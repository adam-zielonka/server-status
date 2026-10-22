package collector

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"math"
	"os"
	"os/user"
	"path/filepath"
	"sort"
	"strconv"
	"strings"
	"time"

	"golang.org/x/sys/unix"
)

const properties = "Id,LoadState,ActiveState,SubState,Result,NRestarts,ExecMainStatus,ActiveEnterTimestampMonotonic,ExecMainStartTimestamp,ExecMainExitTimestamp,LastTriggerUSec,NextElapseUSecRealtime"

func (s sampler) systemdProperties(ctx context.Context, item Unit, timer string) (map[string]string, error) {
	unit := item.Unit
	if timer != "" {
		unit = timer
	}
	if !unitPattern.MatchString(unit) || item.User != "" && !userPattern.MatchString(item.User) {
		return nil, errQuery
	}
	args := []string{"/usr/bin/systemctl"}
	env := map[string]string{"LC_ALL": "C", "TZ": "UTC"}
	if item.User != "" {
		account, err := user.Lookup(item.User)
		if err != nil {
			return nil, errQuery
		}
		env["XDG_RUNTIME_DIR"] = "/run/user/" + account.Uid
		env["DBUS_SESSION_BUS_ADDRESS"] = "unix:path=" + env["XDG_RUNTIME_DIR"] + "/bus"
		args = append(args, "--user")
		if account.Uid != strconv.Itoa(os.Geteuid()) {
			args = append([]string{"/usr/sbin/runuser", "-u", item.User, "--"}, args...)
		}
	}
	args = append(args, "show", unit, "--property="+properties)
	body, err := s.query(ctx, args, 12*time.Second, env)
	if err != nil {
		return nil, errQuery
	}
	props := keyValues(string(body), "=")
	if props["LoadState"] != "loaded" {
		return nil, errQuery
	}
	return props, nil
}

func bootSeconds() (float64, error) {
	var clock unix.Timespec
	if err := unix.ClockGettime(unix.CLOCK_BOOTTIME, &clock); err != nil {
		return 0, err
	}
	return float64(clock.Sec) + float64(clock.Nsec)/1e9, nil
}

func (s sampler) services(ctx context.Context, items []Unit, previous []row) []row {
	known := byName(previous, "id")
	result := []row{}
	for _, item := range items {
		scope, owner := "system", "system"
		if item.User != "" {
			scope, owner = "user", item.User
		}
		id := owner + ":" + item.Unit
		name := item.Name
		if name == "" {
			name = item.Unit
		}
		old := known[id]
		entry := row{"id": id, "name": name, "unit": item.Unit, "scope": scope, "state": "unknown", "last_error": old["last_error"], "last_error_at": old["last_error_at"]}
		p, err := s.systemdProperties(ctx, item, "")
		if err != nil || p["ActiveState"] == "" {
			entry["error"] = "Service state is unavailable"
		} else {
			code, e1 := integerProperty(p, "ExecMainStatus")
			restarts, e2 := integerProperty(p, "NRestarts")
			active, e3 := integerProperty(p, "ActiveEnterTimestampMonotonic")
			boot, e4 := bootSeconds()
			if e1 != nil || e2 != nil || e3 != nil || e4 != nil {
				entry["error"] = "Service state is unavailable"
			} else {
				entry["state"], entry["substate"], entry["result"] = p["ActiveState"], nullable(p["SubState"]), resultProperty(p)
				entry["restarts"], entry["exit_status"], entry["uptime_seconds"] = restarts, code, nil
				if active > 0 && p["ActiveState"] == "active" {
					entry["uptime_seconds"] = max(0, int(boot-float64(active)/1e6))
				}
				if result := resultProperty(p); result != "success" && result != "unknown" {
					entry["last_error"] = fmt.Sprintf("%s (exit status %d)", result, code)
					entry["last_error_at"] = p["ExecMainExitTimestamp"]
					if p["ExecMainExitTimestamp"] == "" {
						entry["last_error_at"] = iso(time.Now())
					}
				}
			}
		}
		result = append(result, entry)
	}
	return result
}

func integerProperty(p map[string]string, key string) (int64, error) {
	if p[key] == "" {
		return 0, nil
	}
	return strconv.ParseInt(p[key], 10, 64)
}
func resultProperty(p map[string]string) string {
	if p["Result"] == "" {
		return "unknown"
	}
	return p["Result"]
}

func (s sampler) directories(ctx context.Context, items []Directory, previous []row, now time.Time, interval int) []row {
	known := byName(previous, "name")
	result := []row{}
	for _, item := range items {
		old := known[item.Name]
		if at := timestamp(old["collected_at"]); !at.IsZero() && now.Sub(at) < time.Duration(interval)*time.Second {
			result = append(result, old)
			continue
		}
		entry := row{"name": item.Name, "bytes": old["bytes"], "collected_at": old["collected_at"]}
		body, err := s.query(ctx, []string{"/usr/bin/du", "-sx", "-B1", "--", item.Path}, 20*time.Second, nil)
		fields := strings.Fields(string(body))
		var size int64
		if err == nil && len(fields) > 0 {
			size, err = strconv.ParseInt(fields[0], 10, 64)
		} else {
			err = errQuery
		}
		if err != nil || size < 0 {
			entry["error"] = "Directory size is unavailable; previous sample retained"
		} else {
			entry["bytes"], entry["collected_at"] = size, iso(now)
		}
		result = append(result, entry)
	}
	return result
}

func (s sampler) systemdJob(ctx context.Context, item Job, old row) row {
	entry := row{"name": item.Name, "kind": "systemd", "category": item.category(), "status": "unknown", "last_success_at": old["last_success_at"], "max_age_seconds": item.maxAge()}
	p, err := s.systemdProperties(ctx, item.Unit, "")
	if err != nil {
		entry["error"] = "Task state is unavailable"
		return entry
	}
	end, start := timestamp(p["ExecMainExitTimestamp"]), timestamp(p["ExecMainStartTimestamp"])
	running := (p["ActiveState"] == "activating" || p["ActiveState"] == "active") && (end.IsZero() || !start.IsZero() && start.After(end))
	status := "unknown"
	if running {
		status = "running"
	} else if !end.IsZero() && p["Result"] == "success" {
		status = "success"
	} else if !end.IsZero() {
		status = "failure"
	}
	entry["status"], entry["last_run_at"], entry["completed_at"] = status, timeValue(start), timeValue(end)
	if !end.IsZero() && p["Result"] == "success" && !running {
		entry["last_success_at"] = iso(end)
	}
	if status == "failure" {
		code, err := integerProperty(p, "ExecMainStatus")
		if err != nil {
			entry["error"] = "Task state is unavailable"
			return entry
		}
		entry["last_error"] = fmt.Sprintf("%s (exit status %d)", resultProperty(p), code)
	}
	if item.Timer != "" {
		timer, err := s.systemdProperties(ctx, item.Unit, item.Timer)
		if err != nil {
			entry["error"] = "Task state is unavailable"
		} else {
			entry["next_run_at"], entry["timer_state"] = timeValue(timestamp(timer["NextElapseUSecRealtime"])), nullable(timer["ActiveState"])
		}
	}
	return entry
}

type workflowRun struct {
	Status     string `json:"status"`
	Conclusion string `json:"conclusion"`
	CreatedAt  string `json:"createdAt"`
	UpdatedAt  string `json:"updatedAt"`
	URL        string `json:"url"`
}

func (s sampler) githubJob(ctx context.Context, item Job, old row, now time.Time, interval int) row {
	if at := timestamp(old["checked_at"]); !at.IsZero() && now.Sub(at) < time.Duration(interval)*time.Second {
		return old
	}
	entry := row{"name": item.Name, "kind": "github", "category": item.category(), "status": "unknown", "last_success_at": old["last_success_at"], "max_age_seconds": item.maxAge(), "checked_at": iso(now)}
	args := []string{"/usr/bin/gh", "run", "list", "--repo", item.Repository, "--workflow", item.Workflow, "--json", "status,conclusion,createdAt,updatedAt,url"}
	env := map[string]string{"GH_CONFIG_DIR": "/root/.config/gh", "GH_PROMPT_DISABLED": "1", "LC_ALL": "C"}
	get := func(extra ...string) ([]workflowRun, error) {
		body, err := s.query(ctx, append(append([]string{}, args...), extra...), 20*time.Second, env)
		var runs []workflowRun
		if err != nil || json.Unmarshal(body, &runs) != nil {
			return nil, errQuery
		}
		return runs, nil
	}
	runs, err := get("--limit", "20")
	if err != nil {
		entry["error"] = "Workflow metadata is unavailable"
		return entry
	}
	if len(runs) == 0 {
		entry["error"] = "No workflow runs are available"
		return entry
	}
	latest := runs[0]
	status := "running"
	if latest.Status == "completed" {
		status = "failure"
		if latest.Conclusion == "success" {
			status = "success"
		}
	}
	entry["status"], entry["last_run_at"], entry["source_url"], entry["completed_at"] = status, nullable(latest.CreatedAt), nullable(latest.URL), nil
	if latest.Status == "completed" {
		entry["completed_at"] = nullable(latest.UpdatedAt)
	}
	if status == "failure" {
		conclusion := latest.Conclusion
		if conclusion == "" {
			conclusion = "unknown"
		}
		entry["last_error"] = "Workflow conclusion: " + conclusion
	}
	var success *workflowRun
	for i := range runs {
		if runs[i].Conclusion == "success" {
			success = &runs[i]
			break
		}
	}
	if success == nil {
		older, err := get("--status", "success", "--limit", "1")
		if err != nil {
			entry["error"] = "Workflow metadata is unavailable"
			return entry
		}
		if len(older) > 0 {
			success = &older[0]
		}
	}
	if success != nil {
		entry["last_success_at"] = nullable(success.UpdatedAt)
	}
	return entry
}

const databaseQuery = "SELECT json_build_object('bytes', pg_database_size(current_database()), 'connections', (SELECT count(*) FROM pg_stat_activity WHERE datname=current_database()), 'tls', COALESCE((SELECT ssl FROM pg_stat_ssl WHERE pid=pg_backend_pid()), false))"

func (s sampler) databases(ctx context.Context, items []Database) []row {
	result := []row{}
	for _, item := range items {
		entry := row{"name": item.Name, "status": "unknown", "checked_at": iso(time.Now()), "limit_bytes": item.LimitBytes}
		start := time.Now()
		env := map[string]string{"PGSERVICEFILE": item.ServiceFile, "PGCONNECT_TIMEOUT": "5", "PGOPTIONS": "-c default_transaction_read_only=on -c statement_timeout=5000"}
		body, err := s.query(ctx, []string{"/usr/bin/psql", "--no-psqlrc", "--no-password", "--dbname=service=" + item.Service, "-At", "-c", databaseQuery}, 12*time.Second, env)
		var data struct {
			Bytes       *int64 `json:"bytes"`
			Connections *int   `json:"connections"`
			TLS         *bool  `json:"tls"`
		}
		if err != nil || json.Unmarshal(body, &data) != nil || data.Bytes == nil || data.Connections == nil || data.TLS == nil || *data.Bytes < 0 || *data.Connections < 0 || item.LimitBytes <= 0 {
			entry["error"] = "Database metrics are unavailable"
		} else {
			size := *data.Bytes
			percent := round(float64(size)/float64(item.LimitBytes)*100, 2)
			status := "healthy"
			if percent >= 95 {
				status = "failure"
			} else if percent >= 80 {
				status = "warning"
			}
			entry["bytes"], entry["available_bytes"], entry["used_percent"] = size, max(int64(0), item.LimitBytes-size), percent
			entry["connections"], entry["tls"], entry["latency_ms"], entry["status"] = *data.Connections, *data.TLS, math.Round(float64(time.Since(start))/float64(time.Millisecond)), status
		}
		result = append(result, entry)
	}
	return result
}

func (s sampler) tailscale(ctx context.Context) row {
	unknown := row{"state": "unknown", "online": false, "error": "Tailscale state is unavailable"}
	body, err := s.query(ctx, []string{"/usr/bin/tailscale", "status", "--json"}, 12*time.Second, nil)
	var status struct {
		BackendState string
		TailscaleIPs []string
		Self         *struct {
			Online                       bool
			HostName, DNSName, KeyExpiry string
		}
	}
	if err != nil || json.Unmarshal(body, &status) != nil {
		return unknown
	}
	body, err = s.query(ctx, []string{"/usr/bin/tailscale", "serve", "status", "--json"}, 12*time.Second, nil)
	var serve struct {
		Web         map[string]struct{ Handlers map[string]json.RawMessage }
		AllowFunnel map[string]bool
	}
	if err != nil || json.Unmarshal(body, &serve) != nil {
		return unknown
	}
	services := []row{}
	addresses := make([]string, 0, len(serve.Web))
	for address := range serve.Web {
		addresses = append(addresses, address)
	}
	sort.Strings(addresses)
	for _, address := range addresses {
		web := serve.Web[address]
		paths := make([]string, 0, len(web.Handlers))
		for path := range web.Handlers {
			paths = append(paths, path)
		}
		sort.Strings(paths)
		services = append(services, row{"address": address, "paths": paths, "funnel": serve.AllowFunnel[address]})
	}
	if status.BackendState == "" {
		status.BackendState = "unknown"
	}
	entry := row{"state": status.BackendState, "online": false, "hostname": nil, "dns_name": "", "addresses": status.TailscaleIPs, "expires_at": nil, "key_days_remaining": nil, "services": services}
	if status.TailscaleIPs == nil {
		entry["addresses"] = []string{}
	}
	if status.Self != nil {
		own := status.Self
		entry["online"], entry["hostname"], entry["dns_name"] = own.Online, nullable(own.HostName), strings.TrimRight(own.DNSName, ".")
		expiry := timestamp(own.KeyExpiry)
		if !strings.HasPrefix(own.KeyExpiry, "0001-") && !expiry.IsZero() {
			entry["expires_at"], entry["key_days_remaining"] = iso(expiry), math.Floor(time.Until(expiry).Hours()/24)
		}
	}
	return entry
}

func optionalInt(path string) *int64 {
	body, err := os.ReadFile(path)
	if err != nil {
		return nil
	}
	value, err := strconv.ParseInt(strings.TrimSpace(string(body)), 10, 64)
	if err != nil || value < 0 {
		return nil
	}
	return &value
}
func cpusetCount(value string) int {
	count := 0
	for _, part := range strings.Split(strings.TrimSpace(value), ",") {
		if part == "" {
			continue
		}
		pair := strings.Split(part, "-")
		if len(pair) > 2 {
			return 0
		}
		first, err := strconv.Atoi(pair[0])
		if err != nil || first < 0 {
			return 0
		}
		last, err := strconv.Atoi(pair[len(pair)-1])
		if err != nil || last < first {
			return 0
		}
		count += last - first + 1
	}
	return count
}
func numericFields(path string) map[string]int64 {
	body, err := os.ReadFile(path)
	result := map[string]int64{}
	if err != nil {
		return result
	}
	for _, line := range strings.Split(string(body), "\n") {
		fields := strings.Fields(line)
		if len(fields) >= 2 {
			if n, err := strconv.ParseInt(fields[1], 10, 64); err == nil {
				result[strings.TrimSuffix(fields[0], ":")] = n
			}
		}
	}
	return result
}
func (s sampler) container(ctx context.Context, ticks float64) (row, error) {
	root := "/sys/fs/cgroup"
	body, _ := os.ReadFile(filepath.Join(root, "cpuset.cpus.effective"))
	cpuset := strings.TrimSpace(string(body))
	cpus := cpusetCount(cpuset)
	if cpus == 0 {
		var set unix.CPUSet
		if unix.SchedGetaffinity(0, &set) == nil {
			cpus = set.Count()
		}
	}
	if cpus < 1 {
		return nil, errors.New("CPU allocation is unavailable")
	}
	var quota any
	effective := float64(cpus)
	body, _ = os.ReadFile(filepath.Join(root, "cpu.max"))
	fields := strings.Fields(string(body))
	if len(fields) == 2 && fields[0] != "max" {
		maximum, e1 := strconv.ParseFloat(fields[0], 64)
		period, e2 := strconv.ParseFloat(fields[1], 64)
		if e1 == nil && e2 == nil && maximum > 0 && period > 0 {
			q := maximum / period
			quota = q
			effective = math.Min(effective, q)
		}
	}
	visible := numericFields("/proc/meminfo")["MemTotal"] * 1024
	if visible <= 0 {
		return nil, errors.New("visible memory is unavailable")
	}
	current := optionalInt(filepath.Join(root, "memory.current"))
	var working any
	stats := numericFields(filepath.Join(root, "memory.stat"))
	if current != nil && len(stats) > 0 {
		working = max(int64(0), *current-stats["inactive_file"])
	}
	boot, err := bootSeconds()
	if err != nil {
		return nil, err
	}
	body, err = os.ReadFile("/proc/1/stat")
	if err != nil {
		return nil, err
	}
	init, err := processStat(string(body))
	if err != nil {
		return nil, err
	}
	virt := "none or undetected"
	if body, err := s.query(ctx, []string{"/usr/bin/systemd-detect-virt"}, 3*time.Second, nil); err == nil {
		virt = strings.TrimSpace(string(body))
	}
	return row{"virtualization": virt, "cpu_count": cpus, "cpuset": cpuset, "cpu_quota_cores": quota, "effective_cpu_cores": effective, "memory_limit_bytes": optionalInt(filepath.Join(root, "memory.max")), "visible_memory_bytes": visible, "memory_current_bytes": current, "memory_working_set_bytes": working, "container_uptime_seconds": max(0, int(boot-float64(init.Start)/ticks)), "host_uptime_seconds": int(boot), "limit_scope": "Visible cgroup subtree; limits imposed by ancestors may be hidden"}, nil
}

package collector

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"math"
	"net"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"reflect"
	"strconv"
	"strings"
	"testing"
	"time"

	"golang.org/x/sys/unix"
)

func TestProcessGroups(t *testing.T) {
	proc := func(parent, start int, exe, scope string) process {
		p := process{Name: exe, Executable: exe, PPID: parent, Start: uint64(start), RSS: 10, ServiceKey: scope}
		if scope != "" {
			p.Service = filepath.Base(scope)
		}
		return p
	}
	type group struct {
		members  []int
		kind     string
		browsers int
	}
	for _, tc := range []struct {
		name      string
		processes map[int]process
		groups    map[int]group
	}{
		{
			"service identity includes scope",
			map[int]process{
				10: proc(1, 10, "node", "system/example.service"),
				11: proc(10, 11, "worker", "system/example.service"),
				20: proc(10, 20, "chrome", "system/example.service"),
				21: proc(20, 21, "chrome", "system/example.service"),
				30: proc(10, 30, "chrome", "system/example.service"),
				40: proc(1, 40, "node", "user/example.service"),
			},
			map[int]group{10: {[]int{10, 11, 20, 21, 30}, "service", 2}, 40: {[]int{40}, "service", 0}},
		},
		{
			"standalone browser instances",
			map[int]process{10: proc(1, 10, "chrome", ""), 11: proc(10, 11, "chrome", ""), 20: proc(1, 20, "chrome", ""), 21: proc(20, 21, "chrome", "")},
			map[int]group{10: {[]int{10, 11}, "browser", 1}, 20: {[]int{20, 21}, "browser", 1}},
		},
		{
			"browsers belong to their launching application",
			map[int]process{10: proc(1, 10, "node", ""), 20: proc(10, 20, "chrome", ""), 21: proc(20, 21, "chrome", ""), 30: proc(10, 30, "chrome", ""), 40: proc(1, 40, "chrome", "")},
			map[int]group{10: {[]int{10, 20, 21, 30}, "process", 2}, 40: {[]int{40}, "browser", 1}},
		},
		{
			"same executable groups only connected ancestors",
			map[int]process{10: proc(1, 10, "postgres", ""), 11: proc(10, 11, "postgres", ""), 20: proc(1, 20, "postgres", ""), 30: proc(10, 30, "worker", "")},
			map[int]group{10: {[]int{10, 11}, "process", 0}, 20: {[]int{20}, "process", 0}, 30: {[]int{30}, "process", 0}},
		},
		{
			"missing ancestors stay separate",
			map[int]process{12: proc(11, 12, "chrome", ""), 20: proc(1, 20, "chrome", ""), 21: proc(20, 21, "chrome", "")},
			map[int]group{12: {[]int{12}, "browser", 1}, 20: {[]int{20, 21}, "browser", 1}},
		},
	} {
		t.Run(tc.name, func(t *testing.T) {
			result := topProcesses(tc.processes, tc.processes, 1, 100)
			groups := result["groups_memory"].([]row)
			if len(groups) != len(tc.groups) {
				t.Fatalf("got %d groups, want %d", len(groups), len(tc.groups))
			}
			seen := map[int]bool{}
			for _, actual := range groups {
				expected, ok := tc.groups[actual["pid"].(int)]
				if !ok {
					t.Fatalf("unexpected group PID %v", actual["pid"])
				}
				if !reflect.DeepEqual(actual["member_pids"], expected.members) || actual["group_kind"] != expected.kind || actual["browser_instance_count"] != expected.browsers {
					t.Fatalf("unexpected group membership or origin: %v", actual)
				}
				if actual["rss_bytes"] != int64(len(expected.members)*10) {
					t.Fatal("group memory does not match its members")
				}
				for _, pid := range actual["member_pids"].([]int) {
					if seen[pid] {
						t.Fatal("process counted twice")
					}
					seen[pid] = true
				}
			}
			if len(seen) != len(tc.processes) {
				t.Fatal("process missing from groups")
			}
		})
	}
}

func TestProcessCPUSampling(t *testing.T) {
	for _, tc := range []struct {
		name          string
		before, after process
		want          any
	}{
		{"same process", process{Start: 1, Ticks: 0}, process{Start: 1, Ticks: 25}, float64(25)},
		{"reused PID", process{Start: 1, Ticks: 100}, process{Start: 2, Ticks: 10000}, nil},
		{"regressed counter", process{Start: 1, Ticks: 100}, process{Start: 1, Ticks: 10}, float64(0)},
	} {
		t.Run(tc.name, func(t *testing.T) {
			result := topProcesses(map[int]process{10: tc.before}, map[int]process{10: tc.after}, 1, 100)
			if got := result["top_cpu"].([]row)[0]["cpu_percent"]; got != tc.want {
				t.Fatalf("CPU got %v, want %v", got, tc.want)
			}
		})
	}
	after := map[int]process{10: {Executable: "chrome", Start: 1, Ticks: 10}, 11: {Executable: "chrome", PPID: 10, Start: 1, Ticks: 20}}
	first := map[int]process{10: {Start: 1, Ticks: 0}, 11: {Start: 1, Ticks: 0}}
	result := topProcesses(first, after, 1, 100)
	if result["groups_cpu"].([]row)[0]["cpu_percent"] != float64(30) {
		t.Fatal("group CPU should sum complete samples")
	}
	delete(first, 11)
	result = topProcesses(first, after, 1, 100)
	if result["groups_cpu"].([]row)[0]["cpu_percent"] != nil {
		t.Fatal("incomplete group CPU must be unknown")
	}
	p := after[10]
	p.PPID = 11
	after[10] = p
	result = topProcesses(first, after, 1, 100)
	if len(result["top_memory"].([]row)) != 2 {
		t.Fatal("cyclic ancestry lost processes")
	}
}

func TestCompleteRankingsAndStatParsing(t *testing.T) {
	items := map[int]process{}
	for pid := 10; pid < 135; pid++ {
		items[pid] = process{Name: "worker", Executable: "worker", PPID: 1, Start: uint64(pid), RSS: int64(pid), Service: "example.service", ServiceKey: "system/example.service"}
	}
	for pid := 200; pid < 215; pid++ {
		items[pid] = process{Name: "worker", Executable: "worker", PPID: 1, Start: uint64(pid), RSS: int64(pid)}
	}
	result := topProcesses(items, items, 1, 100)
	if len(result["top_memory"].([]row)) != 140 || len(result["groups_memory"].([]row)) != 16 {
		t.Fatal("process rankings were truncated")
	}
	for _, g := range result["groups_memory"].([]row) {
		if g["group_kind"] == "service" && len(g["member_pids"].([]int)) != 125 {
			t.Fatal("group members were truncated")
		}
	}
	fields := make([]string, 22)
	for i := range fields {
		fields[i] = "0"
	}
	fields[0] = "S"
	fields[11] = "10"
	fields[12] = "5"
	fields[19] = "123"
	fields[21] = "2"
	p, err := processStat("42 (example (worker)) " + strings.Join(fields, " "))
	if err != nil || p.Name != "example (worker)" || p.Ticks != 15 || p.Start != 123 || p.RSS != int64(2*os.Getpagesize()) {
		t.Fatalf("invalid stat: %+v %v", p, err)
	}
	for _, bad := range []string{"", "42 broken", "42 (broken) S 0"} {
		if _, err := processStat(bad); err == nil {
			t.Fatal("accepted malformed proc stat")
		}
	}
	if cpusetCount("0-3,8,10-11") != 7 || cpusetCount("") != 0 {
		t.Fatal("invalid CPU set count")
	}
}

func queryResult(body string) queryFunc {
	return func(context.Context, []string, time.Duration, map[string]string) ([]byte, error) {
		return []byte(body), nil
	}
}
func queryFailure(context.Context, []string, time.Duration, map[string]string) ([]byte, error) {
	return nil, errors.New("private-sentinel")
}

func TestTaskHistoryAndDirectoryFailure(t *testing.T) {
	ctx := context.Background()
	props := "LoadState=loaded\nExecMainStartTimestamp=Mon 2026-01-05 01:00:00 UTC\nExecMainExitTimestamp=Mon 2026-01-05 01:01:00 UTC\nActiveState=inactive\nResult=success\n"
	job := Job{Unit: Unit{Name: "Maintenance", Unit: "example.service"}, Kind: "systemd"}
	result := (sampler{query: queryResult(props)}).systemdJob(ctx, job, row{})
	if result["status"] != "success" || result["last_success_at"] != "2026-01-05T01:01:00Z" {
		t.Fatalf("inactive oneshot misclassified: %v", result)
	}
	props = strings.Replace(props, "Result=success", "Result=exit-code\nExecMainStatus=1", 1)
	result = (sampler{query: queryResult(props)}).systemdJob(ctx, job, row{"last_success_at": "2026-01-04T00:00:00Z"})
	if result["status"] != "failure" || result["last_success_at"] != "2026-01-04T00:00:00Z" {
		t.Fatal("known successful task history lost")
	}
	s := sampler{query: queryFailure}
	for _, unit := range []string{"--help", "--help.service"} {
		if _, err := s.systemdProperties(ctx, Unit{Unit: unit}, ""); err == nil {
			t.Fatal("option used as unit")
		}
	}
	now := time.Unix(1000, 0)
	dirs := s.directories(ctx, []Directory{{Name: "Data", Path: "/srv/example"}}, nil, now, 900)
	if dirs[0]["bytes"] != nil || dirs[0]["error"] == nil {
		t.Fatal("failed directory scan reported zero")
	}
	old := row{"name": "Data", "bytes": float64(123), "collected_at": iso(now.Add(-time.Hour))}
	dirs = s.directories(ctx, []Directory{{Name: "Data", Path: "/srv/example"}}, []row{old}, now, 900)
	if dirs[0]["bytes"] != float64(123) || dirs[0]["collected_at"] != old["collected_at"] {
		t.Fatal("failed scan discarded previous sample")
	}
}

func TestWorkflowAndTailscaleAllowlist(t *testing.T) {
	ctx := context.Background()
	runs := `[{"status":"completed","conclusion":"failure","updatedAt":"2026-01-05T01:00:00Z","createdAt":"2026-01-05T00:00:00Z","url":"https://github.com/example/project/actions/runs/2","secret":"private-sentinel"},{"status":"completed","conclusion":"success","updatedAt":"2026-01-04T01:00:00Z"}]`
	s := sampler{query: func(ctx context.Context, args []string, timeout time.Duration, env map[string]string) ([]byte, error) {
		if !strings.Contains(strings.Join(args, " "), "status,conclusion,createdAt,updatedAt,url") || env["GH_PROMPT_DISABLED"] != "1" {
			t.Fatal("workflow query must request metadata only")
		}
		return []byte(runs), nil
	}}
	result := s.githubJob(ctx, Job{Unit: Unit{Name: "Backup"}, Kind: "github", Repository: "example/project", Workflow: "backup.yml"}, row{}, time.Now(), 300)
	if result["status"] != "failure" || result["last_success_at"] != "2026-01-04T01:00:00Z" {
		t.Fatalf("invalid workflow metadata: %v", result)
	}
	body, _ := json.Marshal(result)
	if strings.Contains(string(body), "private-sentinel") {
		t.Fatal("workflow leaked non-allowlisted data")
	}
	calls := 0
	s.query = func(context.Context, []string, time.Duration, map[string]string) ([]byte, error) {
		calls++
		if calls == 1 {
			return []byte(`{"BackendState":"Running","TailscaleIPs":["100.64.0.10"],"Self":{"Online":true,"HostName":"example-node","KeyExpiry":"0001-01-01T00:00:00Z","PrivateKey":"private-sentinel"},"Peer":{"private-peer":{}},"User":{"private-user":{}}}`), nil
		}
		return []byte(`{"Web":{"example.ts.net:443":{"Handlers":{"/":{"Proxy":"http://private-target"}}}}}`), nil
	}
	result = s.tailscale(ctx)
	body, _ = json.Marshal(result)
	if result["expires_at"] != nil || strings.Contains(string(body), "private-") {
		t.Fatalf("tailscale leaked fields: %s", body)
	}
}

func TestDatabaseMetricsReadOnlyAndFailure(t *testing.T) {
	item := Database{Name: "Database", Service: "example", ServiceFile: "/private/service", LimitBytes: 200000000}
	s := sampler{query: func(ctx context.Context, args []string, timeout time.Duration, env map[string]string) ([]byte, error) {
		if !strings.Contains(env["PGOPTIONS"], "default_transaction_read_only=on") || !strings.Contains(env["PGOPTIONS"], "statement_timeout=5000") || env["PGCONNECT_TIMEOUT"] != "5" {
			t.Fatal("database query must have read-only transaction and timeouts")
		}
		if strings.Contains(strings.Join(args, " "), item.ServiceFile) {
			t.Fatal("private service file must not enter arguments")
		}
		return []byte(`{"bytes":170000000,"connections":3,"tls":true,"password":"private-sentinel"}`), nil
	}}
	result := s.databases(context.Background(), []Database{item})[0]
	if result["status"] != "warning" || result["used_percent"] != float64(85) || result["available_bytes"] != int64(30000000) {
		t.Fatalf("invalid database metrics: %v", result)
	}
	body, _ := json.Marshal(result)
	if strings.Contains(string(body), "private-sentinel") {
		t.Fatal("database leaked unknown fields")
	}
	s.query = queryFailure
	result = s.databases(context.Background(), []Database{item})[0]
	if result["status"] != "unknown" || result["bytes"] != nil {
		t.Fatal("failed database reported zero usage")
	}
}

func TestTunnelMetricsAndReadiness(t *testing.T) {
	metrics := "cloudflared_tunnel_ha_connections 4\ncloudflared_tunnel_total_requests 12\ncloudflared_tunnel_request_errors 2\ncloudflared_tunnel_server_locations{connection_id=\"private-sentinel\",edge_location=\"ams01\"} 1\ncloudflared_tunnel_server_locations{edge_location=\"fra01\"} 0\n"
	parsed, err := tunnelMetrics(metrics)
	if err != nil || parsed["connections"] != int64(4) || !reflect.DeepEqual(parsed["locations"], []string{"ams01"}) {
		t.Fatalf("invalid metrics %v %v", parsed, err)
	}
	body, _ := json.Marshal(parsed)
	if strings.Contains(string(body), "private-sentinel") {
		t.Fatal("tunnel leaked labels")
	}
	for _, bad := range []string{"other_metric 4", "cloudflared_tunnel_ha_connections NaN", "cloudflared_tunnel_ha_connections -1", "cloudflared_tunnel_ha_connections 1.5"} {
		if _, err := tunnelMetrics(bad); err == nil {
			t.Fatal("accepted invalid tunnel metrics")
		}
	}
	for _, tc := range []struct {
		connections, ready int
		want               string
	}{{4, 200, "healthy"}, {2, 200, "degraded"}, {0, 503, "failure"}, {4, 503, "failure"}, {0, 200, "unknown"}, {4, 302, "unknown"}} {
		t.Run(fmt.Sprintf("%d-%d", tc.connections, tc.ready), func(t *testing.T) {
			server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
				if r.URL.Path == "/ready" {
					w.WriteHeader(tc.ready)
					return
				}
				fmt.Fprintf(w, "cloudflared_tunnel_ha_connections %d\n", tc.connections)
			}))
			defer server.Close()
			_, port, _ := net.SplitHostPort(strings.TrimPrefix(server.URL, "http://"))
			n, _ := strconv.Atoi(port)
			item := Tunnel{Name: "Example", MetricsPort: n}
			result := collectTunnels(context.Background(), []Tunnel{item})[0]
			if result["status"] != tc.want {
				t.Fatalf("got %s, want %s", result["status"], tc.want)
			}
			if tc.want == "unknown" && result["connections"] != nil {
				t.Fatal("unknown tunnel published misleading metrics")
			}
		})
	}
}

func TestAtomicSnapshotsHistoryAndLock(t *testing.T) {
	dir := t.TempDir()
	path := filepath.Join(dir, "snapshot.json")
	if err := atomicJSON(path, row{"generation": 1}, 0640); err != nil {
		t.Fatal(err)
	}
	if atomicJSON(path, row{"value": math.NaN()}, 0600) == nil {
		t.Fatal("invalid JSON committed")
	}
	body, err := os.ReadFile(path)
	if err != nil || string(body) != "{\"generation\":1}\n" {
		t.Fatal("old snapshot was not preserved")
	}
	stat, _ := os.Stat(path)
	if stat.Mode().Perm() != 0640 {
		t.Fatal("snapshot permissions changed")
	}
	entries, _ := os.ReadDir(dir)
	if len(entries) != 1 {
		t.Fatal("temporary file leaked")
	}
	now := time.Unix(100000, 0)
	history := retainHistory([]row{{"at": iso(time.Unix(1, 0))}, {"at": iso(now.Add(-time.Minute))}, {"at": iso(now.Add(time.Second))}}, row{"at": iso(now)}, now)
	if len(history) != 2 {
		t.Fatal("history retained old/future samples")
	}
	cfg := &Config{SnapshotFile: path, StateFile: filepath.Join(dir, "state.json"), SampleInterval: 60, DirectoryInterval: 900, GitHubInterval: 300}
	lock, err := os.OpenFile(cfg.StateFile+".lock", os.O_CREATE|os.O_RDWR, 0600)
	if err != nil {
		t.Fatal(err)
	}
	defer lock.Close()
	if err := unix.Flock(int(lock.Fd()), unix.LOCK_EX|unix.LOCK_NB); err != nil {
		t.Fatal(err)
	}
	defer unix.Flock(int(lock.Fd()), unix.LOCK_UN)
	if err := Run(context.Background(), cfg); err != nil {
		t.Fatal("concurrent collection should skip without error")
	}
	if body, _ := os.ReadFile(path); string(body) != "{\"generation\":1}\n" {
		t.Fatal("concurrent collector changed snapshot")
	}
}

func TestReadOnlyCommandErrorsAreBoundedAndPrivate(t *testing.T) {
	_, err := runCommand(context.Background(), []string{"/bin/sh", "-c", "printf private-sentinel; printf private-password >&2; exit 1"}, time.Second, nil)
	if err == nil || strings.Contains(err.Error(), "private-") {
		t.Fatal("command error leaked output")
	}
	output := &boundedOutput{}
	if _, err := output.Write(make([]byte, 4*1024*1024+1)); err == nil {
		t.Fatal("unbounded command output")
	}
}

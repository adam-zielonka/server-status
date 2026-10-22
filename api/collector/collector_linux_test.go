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

func TestProcessParityWithLegacyCollector(t *testing.T) {
	body, err := os.ReadFile("testdata/process-parity.json")
	if err != nil {
		t.Fatal(err)
	}
	var cases []struct {
		Name          string
		First, Second map[int]process
		Elapsed       float64
		ClockTicks    float64 `json:"clock_ticks"`
		Expected      json.RawMessage
	}
	if err := json.Unmarshal(body, &cases); err != nil {
		t.Fatal(err)
	}
	for _, tc := range cases {
		t.Run(tc.Name, func(t *testing.T) {
			got, err := json.Marshal(topProcesses(tc.First, tc.Second, tc.Elapsed, tc.ClockTicks))
			if err != nil {
				t.Fatal(err)
			}
			var actual, want any
			if json.Unmarshal(got, &actual) != nil || json.Unmarshal(tc.Expected, &want) != nil {
				t.Fatal("invalid fixture")
			}
			if !reflect.DeepEqual(actual, want) {
				t.Fatalf("process grouping differs from legacy\ngot: %s\nwant: %s", got, tc.Expected)
			}
		})
	}
}

func TestCompleteRankingsAndStatParsing(t *testing.T) {
	items := map[int]process{}
	for pid := 10; pid < 135; pid++ {
		items[pid] = process{Name: "worker", Executable: "worker", PPID: 1, Start: uint64(pid), RSS: int64(pid), Service: "example.service"}
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

package collector

import (
	"context"
	"encoding/json"
	"os"
	"path/filepath"
	"testing"
	"time"
)

// Export only synthetic inputs assembled through real collector producers.
// CI passes these to the frontend validator without collecting from its host.
func TestFrontendContractFixtures(t *testing.T) {
	now := time.Date(2026, 11, 5, 12, 0, 0, 0, time.UTC)
	for _, unavailable := range []bool{false, true} {
		name := "available"
		if unavailable {
			name = "unavailable"
		}
		t.Run(name, func(t *testing.T) {
			s := sampler{query: func(_ context.Context, args []string, _ time.Duration, _ map[string]string) ([]byte, error) {
				if unavailable {
					return nil, errQuery
				}
				switch args[0] {
				case "/usr/bin/psql":
					return []byte(`{"bytes":1000,"connections":1,"tls":true}`), nil
				case "/usr/bin/du":
					return []byte("2048\t/example\n"), nil
				case "/usr/bin/gh":
					return []byte(`[{"status":"completed","conclusion":"success","createdAt":"2026-11-05T11:00:00Z","updatedAt":"2026-11-05T11:01:00Z","url":"https://github.com/example/project/actions/runs/1"}]`), nil
				case "/usr/bin/systemctl":
					return []byte("LoadState=loaded\nActiveState=inactive\nResult=success\nExecMainStatus=0\nExecMainStartTimestamp=Thu 2026-11-05 11:00:00 UTC\nExecMainExitTimestamp=Thu 2026-11-05 11:01:00 UTC\n"), nil
				case "/usr/bin/tailscale":
					if args[1] == "serve" {
						return []byte(`{"Web":{},"AllowFunnel":{}}`), nil
					}
					return []byte(`{"BackendState":"Running","TailscaleIPs":["100.64.0.10"],"Self":{"Online":true,"HostName":"example","DNSName":"example.test."}}`), nil
				}
				return nil, errQuery
			}}
			ctx := context.Background()
			backup := filepath.Join(t.TempDir(), "backup.json")
			if err := os.WriteFile(backup, []byte(`{"status":"healthy","checked_at":"2026-11-05T12:00:00Z","bytes":1000,"limit_bytes":10000,"latest_backup_bytes":100,"last_success_at":"2026-11-05T11:00:00Z"}`), 0600); err != nil {
				t.Fatal(err)
			}
			if unavailable {
				backup += ".missing"
			}
			processes := map[int]process{10: {Name: "example", Executable: "example", Start: 1, Ticks: 10, RSS: 1024}}
			fixture := row{
				"schema_version": 1, "enabled": true, "collected_at": iso(now), "sample_at": iso(now), "sample_interval_seconds": 60,
				"services":      s.services(ctx, []Unit{{Name: "Example", Unit: "example.service"}}, nil),
				"processes":     topProcesses(processes, processes, 1, 100),
				"container":     row{"virtualization": "example", "cpu_count": 2, "cpuset": "0-1", "cpu_quota_cores": nil, "effective_cpu_cores": 2, "memory_limit_bytes": nil, "visible_memory_bytes": 10000, "memory_current_bytes": nil, "memory_working_set_bytes": nil, "container_uptime_seconds": 100, "host_uptime_seconds": 100, "limit_scope": "synthetic"},
				"tailscale":     s.tailscale(ctx),
				"directories":   s.directories(ctx, []Directory{{Name: "Example", Path: "/example"}}, nil, now, 900),
				"jobs":          []row{s.systemdJob(ctx, Job{Unit: Unit{Name: "Example system task", Unit: "example.service"}, Kind: "systemd"}, nil), s.githubJob(ctx, Job{Unit: Unit{Name: "Example workflow"}, Kind: "github", Repository: "example/project", Workflow: "example.yml"}, nil, now, 300)},
				"databases":     s.databases(ctx, []Database{{Name: "Example database", Service: "example", ServiceFile: "/private/example", LimitBytes: 10000}}),
				"backup_stores": collectBackupStores([]BackupStore{{Name: "Example store", StatusFile: backup, MaxAge: 300}}, now),
				"tunnels":       []row{}, "software": s.software(ctx, &SoftwareConfig{Tools: []SoftwareTool{{Name: "Example CLI", Kind: "npm", Package: "@example/cli", Executable: "/example/cli"}}}, nil, now), "cpu_capacity": row{"peak_cores": 0, "observed_since": nil},
				"history": []row{{"at": iso(now), "cpu_percent": nil, "memory_percent": nil, "disk_percent": 10.0, "cpu_capacity_cores": 2}},
			}
			// Host uptime is not part of the fixture; service observations use a
			// synthetic inactive unit and its uptime remains null.
			body, err := json.Marshal(fixture)
			if err != nil {
				t.Fatal(err)
			}
			if dir := os.Getenv("SERVER_STATUS_CONTRACT_DIR"); dir != "" {
				if err := os.WriteFile(filepath.Join(dir, name+".json"), body, 0600); err != nil {
					t.Fatal(err)
				}
			}
		})
	}
}

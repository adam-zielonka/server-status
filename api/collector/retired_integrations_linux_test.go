package collector

import (
	"context"
	"encoding/json"
	"os"
	"path/filepath"
	"reflect"
	"testing"
	"time"
)

func TestCollectionDropsRetiredQueueWithoutLosingResourceState(t *testing.T) {
	dir := t.TempDir()
	configPath := filepath.Join(dir, "collector.json")
	body, err := json.Marshal(row{
		"snapshot_file":      filepath.Join(dir, "snapshot.json"),
		"state_file":         filepath.Join(dir, "state.json"),
		"cpu_capacity_cores": 1.0,
		"agent_queue":        row{"github_config_file": filepath.Join(dir, "no-longer-present.json")},
	})
	if err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(configPath, body, 0600); err != nil {
		t.Fatal(err)
	}
	cfg, err := Load(configPath)
	if err != nil {
		t.Fatal("old configuration must remain loadable:", err)
	}
	now := time.Now().UTC().Truncate(time.Second)
	point := row{"at": iso(now.Add(-time.Minute)), "cpu_percent": 25.0, "cpu_usage_cores": 0.25, "cpu_capacity_cores": 1.0, "memory_percent": 30.0, "disk_percent": 40.0}
	peak := row{"peak_cores": 100.0, "observed_since": iso(now.Add(-48 * time.Hour))}
	old := row{"history": []row{point}, "cpu_capacity": peak, "agent_queue": row{"fingerprint": "retired-example"}}
	if err := atomicJSON(cfg.StateFile, old, 0600); err != nil {
		t.Fatal(err)
	}
	if err := atomicJSON(cfg.SnapshotFile, old, 0640); err != nil {
		t.Fatal(err)
	}
	sample := sampler{query: func(_ context.Context, args []string, _ time.Duration, _ map[string]string) ([]byte, error) {
		if len(args) != 1 || args[0] != "/usr/bin/systemd-detect-virt" {
			t.Errorf("unexpected command after queue removal: %v", args)
		}
		return []byte("lxc\n"), nil
	}}
	for range 2 {
		if err := sample.collect(context.Background(), cfg); err != nil {
			t.Fatal(err)
		}
		for _, path := range []string{cfg.StateFile, cfg.SnapshotFile} {
			saved := readObject(path)
			if _, exists := saved["agent_queue"]; exists {
				t.Fatal("retired queue was republished")
			}
			if !reflect.DeepEqual(rows(saved["history"])[0], point) || !reflect.DeepEqual(saved["cpu_capacity"], map[string]any(peak)) {
				t.Fatal("existing resource history or CPU peak changed")
			}
		}
	}
}

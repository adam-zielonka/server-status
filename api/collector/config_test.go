package collector

import (
	"os"
	"path/filepath"
	"strings"
	"testing"
)

func TestCollectorConfiguration(t *testing.T) {
	load := func(body string) (*Config, error) {
		t.Helper()
		path := filepath.Join(t.TempDir(), "collector.json")
		if err := os.WriteFile(path, []byte(body), 0600); err != nil {
			t.Fatal(err)
		}
		return Load(path)
	}
	base := `{"snapshot_file":"/private/snapshot","state_file":"/private/state"}`
	cfg, err := load(base)
	if err != nil {
		t.Fatal(err)
	}
	if cfg.SampleInterval != 60 || cfg.DirectoryInterval != 900 || cfg.GitHubInterval != 300 {
		t.Fatal("legacy defaults changed")
	}
	for _, body := range []string{"null", "[]", "{}", strings.Replace(base, "/private/snapshot", "relative", 1), strings.Replace(base, "/private/snapshot", "/private/state", 1),
		strings.TrimSuffix(base, "}") + `,"units":[{"unit":"--help.service"}]}`,
		strings.TrimSuffix(base, "}") + `,"tunnels":[{"name":"Example","metrics_port":true}]}`,
		strings.TrimSuffix(base, "}") + `,"tunnels":[{"name":"Example","metrics_port":20241,"expected_connections":0}]}`,
		strings.TrimSuffix(base, "}") + `,"tunnels":[{"name":"Example","metrics_port":20241},{"name":"Other","metrics_port":20241}]}`,
		strings.TrimSuffix(base, "}") + `,"tunnels":[{"name":"Example","metrics_port":20241,"hostnames":["https://example.com/private"]}]}`,
		strings.TrimSuffix(base, "}") + `,"databases":[{"name":"DB","service":"example","service_file":"/private/service","limit_bytes":true}]}`,
		strings.TrimSuffix(base, "}") + `,"jobs":[{"name":"Backup","kind":"github","repository":"example/project","workflow":"--help"}]}`,
		strings.TrimSuffix(base, "}") + `,"sample_interval_seconds":0}`,
	} {
		if _, err := load(body); err == nil {
			t.Errorf("accepted invalid config: %s", body)
		}
	}
	if _, err := Load(""); err == nil {
		t.Fatal("collector must require explicit config")
	}
	// Public example must remain loadable by the standalone collector.
	if _, err := Load("../../collector/config.example.json"); err != nil {
		t.Fatal(err)
	}
}

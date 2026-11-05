package collector

import (
	"context"
	"reflect"
	"testing"
	"time"
)

func TestConfiguredCommandsPreserveArgumentsAndEnvironment(t *testing.T) {
	cfg := &Config{Commands: map[string]string{"du": "/opt/tools/du", "runuser": "/opt/tools/runuser", "systemctl": "/opt/tools/systemctl", "gh": "/opt/tools/gh"}, GitHubConfigDir: "/private/example-gh"}
	for _, tc := range []struct {
		before, after []string
		github        bool
	}{
		{[]string{"/usr/bin/du", "-sx", "--", "/usr/bin/du"}, []string{"/opt/tools/du", "-sx", "--", "/usr/bin/du"}, false},
		{[]string{"/usr/sbin/runuser", "-u", "example", "--", "/usr/bin/systemctl", "--user", "show", "example.service"}, []string{"/opt/tools/runuser", "-u", "example", "--", "/opt/tools/systemctl", "--user", "show", "example.service"}, false},
		{[]string{"/usr/bin/gh", "run", "list"}, []string{"/opt/tools/gh", "run", "list"}, true},
		{[]string{"/usr/bin/psql", "--no-password"}, []string{"/usr/bin/psql", "--no-password"}, false},
		{[]string{"/usr/bin/gh", "--version"}, []string{"/usr/bin/gh", "--version"}, false},
	} {
		original := append([]string(nil), tc.before...)
		env := map[string]string{"LC_ALL": "C"}
		query := configuredQuery(cfg, func(_ context.Context, args []string, timeout time.Duration, gotEnv map[string]string) ([]byte, error) {
			if !reflect.DeepEqual(args, tc.after) || timeout != time.Second || gotEnv["LC_ALL"] != "C" {
				t.Fatal("command invocation changed unexpectedly")
			}
			if (gotEnv["GH_CONFIG_DIR"] == cfg.GitHubConfigDir) != tc.github {
				t.Fatal("GitHub directory must apply only to gh")
			}
			return []byte("ok"), nil
		})
		if _, err := query(context.Background(), tc.before, time.Second, env); err != nil {
			t.Fatal(err)
		}
		if !reflect.DeepEqual(tc.before, original) || len(env) != 1 {
			t.Fatal("caller-owned arguments/environment mutated")
		}
	}
}

func TestDefaultGitHubQueryUsesInvokingAccount(t *testing.T) {
	query := configuredQuery(&Config{}, func(_ context.Context, args []string, _ time.Duration, env map[string]string) ([]byte, error) {
		if _, forced := env["GH_CONFIG_DIR"]; forced {
			t.Fatal("default query must not override inherited gh configuration")
		}
		return []byte(`[]`), nil
	})
	s := sampler{query: query}
	s.githubJob(context.Background(), Job{Unit: Unit{Name: "Example"}, Kind: "github", Repository: "example/repo", Workflow: "test.yml"}, nil, time.Now(), 300)
}

func TestCollectorCommandValidation(t *testing.T) {
	for _, commands := range []map[string]string{{"gh": "relative"}, {"shell": "/bin/sh"}, {"du": "/bin/du\x00extra"}} {
		cfg := &Config{SnapshotFile: "/private/snapshot", StateFile: "/private/state", SampleInterval: 60, DirectoryInterval: 900, GitHubInterval: 300, Commands: commands}
		if cfg.Validate() == nil {
			t.Fatal("invalid command configuration accepted")
		}
	}
	cfg := &Config{SnapshotFile: "/private/snapshot", StateFile: "/private/state", SampleInterval: 60, DirectoryInterval: 900, GitHubInterval: 300, Commands: map[string]string{"gh": "/opt/tools/gh"}, GitHubConfigDir: "/private/gh"}
	if err := cfg.Validate(); err != nil {
		t.Fatal(err)
	}
	cfg.GitHubConfigDir = "relative"
	if cfg.Validate() == nil {
		t.Fatal("relative GitHub configuration accepted")
	}
}

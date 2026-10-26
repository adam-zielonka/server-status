package collector

import (
	"context"
	"encoding/json"
	"errors"
	"strings"
	"testing"
	"time"
)

func TestAPTUpdatesPreserveDebianVersions(t *testing.T) {
	rows, err := parseAPTUpdates("Listing...\ngit/stable-security 1:2.43.0-1ubuntu7.4 amd64 [upgradable from: 1:2.43.0-1ubuntu7.3]\n")
	if err != nil || len(rows) != 1 || rows[0]["installed_version"] != "1:2.43.0-1ubuntu7.3" {
		t.Fatalf("invalid APT results: %v %v", rows, err)
	}
	if _, err := parseAPTUpdates("unexpected output"); err == nil {
		t.Fatal("malformed output must not report no updates")
	}
	if rows, err := parseAPTUpdates("Listing...\n"); err != nil || len(rows) != 0 {
		t.Fatal("empty update list rejected")
	}
}
func TestSoftwareReleaseChannelsAndComparison(t *testing.T) {
	fetch := func(_ context.Context, endpoint string, target any) error {
		body := `[{"version":"v26.0.0"},{"version":"v24.9.0"},{"version":"v24.10.0"},{"version":"v24.11.0-rc.1"}]`
		if strings.Contains(endpoint, "go.dev") {
			body = `[{"version":"go1.28.1"},{"version":"go1.27.3"}]`
		}
		return json.Unmarshal([]byte(body), target)
	}
	for _, tc := range []struct{ kind, installed, want string }{{"node", "24.8.0", "24.10.0"}, {"go", "1.27.2", "1.27.3"}} {
		got, _, err := availableVersion(context.Background(), SoftwareTool{Kind: tc.kind}, tc.installed, fetch)
		if err != nil || got != tc.want {
			t.Fatalf("channel mismatch: %s %v", got, err)
		}
	}
	for _, tc := range []struct{ installed, available, status string }{{"12.9.0", "12.10.0", "update_available"}, {"2.0.0", "1.9.0", "current"}, {"1.0.0-beta.1", "1.0.0", "update_available"}, {"broken", "1.0.0", "unknown"}} {
		if got := versionStatus(tc.installed, tc.available); got != tc.status {
			t.Fatalf("status %s", got)
		}
	}
}
func TestSoftwareFailurePrivacyAndCache(t *testing.T) {
	now := time.Now()
	calls := 0
	s := sampler{query: func(context.Context, []string, time.Duration, map[string]string) ([]byte, error) {
		calls++
		return nil, errors.New("private-command-output")
	}}
	cfg := &SoftwareConfig{Tools: []SoftwareTool{{Name: "Example", Kind: "manual", Executable: "/example/bin/tool"}}}
	first := s.software(context.Background(), cfg, nil, now)
	body, _ := json.Marshal(first)
	if strings.Contains(string(body), "private-command-output") || strings.Contains(string(body), "/example") {
		t.Fatal("private details exposed")
	}
	if !strings.Contains(string(body), `"status":"unknown"`) {
		t.Fatal("failed check must be unknown")
	}
	var cached map[string]any
	_ = json.Unmarshal(body, &cached)
	s.software(context.Background(), cfg, cached, now.Add(time.Minute))
	if calls != 1 {
		t.Fatal("cache not used")
	}
	cfg.Tools[0].Executable = "/different/bin/tool"
	s.software(context.Background(), cfg, cached, now.Add(time.Minute))
	if calls != 2 {
		t.Fatal("changed configuration must invalidate cache")
	}
	s.software(context.Background(), cfg, cached, now.Add(7*time.Hour))
	if calls != 3 {
		t.Fatal("expired cache not refreshed")
	}
}

func TestCLIVersionFormats(t *testing.T) {
	for _, tc := range []struct{ output, version string }{
		{"GitHub Copilot CLI 1.0.98.\nRun 'copilot update' to check for updates.", "1.0.98"},
		{"go version go1.27.2 linux/amd64\n", "1.27.2"},
		{"codex-cli 0.164.0\n", "0.164.0"},
		{"1.0.0-beta.18\n", "1.0.0-beta.18"},
	} {
		match := toolVersion.FindStringSubmatch(tc.output)
		if len(match) < 2 || match[1] != tc.version {
			t.Fatalf("version extraction failed for %q: %v", tc.output, match)
		}
	}
}

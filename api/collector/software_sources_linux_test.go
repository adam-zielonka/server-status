package collector

import (
	"context"
	"encoding/json"
	"strings"
	"testing"
	"time"
)

func TestSoftwareSourceURLsSurviveVersionFailure(t *testing.T) {
	s := sampler{query: queryFailure}
	for _, tc := range []struct {
		tool SoftwareTool
		want string
	}{
		{SoftwareTool{Kind: "npm", Package: "@example/cli"}, "https://www.npmjs.com/package/@example/cli"},
		{SoftwareTool{Kind: "github", Repository: "example/cli"}, "https://github.com/example/cli"},
		{SoftwareTool{Kind: "node"}, "https://nodejs.org/en/download"},
		{SoftwareTool{Kind: "go"}, "https://go.dev/dl/"},
		{SoftwareTool{Kind: "manual"}, ""},
	} {
		r := s.softwareTool(context.Background(), tc.tool, time.Now())
		if text(r["source_url"]) != tc.want || r["status"] != "unknown" {
			t.Fatal(r)
		}
	}
}

const indexSourcesFixture = `Package files:
 500 https://mirror.example/ubuntu noble/main amd64 Packages
     release o=Ubuntu,a=noble,n=noble,l=Ubuntu,c=main,b=amd64
 500 https://mirror.example/security noble-security/main amd64 Packages
     release o=Ubuntu,a=noble-security,n=noble,l=Ubuntu,c=main,b=amd64
 500 https://deb.debian.org/debian stable/main amd64 Packages
     release o=Debian,a=stable,n=trixie,l=Debian,c=main,b=amd64
 500 https://pkgs.tailscale.com/stable/ubuntu noble/main amd64 Packages
     release o=Tailscale,n=noble,l=Tailscale,c=main,b=amd64
 500 https://pkg.cloudflare.com/cloudflared any/main amd64 Packages
     release o=cloudflared,n=any,c=main,b=amd64
`

func TestAPTSourcesFollowExactVersionAndReleaseOrigin(t *testing.T) {
	indexes := aptIndexSources(indexSourcesFixture)
	for _, tc := range []struct{ name, policy, want string }{
		{"git", " *** 9.0-1 100\n 100 https://private.example/secret stable/main amd64 Packages\n 2.0-1 500\n 500 https://mirror.example/ubuntu noble/main amd64 Packages\n 500 https://mirror.example/security noble-security/main amd64 Packages\n 100 /var/lib/dpkg/status", "https://packages.ubuntu.com/search?"},
		{"git:amd64", " 2.0-1 500\n -1 https://deb.debian.org/debian stable/main amd64 Packages", "https://packages.debian.org/search?"},
		{"tailscale", " *** 2.0-1 500\n 500 https://pkgs.tailscale.com/stable/ubuntu noble/main amd64 Packages", "https://pkgs.tailscale.com/"},
		{"cloudflared", " 2.0-1 500\n 500 https://pkg.cloudflare.com/cloudflared any/main amd64 Packages", "https://pkg.cloudflare.com/"},
		{"local", " *** 2.0-1 100\n 100 /var/lib/dpkg/status", ""},
		{"unknown", " 2.0-1 500\n 500 https://private.example/secret noble/main amd64 Packages", ""},
		{"ambiguous", " 2.0-1 500\n 500 https://mirror.example/ubuntu noble/main amd64 Packages\n 500 https://private.example/secret noble/main amd64 Packages", ""},
		{"flat-ambiguous", " 2.0-1 500\n 500 https://mirror.example/ubuntu noble/main amd64 Packages\n 500 https://private.example/repo ./ Packages", ""},
		{"missing", " Candidate: (none)", ""},
	} {
		got := aptPackageSources(tc.name+":\n"+tc.policy, indexes, map[string]string{tc.name: "2.0-1"})[tc.name]
		if tc.want == "" && got != "" || tc.want != "" && !strings.HasPrefix(got, tc.want) {
			t.Fatalf("%s: %q", tc.name, got)
		}
		if strings.Contains(tc.name, ":") && strings.Contains(got, "%3A") {
			t.Fatal("architecture in package search", got)
		}
	}
}

func TestAPTSourcesBatchAndFailure(t *testing.T) {
	for _, fail := range []bool{false, true} {
		calls := 0
		s := sampler{query: func(_ context.Context, args []string, timeout time.Duration, env map[string]string) ([]byte, error) {
			calls++
			if args[0] != "/usr/bin/apt-cache" || args[1] != "policy" || env["LC_ALL"] != "C" || timeout > 10*time.Second {
				t.Fatal(args, timeout, env)
			}
			if fail {
				return nil, errQuery
			}
			if len(args) == 2 {
				return []byte(indexSourcesFixture), nil
			}
			if len(args) != 4 {
				t.Fatal("not batched", args)
			}
			return []byte("git:\n 2.0-1 500\n 500 https://mirror.example/ubuntu noble/main amd64 Packages\ncurl:\n 3.0-1 500\n 500 https://mirror.example/ubuntu noble/main amd64 Packages"), nil
		}}
		tools := []row{{"available_version": "2.0-1", "status": "current"}}
		updates := []row{{"name": "curl", "available_version": "3.0-1"}}
		s.linkAPTSources(context.Background(), tools, []SoftwareTool{{Kind: "apt", Package: "git"}}, updates)
		if fail {
			if tools[0]["source_url"] != nil || updates[0]["source_url"] != nil || tools[0]["status"] != "current" {
				t.Fatal(tools, updates)
			}
		} else if calls != 2 || tools[0]["source_url"] == nil || updates[0]["source_url"] == nil {
			t.Fatal(calls, tools, updates)
		}
	}
}

func TestAPTSourcePrivacy(t *testing.T) {
	for _, uri := range []string{"https://secret@pkgs.tailscale.com/private", "https://private.example/token", "file:///private", "javascript:alert(1)", "https://pkgs.tailscale.com.evil.test/private"} {
		indexes := aptIndexSources(" 500 " + uri + " noble/main amd64 Packages\n release o=Unknown,n=noble")
		sources := aptPackageSources("example:\n 1.0 500\n 500 "+uri+" noble/main amd64 Packages", indexes, map[string]string{"example": "1.0"})
		if len(sources) != 0 {
			t.Fatal(sources)
		}
	}
	// A legacy cache must be enriched on the next collection, even within the interval.
	s := sampler{query: queryFailure}
	now := time.Now()
	cfg := &SoftwareConfig{Tools: []SoftwareTool{{Kind: "npm", Package: "example", Executable: "/example"}}}
	fresh := s.software(context.Background(), cfg, nil, now)
	body, _ := json.Marshal(fresh)
	var cached map[string]any
	_ = json.Unmarshal(body, &cached)
	cached["config_hash"] = strings.TrimPrefix(text(cached["config_hash"]), "sources-v1:")
	cached["tools"] = []any{}
	got := s.software(context.Background(), cfg, cached, now.Add(time.Minute)).(row)
	if len(got["tools"].([]row)) != 1 {
		t.Fatal("legacy cache reused")
	}
}

package main

import (
	"bytes"
	"context"
	"encoding/json"
	"io"
	"net/http/httptest"
	"os"
	"path/filepath"
	"regexp"
	"status/config"
	"strings"
	"testing"
)

func testConfig(t *testing.T) string {
	t.Helper()
	settings := config.ServerConfig{
		Listen: config.Listen{Host: "127.0.0.1", Port: 4000},
		Auth: config.ServerAuth{
			Secret: "test-signing-key-only",
			Users:  []config.ServerUser{{Name: "example-user", Pass: "test-only"}},
		},
	}
	body, err := json.Marshal(settings)
	if err != nil {
		t.Fatal(err)
	}
	path := filepath.Join(t.TempDir(), "settings.json")
	if err := os.WriteFile(path, body, 0600); err != nil {
		t.Fatal(err)
	}
	return path
}

func TestCLI(t *testing.T) {
	path := testConfig(t)
	for _, tc := range []struct {
		name string
		args []string
		want string
	}{
		{"help", []string{"--help"}, "Usage:"},
		{"serve help", []string{"serve", "--help"}, "api-only"},
		{"short help", []string{"-h"}, "Usage:"},
		{"no command", nil, "Usage:"},
		{"config help", []string{"config", "check", "--help"}, "config"},
		{"collector help", []string{"collect", "--help"}, "required"},
		{"version", []string{"version"}, "server-status dev"},
		{"config check", []string{"config", "check", "--config", path}, "Configuration is valid."},
		{"collector config check", []string{"config", "check", "--collector", "--config", "../collector/config.example.json"}, "Configuration is valid."},
	} {
		t.Run(tc.name, func(t *testing.T) {
			var out bytes.Buffer
			if err := run(context.Background(), tc.args, &out, &out); err != nil {
				t.Fatal(err)
			}
			if !strings.Contains(out.String(), tc.want) {
				t.Fatalf("output %q does not contain %q", out.String(), tc.want)
			}
			if strings.Contains(out.String(), "test-signing-key-only") || strings.Contains(out.String(), "test-only") {
				t.Fatal("configuration contents leaked to CLI output")
			}
		})
	}
	for _, args := range [][]string{
		{"unknown"}, {"serve", "--unknown"}, {"serve", "unexpected"},
		{"--config", path},
		{"config"}, {"config", "unknown"}, {"config", "check", "extra"},
		{"config", "check", "--config", filepath.Join(t.TempDir(), "missing")},
		{"collect"}, {"collect", "unexpected"}, {"config", "check", "--collector"},
		{"version", "extra"}, {"help", "extra"},
		{"serve", "--config", path, "--listen", "invalid"},
	} {
		if err := run(context.Background(), args, io.Discard, io.Discard); err == nil {
			t.Errorf("expected error for %v", args)
		}
	}
}

func TestListenAddress(t *testing.T) {
	for _, address := range []string{"127.0.0.1:4000", "localhost:8080", "[::1]:4000", ":4000"} {
		if err := validateListen(address); err != nil {
			t.Errorf("valid address %q: %v", address, err)
		}
	}
	for _, address := range []string{"localhost", "::1:4000", "localhost:0", "localhost:65536", "localhost:http"} {
		if validateListen(address) == nil {
			t.Errorf("accepted invalid address %q", address)
		}
	}
}

func TestEmbeddedDashboardAndAPI(t *testing.T) {
	if err := config.Initialize(testConfig(t)); err != nil {
		t.Fatal(err)
	}
	handler, err := newHandler(false)
	if err != nil {
		t.Fatal(err)
	}
	get := func(method, path string) *httptest.ResponseRecorder {
		t.Helper()
		w := httptest.NewRecorder()
		handler.ServeHTTP(w, httptest.NewRequest(method, path, nil))
		return w
	}
	root := get("GET", "/")
	if root.Code != 200 || !strings.Contains(root.Body.String(), `<div id="root">`) || !strings.Contains(root.Header().Get("Content-Type"), "text/html") {
		t.Fatalf("dashboard not served: %d %s", root.Code, root.Header())
	}
	if root.Header().Get("Cache-Control") != "no-cache" {
		t.Fatal("HTML must revalidate after binary upgrades")
	}
	asset := regexp.MustCompile(`src="\.?(/assets/[^"]+\.js)"`).FindStringSubmatch(root.Body.String())
	if len(asset) != 2 {
		t.Fatal("dashboard does not reference a built JavaScript entry point")
	}
	js := get("GET", asset[1])
	if js.Code != 200 || !strings.Contains(js.Header().Get("Content-Type"), "javascript") {
		t.Fatalf("embedded JS not served: %d %s", js.Code, js.Header())
	}
	if !strings.Contains(js.Header().Get("Cache-Control"), "immutable") {
		t.Fatal("hashed assets should be cached")
	}
	for _, tc := range []struct {
		method, path string
		status       int
	}{
		{"HEAD", "/", 200},
		{"GET", "/api/ok", 401},
		{"GET", "/api/telemetry", 401},
		{"GET", "/api/missing", 404},
		{"GET", "/api", 404},
		{"GET", "/assets/", 404},
		{"GET", "/assets/missing.js", 404},
		{"GET", "/config.json", 404},
		{"GET", "/.env", 404},
		{"GET", "/missing", 404},
		{"POST", "/", 405},
		{"POST", "/api/ok", 405},
	} {
		if w := get(tc.method, tc.path); w.Code != tc.status {
			t.Errorf("%s %s: got %d, want %d", tc.method, tc.path, w.Code, tc.status)
		}
	}
	apiOnly, err := newHandler(true)
	if err != nil {
		t.Fatal(err)
	}
	w := httptest.NewRecorder()
	apiOnly.ServeHTTP(w, httptest.NewRequest("GET", "/", nil))
	if w.Code != 404 {
		t.Fatal("API-only mode served the frontend")
	}
}

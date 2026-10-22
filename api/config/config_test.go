package config

import (
	"os"
	"path/filepath"
	"strings"
	"testing"
)

const validConfig = `{"listen":{"host":"::1","port":4000},"auth":{"secret":"test-secret-only","users":[{"name":"example","pass":"test-only"}]}}`

func writeConfig(t *testing.T, body string) string {
	t.Helper()
	path := filepath.Join(t.TempDir(), "settings.json")
	if err := os.WriteFile(path, []byte(body), 0600); err != nil {
		t.Fatal(err)
	}
	return path
}

func TestConfigurationValidation(t *testing.T) {
	for _, body := range []string{
		"null", "[]", "invalid JSON", "{}",
		strings.Replace(validConfig, `"port":4000`, `"port":0`, 1),
		strings.Replace(validConfig, `"port":4000`, `"port":65536`, 1),
		strings.Replace(validConfig, `"test-secret-only"`, `""`, 1),
		strings.Replace(validConfig, `[{"name":"example","pass":"test-only"}]`, `[]`, 1),
	} {
		if _, err := Load(writeConfig(t, body)); err == nil {
			t.Errorf("accepted invalid config %s", body)
		}
	}
	path := writeConfig(t, validConfig)
	if err := Initialize(path); err != nil {
		t.Fatal(err)
	}
	if got := GetListenAddress(); got != "[::1]:4000" {
		t.Fatalf("IPv6 listen address: %q", got)
	}
	// A prior successful load must not hide an invalid file or replace the
	// running settings when validation fails.
	if err := Initialize(writeConfig(t, "null")); err == nil {
		t.Fatal("invalid config was accepted after initialization")
	}
	if GetListenAddress() != "[::1]:4000" {
		t.Fatal("failed initialization changed running settings")
	}
	if _, err := Load(writeConfig(t, strings.Replace(validConfig, "4000", "5000", 1))); err != nil {
		t.Fatal(err)
	}
	if GetListenAddress() != "[::1]:4000" {
		t.Fatal("standalone check changed running settings")
	}
	bad := strings.Replace(validConfig, `"port":4000`, `"port":"sensitive-sentinel"`, 1)
	_, err := Load(writeConfig(t, bad))
	if err == nil || strings.Contains(err.Error(), "sensitive-sentinel") {
		t.Fatal("invalid field contents must not be exposed in validation errors")
	}
}

func TestDefaultConfigurationLookup(t *testing.T) {
	t.Chdir(t.TempDir())
	if _, err := Load(""); err == nil {
		t.Fatal("expected missing default config error")
	}
	if err := os.WriteFile("config.json", []byte(validConfig), 0600); err != nil {
		t.Fatal(err)
	}
	if _, err := Load(""); err != nil {
		t.Fatal(err)
	}
	// Preserve the existing preference for config.jsonc over config.json.
	if err := os.WriteFile("config.jsonc", []byte("null"), 0600); err != nil {
		t.Fatal(err)
	}
	if _, err := Load(""); err == nil {
		t.Fatal("config.jsonc should take precedence")
	}
}

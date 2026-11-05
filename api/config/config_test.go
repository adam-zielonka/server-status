package config

import (
	"encoding/json"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"sync"
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
}

func TestStrictConfigurationJSON(t *testing.T) {
	for _, tc := range []struct{ name, body string }{
		{"trailing object", validConfig + `{}`},
		{"trailing null", validConfig + `null`},
		{"trailing garbage", validConfig + `invalid`},
		{"comment", validConfig + ` // comment`},
		{"unknown root", strings.Replace(validConfig, `"listen":`, `"sensitive-sentinel":true,"listen":`, 1)},
		{"unknown listen", strings.Replace(validConfig, `"host":`, `"sensitive-sentinel":true,"host":`, 1)},
		{"unknown auth", strings.Replace(validConfig, `"secret":`, `"sensitive-sentinel":true,"secret":`, 1)},
		{"unknown user", strings.Replace(validConfig, `"pass":`, `"sensitive-sentinel":true,"pass":`, 1)},
		{"unknown service", strings.TrimSuffix(validConfig, "}") + `,"services":[{"name":"Example","port":"22","sensitive-sentinel":true}]}`},
		{"duplicate root", strings.Replace(validConfig, `"listen":`, `"listen":{},"listen":`, 1)},
		{"duplicate field", strings.Replace(validConfig, `"port":4000`, `"port":5000,"port":4000`, 1)},
		{"duplicate secret", strings.Replace(validConfig, `"secret":`, `"secret":"sensitive-sentinel","secret":`, 1)},
		{"escaped duplicate field", strings.Replace(validConfig, `"port":4000`, `"p\u006frt":5000,"port":4000`, 1)},
		{"wrong field case", strings.Replace(validConfig, `"secret":`, `"Secret":`, 1)},
		{"null listen", strings.Replace(validConfig, `{"host":"::1","port":4000}`, `null`, 1)},
		{"null host", strings.Replace(validConfig, `"host":"::1"`, `"host":null`, 1)},
		{"null secret", strings.Replace(validConfig, `"secret":"test-secret-only"`, `"secret":null`, 1)},
		{"null TTL", strings.Replace(validConfig, `"secret":`, `"session_ttl_seconds":null,"secret":`, 1)},
		{"null user", strings.Replace(validConfig, `[{"name":"example","pass":"test-only"}]`, `[null]`, 1)},
		{"nonobject user", strings.Replace(validConfig, `[{"name":"example","pass":"test-only"}]`, `["sensitive-sentinel"]`, 1)},
		{"null password", strings.Replace(validConfig, `"pass":"test-only"`, `"pass":null`, 1)},
		{"wrong users type", strings.Replace(validConfig, `[{"name":"example","pass":"test-only"}]`, `{}`, 1)},
		{"wrong port type", strings.Replace(validConfig, `"port":4000`, `"port":"sensitive-sentinel"`, 1)},
		{"fractional port", strings.Replace(validConfig, `"port":4000`, `"port":4000.5`, 1)},
	} {
		t.Run(tc.name, func(t *testing.T) {
			_, err := Load(writeConfig(t, tc.body))
			if err == nil {
				t.Fatal("accepted invalid JSON structure")
			}
			if strings.Contains(err.Error(), "sensitive-sentinel") {
				t.Fatal("parse error exposed supplied contents")
			}
		})
	}
	for _, suffix := range []string{``, "\n\t ", ` `} {
		if _, err := Load(writeConfig(t, validConfig+suffix)); err != nil {
			t.Fatal(err)
		}
	}
	for _, external := range []string{`null`, `[]`, `{"sensitive-sentinel":{"anything":true}}`, `"obsolete"`, `false`} {
		body := strings.TrimSuffix(validConfig, "}") + `,"external":` + external + `}`
		if _, err := Load(writeConfig(t, body)); err != nil {
			t.Fatal("retired external option must remain ignored")
		}
	}
}

func TestUsersAndSecrets(t *testing.T) {
	for _, tc := range []struct {
		name  string
		users []ServerUser
	}{
		{"empty entry", []ServerUser{{}}},
		{"empty name", []ServerUser{{Pass: "nonempty"}}},
		{"whitespace name", []ServerUser{{Name: " \t", Pass: "nonempty"}}},
		{"leading whitespace", []ServerUser{{Name: " example", Pass: "nonempty"}}},
		{"trailing whitespace", []ServerUser{{Name: "example\u00a0", Pass: "nonempty"}}},
		{"colon", []ServerUser{{Name: "example:second", Pass: "nonempty"}}},
		{"control character", []ServerUser{{Name: "example\n", Pass: "nonempty"}}},
		{"interior control character", []ServerUser{{Name: "ex\x00ample", Pass: "nonempty"}}},
		{"empty password", []ServerUser{{Name: "example"}}},
		{"duplicate name", []ServerUser{{Name: "example", Pass: "first"}, {Name: "example", Pass: "second"}}},
	} {
		t.Run(tc.name, func(t *testing.T) {
			body, err := json.Marshal(tc.users)
			if err != nil {
				t.Fatal(err)
			}
			input := strings.Replace(validConfig, `[{"name":"example","pass":"test-only"}]`, string(body), 1)
			if _, err := Load(writeConfig(t, input)); err == nil {
				t.Fatal("invalid users accepted")
			}
		})
	}
	// Preserve established secrets and exact password bytes, including whitespace
	// and Basic-auth-safe password colons. No arbitrary minimum secret length.
	for _, secret := range []string{"x", " secret with spaces "} {
		body := strings.Replace(validConfig, `"test-secret-only"`, strconv.Quote(secret), 1)
		body = strings.Replace(body, `"test-only"`, `" pass:with:colons "`, 1)
		if err := Initialize(writeConfig(t, body)); err != nil {
			t.Fatal(err)
		}
		if string(GetAuthSecret()) != secret {
			t.Fatal("secret was normalized")
		}
		if FindUserAndCheckPassword("example", " pass:with:colons ") != nil {
			t.Fatal("exact password rejected")
		}
		if FindUserAndCheckPassword("example", "pass:with:colons") == nil {
			t.Fatal("trimmed password accepted")
		}
	}
	body := strings.Replace(validConfig, `"test-only"`, `" "`, 1)
	if err := Initialize(writeConfig(t, body)); err != nil {
		t.Fatal("nonempty password was trimmed")
	}
	if FindUserAndCheckPassword("example", " ") != nil {
		t.Fatal("whitespace password changed")
	}
	if _, err := Load(writeConfig(t, strings.Replace(validConfig, `"test-secret-only"`, `" \t"`, 1))); err == nil {
		t.Fatal("blank signing secret accepted")
	}
}

func TestSessionTTLConfiguration(t *testing.T) {
	loaded, err := Load(writeConfig(t, validConfig))
	if err != nil {
		t.Fatal(err)
	}
	if loaded.Auth.SessionTTLSeconds != DefaultSessionTTLSeconds {
		t.Fatal("missing TTL must default to 12 hours")
	}
	for _, ttl := range []string{"-1", "0", "299", "604801", "1.5", `"43200"`, "true", "99999999999999999999999999"} {
		body := strings.Replace(validConfig, `"secret":`, `"session_ttl_seconds":`+ttl+`,"secret":`, 1)
		if _, err := Load(writeConfig(t, body)); err == nil {
			t.Errorf("invalid TTL accepted: %s", ttl)
		}
	}
	for _, ttl := range []int{300, 43200, 604800} {
		body := strings.Replace(validConfig, `"secret":`, `"session_ttl_seconds":`+strconv.Itoa(ttl)+`,"secret":`, 1)
		loaded, err := Load(writeConfig(t, body))
		if err != nil || loaded.Auth.SessionTTLSeconds != ttl {
			t.Fatalf("valid TTL rejected: %d", ttl)
		}
	}
}

func TestHostsAndServices(t *testing.T) {
	for _, host := range []string{"localhost", "127.0.0.1", "::", "2001:db8::1", "fe80::1%eth0", "server.example", "server.example.", "example-1"} {
		body := strings.Replace(validConfig, `"::1"`, strconv.Quote(host), 1)
		body = strings.TrimSuffix(body, "}") + `,"hosts":[` + strconv.Quote(host) + `],"services":[{"name":"SSH","port":"22"},{"name":"Example","port":"65535"}]}`
		if _, err := Load(writeConfig(t, body)); err != nil {
			t.Errorf("valid host %q rejected: %v", host, err)
		}
	}
	for _, host := range []string{"", " ", " localhost", "localhost ", "https://example.org", "localhost:22", "[::1]", "127.0.0.1:22", "../socket", "bad\nname", "bad..name", "-example", "example-", ".", strings.Repeat("a", 64) + ".example"} {
		body := strings.TrimSuffix(validConfig, "}") + `,"hosts":[` + strconv.Quote(host) + `]}`
		if _, err := Load(writeConfig(t, body)); err == nil {
			t.Errorf("invalid probe host %q accepted", host)
		}
		if host != "" {
			body = strings.Replace(validConfig, `"::1"`, strconv.Quote(host), 1)
			if _, err := Load(writeConfig(t, body)); err == nil {
				t.Errorf("invalid listen host %q accepted", host)
			}
		}
	}
	// An empty listen host retains Go's explicit all-interface binding behavior.
	if _, err := Load(writeConfig(t, strings.Replace(validConfig, `"::1"`, `""`, 1))); err != nil {
		t.Fatal(err)
	}
	for _, service := range []string{
		`null`, `{}`, `{"name":"","port":"22"}`, `{"name":" example","port":"22"}`,
		`{"name":"bad\nname","port":"22"}`, `{"name":"Example","port":"0"}`,
		`{"name":"Example","port":"65536"}`, `{"name":"Example","port":"http"}`,
		`{"name":"Example","port":"+22"}`, `{"name":"Example","port":" 22"}`,
		`{"name":"Example","port":"22"},{"name":"Example","port":"23"}`,
	} {
		body := strings.TrimSuffix(validConfig, "}") + `,"services":[` + service + `]}`
		if _, err := Load(writeConfig(t, body)); err == nil {
			t.Errorf("invalid service accepted: %s", service)
		}
	}
	for _, value := range []string{"\x00path", " telemetry.json", "telemetry.json "} {
		body := strings.TrimSuffix(validConfig, "}") + `,"telemetry_file":` + strconv.Quote(value) + `}`
		if _, err := Load(writeConfig(t, body)); err == nil {
			t.Fatal("invalid telemetry path accepted")
		}
	}
	// Optional integrations may remain omitted, null or empty; no network checks.
	body := strings.TrimSuffix(validConfig, "}") + `,"services":null,"hosts":null,"telemetry_file":"relative/path.json"}`
	if _, err := Load(writeConfig(t, body)); err != nil {
		t.Fatal(err)
	}
}

func TestAuthSettingsAreIndependentSnapshots(t *testing.T) {
	if err := Initialize(writeConfig(t, validConfig)); err != nil {
		t.Fatal(err)
	}
	first := GetAuthSettings()
	first.Users[0].Pass = "modified"
	if FindUserAndCheckPassword("example", "test-only") != nil {
		t.Fatal("mutating a settings copy changed running credentials")
	}
}

func TestConcurrentConfigurationReads(t *testing.T) {
	path := writeConfig(t, validConfig)
	if err := Initialize(path); err != nil {
		t.Fatal(err)
	}
	var workers sync.WaitGroup
	for range 4 {
		workers.Go(func() {
			for range 50 {
				GetListenAddress()
				GetServicesAndHosts()
				GetTelemetryFile()
				if FindUserAndCheckPassword("example", "test-only") != nil {
					t.Error("credentials changed")
				}
			}
		})
	}
	for range 20 {
		if err := Initialize(path); err != nil {
			t.Fatal(err)
		}
	}
	workers.Wait()
}

func TestTrackedExampleConfiguration(t *testing.T) {
	if _, err := Load("../config.example.json"); err != nil {
		t.Fatal(err)
	}
}

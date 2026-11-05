package main

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"status/auth"
	"status/config"
	"strings"
	"testing"
)

func TestTelemetryRequiresAuthentication(t *testing.T) {
	dir := t.TempDir()
	snapshot := filepath.Join(dir, "snapshot.json")
	if err := os.WriteFile(snapshot, []byte(`{"enabled":true,"schema_version":1,"collected_at":"2026-01-01T00:00:00Z","services":[]}`), 0600); err != nil {
		t.Fatal(err)
	}
	settings := config.ServerConfig{
		Listen:        config.Listen{Host: "127.0.0.1", Port: 4000},
		Auth:          config.ServerAuth{Secret: "test-signing-key-only", Users: []config.ServerUser{{Name: "example-user", Pass: "test-only"}}},
		TelemetryFile: snapshot,
	}
	body, err := json.Marshal(settings)
	if err != nil {
		t.Fatal(err)
	}
	path := filepath.Join(dir, "config.json")
	if err := os.WriteFile(path, body, 0600); err != nil {
		t.Fatal(err)
	}
	if err := config.Initialize(path); err != nil {
		t.Fatal(err)
	}
	mux, err := newHandler(true)
	if err != nil {
		t.Fatal(err)
	}
	// Obtain a real bounded session through the unchanged Basic login interface.
	loginRequest := httptest.NewRequest(http.MethodGet, "/api/auth", nil)
	loginRequest.RemoteAddr = "192.0.2.25:1234"
	loginRequest.SetBasicAuth("example-user", "test-only")
	loginResponse := httptest.NewRecorder()
	mux.ServeHTTP(loginResponse, loginRequest)
	if loginResponse.Code != http.StatusOK {
		t.Fatalf("login failed: %d", loginResponse.Code)
	}
	var session struct {
		Data auth.Auth `json:"data"`
	}
	if err := json.Unmarshal(loginResponse.Body.Bytes(), &session); err != nil || session.Data.Token == "" {
		t.Fatal("login response must include a token")
	}
	token := session.Data.Token
	for _, tc := range []struct {
		method, token string
		status        int
	}{
		{"GET", "", http.StatusUnauthorized},
		{"GET", "invalid", http.StatusUnauthorized},
		{"GET", token, http.StatusOK},
		{"POST", token, http.StatusMethodNotAllowed},
	} {
		r := httptest.NewRequest(tc.method, "/api/telemetry", nil)
		if tc.token != "" {
			r.Header.Set("Authorization", "Bearer "+tc.token)
		}
		w := httptest.NewRecorder()
		mux.ServeHTTP(w, r)
		if w.Code != tc.status {
			t.Fatalf("%s token present=%t: got %d, want %d", tc.method, tc.token != "", w.Code, tc.status)
		}
		if tc.status == http.StatusOK && !strings.Contains(w.Body.String(), `"services"`) {
			t.Fatal("authenticated telemetry missing")
		}
		if tc.status == http.StatusUnauthorized && strings.Contains(w.Body.String(), `"services"`) {
			t.Fatal("unauthorized telemetry disclosed")
		}
		if tc.method == "GET" && w.Header().Get("Cache-Control") != "no-store" {
			t.Fatal("telemetry response must not be cached")
		}
	}
}

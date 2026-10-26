package collector

import (
	"encoding/json"
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"
)

func TestBackupStoreCapacityFreshnessAndPrivacy(t *testing.T) {
	now := time.Date(2026, 1, 1, 12, 0, 0, 0, time.UTC)
	path := filepath.Join(t.TempDir(), "status.json")
	cfg := []BackupStore{{Name: "Example backup", StatusFile: path, MaxAge: 1800}}
	for _, tc := range []struct {
		body, status string
		metrics      bool
	}{
		{`{"status":"healthy","checked_at":"2026-01-01T12:00:00Z","bytes":160,"limit_bytes":200,"backup_count":7,"secret":"NEVER-PUBLISH","error":"SECRET-ERROR"}`, "warning", true},
		{`{"status":"healthy","checked_at":"2026-01-01T12:00:00Z","bytes":210,"limit_bytes":200}`, "failure", true},
		{`{"status":"healthy","checked_at":"2026-01-01T10:00:00Z","bytes":0,"limit_bytes":200}`, "unknown", false},
		{`{"status":"healthy","checked_at":"2026-01-02T12:00:00Z","bytes":0,"limit_bytes":200}`, "unknown", false},
		{`{"status":"unknown","checked_at":"2026-01-01T12:00:00Z"}`, "unknown", false},
		{`{"status":"healthy","checked_at":"2026-01-01T12:00:00Z","bytes":-1,"limit_bytes":200}`, "unknown", false},
		{`not json`, "unknown", false},
	} {
		if err := os.WriteFile(path, []byte(tc.body), 0600); err != nil {
			t.Fatal(err)
		}
		got := collectBackupStores(cfg, now)[0]
		if got["status"] != tc.status {
			t.Fatalf("status: %v", got)
		}
		if _, ok := got["bytes"]; ok != tc.metrics {
			t.Fatalf("unavailable metrics must not become zero: %v", got)
		}
		if tc.status == "failure" && got["available_bytes"] != int64(0) {
			t.Fatalf("negative available space: %v", got)
		}
		body, _ := json.Marshal(got)
		if strings.Contains(string(body), "NEVER-PUBLISH") || strings.Contains(string(body), "SECRET-ERROR") || strings.Contains(string(body), path) {
			t.Fatal("private input leaked")
		}
	}
	if err := os.Remove(path); err != nil {
		t.Fatal(err)
	}
	if collectBackupStores(cfg, now)[0]["status"] != "unknown" {
		t.Fatal("missing source should be unknown")
	}
}

package mods

import (
	"os"
	"path/filepath"
	"strings"
	"testing"
)

func TestTelemetrySnapshotValidation(t *testing.T) {
	path := filepath.Join(t.TempDir(), "snapshot.json")
	for _, body := range []string{`null`, `[]`, `{`, `{"schema_version":2,"enabled":true,"collected_at":"now"}`, `{"schema_version":1,"enabled":false,"collected_at":"now"}`} {
		if err := os.WriteFile(path, []byte(body), 0600); err != nil {
			t.Fatal(err)
		}
		if _, err := readTelemetry(path); err == nil {
			t.Fatalf("accepted invalid snapshot: %s", body)
		}
	}
	body := `{"schema_version":1,"enabled":true,"collected_at":"2026-01-01T00:00:00Z","history":[]}`
	if err := os.WriteFile(path, []byte(body), 0600); err != nil {
		t.Fatal(err)
	}
	got, err := readTelemetry(path)
	if err != nil || string(got) != body {
		t.Fatalf("valid snapshot failed: %v", err)
	}
	if err := os.WriteFile(path, []byte(strings.Repeat(" ", 8*1024*1024+1)), 0600); err != nil {
		t.Fatal(err)
	}
	if _, err := readTelemetry(path); err == nil {
		t.Fatal("accepted oversized snapshot")
	}
}

func TestSnapshotErrorsDoNotExposePaths(t *testing.T) {
	_, err := readTelemetry("/private/example/credentials.json")
	if err == nil || strings.Contains(err.Error(), "/private/") {
		t.Fatalf("unexpected error: %v", err)
	}
}

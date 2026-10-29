package collector

import (
	"math"
	"path/filepath"
	"testing"
	"time"
)

func TestObservedCPUPeakMigrationAndCalibration(t *testing.T) {
	now := time.Date(2026, 1, 2, 12, 0, 0, 0, time.UTC)
	history := []row{
		{"at": iso(now.Add(-time.Hour)), "cpu_percent": 20.0, "cpu_capacity_cores": 2.0},
		{"at": iso(now.Add(-time.Minute)), "cpu_percent": 40.0},
	}
	current := row{"at": iso(now), "cpu_percent": 50.0, "cpu_capacity_cores": 2.0}
	peak := observeCPUPeak(row{}, row{}, history, current, 2, now)
	if peak["peak_cores"] != 1.0 || peak["observed_since"] != history[0]["at"] {
		t.Fatalf("migration: %v", peak)
	}
	normalizeCPUHistory(history, 2, 1)
	if history[0]["cpu_usage_cores"] != 0.4 || history[0]["cpu_percent"] != 40.0 {
		t.Fatalf("physical usage lost: %v", history)
	}
	// A restart after all peak samples have left the rolling window preserves it.
	next := now.Add(48 * time.Hour)
	low := row{"at": iso(next), "cpu_percent": 25.0, "cpu_capacity_cores": 1.0}
	retained := retainHistory(history, low, next)
	if len(retained) != 1 {
		t.Fatal("expected expired history")
	}
	recovered := observeCPUPeak(row{"cpu_capacity": peak}, row{}, retained, low, 1, next)
	if recovered["peak_cores"] != 1.0 || recovered["observed_since"] != peak["observed_since"] {
		t.Fatalf("peak lost: %v", recovered)
	}
	// A new high-water mark changes the common reference, never raw measurements.
	high := row{"at": iso(next.Add(time.Minute)), "cpu_percent": 80.0, "cpu_capacity_cores": 2.0}
	updated := observeCPUPeak(row{"cpu_capacity": recovered}, row{}, retained, high, 1, next.Add(time.Minute))
	if updated["peak_cores"] != 1.6 || low["cpu_percent"] != 25.0 {
		t.Fatalf("new record: %v", updated)
	}
}

func TestObservedCPUPeakUnavailableAndInvalid(t *testing.T) {
	now := time.Now().UTC().Truncate(time.Second)
	for _, value := range []any{nil, "20", -1.0, math.NaN(), math.Inf(1)} {
		p := row{"at": iso(now), "cpu_percent": value, "cpu_capacity_cores": 2.0}
		peak := observeCPUPeak(row{}, row{}, nil, p, 0, now)
		if peak["peak_cores"] != 0.0 || peak["observed_since"] != nil || p["cpu_usage_cores"] != nil {
			t.Fatalf("invalid sample %v: %v", value, peak)
		}
	}
	legacy := row{"at": iso(now), "cpu_percent": 50.0}
	unknown := observeCPUPeak(row{}, row{}, nil, legacy, 0, now)
	if unknown["peak_cores"] != 0.0 {
		t.Fatal("guessed legacy denominator")
	}
	zero := row{"at": iso(now), "cpu_percent": 0.0, "cpu_capacity_cores": 2.0}
	peak := observeCPUPeak(row{}, row{}, nil, zero, 0, now)
	if peak["peak_cores"] != 0.0 || peak["observed_since"] != iso(now) {
		t.Fatalf("zero: %v", peak)
	}
	future := row{"at": iso(now.Add(time.Hour)), "cpu_percent": 100.0, "cpu_capacity_cores": 2.0}
	ignored := observeCPUPeak(row{}, row{}, []row{future}, zero, 0, now)
	if ignored["peak_cores"] != 0.0 {
		t.Fatal("future observation accepted")
	}
}

func TestObservedCPUPeakRejectsInvalidScaleAndFailedState(t *testing.T) {
	now := time.Now().UTC().Truncate(time.Second)
	for _, scale := range []any{0.0, -1.0, math.NaN(), math.Inf(1), "2"} {
		p := row{"at": iso(now), "cpu_percent": 50.0, "cpu_capacity_cores": scale}
		if cpuUsageCores(p, 2) != nil {
			t.Fatalf("invalid explicit scale accepted: %v", scale)
		}
	}
	dir := t.TempDir()
	cfg := &Config{StateFile: filepath.Join(dir, "missing", "state.json"), SnapshotFile: filepath.Join(dir, "snapshot.json")}
	if err := atomicJSON(cfg.SnapshotFile, row{"generation": 1}, 0640); err != nil {
		t.Fatal(err)
	}
	if persistCollection(cfg, nil, row{}, row{"generation": 2}) == nil {
		t.Fatal("expected state failure")
	}
	if numeric(readObject(cfg.SnapshotFile)["generation"]) != 1 {
		t.Fatal("published without durable state")
	}
}

func TestObservedCPUPeakPersistsBeforeSnapshotFailure(t *testing.T) {
	dir := t.TempDir()
	cfg := &Config{StateFile: filepath.Join(dir, "state.json"), SnapshotFile: filepath.Join(dir, "missing", "snapshot.json")}
	now := time.Now().UTC().Truncate(time.Second)
	point := row{"at": iso(now), "cpu_percent": 80.0, "cpu_capacity_cores": 2.0}
	peak := observeCPUPeak(row{}, row{}, nil, point, 0, now)
	history := []row{point}
	if persistCollection(cfg, history, peak, row{"cpu_capacity": peak}) == nil {
		t.Fatal("expected snapshot failure")
	}
	saved := readObject(cfg.StateFile)
	later := row{"at": iso(now.Add(time.Minute)), "cpu_percent": 20.0, "cpu_capacity_cores": 1.0}
	retry := observeCPUPeak(saved, row{}, rows(saved["history"]), later, 1, now.Add(time.Minute))
	if retry["peak_cores"] != 1.6 {
		t.Fatalf("restart/retry lost peak: %v", retry)
	}
	cfg.SnapshotFile = filepath.Join(dir, "snapshot.json")
	if err := persistCollection(cfg, []row{later}, retry, row{"cpu_capacity": retry}); err != nil {
		t.Fatal(err)
	}
	fallback := observeCPUPeak(row{}, readObject(cfg.SnapshotFile), nil, later, 1, now.Add(time.Minute))
	if fallback["peak_cores"] != 1.6 || fallback["observed_since"] != iso(now) {
		t.Fatalf("snapshot recovery: %v", fallback)
	}
}

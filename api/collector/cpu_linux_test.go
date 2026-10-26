package collector

import "testing"

func TestCPUCapacity(t *testing.T) {
	for _, tc := range []struct {
		name                      string
		visible, configured, want float64
	}{
		{"hidden host limit", 2, 1, 1},
		{"fractional capacity", 2, 0.5, 0.5},
		{"visible quota remains binding", 0.5, 1, 0.5},
		{"visible cpuset remains binding", 2, 4, 2},
	} {
		t.Run(tc.name, func(t *testing.T) {
			container := row{"cpu_count": 2, "effective_cpu_cores": tc.visible, "cpu_quota_cores": nil}
			applyCPUCapacity(container, &tc.configured)
			if container["effective_cpu_cores"] != tc.want || container["cpu_capacity_cores"] != tc.configured || container["cpu_quota_cores"] != nil || container["cpu_count"] != 2 {
				t.Fatalf("capacity calibration changed detected allocation: %v", container)
			}
		})
	}
	container := row{"effective_cpu_cores": 2.0}
	applyCPUCapacity(container, nil)
	if container["effective_cpu_cores"] != 2.0 || container["cpu_capacity_cores"] != nil {
		t.Fatal("default scale changed")
	}
}

func TestCPUHistoryCalibration(t *testing.T) {
	history := []row{
		{"at": "legacy", "cpu_percent": 50.35, "memory_percent": 30.0},
		{"at": "current", "cpu_percent": 20.0, "cpu_capacity_cores": 1.0},
		{"at": "fractional", "cpu_percent": 80.0, "cpu_capacity_cores": 0.5},
		{"at": "gap", "cpu_percent": nil},
	}
	check := func(wants []any) {
		t.Helper()
		for i, want := range wants {
			if history[i]["cpu_percent"] != want {
				t.Fatalf("point %d: got %v, want %v", i, history[i]["cpu_percent"], want)
			}
		}
		if history[0]["memory_percent"] != 30.0 || history[0]["at"] != "legacy" {
			t.Fatal("calibration changed other history fields")
		}
	}
	normalizeCPUHistory(history, 2, 1)
	check([]any{100.7, 20.0, 40.0, nil})
	// A later collection or a retry must not multiply old values again.
	normalizeCPUHistory(history, 2, 1)
	check([]any{100.7, 20.0, 40.0, nil})
	// Removing the setting restores the original visible allocation scale.
	normalizeCPUHistory(history, 1, 2)
	check([]any{50.35, 10.0, 20.0, nil})
	unknown := []row{{"cpu_percent": 50.0, "memory_percent": 30.0}}
	normalizeCPUHistory(unknown, 0, 1)
	if unknown[0]["cpu_percent"] != nil || unknown[0]["memory_percent"] != 30.0 {
		t.Fatal("unknown legacy denominator must not produce a CPU estimate")
	}
}

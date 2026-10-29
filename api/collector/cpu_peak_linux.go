package collector

import (
	"math"
	"time"
)

// Preserve usage in logical CPUs before normalizing raw percentages to a new
// allocation. Never infer a missing legacy denominator from the current one.
func cpuUsageCores(point row, legacyCapacity float64) any {
	percent, ok := finiteNonnegative(point["cpu_percent"])
	if !ok {
		return nil
	}
	if n, valid := finiteNonnegative(point["cpu_usage_cores"]); valid {
		return n
	}
	capacity := legacyCapacity
	if stored := point["cpu_capacity_cores"]; stored != nil {
		var valid bool
		capacity, valid = finiteNonnegative(stored)
		if !valid {
			return nil
		}
	}
	if capacity <= 0 || math.IsNaN(capacity) || math.IsInf(capacity, 0) {
		return nil
	}
	usage := percent / 100 * capacity
	if math.IsNaN(usage) || math.IsInf(usage, 0) {
		return nil
	}
	return usage
}

func cpuPeakMetadata(value any, now time.Time) (float64, time.Time, bool) {
	meta, ok := value.(map[string]any)
	if !ok {
		if r, yes := value.(row); yes {
			meta = r
		}
	}
	peak, valid := finiteNonnegative(meta["peak_cores"])
	since := timestamp(meta["observed_since"])
	return peak, since, valid && !since.IsZero() && !since.After(now)
}

// State is authoritative. Snapshot fallback preserves an already-published
// baseline when migrating or recovering missing metadata, without reading logs.
func observeCPUPeak(state, previous row, history []row, point row, legacyCapacity float64, now time.Time) row {
	peak, since, ok := cpuPeakMetadata(state["cpu_capacity"], now)
	if !ok {
		peak, since, ok = cpuPeakMetadata(previous["cpu_capacity"], now)
	}
	if !ok {
		peak, since = 0, time.Time{}
	}
	for _, p := range append(history, point) {
		at := timestamp(p["at"])
		if at.IsZero() || at.After(now) {
			continue
		}
		usage := cpuUsageCores(p, legacyCapacity)
		p["cpu_usage_cores"] = usage
		if usage == nil {
			continue
		}
		peak = max(peak, numeric(usage))
		if since.IsZero() || at.Before(since) {
			since = at
		}
	}
	return row{"peak_cores": peak, "observed_since": timeValue(since)}
}

func persistCollection(cfg *Config, history []row, peak row, snapshot row) error {
	// Commit the denominator and high-water mark together, before publishing. A
	// snapshot failure cannot lose a peak or multiply calibration on retry.
	if err := atomicJSON(cfg.StateFile, row{"history": history, "cpu_capacity": peak}, 0600); err != nil {
		return err
	}
	return atomicJSON(cfg.SnapshotFile, snapshot, 0640)
}

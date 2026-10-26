package collector

import "math"

// Calibrate hidden host limits without claiming they were detected.
// Visible cpuset/quota still bound the available capacity.
func applyCPUCapacity(container row, configured *float64) {
	if configured != nil {
		container["cpu_capacity_cores"] = *configured
		container["effective_cpu_cores"] = math.Min(numeric(container["effective_cpu_cores"]), *configured)
	}
}

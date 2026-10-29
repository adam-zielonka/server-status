package collector

import (
	"encoding/json"
	"io"
	"math"
	"os"
	"strings"
	"time"
)

// Only explicitly selected fields enter these objects. Command output and
// configuration objects are never copied wholesale into a snapshot.
type row map[string]any

func text(v any) string { s, _ := v.(string); return s }
func rows(v any) []row {
	result := []row{}
	if items, ok := v.([]any); ok {
		for _, item := range items {
			if r, ok := item.(map[string]any); ok {
				result = append(result, row(r))
			}
		}
	}
	return result
}
func numeric(v any) float64 {
	switch n := v.(type) {
	case float64:
		return n
	case int:
		return float64(n)
	case int64:
		return float64(n)
	case uint64:
		return float64(n)
	default:
		return 0
	}
}
func nullable(s string) any {
	if s == "" {
		return nil
	}
	return s
}
func round(v float64, digits int) float64 {
	scale := math.Pow10(digits)
	return math.RoundToEven(v*scale) / scale
}
func iso(t time.Time) string { return t.UTC().Truncate(time.Second).Format(time.RFC3339) }
func timestamp(v any) time.Time {
	s := text(v)
	for _, layout := range []string{time.RFC3339Nano, "Mon 2006-01-02 15:04:05 MST", "Mon 2006-01-02 15:04:05.999999 MST"} {
		if t, err := time.Parse(layout, s); err == nil {
			return t
		}
	}
	return time.Time{}
}
func timeValue(t time.Time) any {
	if t.IsZero() {
		return nil
	}
	return iso(t)
}
func readObject(path string) row {
	f, err := os.Open(path)
	if err != nil {
		return row{}
	}
	defer f.Close()
	body, err := io.ReadAll(io.LimitReader(f, 8*1024*1024+1))
	if err != nil || len(body) > 8*1024*1024 {
		return row{}
	}
	var value row
	if json.Unmarshal(body, &value) != nil || value == nil {
		return row{}
	}
	return value
}
func byName(items []row, field string) map[string]row {
	result := map[string]row{}
	for _, item := range items {
		result[text(item[field])] = item
	}
	return result
}
func keyValues(body, separator string) map[string]string {
	result := map[string]string{}
	for _, line := range strings.Split(body, "\n") {
		key, value, ok := strings.Cut(line, separator)
		if ok {
			result[key] = strings.TrimSpace(value)
		}
	}
	return result
}

// Store each point's denominator so calibration changes rescale history once.
// Legacy points use the allocation from the previous snapshot.
func normalizeCPUHistory(history []row, legacyCapacity, capacity float64) []row {
	for _, point := range history {
		old := numeric(point["cpu_capacity_cores"])
		if old <= 0 {
			old = legacyCapacity
		}
		if point["cpu_percent"] != nil {
			value, valid := finiteNonnegative(point["cpu_percent"])
			if !valid || old <= 0 || math.IsNaN(old) || math.IsInf(old, 0) || capacity <= 0 || math.IsNaN(capacity) || math.IsInf(capacity, 0) {
				point["cpu_percent"] = nil
			} else if old != capacity {
				point["cpu_percent"] = round(value*old/capacity, 2)
			}
		}
		point["cpu_capacity_cores"] = capacity
	}
	return history
}

func retainHistory(previous []row, point row, now time.Time) []row {
	result := []row{}
	for _, p := range previous {
		t := timestamp(p["at"])
		if !t.IsZero() && !t.Before(now.Add(-24*time.Hour)) && t.Before(now) {
			result = append(result, p)
		}
	}
	result = append(result, point)
	if len(result) > 1441 {
		result = result[len(result)-1441:]
	}
	return result
}

func finiteNonnegative(value any) (float64, bool) {
	switch value.(type) {
	case float64, int, int64, uint64:
		n := numeric(value)
		return n, n >= 0 && !math.IsNaN(n) && !math.IsInf(n, 0)
	default:
		return 0, false
	}
}

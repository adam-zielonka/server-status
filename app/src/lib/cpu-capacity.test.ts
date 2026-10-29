import { describe, expect, it } from 'vitest'
import { cpuCapacityDescription, cpuRelativePercent } from './cpu-capacity'
import { demoTelemetry } from './demo'
import { chartHistory, monitoringIssues } from './monitoring'

const now = Date.parse('2026-01-02T12:00:00Z')
const snapshot = () => {
  const s = demoTelemetry(now)
  s.cpu_capacity = { peak_cores: 0.8, observed_since: new Date(now - 86400000).toISOString() }
  return s
}
const point = (percent: number | null, capacity = 2) => ({
  at: new Date(now).toISOString(),
  cpu_percent: percent,
  cpu_capacity_cores: capacity,
  memory_percent: 20,
  disk_percent: 30,
})

describe('CPU capacity relative to the durable observed peak', () => {
  it('uses one common peak and rescales old points after a new record', () => {
    const s = snapshot()
    const points = [point(20), point(40)]
    expect(points.map((p) => cpuRelativePercent(p, s))).toEqual([50, 100])
    s.cpu_capacity!.peak_cores = 1.6
    expect([...points, point(80)].map((p) => cpuRelativePercent(p, s))).toEqual([25, 50, 100])
  })
  it('is independent of calibration and history retention', () => {
    const s = snapshot()
    s.cpu_capacity!.peak_cores = 1
    expect(cpuRelativePercent(point(50, 2), s)).toBe(100)
    expect(cpuRelativePercent(point(100, 1), s)).toBe(100)
    s.history = []
    expect(cpuRelativePercent(point(25, 2), s)).toBe(50)
  })
  it('preserves zero, unavailable, invalid, legacy and gap semantics', () => {
    const s = snapshot()
    expect(cpuRelativePercent(point(0), s)).toBe(0)
    for (const p of [undefined, point(null), point(-1), point(NaN), point(Infinity)])
      expect(cpuRelativePercent(p, s)).toBeNull()
    for (const peak of [0, -1, NaN, Infinity]) {
      s.cpu_capacity!.peak_cores = peak
      expect(cpuRelativePercent(point(20), s)).toBeNull()
    }
    delete s.cpu_capacity
    expect(cpuRelativePercent(point(20), s)).toBeNull()
    expect(cpuCapacityDescription(s)).toMatch(/unavailable/)
    const points = chartHistory(
      [point(20), { ...point(40), at: new Date(now + 600000).toISOString() }],
      now,
      now + 600000,
      180,
    )
    expect(points.map((p) => cpuRelativePercent(p, snapshot()))).toEqual([50, null, 100])
  })
  it('does not change raw resource alerts or process CPU', () => {
    const s = snapshot()
    s.history = [point(96)]
    const before = JSON.stringify(s)
    const issues = monitoringIssues(s, now)
    expect(cpuRelativePercent(s.history[0], s)).toBe(100)
    expect(monitoringIssues(s, now)).toEqual(issues)
    expect(JSON.stringify(s)).toBe(before)
    expect(cpuCapacityDescription(s)).toMatch(/highest observed use.*since/)
  })
})

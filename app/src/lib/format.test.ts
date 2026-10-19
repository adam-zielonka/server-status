import { describe, expect, it } from 'vitest'
import { formatBytes, formatDate, formatDuration, formatPercent, safeWorkflowUrl } from './format'

describe('metric formatting', () => {
  it.each([
    [0, '0 B'],
    [1024, '1 KB'],
    [1024 ** 2, '1 MB'],
    [1024 ** 3 * 1.25, '1.3 GB'],
    [-1024, '-1 KB'],
    [0.5, '0.5 B'],
  ])('formats %s bytes as %s', (value, expected) => expect(formatBytes(value)).toBe(expected))
  it.each([undefined, null, NaN, Infinity, 'private-value'])(
    'marks invalid byte values unavailable: %s',
    (value) => expect(formatBytes(value)).toBe('Unavailable'),
  )
  it.each([
    [0, 'Less than a second'],
    [1, '1 second'],
    [60, '1 minute'],
    [3661, '1 hour 1 minute'],
    [90000, '1 day 1 hour'],
  ])('formats durations: %s', (value, expected) => expect(formatDuration(value)).toBe(expected))
  it('does not confuse missing durations or percentages with zero', () => {
    expect(formatDuration(null)).toBe('Unavailable')
    expect(formatPercent(0)).toBe('0.0%')
    expect(formatPercent(null)).toBe('Unavailable')
    expect(formatPercent(12.345)).toBe('12.3%')
    expect(formatDate('not-a-date')).toBe('Not available')
  })
})

describe('workflow links', () => {
  it('accepts only HTTPS GitHub links without credentials', () => {
    expect(safeWorkflowUrl('https://github.com/example/project/actions/runs/1')).toBe(
      'https://github.com/example/project/actions/runs/1',
    )
    for (const value of [
      'javascript:alert(1)',
      'https://github.com.evil.example/path',
      'http://github.com/path',
      'https://user:pass@github.com/path',
      'invalid',
    ])
      expect(safeWorkflowUrl(value)).toBeUndefined()
  })
})

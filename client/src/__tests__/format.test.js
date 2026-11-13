// @vitest-environment node
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { formatDate, formatDateTime, formatMoney, relativeTime } from '../utils/format.js'

const SRC = fileURLToPath(new URL('..', import.meta.url))

function sourceFiles(dir) {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name)
    if (statSync(path).isDirectory()) return name === '__tests__' ? [] : sourceFiles(path)
    return /\.(jsx?|tsx?)$/.test(name) ? [path] : []
  })
}

describe('utils/format (en-IN)', () => {
  // Local-time constructors keep these independent of the machine's time zone.
  const date = new Date(2026, 10, 12, 13, 34)

  it('a1. formats dates as "12 Nov 2026"', () => {
    expect(formatDate(date)).toBe('12 Nov 2026')
    expect(formatDate(date.toISOString())).toBe('12 Nov 2026')
    expect(formatDate(null)).toBe('—')
    expect(formatDate('not a date', 'unknown')).toBe('unknown')
  })

  it('a2. formats date-times as "12 Nov 2026, 1:34 pm"', () => {
    expect(formatDateTime(date)).toBe('12 Nov 2026, 1:34 pm')
  })

  it('a3. formats relative times', () => {
    const now = date.getTime()
    expect(relativeTime(new Date(now - 3 * 3_600_000), now)).toBe('3 hours ago')
    expect(relativeTime(new Date(now - 86_400_000), now)).toBe('yesterday')
    expect(relativeTime(new Date(now - 10_000), now)).toBe('just now')
    expect(relativeTime(new Date(now + 2 * 86_400_000), now)).toBe('in 2 days')
  })

  it('a4. formats money with Indian grouping', () => {
    expect(formatMoney(22543)).toBe('₹22,543')
    expect(formatMoney(123456789)).toBe('₹12,34,56,789')
    expect(formatMoney(0)).toBe('₹0')
  })
})

describe('no ad-hoc date or number formatting', () => {
  it('g. toLocale* is only used inside utils/format.js', () => {
    const offenders = sourceFiles(SRC)
      .filter((file) => !file.endsWith(join('utils', 'format.js')))
      .filter((file) => /\.toLocale(Date|Time)?String\(/.test(readFileSync(file, 'utf8')))
      .map((file) => relative(SRC, file))
    expect(offenders).toEqual([])
  })
})

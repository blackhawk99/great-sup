import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('./coastlineAnalysis.js', () => ({
  calculateGeographicProtection: vi.fn(async () => ({
    protectionScore: 80, windProtection: 0.6, waveProtection: 0.5,
    bayEnclosure: 0.8, isProtected: true
  }))
}))

import { calculateGeographicProtection } from './coastlineAnalysis.js'
import {
  scoreHourlySeries, findBestWindow, findPeakHour, summariseDay, rankSummaries
} from './dayPlan.js'

const hour = (h: number, over: Record<string, unknown> = {}) => ({
  time: `2026-08-18T${String(h).padStart(2, '0')}:00`,
  temperature: 26, precipitation: 0, cloudcover: 10,
  windSpeed: 10, windGusts: 14, windDirection: 45,
  weatherCode: 1, waveHeight: 0.2, swellHeight: 0.15, swellPeriod: 8,
  waveDirection: 60, waterTemperature: 24,
  tideHeight: 1.2, currentSpeed: 0.1, currentDirection: 90,
  ...over
})

const fullDay = (windByHour: (h: number) => number) =>
  Array.from({ length: 24 }, (_, h) => hour(h, { windSpeed: windByHour(h), windGusts: windByHour(h) * 1.3 }))

const beach = { id: 'b1', name: 'Test Bay', latitude: 37.3255, longitude: 23.4486 }

beforeEach(() => { vi.mocked(calculateGeographicProtection).mockClear() })

describe('scoreHourlySeries', () => {
  it('scores only daylight hours', async () => {
    const { hourly } = await scoreHourlySeries(beach, fullDay(() => 8))
    expect(hourly).toHaveLength(15)
    expect(hourly[0].hour).toBe(6)
    expect(hourly[14].hour).toBe(20)
  })

  it('runs the coastline analysis once for the whole day, not once per hour', async () => {
    await scoreHourlySeries(beach, fullDay((h) => 5 + h))
    expect(calculateGeographicProtection).toHaveBeenCalledTimes(1)
  })

  it('tracks conditions changing through the day', async () => {
    const { hourly } = await scoreHourlySeries(beach, fullDay((h) => (h < 12 ? 5 : 40)))
    const morning = hourly.find((e) => e.hour === 8)!
    const afternoon = hourly.find((e) => e.hour === 16)!
    expect(morning.score).toBeGreaterThan(afternoon.score)
  })

  it('returns nothing when the forecast has no daylight hours', async () => {
    const result = await scoreHourlySeries(beach, [hour(2), hour(3)])
    expect(result.hourly).toEqual([])
    expect(result.protection).toBeNull()
  })

  it('keys off the timestamp rather than array position', async () => {
    const partial = [hour(8), hour(9), hour(10)]
    const { hourly } = await scoreHourlySeries(beach, partial)
    expect(hourly.map((e) => e.hour)).toEqual([8, 9, 10])
  })
})

describe('findBestWindow', () => {
  const series = (scores: number[]) => scores.map((score, i) => ({ hour: 6 + i, score }))

  it('finds the longest qualifying run', () => {
    expect(findBestWindow(series([60, 80, 85, 90, 60, 80, 80]))).toEqual({
      startHour: 7, endHour: 9, length: 3
    })
  })

  it('includes a run that reaches the end of the day', () => {
    expect(findBestWindow(series([60, 60, 80, 85, 90]))).toEqual({
      startHour: 8, endHour: 10, length: 3
    })
  })

  it('rejects a single good hour as too short to be a window', () => {
    expect(findBestWindow(series([60, 90, 60]))).toBeNull()
  })

  it('returns null when nothing clears the threshold', () => {
    expect(findBestWindow(series([40, 50, 60, 70]))).toBeNull()
  })

  it('honours a custom threshold', () => {
    expect(findBestWindow(series([60, 65, 68]), 60)).toEqual({
      startHour: 6, endHour: 8, length: 3
    })
  })
})

describe('findPeakHour', () => {
  it('returns the best hour', () => {
    const peak = findPeakHour([{ hour: 6, score: 70 }, { hour: 7, score: 91 }, { hour: 8, score: 80 }])
    expect(peak).toEqual({ hour: 7, score: 91 })
  })

  it('returns null for an empty day', () => {
    expect(findPeakHour([])).toBeNull()
  })
})

describe('summariseDay', () => {
  it('headlines the peak hour and names the window', async () => {
    const { hourly } = await scoreHourlySeries(beach, fullDay((h) => (h < 13 ? 4 : 45)))
    const summary = summariseDay(beach, hourly)!
    expect(summary.score).toBe(Math.max(...hourly.map((e) => e.score)))
    expect(summary.window).not.toBeNull()
    expect(summary.window!.startHour).toBe(6)
  })

  it('reports no window when the wind never drops', async () => {
    const { hourly } = await scoreHourlySeries(beach, fullDay(() => 60))
    expect(summariseDay(beach, hourly)!.window).toBeNull()
  })
})

describe('rankSummaries', () => {
  it('orders by score, then name, with unscored spots last', () => {
    const ranked = rankSummaries([
      { beach: { name: 'Beta' }, summary: { score: 70 } },
      { beach: { name: 'Alpha' }, summary: null },
      { beach: { name: 'Delta' }, summary: { score: 91 } },
      { beach: { name: 'Gamma' }, summary: { score: 70 } }
    ])
    expect(ranked.map((r) => r.beach.name)).toEqual(['Delta', 'Beta', 'Gamma', 'Alpha'])
  })
})

import { describe, it, expect } from 'vitest'
import { getTier, tierInk, tierFill, formatHour, formatWindow } from './conditionTiers.js'

describe('getTier', () => {
  it('maps each band by its lower bound', () => {
    expect(getTier(100).key).toBe('perfect')
    expect(getTier(85).key).toBe('perfect')
    expect(getTier(84).key).toBe('okay')
    expect(getTier(70).key).toBe('okay')
    expect(getTier(69).key).toBe('poor')
    expect(getTier(50).key).toBe('poor')
    expect(getTier(49).key).toBe('nope')
    expect(getTier(0).key).toBe('nope')
  })

  it('treats a missing score as the worst band rather than throwing', () => {
    expect(getTier(undefined).key).toBe('nope')
    expect(getTier(NaN).key).toBe('nope')
  })
})

describe('theme colours', () => {
  it('returns lighter ink in dark mode so numerals stay legible', () => {
    expect(tierInk(90, false)).toBe('#16a34a')
    expect(tierInk(90, true)).toBe('#4ade80')
    expect(tierFill(40, false)).toBe('#ef4444')
    expect(tierFill(40, true)).toBe('#f87171')
  })
})

describe('formatting', () => {
  it('zero-pads hours', () => {
    expect(formatHour(6)).toBe('06:00')
    expect(formatHour(20)).toBe('20:00')
  })

  it('formats a window and handles its absence', () => {
    expect(formatWindow({ startHour: 6, endHour: 12 })).toBe('06:00 – 12:00')
    expect(formatWindow(null)).toBeNull()
  })
})

import { describe, it, expect, vi } from 'vitest'

// Mock the coastlineAnalysis module
vi.mock('./coastlineAnalysis', () => ({
  calculateGeographicProtection: vi.fn().mockResolvedValue({
    windProtection: 0.5,
    waveProtection: 0.5,
    protectionScore: 50,
    bayEnclosure: 0.5,
  }),
}))

// Import after mock
import { calculatePaddleScore } from './scoreCalculator'

describe('scoreCalculator', () => {
  const mockBeach = {
    latitude: 37.5,
    longitude: 23.5,
    name: 'Test Beach',
  }

  describe('calculatePaddleScore', () => {
    it('returns high score for perfect conditions', async () => {
      const perfectConditions = [
        {
          time: '2024-01-01T10:00',
          windSpeed: 5,
          windGusts: 7,
          windDirection: 180,
          waveHeight: 0.2,
          waveDirection: 180,
          swellHeight: 0.1,
          swellPeriod: 10,
          precipitation: 0,
          temperature: 24,
          waterTemperature: 22,
          cloudcover: 20,
          tideHeight: 1.0,
          currentSpeed: 0.2,
          weatherCode: 0,
        },
      ]

      const result = await calculatePaddleScore(
        mockBeach,
        perfectConditions,
        { startIndex: 0, endIndex: 0 }
      )

      expect(result.totalScore).toBeGreaterThan(70)
      expect(result.dataQuality).toBe(100)
      expect(result.warnings).toHaveLength(0)
      expect(result.hasThunderstorm).toBe(false)
    })

    it('returns low score for dangerous conditions', async () => {
      const dangerousConditions = [
        {
          time: '2024-01-01T10:00',
          windSpeed: 35,
          windGusts: 50,
          windDirection: 180,
          waveHeight: 2.5,
          waveDirection: 180,
          swellHeight: 2.0,
          swellPeriod: 4,
          precipitation: 10,
          temperature: 8,
          waterTemperature: 10,
          cloudcover: 100,
          tideHeight: 0.1,
          currentSpeed: 2.0,
          weatherCode: 0,
        },
      ]

      const result = await calculatePaddleScore(
        mockBeach,
        dangerousConditions,
        { startIndex: 0, endIndex: 0 }
      )

      expect(result.totalScore).toBeLessThan(30)
      expect(result.warnings.length).toBeGreaterThan(0)
    })

    it('caps score at 20 for thunderstorm conditions', async () => {
      const thunderstormConditions = [
        {
          time: '2024-01-01T10:00',
          windSpeed: 5,
          windGusts: 7,
          windDirection: 180,
          waveHeight: 0.2,
          waveDirection: 180,
          swellHeight: 0.1,
          swellPeriod: 10,
          precipitation: 5,
          temperature: 24,
          waterTemperature: 22,
          cloudcover: 80,
          tideHeight: 1.0,
          currentSpeed: 0.2,
          weatherCode: 95, // Thunderstorm
        },
      ]

      const result = await calculatePaddleScore(
        mockBeach,
        thunderstormConditions,
        { startIndex: 0, endIndex: 0 }
      )

      expect(result.totalScore).toBeLessThanOrEqual(20)
      expect(result.hasThunderstorm).toBe(true)
      expect(result.warnings.some(w => w.includes('THUNDERSTORM'))).toBe(true)
    })

    it('warns about cold water temperatures', async () => {
      const coldWaterConditions = [
        {
          time: '2024-01-01T10:00',
          windSpeed: 5,
          windGusts: 7,
          windDirection: 180,
          waveHeight: 0.2,
          waveDirection: 180,
          swellHeight: 0.1,
          swellPeriod: 10,
          precipitation: 0,
          temperature: 20,
          waterTemperature: 12, // Cold water
          cloudcover: 20,
          tideHeight: 1.0,
          currentSpeed: 0.2,
          weatherCode: 0,
        },
      ]

      const result = await calculatePaddleScore(
        mockBeach,
        coldWaterConditions,
        { startIndex: 0, endIndex: 0 }
      )

      expect(result.warnings.some(w => w.includes('Cold water') || w.includes('hypothermia'))).toBe(true)
    })

    it('handles missing data with worst-case defaults', async () => {
      const missingDataConditions = [
        {
          time: '2024-01-01T10:00',
          windSpeed: null,
          windGusts: undefined,
          windDirection: 180,
          waveHeight: null,
          waveDirection: 180,
          swellHeight: null,
          swellPeriod: null,
          precipitation: null,
          temperature: null,
          waterTemperature: null,
          cloudcover: null,
          tideHeight: null,
          currentSpeed: null,
          weatherCode: 0,
        },
      ]

      const result = await calculatePaddleScore(
        mockBeach,
        missingDataConditions,
        { startIndex: 0, endIndex: 0 }
      )

      // Should still return a result
      expect(result.totalScore).toBeDefined()
      expect(result.totalScore).toBeGreaterThanOrEqual(0)
      expect(result.totalScore).toBeLessThanOrEqual(100)
      // Data quality should be low due to missing data
      expect(result.dataQuality).toBeLessThan(100)
    })

    it('calculates average conditions over multiple hours', async () => {
      const multiHourConditions = [
        {
          time: '2024-01-01T10:00',
          windSpeed: 10,
          windGusts: 12,
          windDirection: 180,
          waveHeight: 0.5,
          waveDirection: 180,
          swellHeight: 0.3,
          swellPeriod: 8,
          precipitation: 0,
          temperature: 22,
          waterTemperature: 20,
          cloudcover: 30,
          tideHeight: 1.0,
          currentSpeed: 0.3,
          weatherCode: 0,
        },
        {
          time: '2024-01-01T11:00',
          windSpeed: 15,
          windGusts: 18,
          windDirection: 180,
          waveHeight: 0.8,
          waveDirection: 180,
          swellHeight: 0.5,
          swellPeriod: 7,
          precipitation: 0,
          temperature: 24,
          waterTemperature: 21,
          cloudcover: 40,
          tideHeight: 1.2,
          currentSpeed: 0.4,
          weatherCode: 0,
        },
        {
          time: '2024-01-01T12:00',
          windSpeed: 20,
          windGusts: 25,
          windDirection: 180,
          waveHeight: 1.0,
          waveDirection: 180,
          swellHeight: 0.7,
          swellPeriod: 6,
          precipitation: 1,
          temperature: 25,
          waterTemperature: 22,
          cloudcover: 50,
          tideHeight: 1.4,
          currentSpeed: 0.5,
          weatherCode: 0,
        },
      ]

      const result = await calculatePaddleScore(
        mockBeach,
        multiHourConditions,
        { startIndex: 0, endIndex: 2 }
      )

      expect(result.totalScore).toBeDefined()
      expect(result.breakdown).toBeDefined()
      // Wind breakdown should reflect averaged conditions
      expect(result.breakdown.wind.value).toBeGreaterThan(0)
    })

    it('returns correct breakdown structure', async () => {
      const conditions = [
        {
          time: '2024-01-01T10:00',
          windSpeed: 10,
          windGusts: 12,
          windDirection: 180,
          waveHeight: 0.5,
          waveDirection: 180,
          swellHeight: 0.3,
          swellPeriod: 8,
          precipitation: 0,
          temperature: 22,
          waterTemperature: 20,
          cloudcover: 30,
          tideHeight: 1.0,
          currentSpeed: 0.3,
          weatherCode: 0,
        },
      ]

      const result = await calculatePaddleScore(
        mockBeach,
        conditions,
        { startIndex: 0, endIndex: 0 }
      )

      expect(result.breakdown).toHaveProperty('wind')
      expect(result.breakdown).toHaveProperty('waves')
      expect(result.breakdown).toHaveProperty('swell')
      expect(result.breakdown).toHaveProperty('gusts')
      expect(result.breakdown).toHaveProperty('precipitation')
      expect(result.breakdown).toHaveProperty('temperature')
      expect(result.breakdown).toHaveProperty('waterTemperature')
      expect(result.breakdown).toHaveProperty('cloudcover')
      expect(result.breakdown).toHaveProperty('geographic')
      expect(result.breakdown).toHaveProperty('tide')
      expect(result.breakdown).toHaveProperty('currents')

      // Each breakdown should have value and score
      expect(result.breakdown.wind).toHaveProperty('value')
      expect(result.breakdown.wind).toHaveProperty('score')
    })

    it('warns about strong gusts', async () => {
      const gustyConditions = [
        {
          time: '2024-01-01T10:00',
          windSpeed: 10,
          windGusts: 25, // Gusts 2.5x wind speed
          windDirection: 180,
          waveHeight: 0.5,
          waveDirection: 180,
          swellHeight: 0.3,
          swellPeriod: 8,
          precipitation: 0,
          temperature: 22,
          waterTemperature: 20,
          cloudcover: 30,
          tideHeight: 1.0,
          currentSpeed: 0.3,
          weatherCode: 0,
        },
      ]

      const result = await calculatePaddleScore(
        mockBeach,
        gustyConditions,
        { startIndex: 0, endIndex: 0 }
      )

      expect(result.warnings.some(w => w.toLowerCase().includes('gust'))).toBe(true)
    })

    it('warns about strong currents', async () => {
      const strongCurrentConditions = [
        {
          time: '2024-01-01T10:00',
          windSpeed: 5,
          windGusts: 7,
          windDirection: 180,
          waveHeight: 0.2,
          waveDirection: 180,
          swellHeight: 0.1,
          swellPeriod: 10,
          precipitation: 0,
          temperature: 22,
          waterTemperature: 20,
          cloudcover: 30,
          tideHeight: 1.0,
          currentSpeed: 1.5, // Strong current
          weatherCode: 0,
        },
      ]

      const result = await calculatePaddleScore(
        mockBeach,
        strongCurrentConditions,
        { startIndex: 0, endIndex: 0 }
      )

      expect(result.warnings.some(w => w.toLowerCase().includes('current'))).toBe(true)
    })
  })
})

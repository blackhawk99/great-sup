import { describe, it, expect, vi, beforeEach } from 'vitest'
import { fetchPaddleConditions, isThunderstormCode, getWeatherDescription } from './WeatherService'

describe('WeatherService', () => {
  describe('isThunderstormCode', () => {
    it('returns true for thunderstorm codes (95-99)', () => {
      expect(isThunderstormCode(95)).toBe(true)
      expect(isThunderstormCode(96)).toBe(true)
      expect(isThunderstormCode(97)).toBe(true)
      expect(isThunderstormCode(98)).toBe(true)
      expect(isThunderstormCode(99)).toBe(true)
    })

    it('returns false for non-thunderstorm codes', () => {
      expect(isThunderstormCode(0)).toBe(false)
      expect(isThunderstormCode(1)).toBe(false)
      expect(isThunderstormCode(61)).toBe(false)
      expect(isThunderstormCode(80)).toBe(false)
      expect(isThunderstormCode(94)).toBe(false)
      expect(isThunderstormCode(100)).toBe(false)
    })
  })

  describe('getWeatherDescription', () => {
    it('returns correct description for known codes', () => {
      expect(getWeatherDescription(0)).toBe('Clear sky')
      expect(getWeatherDescription(1)).toBe('Mainly clear')
      expect(getWeatherDescription(2)).toBe('Partly cloudy')
      expect(getWeatherDescription(3)).toBe('Overcast')
      expect(getWeatherDescription(45)).toBe('Fog')
      expect(getWeatherDescription(61)).toBe('Slight rain')
      expect(getWeatherDescription(95)).toBe('Thunderstorm')
      expect(getWeatherDescription(99)).toBe('Thunderstorm with heavy hail')
    })

    it('returns fallback description for unknown codes', () => {
      expect(getWeatherDescription(50)).toBe('Weather code 50')
      expect(getWeatherDescription(100)).toBe('Weather code 100')
      expect(getWeatherDescription(-1)).toBe('Weather code -1')
    })
  })

  describe('fetchPaddleConditions', () => {
    beforeEach(() => {
      vi.resetAllMocks()
    })

    it('fetches and combines weather, marine, and current data', async () => {
      const mockWeatherResponse = {
        hourly: {
          time: ['2024-01-01T10:00', '2024-01-01T11:00'],
          temperature_2m: [22, 23],
          precipitation: [0, 0],
          cloudcover: [30, 40],
          windspeed_10m: [10, 12],
          windgusts_10m: [15, 18],
          winddirection_10m: [180, 185],
          weather_code: [0, 1],
        },
      }

      const mockMarineResponse = {
        hourly: {
          wave_height: [0.5, 0.6],
          swell_wave_height: [0.3, 0.4],
          swell_wave_period: [8, 9],
          wave_direction: [180, 185],
          tide_height: [1.0, 1.1],
          sea_surface_temperature: [20, 21],
        },
      }

      const mockCurrentsResponse = {
        hourly: {
          current_speed: [0.3, 0.4],
          current_direction: [90, 95],
        },
      }

      global.fetch = vi.fn()
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(mockWeatherResponse),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(mockMarineResponse),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(mockCurrentsResponse),
        })

      const result = await fetchPaddleConditions({
        latitude: 37.5,
        longitude: 23.5,
        startDate: '2024-01-01',
        endDate: '2024-01-01',
      })

      expect(result).toHaveLength(2)
      expect(result[0]).toMatchObject({
        time: '2024-01-01T10:00',
        temperature: 22,
        precipitation: 0,
        cloudcover: 30,
        windSpeed: 10,
        windGusts: 15,
        windDirection: 180,
        weatherCode: 0,
        waveHeight: 0.5,
        swellHeight: 0.3,
        swellPeriod: 8,
        waveDirection: 180,
        waterTemperature: 20,
        tideHeight: 1.0,
        currentSpeed: 0.3,
        currentDirection: 90,
      })
    })

    it('throws error when weather fetch fails', async () => {
      global.fetch = vi.fn().mockResolvedValueOnce({
        ok: false,
        status: 500,
      })

      await expect(
        fetchPaddleConditions({
          latitude: 37.5,
          longitude: 23.5,
          startDate: '2024-01-01',
          endDate: '2024-01-01',
        })
      ).rejects.toThrow('Weather fetch failed')
    })

    it('throws error when marine fetch fails', async () => {
      global.fetch = vi.fn()
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ hourly: { time: [] } }),
        })
        .mockResolvedValueOnce({
          ok: false,
          status: 500,
        })

      await expect(
        fetchPaddleConditions({
          latitude: 37.5,
          longitude: 23.5,
          startDate: '2024-01-01',
          endDate: '2024-01-01',
        })
      ).rejects.toThrow('Marine fetch failed')
    })

    it('handles mismatched data lengths gracefully', async () => {
      const mockWeatherResponse = {
        hourly: {
          time: ['2024-01-01T10:00', '2024-01-01T11:00', '2024-01-01T12:00'],
          temperature_2m: [22, 23, 24],
          precipitation: [0, 0, 0],
          cloudcover: [30, 40, 50],
          windspeed_10m: [10, 12, 14],
          windgusts_10m: [15, 18, 20],
          winddirection_10m: [180, 185, 190],
          weather_code: [0, 1, 2],
        },
      }

      // Marine has fewer entries
      const mockMarineResponse = {
        hourly: {
          wave_height: [0.5],
          swell_wave_height: [0.3],
          swell_wave_period: [8],
          wave_direction: [180],
          tide_height: [1.0],
          sea_surface_temperature: [20],
        },
      }

      const mockCurrentsResponse = {
        hourly: {
          current_speed: [0.3, 0.4],
          current_direction: [90, 95],
        },
      }

      global.fetch = vi.fn()
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(mockWeatherResponse),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(mockMarineResponse),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(mockCurrentsResponse),
        })

      const result = await fetchPaddleConditions({
        latitude: 37.5,
        longitude: 23.5,
        startDate: '2024-01-01',
        endDate: '2024-01-01',
      })

      // Should return all weather hours
      expect(result).toHaveLength(3)
      // Missing marine data should be undefined
      expect(result[2].waveHeight).toBeUndefined()
      expect(result[2].currentSpeed).toBeUndefined()
    })
  })
})

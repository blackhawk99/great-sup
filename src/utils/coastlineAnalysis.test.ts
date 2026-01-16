import { describe, it, expect, vi } from 'vitest'

// Mock the large data files before importing coastlineAnalysis
vi.mock('../data/greece-coastlines', () => ({
  greeceCoastlines: { type: 'FeatureCollection', features: [] }
}))

vi.mock('../data/greece-islands', () => ({
  greeceIslands: { type: 'FeatureCollection', features: [] }
}))

import {
  generateRays,
  calculateDirectionalExposure,
  getCardinalDirection,
  generateProtectionDescription,
} from './coastlineAnalysis'

// Mock turf.js for ray generation tests
vi.mock('@turf/turf', async () => {
  const actual = await vi.importActual('@turf/turf') as any
  return {
    ...actual,
    point: (coords: number[]) => ({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: coords },
      properties: {},
    }),
    destination: (_center: any, distance: number, angle: number) => ({
      type: 'Feature',
      geometry: {
        type: 'Point',
        coordinates: [
          Math.cos((angle * Math.PI) / 180) * distance,
          Math.sin((angle * Math.PI) / 180) * distance,
        ],
      },
      properties: {},
    }),
    lineString: (coords: number[][]) => ({
      type: 'Feature',
      geometry: { type: 'LineString', coordinates: coords },
      properties: {},
    }),
  }
})

describe('coastlineAnalysis', () => {
  describe('generateRays', () => {
    it('generates correct number of rays', () => {
      const center = {
        type: 'Feature' as const,
        geometry: { type: 'Point' as const, coordinates: [23.5, 37.5] },
        properties: {},
      }
      const rays = generateRays(center, 36, 1.0)

      expect(rays).toHaveLength(36)
    })

    it('generates rays with correct structure', () => {
      const center = {
        type: 'Feature' as const,
        geometry: { type: 'Point' as const, coordinates: [23.5, 37.5] },
        properties: {},
      }
      const rays = generateRays(center, 4, 1.0)

      expect(rays).toHaveLength(4)
      rays.forEach(ray => {
        expect(ray.type).toBe('Feature')
        expect(ray.geometry.type).toBe('LineString')
        expect(ray.geometry.coordinates).toHaveLength(2)
      })
    })
  })

  describe('calculateDirectionalExposure', () => {
    it('returns 0 for identical directions', () => {
      expect(calculateDirectionalExposure(180, 180)).toBe(0)
      expect(calculateDirectionalExposure(0, 0)).toBe(0)
      expect(calculateDirectionalExposure(90, 90)).toBe(0)
    })

    it('returns 180 for opposite directions', () => {
      expect(calculateDirectionalExposure(0, 180)).toBe(180)
      expect(calculateDirectionalExposure(90, 270)).toBe(180)
      expect(calculateDirectionalExposure(45, 225)).toBe(180)
    })

    it('returns 90 for perpendicular directions', () => {
      expect(calculateDirectionalExposure(0, 90)).toBe(90)
      expect(calculateDirectionalExposure(180, 270)).toBe(90)
      expect(calculateDirectionalExposure(45, 135)).toBe(90)
    })

    it('handles negative angles by normalizing', () => {
      expect(calculateDirectionalExposure(-90, 0)).toBe(90)
      expect(calculateDirectionalExposure(0, -90)).toBe(90)
    })

    it('handles angles > 360 by normalizing', () => {
      expect(calculateDirectionalExposure(450, 90)).toBe(0) // 450 = 90
      expect(calculateDirectionalExposure(720, 0)).toBe(0)  // 720 = 0
    })
  })

  describe('getCardinalDirection', () => {
    it('returns correct cardinal directions', () => {
      expect(getCardinalDirection(0)).toBe('N')
      expect(getCardinalDirection(90)).toBe('E')
      expect(getCardinalDirection(180)).toBe('S')
      expect(getCardinalDirection(270)).toBe('W')
    })

    it('returns correct intermediate directions', () => {
      expect(getCardinalDirection(45)).toBe('NE')
      expect(getCardinalDirection(135)).toBe('SE')
      expect(getCardinalDirection(225)).toBe('SW')
      expect(getCardinalDirection(315)).toBe('NW')
    })

    it('returns correct fine directions', () => {
      expect(getCardinalDirection(22.5)).toBe('NNE')
      expect(getCardinalDirection(67.5)).toBe('ENE')
      expect(getCardinalDirection(112.5)).toBe('ESE')
      expect(getCardinalDirection(157.5)).toBe('SSE')
    })

    it('wraps around at 360 degrees', () => {
      expect(getCardinalDirection(360)).toBe('N')
      expect(getCardinalDirection(361)).toBe('N')
    })
  })

  describe('generateProtectionDescription', () => {
    it('describes well-protected bays with excellent protection', () => {
      const description = generateProtectionDescription(0.8, 90, 0.8, 0.8).toLowerCase()

      expect(description).toContain('well-protected bay')
      expect(description).toContain('excellent')
      expect(description).toContain('e') // East-facing
    })

    it('describes exposed beaches with limited protection', () => {
      const description = generateProtectionDescription(0.2, 180, 0.2, 0.2).toLowerCase()

      expect(description).toContain('exposed beach')
      expect(description).toContain('limited protection')
      expect(description).toContain('s') // South-facing
    })

    it('describes moderately protected beaches', () => {
      const description = generateProtectionDescription(0.5, 270, 0.5, 0.5).toLowerCase()

      expect(description).toContain('moderately protected')
      expect(description).toContain('w') // West-facing
    })

    it('includes correct cardinal direction in description', () => {
      expect(generateProtectionDescription(0.5, 0, 0.5, 0.5)).toContain('N')
      expect(generateProtectionDescription(0.5, 45, 0.5, 0.5)).toContain('NE')
      expect(generateProtectionDescription(0.5, 90, 0.5, 0.5)).toContain('E')
    })
  })
})

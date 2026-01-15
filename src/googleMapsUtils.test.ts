import { describe, it, expect } from 'vitest'
import { parseGoogleMapsUrl } from './googleMapsUtils'

describe('googleMapsUtils', () => {
  describe('parseGoogleMapsUrl', () => {
    it('returns null for empty or undefined input', () => {
      expect(parseGoogleMapsUrl('')).toBeNull()
      expect(parseGoogleMapsUrl(null as any)).toBeNull()
      expect(parseGoogleMapsUrl(undefined as any)).toBeNull()
    })

    it('parses @lat,lng format URLs', () => {
      const url = 'https://www.google.com/maps/@37.5234,23.4567,15z'
      const result = parseGoogleMapsUrl(url)

      expect(result).not.toBeNull()
      expect(result?.latitude).toBeCloseTo(37.5234, 4)
      expect(result?.longitude).toBeCloseTo(23.4567, 4)
      expect(result?.googleMapsUrl).toBe(url)
    })

    it('parses ?q=lat,lng format URLs', () => {
      const url = 'https://www.google.com/maps?q=37.5234,23.4567'
      const result = parseGoogleMapsUrl(url)

      expect(result).not.toBeNull()
      expect(result?.latitude).toBeCloseTo(37.5234, 4)
      expect(result?.longitude).toBeCloseTo(23.4567, 4)
    })

    it('handles negative coordinates', () => {
      const url = 'https://www.google.com/maps/@-33.8688,151.2093,15z'
      const result = parseGoogleMapsUrl(url)

      expect(result).not.toBeNull()
      expect(result?.latitude).toBeCloseTo(-33.8688, 4)
      expect(result?.longitude).toBeCloseTo(151.2093, 4)
    })

    it('extracts place name from /place/ URL pattern', () => {
      const url = 'https://www.google.com/maps/place/Vouliagmeni+Beach/@37.8123,23.7654,15z'
      const result = parseGoogleMapsUrl(url)

      expect(result).not.toBeNull()
      expect(result?.name).toBe('Vouliagmeni Beach')
      expect(result?.latitude).toBeCloseTo(37.8123, 4)
      expect(result?.longitude).toBeCloseTo(23.7654, 4)
    })

    it('returns null for goo.gl short URLs (to be handled by proxy)', () => {
      const url = 'https://goo.gl/maps/abc123'
      const result = parseGoogleMapsUrl(url)

      expect(result).toBeNull()
    })

    it('returns null for invalid URLs without coordinates', () => {
      expect(parseGoogleMapsUrl('https://www.google.com/maps')).toBeNull()
      expect(parseGoogleMapsUrl('https://example.com')).toBeNull()
      expect(parseGoogleMapsUrl('not a url')).toBeNull()
    })

    it('handles URLs with additional parameters', () => {
      const url = 'https://www.google.com/maps/@37.5234,23.4567,15z/data=!3m1!1e3'
      const result = parseGoogleMapsUrl(url)

      expect(result).not.toBeNull()
      expect(result?.latitude).toBeCloseTo(37.5234, 4)
      expect(result?.longitude).toBeCloseTo(23.4567, 4)
    })

    it('uses "New Beach" as default name when no name is found', () => {
      const url = 'https://www.google.com/maps/@37.5234,23.4567,15z'
      const result = parseGoogleMapsUrl(url)

      expect(result?.name).toBe('New Beach')
    })

    it('cleans up place names with plus signs', () => {
      const url = 'https://www.google.com/maps/place/Porto+Rafti+Beach/@37.8,23.9,15z'
      const result = parseGoogleMapsUrl(url)

      expect(result?.name).toBe('Porto Rafti Beach')
    })
  })
})

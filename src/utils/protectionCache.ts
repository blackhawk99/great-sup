const CACHE_KEY = 'geoProtectionCache_v1'

interface ProtectionData {
  protectionScore: number
  windProtection: number
  waveProtection: number
  bayEnclosure: number
  isProtected: boolean
  description?: string
  coastlineAngle?: number
  enclosureScore?: number
  analysisError?: boolean
  isDeepBay?: boolean
  debugInfo?: {
    shortEnclosure: number
    mediumEnclosure: number
    longEnclosure: number
    bayType: string
  }
}

type CacheStore = Record<string, ProtectionData>

function loadCache(): CacheStore {
  if (typeof localStorage === 'undefined') return {}
  try {
    const item = localStorage.getItem(CACHE_KEY)
    return item ? JSON.parse(item) : {}
  } catch {
    return {}
  }
}

function saveCache(cache: CacheStore): void {
  if (typeof localStorage === 'undefined') return
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(cache))
  } catch {
    // Ignore write errors (e.g., storage quota exceeded)
  }
}

const cache: CacheStore = loadCache()

export function getCachedProtection(key: string): ProtectionData | undefined {
  return cache[key]
}

export function setCachedProtection(key: string, value: ProtectionData): void {
  cache[key] = value
  saveCache(cache)
}

export function clearProtectionCache(): void {
  Object.keys(cache).forEach(key => delete cache[key])
  if (typeof localStorage !== 'undefined') {
    localStorage.removeItem(CACHE_KEY)
  }
}

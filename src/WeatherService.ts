// src/WeatherService.ts

export interface HourlyCondition {
  time: string
  temperature: number | undefined
  precipitation: number | undefined
  cloudcover: number | undefined
  windSpeed: number | undefined
  windGusts: number | undefined
  windDirection: number | undefined
  weatherCode: number | undefined
  waveHeight: number | undefined
  swellHeight: number | undefined
  swellPeriod: number | undefined
  waveDirection: number | undefined
  waterTemperature: number | undefined
  tideHeight: number | undefined
  currentSpeed: number | undefined
  currentDirection: number | undefined
}

interface FetchParams {
  latitude: number
  longitude: number
  startDate: string
  endDate: string
  timezone?: string
}

interface WeatherAPIResponse {
  hourly: {
    time: string[]
    temperature_2m?: number[]
    precipitation?: number[]
    cloudcover?: number[]
    windspeed_10m?: number[]
    windgusts_10m?: number[]
    winddirection_10m?: number[]
    weather_code?: number[]
  }
}

interface MarineAPIResponse {
  hourly?: {
    wave_height?: number[]
    swell_wave_height?: number[]
    swell_wave_period?: number[]
    wave_direction?: number[]
    tide_height?: number[]
    sea_surface_temperature?: number[]
  }
}

interface CurrentsAPIResponse {
  hourly?: {
    current_speed?: number[]
    current_direction?: number[]
  }
}

/**
 * Fetch combined weather, wave, tide and current data from Open-Meteo.
 * Returns an array of hourly objects with all paddle-relevant conditions.
 */
export async function fetchPaddleConditions({
  latitude,
  longitude,
  startDate,
  endDate,
  timezone = 'Europe/Athens'
}: FetchParams): Promise<HourlyCondition[]> {
  const base = 'https://api.open-meteo.com/v1'

  // 1) Meteorological data (added wind gusts and weather code for storm detection)
  const weatherUrl = `${base}/forecast?latitude=${latitude}&longitude=${longitude}` +
    `&hourly=temperature_2m,precipitation,cloudcover,windspeed_10m,windgusts_10m,winddirection_10m,weather_code` +
    `&start_date=${startDate}&end_date=${endDate}&timezone=${timezone}`

  // 2) Marine data: waves + tides + water temperature
  const marineUrl = `${base}/marine?latitude=${latitude}&longitude=${longitude}` +
    `&hourly=wave_height,swell_wave_height,swell_wave_period,wave_direction,tide_height,sea_surface_temperature` +
    `&start_date=${startDate}&end_date=${endDate}&timezone=${timezone}`

  // 3) Ocean currents (Open-Meteo marine endpoint also serves currents)
  const currentsUrl = `${base}/marine?latitude=${latitude}&longitude=${longitude}` +
    `&hourly=current_speed,current_direction` +
    `&start_date=${startDate}&end_date=${endDate}&timezone=${timezone}`

  // Fire all three in parallel
  const [weatherRes, marineRes, currentsRes] = await Promise.all([
    fetch(weatherUrl),
    fetch(marineUrl),
    fetch(currentsUrl),
  ])

  if (!weatherRes.ok) throw new Error(`Weather fetch failed (${weatherRes.status})`)
  if (!marineRes.ok) throw new Error(`Marine fetch failed (${marineRes.status})`)
  if (!currentsRes.ok) throw new Error(`Currents fetch failed (${currentsRes.status})`)

  let weatherData: WeatherAPIResponse
  let marineData: MarineAPIResponse
  let currentsData: CurrentsAPIResponse

  try {
    weatherData = await weatherRes.json()
    marineData = await marineRes.json()
    currentsData = await currentsRes.json()
  } catch (e) {
    throw new Error(`Failed to parse API response: ${(e as Error).message}`)
  }

  // Validate response structure
  if (!weatherData?.hourly?.time) {
    throw new Error('Invalid weather data structure: missing hourly.time')
  }

  // Use weather timeline as primary (most reliable)
  const times = weatherData.hourly.time
  const len = times.length

  // Validate marine data alignment (log warning if mismatched, don't fail)
  const marineLen = marineData?.hourly?.wave_height?.length ?? 0
  const currentsLen = currentsData?.hourly?.current_speed?.length ?? 0

  if (marineLen !== len) {
    console.warn(`Marine data length mismatch: expected ${len}, got ${marineLen}. Some data may be missing.`)
  }
  if (currentsLen !== len) {
    console.warn(`Currents data length mismatch: expected ${len}, got ${currentsLen}. Some data may be missing.`)
  }

  // Safe array access helper - returns undefined for out-of-bounds
  const safeGet = <T>(arr: T[] | undefined, i: number): T | undefined =>
    (arr && i < arr.length) ? arr[i] : undefined

  // Merge into a single timeline with safe access
  return times.map((t, i): HourlyCondition => ({
    time: t,
    temperature: safeGet(weatherData.hourly.temperature_2m, i),
    precipitation: safeGet(weatherData.hourly.precipitation, i),
    cloudcover: safeGet(weatherData.hourly.cloudcover, i),
    windSpeed: safeGet(weatherData.hourly.windspeed_10m, i),
    windGusts: safeGet(weatherData.hourly.windgusts_10m, i),
    windDirection: safeGet(weatherData.hourly.winddirection_10m, i),
    weatherCode: safeGet(weatherData.hourly.weather_code, i),
    waveHeight: safeGet(marineData?.hourly?.wave_height, i),
    swellHeight: safeGet(marineData?.hourly?.swell_wave_height, i),
    swellPeriod: safeGet(marineData?.hourly?.swell_wave_period, i),
    waveDirection: safeGet(marineData?.hourly?.wave_direction, i),
    waterTemperature: safeGet(marineData?.hourly?.sea_surface_temperature, i),
    tideHeight: safeGet(marineData?.hourly?.tide_height, i),
    currentSpeed: safeGet(currentsData?.hourly?.current_speed, i),
    currentDirection: safeGet(currentsData?.hourly?.current_direction, i),
  }))
}

/**
 * Check if a WMO weather code indicates a thunderstorm.
 * WMO codes 95-99 are thunderstorm conditions.
 */
export function isThunderstormCode(code: number): boolean {
  return code >= 95 && code <= 99
}

/**
 * Get a human-readable description of WMO weather codes.
 */
export function getWeatherDescription(code: number): string {
  const descriptions: Record<number, string> = {
    0: 'Clear sky',
    1: 'Mainly clear', 2: 'Partly cloudy', 3: 'Overcast',
    45: 'Fog', 48: 'Depositing rime fog',
    51: 'Light drizzle', 53: 'Moderate drizzle', 55: 'Dense drizzle',
    61: 'Slight rain', 63: 'Moderate rain', 65: 'Heavy rain',
    71: 'Slight snow', 73: 'Moderate snow', 75: 'Heavy snow',
    80: 'Slight rain showers', 81: 'Moderate rain showers', 82: 'Violent rain showers',
    95: 'Thunderstorm', 96: 'Thunderstorm with slight hail', 99: 'Thunderstorm with heavy hail'
  }
  return descriptions[code] || `Weather code ${code}`
}

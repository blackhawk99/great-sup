// src/WeatherService.js

/**
 * Fetch combined weather, wave, tide and current data from Open-Meteo.
 * Returns an array of hourly objects:
 * {
 *   time,
 *   temperature, precipitation, cloudcover,
 *   windSpeed, windGusts, windDirection,
 *   waveHeight, swellHeight, swellPeriod, waveDirection,
 *   tideHeight,
 *   currentSpeed, currentDirection
 * }
 */
export async function fetchPaddleConditions({ latitude, longitude, startDate, endDate, timezone = 'auto' }) {
  const base = 'https://api.open-meteo.com/v1';

  // 1) Meteorological data (added wind gusts)
  const weatherUrl = `${base}/forecast?latitude=${latitude}&longitude=${longitude}` +
    `&hourly=temperature_2m,precipitation,cloudcover,windspeed_10m,windgusts_10m,winddirection_10m` +
    `&start_date=${startDate}&end_date=${endDate}&timezone=${timezone}`;

  // 2) Marine data: waves + tides (added swell period)
  const marineUrl = `${base}/marine?latitude=${latitude}&longitude=${longitude}` +
    `&hourly=wave_height,swell_wave_height,swell_wave_period,wave_direction,tide_height` +
    `&start_date=${startDate}&end_date=${endDate}&timezone=${timezone}`;

  // 3) Ocean currents (Open-Meteo marine endpoint also serves currents)
  const currentsUrl = `${base}/marine?latitude=${latitude}&longitude=${longitude}` +
    `&hourly=current_speed,current_direction` +
    `&start_date=${startDate}&end_date=${endDate}&timezone=${timezone}`;

  // Fire all three in parallel
  const [weatherRes, marineRes, currentsRes] = await Promise.all([
    fetch(weatherUrl),
    fetch(marineUrl),
    fetch(currentsUrl),
  ]);

  if (!weatherRes.ok)  throw new Error(`Weather fetch failed (${weatherRes.status})`);
  if (!marineRes.ok)   throw new Error(`Marine fetch failed (${marineRes.status})`);
  if (!currentsRes.ok) throw new Error(`Currents fetch failed (${currentsRes.status})`);

  let weatherData, marineData, currentsData;
  try {
    weatherData  = await weatherRes.json();
    marineData   = await marineRes.json();
    currentsData = await currentsRes.json();
  } catch (e) {
    throw new Error(`Failed to parse API response: ${e.message}`);
  }

  // Validate response structure
  if (!weatherData?.hourly?.time) {
    throw new Error('Invalid weather data structure: missing hourly.time');
  }

  // Use weather timeline as primary (most reliable)
  const times = weatherData.hourly.time;
  const len = times.length;

  // Validate marine data alignment (log warning if mismatched, don't fail)
  const marineLen = marineData?.hourly?.wave_height?.length ?? 0;
  const currentsLen = currentsData?.hourly?.current_speed?.length ?? 0;

  if (marineLen !== len) {
    console.warn(`Marine data length mismatch: expected ${len}, got ${marineLen}. Some data may be missing.`);
  }
  if (currentsLen !== len) {
    console.warn(`Currents data length mismatch: expected ${len}, got ${currentsLen}. Some data may be missing.`);
  }

  // Safe array access helper - returns undefined for out-of-bounds
  const safeGet = (arr, i) => (arr && i < arr.length) ? arr[i] : undefined;

  // Merge into a single timeline with safe access
  return times.map((t, i) => ({
    time:             t,
    temperature:      safeGet(weatherData.hourly.temperature_2m, i),
    precipitation:    safeGet(weatherData.hourly.precipitation, i),
    cloudcover:       safeGet(weatherData.hourly.cloudcover, i),
    windSpeed:        safeGet(weatherData.hourly.windspeed_10m, i),
    windGusts:        safeGet(weatherData.hourly.windgusts_10m, i),
    windDirection:    safeGet(weatherData.hourly.winddirection_10m, i),
    waveHeight:       safeGet(marineData?.hourly?.wave_height, i),
    swellHeight:      safeGet(marineData?.hourly?.swell_wave_height, i),
    swellPeriod:      safeGet(marineData?.hourly?.swell_wave_period, i),
    waveDirection:    safeGet(marineData?.hourly?.wave_direction, i),
    tideHeight:       safeGet(marineData?.hourly?.tide_height, i),
    currentSpeed:     safeGet(currentsData?.hourly?.current_speed, i),
    currentDirection: safeGet(currentsData?.hourly?.current_direction, i),
  }));
}

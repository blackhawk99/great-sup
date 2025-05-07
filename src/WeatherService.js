// src/WeatherService.js

/**
 * Fetch combined weather, wave, tide and current data from Open-Meteo.
 * Returns an array of hourly objects:
 * {
 *   time,
 *   temperature, precipitation, cloudcover,
 *   windSpeed, windDirection,
 *   waveHeight, swellHeight, waveDirection,
 *   tideHeight,
 *   currentSpeed, currentDirection
 * }
 */
export async function fetchPaddleConditions({ latitude, longitude, startDate, endDate, timezone = 'auto' }) {
  const base = 'https://api.open-meteo.com/v1';

  // 1) Meteorological data
  const weatherUrl = `${base}/forecast?latitude=${latitude}&longitude=${longitude}` +
    `&hourly=temperature_2m,precipitation,cloudcover,windspeed_10m,winddirection_10m` +
    `&start_date=${startDate}&end_date=${endDate}&timezone=${timezone}`;

  // 2) Marine data: waves + tides
  const marineUrl = `${base}/marine?latitude=${latitude}&longitude=${longitude}` +
    `&hourly=wave_height,swell_wave_height,wave_direction,tide_height` +
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

  const weatherData  = await weatherRes.json();
  const marineData   = await marineRes.json();
  const currentsData = await currentsRes.json();

  // Merge into a single timeline
  const times = weatherData.hourly.time;
  return times.map((t,i) => ({
    time:             t,
    temperature:      weatherData.hourly.temperature_2m[i],
    precipitation:    weatherData.hourly.precipitation[i],
    cloudcover:       weatherData.hourly.cloudcover[i],
    windSpeed:        weatherData.hourly.windspeed_10m[i],
    windDirection:    weatherData.hourly.winddirection_10m[i],
    waveHeight:       marineData.hourly.wave_height[i],
    swellHeight:      marineData.hourly.swell_wave_height[i],
    waveDirection:    marineData.hourly.wave_direction[i],
    tideHeight:       marineData.hourly.tide_height[i],
    currentSpeed:     currentsData.hourly.current_speed[i],
    currentDirection: currentsData.hourly.current_direction[i],
  }));
}

// src/utils/scoreCalculator.js
import { calculateGeographicProtection } from './coastlineAnalysis';

/**
 * Worst-case defaults for missing weather data.
 * Using pessimistic values ensures we don't give false confidence.
 */
const WORST_CASE_DEFAULTS = {
  windSpeed: 25,        // Strong wind (dangerous) - km/h
  windDirection: 0,
  waveHeight: 2.0,      // Rough seas - meters
  waveDirection: 0,
  swellHeight: 1.5,     // Significant swell - meters
  precipitation: 5,     // Heavy rain - mm/hr
  temperature: 10,      // Cold (hypothermia risk) - °C
  cloudcover: 100,      // Overcast - %
  tideHeight: 0,        // Extreme low tide - meters
  currentSpeed: 2.0,    // Strong current - m/s
};

/**
 * Calculate a 0–100 paddleability score.
 *
 * @param beach  { latitude, longitude, shoreBearing }
 * @param hours  Array of hourly-condition objects from fetchPaddleConditions
 * @param range  { startIndex, endIndex } slice into hours
 * @returns { totalScore, breakdown: { wind, waves, swell, precipitation,
 *   temperature, cloudcover, geographic, tide, currents }, dataQuality }
 */
export async function calculatePaddleScore(beach, hours, range) {
  const slice = hours.slice(range.startIndex, range.endIndex + 1);
  const n     = slice.length;

  // Track missing data for quality indicator
  let missingDataCount = 0;
  const totalFields = n * Object.keys(WORST_CASE_DEFAULTS).length;

  // Average function that uses worst-case defaults for missing data
  const avg = key => {
    const worstCase = WORST_CASE_DEFAULTS[key] ?? 0;
    return slice.reduce((s, h) => {
      const val = h[key];
      if (val === null || val === undefined) {
        missingDataCount++;
        return s + worstCase;
      }
      return s + val;
    }, 0) / n;
  };

  // Averages (missing data now uses worst-case, not 0)
  const windSpeed   = avg('windSpeed');
  const windDir     = avg('windDirection');
  const waveHeight  = avg('waveHeight');
  const waveDir     = avg('waveDirection');
  const swellHeight = avg('swellHeight');
  const precip      = avg('precipitation');
  const temp        = avg('temperature');
  const cloud       = avg('cloudcover');
  const tide        = avg('tideHeight');
  const currentSpd  = avg('currentSpeed');

  // Geographic protection analysis
  const geoProtection = await calculateGeographicProtection(beach, windDir, waveDir);

  // Apply protection ratios to get effective wind/wave values
  // Protection of 0.8 means 80% reduction, so effective = raw * (1 - 0.8)
  const windProtectionFactor = 1 - (geoProtection.windProtection || 0);
  const waveProtectionFactor = 1 - (geoProtection.waveProtection || 0);
  const protectedWindSpeed = windSpeed * windProtectionFactor;
  const protectedWaveHeight = waveHeight * waveProtectionFactor;

  // Scoring weights (normalized to sum to 100)
  // Wind: 35, Waves: 17, Swell: 9, Precip: 4, Temp: 9, Cloud: 4, Geo: 9, Tide: 9, Currents: 4
  const ptsWind   = linearScore(protectedWindSpeed, 0, 20) * 35;
  const ptsWaves  = linearScore(protectedWaveHeight, 0, 1.0) * 17;
  const ptsSwell  = linearScore(swellHeight, 0, 0.5) * 9;
  const ptsPrecip = linearScore(precip, 0, 5) * 4;  // Extended range to 5mm/hr
  const ptsTemp   = bellScore(temp, 18, 28) * 9;    // Bell curve: ideal 18-28°C
  const ptsCloud  = linearScore(cloud, 0, 100) * 4; // Fixed: clear skies = high score
  const ptsGeo    = clamp((20 - protectedWindSpeed) / 20, 0, 1) * 9;
  const ptsTide   = inRangeScore(tide, 0.5, 2.0) * 9;
  const ptsCurrents = clamp(1 - clamp(currentSpd / 1.5, 0, 1), 0, 1) * 4;

  const total = Math.round(
    ptsWind + ptsWaves + ptsSwell + ptsPrecip +
    ptsTemp + ptsCloud + ptsGeo + ptsTide + ptsCurrents
  );

  // Calculate data quality (0-100%)
  const dataQuality = Math.round(100 * (1 - missingDataCount / totalFields));

  return {
    totalScore: total,
    dataQuality,
    breakdown: {
      wind:         { value: protectedWindSpeed, score: Math.round(ptsWind) },
      waves:        { value: protectedWaveHeight, score: Math.round(ptsWaves) },
      swell:        { value: swellHeight,          score: Math.round(ptsSwell) },
      precipitation:{ value: precip,               score: Math.round(ptsPrecip) },
      temperature:  { value: temp,                 score: Math.round(ptsTemp) },
      cloudcover:   { value: cloud,                score: Math.round(ptsCloud) },
      geographic:   { value: null,                 score: Math.round(ptsGeo) },
      tide:         { value: tide,                 score: Math.round(ptsTide) },
      currents:     { value: currentSpd,           score: Math.round(ptsCurrents) },
    }
  };
}

// Helpers
function clamp(x, min = 0, max = 1) {
  return x < min ? min : x > max ? max : x;
}

function linearScore(val, min, max) {
  // Guard against division by zero
  if (max === min) return val <= min ? 1 : 0;
  // maps [min→max] to [1→0]
  return clamp((max - val) / (max - min), 0, 1);
}

/**
 * Bell curve scoring for values with an ideal range.
 * Returns 1.0 within [idealLow, idealHigh], tapers off outside.
 * Used for temperature where both too cold and too hot are bad.
 */
function bellScore(val, idealLow, idealHigh) {
  if (val >= idealLow && val <= idealHigh) return 1;
  if (val < idealLow) {
    // Below ideal: drops to 0 at (idealLow - 15)
    // e.g., for 18°C ideal, score hits 0 at 3°C (hypothermia danger)
    const distanceFromIdeal = idealLow - val;
    return clamp(1 - distanceFromIdeal / 15, 0, 1);
  }
  // Above ideal: drops to 0 at (idealHigh + 12)
  // e.g., for 28°C ideal, score hits 0 at 40°C (heat exhaustion)
  const distanceFromIdeal = val - idealHigh;
  return clamp(1 - distanceFromIdeal / 12, 0, 1);
}

function inRangeScore(val, low, high) {
  if (val >= low && val <= high) return 1;
  // Guard against division by zero
  if (low === 0 && val < low) return 0;
  if (val < low)  return clamp(val / low, 0, 1);
  // above high: taper off linearly
  if (high === 0) return 0;
  return clamp((high * 2 - val) / high, 0, 1);
}

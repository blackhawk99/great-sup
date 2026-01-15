// src/utils/scoreCalculator.js
import { calculateGeographicProtection } from './coastlineAnalysis';

/**
 * Worst-case defaults for missing weather data.
 * Using pessimistic values ensures we don't give false confidence.
 */
const WORST_CASE_DEFAULTS = {
  windSpeed: 25,        // Strong wind (dangerous) - km/h
  windGusts: 40,        // Strong gusts - km/h
  windDirection: 0,
  waveHeight: 2.0,      // Rough seas - meters
  waveDirection: 0,
  swellHeight: 1.5,     // Significant swell - meters
  swellPeriod: 4,       // Short period = choppy (worst case) - seconds
  precipitation: 5,     // Heavy rain - mm/hr
  temperature: 10,      // Cold air (hypothermia risk) - °C
  waterTemperature: 12, // Cold water (hypothermia risk) - °C
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
  const windGusts   = avg('windGusts');
  const windDir     = avg('windDirection');
  const waveHeight  = avg('waveHeight');
  const waveDir     = avg('waveDirection');
  const swellHeight = avg('swellHeight');
  const swellPeriod = avg('swellPeriod');
  const precip      = avg('precipitation');
  const temp        = avg('temperature');
  const waterTemp   = avg('waterTemperature');
  const cloud       = avg('cloudcover');
  const tide        = avg('tideHeight');
  const currentSpd  = avg('currentSpeed');

  // Check for thunderstorms (WMO codes 95-99)
  // Unlike other metrics, we check if ANY hour has a thunderstorm
  const hasThunderstorm = slice.some(h => {
    const code = h.weatherCode;
    return code !== null && code !== undefined && code >= 95 && code <= 99;
  });
  const thunderstormHours = slice.filter(h => {
    const code = h.weatherCode;
    return code !== null && code !== undefined && code >= 95 && code <= 99;
  }).length;

  // Geographic protection analysis
  const geoProtection = await calculateGeographicProtection(beach, windDir, waveDir);

  // Apply protection ratios to get effective wind/wave values
  // Protection of 0.8 means 80% reduction, so effective = raw * (1 - 0.8)
  const windProtectionFactor = 1 - (geoProtection.windProtection || 0);
  const waveProtectionFactor = 1 - (geoProtection.waveProtection || 0);
  const protectedWindSpeed = windSpeed * windProtectionFactor;
  const protectedWaveHeight = waveHeight * waveProtectionFactor;

  // Calculate gust factor (how much gusts exceed average wind)
  // Gust factor > 1.5 means unpredictable, gusty conditions
  const gustFactor = windSpeed > 0 ? windGusts / windSpeed : 1;
  const gustPenalty = gustFactor > 1.5 ? (gustFactor - 1.5) * 0.3 : 0; // Penalty for gusty conditions

  // Calculate swell score considering both height and period
  // Long period swells (>10s) are gentle rollers, short period (<6s) are choppy
  const swellPeriodFactor = swellPeriodScore(swellPeriod);
  const effectiveSwellSeverity = swellHeight / swellPeriodFactor; // Adjusted for period

  // Scoring weights (normalized to sum to 100)
  // Wind: 30, Waves: 14, Swell: 8, Gusts: 5, Precip: 4, AirTemp: 6, WaterTemp: 8, Cloud: 3, Geo: 8, Tide: 7, Currents: 7
  const ptsWind      = linearScore(protectedWindSpeed, 0, 20) * 30;
  const ptsWaves     = linearScore(protectedWaveHeight, 0, 1.0) * 14;
  const ptsSwell     = linearScore(effectiveSwellSeverity, 0, 0.5) * 8;
  const ptsGusts     = clamp(1 - gustPenalty, 0, 1) * 5;
  const ptsPrecip    = linearScore(precip, 0, 5) * 4;
  const ptsTemp      = bellScore(temp, 18, 28) * 6;       // Air temperature
  const ptsWaterTemp = bellScore(waterTemp, 18, 26) * 8;  // Water temperature (crucial for safety)
  const ptsCloud     = linearScore(cloud, 0, 100) * 3;
  const ptsGeo       = clamp((20 - protectedWindSpeed) / 20, 0, 1) * 8;
  const ptsTide      = inRangeScore(tide, 0.5, 2.0) * 7;
  const ptsCurrents  = clamp(1 - clamp(currentSpd / 1.5, 0, 1), 0, 1) * 7;

  let total = Math.round(
    ptsWind + ptsWaves + ptsSwell + ptsGusts + ptsPrecip +
    ptsTemp + ptsWaterTemp + ptsCloud + ptsGeo + ptsTide + ptsCurrents
  );

  // CRITICAL: Thunderstorms make conditions extremely dangerous
  // Lightning is the #1 weather killer on water - cap score at 20
  if (hasThunderstorm) {
    total = Math.min(total, 20);
  }

  // Calculate data quality (0-100%)
  const dataQuality = Math.round(100 * (1 - missingDataCount / totalFields));

  // Generate warnings for dangerous conditions
  const warnings = [];

  // CRITICAL: Thunderstorm warning - lightning is deadly on water
  if (hasThunderstorm) {
    warnings.unshift(`⚡ THUNDERSTORM WARNING: ${thunderstormHours} hour(s) with storm activity - DO NOT paddle!`);
  }

  if (waterTemp < 15) {
    warnings.push(`🥶 Cold water: ${waterTemp.toFixed(1)}°C - hypothermia risk, wear a wetsuit!`);
  }
  if (gustFactor > 1.8) {
    warnings.push(`Strong gusts: ${Math.round(windGusts)} km/h (${Math.round(gustFactor * 100 - 100)}% above average)`);
  }
  if (swellPeriod < 5 && swellHeight > 0.3) {
    warnings.push(`Choppy swell: ${swellHeight.toFixed(1)}m at ${swellPeriod.toFixed(0)}s period`);
  }
  if (currentSpd > 1.0) {
    warnings.push(`Strong currents: ${currentSpd.toFixed(1)} m/s`);
  }

  return {
    totalScore: total,
    dataQuality,
    warnings,
    hasThunderstorm,
    breakdown: {
      wind:            { value: protectedWindSpeed, score: Math.round(ptsWind) },
      waves:           { value: protectedWaveHeight, score: Math.round(ptsWaves) },
      swell:           { value: swellHeight, period: swellPeriod, score: Math.round(ptsSwell) },
      gusts:           { value: windGusts, factor: gustFactor, score: Math.round(ptsGusts) },
      precipitation:   { value: precip,               score: Math.round(ptsPrecip) },
      temperature:     { value: temp,                 score: Math.round(ptsTemp) },
      waterTemperature:{ value: waterTemp,            score: Math.round(ptsWaterTemp) },
      cloudcover:      { value: cloud,                score: Math.round(ptsCloud) },
      geographic:      { value: null,                 score: Math.round(ptsGeo) },
      tide:            { value: tide,                 score: Math.round(ptsTide) },
      currents:        { value: currentSpd,           score: Math.round(ptsCurrents) },
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

/**
 * Score swell period - longer periods are gentler, shorter are choppier.
 * Returns a factor to divide swell height by:
 * - Period > 12s: factor 2.0 (very gentle, halves effective severity)
 * - Period 8-12s: factor 1.5 (moderate)
 * - Period 6-8s:  factor 1.0 (no adjustment)
 * - Period < 6s:  factor 0.7 (choppy, increases effective severity)
 */
function swellPeriodScore(period) {
  if (period >= 12) return 2.0;   // Long period = very gentle swells
  if (period >= 8)  return 1.5;   // Medium-long period
  if (period >= 6)  return 1.0;   // Normal
  return 0.7;                     // Short period = choppy, uncomfortable
}

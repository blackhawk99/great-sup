// src/utils/scoreCalculator.js
import { calculateGeographicProtection } from './coastlineAnalysis';

/**
 * Calculate a 0–100 paddleability score.
 *
 * @param beach  { latitude, longitude, shoreBearing }
 * @param hours  Array of hourly-condition objects from fetchPaddleConditions
 * @param range  { startIndex, endIndex } slice into hours
 * @returns { totalScore, breakdown: { wind, waves, swell, precipitation,
 *   temperature, cloudcover, geographic, tide, currents } }
 */
export async function calculatePaddleScore(beach, hours, range) {
  const slice = hours.slice(range.startIndex, range.endIndex + 1);
  const n     = slice.length;
  const avg   = key => slice.reduce((s, h) => s + (h[key] ?? 0), 0) / n;

  // Averages
  const windSpeed   = avg('windSpeed');
  const windDir     = avg('windDirection');
  const waveDir     = avg('waveDirection');
  const waveHeight  = avg('waveHeight');
  const swellHeight = avg('swellHeight');
  const precip      = avg('precipitation');
  const temp        = avg('temperature');
  const cloud       = avg('cloudcover');
  const tide        = avg('tideHeight');
  const currentSpd  = avg('currentSpeed');

  // Geographic protection
  const { windProtection, waveProtection } =
    await calculateGeographicProtection(beach, windDir, waveDir);

  const protectedWindSpeed  = windSpeed * (1 - (windProtection * 0.9));
  const protectedWaveHeight = waveHeight * (1 - (waveProtection * 0.9));

  // Scoring buckets (max points in parentheses)
  const ptsWind   = linearScore(protectedWindSpeed, 0, 20) * 40;    // 40 pts
  const ptsWaves  = linearScore(protectedWaveHeight, 0, 1.0) * 20;  // 20 pts
  const ptsSwell  = linearScore(swellHeight, 0, 0.5) * 10;          // 10 pts
  const ptsPrecip = linearScore(precip, 0, 2) *  5;                 //  5 pts
  const ptsTemp   = linearScore(temp, 15, 30) * 10;                 // 10 pts
  const ptsCloud  = linearScore(100 - cloud, 0, 100) *  5;          //  5 pts
  const ptsGeo    = clamp((20 - protectedWindSpeed) / 20, 0, 1) * 10; // 10 pts

  // New: Tide (10 pts)
  // Ideal tide between 0.5m and 2.0m
  const ptsTide = inRangeScore(tide, 0.5, 2.0) * 10;

  // New: Currents (5 pts)
  // Penalize if current > 1.5 m/s
  const ptsCurrents = clamp(1 - clamp(currentSpd / 1.5, 0, 1), 0, 1) * 5;

  const total = Math.round(
    ptsWind + ptsWaves + ptsSwell + ptsPrecip +
    ptsTemp + ptsCloud + ptsGeo + ptsTide + ptsCurrents
  );

  return {
    totalScore: total,
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
  // maps [min→max] to [1→0]
  return clamp((max - val) / (max - min), 0, 1);
}
function inRangeScore(val, low, high) {
  if (val >= low && val <= high) return 1;
  if (val < low)  return clamp(val / low, 0, 1);
  // above high: taper off linearly
  return clamp((high * 2 - val) / high, 0, 1);
}

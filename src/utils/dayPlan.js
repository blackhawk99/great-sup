// src/utils/dayPlan.js
import { averageConditions, scoreAveragedConditions } from './scoreCalculator.js';
import { calculateGeographicProtection } from './coastlineAnalysis.js';

export const DAY_START_HOUR = 6;
export const DAY_END_HOUR = 20;

/** A window is only worth naming if conditions hold at or above this score. */
export const WINDOW_THRESHOLD = 75;

/** Shortest run of hours we will call a window. */
export const MIN_WINDOW_HOURS = 2;

/**
 * Map hourly conditions to their index by hour-of-day.
 *
 * Open-Meteo returns entries stamped "YYYY-MM-DDTHH:00"; we key off that
 * rather than assuming the array starts at midnight.
 */
function indexByHour(hours) {
  const byHour = new Map();
  hours.forEach((entry, index) => {
    const stamp = typeof entry?.time === 'string' ? entry.time : '';
    const hour = Number.parseInt(stamp.slice(11, 13), 10);
    if (Number.isFinite(hour) && !byHour.has(hour)) byHour.set(hour, index);
  });
  return byHour;
}

/**
 * Score every daylight hour for one beach.
 *
 * Geographic protection is the expensive part of scoring - a coastline
 * ray-cast that costs roughly a second uncached - and it varies only with
 * wind and wave direction. Those barely move across a single day, so we
 * analyse once against the day's mean direction and reuse the result for
 * every hour. Scoring fifteen hours independently would cost fifteen
 * ray-casts; this costs one.
 */
export async function scoreHourlySeries(beach, hours, options = {}) {
  const startHour = options.startHour ?? DAY_START_HOUR;
  const endHour = options.endHour ?? DAY_END_HOUR;
  const byHour = indexByHour(hours);

  const indices = [];
  for (let hour = startHour; hour <= endHour; hour += 1) {
    const index = byHour.get(hour);
    if (index !== undefined) indices.push({ hour, index });
  }
  if (!indices.length) return { protection: null, hourly: [] };

  // One protection analysis for the whole day, from its mean direction.
  const dayAverage = averageConditions(hours, {
    startIndex: indices[0].index,
    endIndex: indices[indices.length - 1].index
  });
  const protection = await calculateGeographicProtection(
    beach, dayAverage.windDir, dayAverage.waveDir
  );

  const hourly = indices.map(({ hour, index }) => {
    const averaged = averageConditions(hours, { startIndex: index, endIndex: index });
    const scored = scoreAveragedConditions(averaged, protection);
    return {
      hour,
      score: scored.totalScore,
      dataQuality: scored.dataQuality,
      warnings: scored.warnings,
      hasThunderstorm: scored.hasThunderstorm,
      breakdown: scored.breakdown
    };
  });

  return { protection, hourly };
}

/**
 * Find the longest run of consecutive hours at or above the threshold.
 * Returns null when nothing sustained is on offer - "no window today" is a
 * real answer and better than naming an hour nobody should paddle.
 */
export function findBestWindow(hourly, threshold = WINDOW_THRESHOLD) {
  let best = null;
  let runStart = -1;

  for (let i = 0; i <= hourly.length; i += 1) {
    const passes = i < hourly.length && hourly[i].score >= threshold;
    if (passes && runStart === -1) {
      runStart = i;
    } else if (!passes && runStart !== -1) {
      const length = i - runStart;
      if (!best || length > best.length) {
        best = { startHour: hourly[runStart].hour, endHour: hourly[i - 1].hour, length };
      }
      runStart = -1;
    }
  }

  return best && best.length >= MIN_WINDOW_HOURS ? best : null;
}

/** The best single hour of the day, used as the spot's headline score. */
export function findPeakHour(hourly) {
  return hourly.reduce(
    (best, entry) => (!best || entry.score > best.score ? entry : best),
    null
  );
}

/**
 * Summarise a beach's day into the shape the ranked dashboard renders:
 * a headline score, when to go, and the conditions at that moment.
 */
export function summariseDay(beach, hourly) {
  const peak = findPeakHour(hourly);
  if (!peak) return null;
  const window = findBestWindow(hourly);
  return {
    beachId: beach.id,
    score: peak.score,
    peakHour: peak.hour,
    window,
    dataQuality: peak.dataQuality,
    warnings: peak.warnings,
    hasThunderstorm: hourly.some((entry) => entry.hasThunderstorm),
    breakdown: peak.breakdown,
    hourly
  };
}

/** Rank summaries best-first; spots we could not score sink to the bottom. */
export function rankSummaries(summaries) {
  return [...summaries].sort((a, b) => {
    if (!a.summary && !b.summary) return a.beach.name.localeCompare(b.beach.name);
    if (!a.summary) return 1;
    if (!b.summary) return -1;
    if (b.summary.score !== a.summary.score) return b.summary.score - a.summary.score;
    return a.beach.name.localeCompare(b.beach.name);
  });
}

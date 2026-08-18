// src/useRankedDay.js
import { useCallback, useEffect, useRef, useState } from 'react';
import { fetchPaddleConditions } from './WeatherService';
import { scoreHourlySeries, summariseDay, rankSummaries } from './utils/dayPlan.js';

/**
 * How many beaches we score at once.
 *
 * Scoring is CPU-bound (a coastline ray-cast per beach) and runs on the main
 * thread, so this is about keeping the interface responsive rather than about
 * network throughput. Rows appear as they finish.
 */
const CONCURRENCY = 2;

/** Let the browser paint between beaches so the list fills in visibly. */
const yieldToBrowser = () =>
  new Promise((resolve) => {
    if (typeof requestAnimationFrame === 'function') requestAnimationFrame(() => resolve());
    else setTimeout(resolve, 0);
  });

/**
 * Score every saved beach for a given day and rank them best-first.
 *
 * This is what turns the dashboard from an index into an answer: instead of
 * opening spots one at a time to compare them, every spot is scored up front.
 */
export function useRankedDay(beaches, dateISO) {
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(false);
  const [lastUpdated, setLastUpdated] = useState(null);
  const cacheRef = useRef(new Map());
  const runIdRef = useRef(0);

  const run = useCallback(async (force) => {
    const runId = runIdRef.current + 1;
    runIdRef.current = runId;
    const stale = () => runIdRef.current !== runId;

    if (!beaches.length) {
      setEntries([]);
      setLoading(false);
      return;
    }

    if (force) cacheRef.current.clear();

    // Seed the list so every spot has a row immediately, then fill it in.
    setEntries(beaches.map((beach) => {
      const cached = cacheRef.current.get(`${beach.id}:${dateISO}`);
      return { beach, summary: cached?.summary ?? null, status: cached ? 'ready' : 'pending' };
    }));
    setLoading(true);

    const resolveOne = async (beach) => {
      const key = `${beach.id}:${dateISO}`;
      const cached = cacheRef.current.get(key);
      if (cached) return cached;

      try {
        const hours = await fetchPaddleConditions({
          latitude: beach.latitude,
          longitude: beach.longitude,
          startDate: dateISO,
          endDate: dateISO
        });
        const { hourly } = await scoreHourlySeries(beach, hours);
        const summary = summariseDay(beach, hourly);
        const result = { summary, status: summary ? 'ready' : 'empty' };
        cacheRef.current.set(key, result);
        return result;
      } catch (error) {
        console.error(`Could not score ${beach.name}`, error);
        return { summary: null, status: 'error' };
      }
    };

    const queue = [...beaches];
    const worker = async () => {
      while (queue.length && !stale()) {
        const beach = queue.shift();
        const result = await resolveOne(beach);
        if (stale()) return;
        setEntries((prev) =>
          prev.map((entry) => (entry.beach.id === beach.id ? { beach, ...result } : entry))
        );
        await yieldToBrowser();
      }
    };

    await Promise.all(Array.from({ length: Math.min(CONCURRENCY, beaches.length) }, worker));

    if (stale()) return;
    setLoading(false);
    setLastUpdated(new Date());
  }, [beaches, dateISO]);

  useEffect(() => {
    run(false);
    return () => { runIdRef.current += 1; };
  }, [run]);

  const refresh = useCallback(() => run(true), [run]);
  const ranked = rankSummaries(entries);

  return { entries: ranked, loading, lastUpdated, refresh };
}

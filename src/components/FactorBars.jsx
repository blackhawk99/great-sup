import React from "react";
import { FACTOR_WEIGHTS } from "../utils/scoreCalculator.js";

/**
 * Labels and value formatting for each scored factor, in the order the
 * scoring itself weights them.
 */
const FACTORS = [
  { key: "wind", label: "Wind", format: (f) => `${Math.round(f.value)} km/h in the bay` },
  { key: "waves", label: "Waves", format: (f) => `${f.value.toFixed(2)} m` },
  { key: "geographic", label: "Shelter", format: (f, protection) =>
      typeof protection?.protectionScore === "number"
        ? `${Math.round(protection.protectionScore)}% enclosed`
        : "coastline analysis" },
  { key: "waterTemperature", label: "Water temp", format: (f) => `${Math.round(f.value)}°C` },
  { key: "swell", label: "Swell", format: (f) =>
      `${f.value.toFixed(1)} m at ${Math.round(f.period)} s` },
  { key: "tide", label: "Tide", format: (f) => `${f.value.toFixed(1)} m` },
  { key: "currents", label: "Currents", format: (f) => `${f.value.toFixed(1)} m/s` },
  { key: "temperature", label: "Air temp", format: (f) => `${Math.round(f.value)}°C` },
  { key: "gusts", label: "Gusts", format: (f) => `${Math.round(f.value)} km/h peak` },
  { key: "precipitation", label: "Rain", format: (f) => `${f.value.toFixed(1)} mm` },
  { key: "cloudcover", label: "Cloud", format: (f) => `${Math.round(f.value)}% cover` }
];

const HEAVIEST = Math.max(...Object.values(FACTOR_WEIGHTS));

/**
 * The score breakdown as proportional bars.
 *
 * The old table gave every factor an identical row, which hid the thing that
 * matters most: wind is 30% of the score and cloud cover is 3%. Here the
 * track length is the factor's weight and the fill is what it earned, so the
 * relative stakes are visible before you read a number.
 */
const FactorBars = ({ breakdown, protection }) => {
  if (!breakdown) return null;

  const rows = FACTORS.map((factor) => {
    const entry = breakdown[factor.key];
    if (!entry) return null;
    const weight = FACTOR_WEIGHTS[factor.key];
    const earned = Math.max(0, Math.min(weight, entry.score ?? 0));
    let value;
    try {
      value = factor.format(entry, protection);
    } catch {
      value = "–";
    }
    return { ...factor, weight, earned, lost: weight - earned, value };
  }).filter(Boolean);

  return (
    <div>
      <div className="mb-2 flex items-center gap-2">
        <span className="flex-grow text-[11px] font-bold uppercase tracking-[0.1em] text-gray-500 dark:text-slate-400">
          Heaviest factors first
        </span>
        <span className="flex items-center gap-1.5 text-[10px] text-gray-500 dark:text-slate-400">
          <span className="h-2 w-2 rounded-sm bg-green-500 dark:bg-green-400" />
          earned
          <span className="ml-1 h-2 w-2 rounded-sm bg-gray-200 dark:bg-slate-600" />
          lost
        </span>
      </div>

      <ul>
        {rows.map((row) => (
          <li
            key={row.key}
            className="flex items-center gap-3 border-b border-gray-100 py-2 last:border-b-0 dark:border-slate-700"
          >
            <div className="flex w-24 flex-shrink-0 flex-col gap-0.5 sm:w-28">
              <span className="text-[13px] font-semibold text-gray-800 dark:text-slate-200">{row.label}</span>
              <span className="text-[10px] tabular-nums text-gray-500 dark:text-slate-400">{row.value}</span>
            </div>

            <div className="flex min-w-0 flex-grow items-center">
              <div
                className="h-2 overflow-hidden rounded-full bg-gray-200 dark:bg-slate-600"
                style={{ width: `${(row.weight / HEAVIEST) * 100}%` }}
                role="img"
                aria-label={`${row.label}: ${row.earned} of ${row.weight} points`}
              >
                <div
                  className="h-full rounded-full bg-green-500 dark:bg-green-400"
                  style={{ width: `${(row.earned / row.weight) * 100}%` }}
                />
              </div>
            </div>

            <div className="flex w-16 flex-shrink-0 flex-col items-end gap-0.5">
              <span className="text-[13px] font-bold tabular-nums text-gray-900 dark:text-slate-100">
                {row.earned}/{row.weight}
              </span>
              <span
                className={`text-[10px] tabular-nums ${
                  row.lost > 0 ? "text-red-500 dark:text-red-400" : "text-gray-400 dark:text-slate-500"
                }`}
              >
                {row.lost > 0 ? `−${row.lost}` : "full"}
              </span>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
};

export default FactorBars;

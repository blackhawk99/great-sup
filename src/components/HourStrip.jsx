import React from "react";
import { tierFill, formatHour } from "../utils/conditionTiers.js";

/**
 * The day as a bar per hour, tallest and brightest where conditions are best.
 *
 * The forecast is already fetched hour by hour; this shows all of it at once
 * so the shape of the day - calm dawn, wind building after lunch - is legible
 * without reading a single number. Selecting an hour drives the readout and
 * metric tiles beside it.
 */
const HourStrip = ({
  hourly,
  selectedHour,
  onSelectHour,
  window: bestWindow,
  isDark = false,
  height = 104,
  labelEvery = 3,
  compact = false
}) => {
  if (!hourly?.length) return null;

  const inWindow = (hour) =>
    bestWindow && hour >= bestWindow.startHour && hour <= bestWindow.endHour;

  return (
    <div>
      <div className="flex items-end gap-[3px]" style={{ height }} role="group" aria-label="Hourly conditions">
        {hourly.map((entry) => {
          const selected = entry.hour === selectedHour;
          const barHeight = Math.max(8, Math.round((entry.score / 100) * height));
          const interactive = typeof onSelectHour === "function";
          const Bar = interactive ? "button" : "div";

          return (
            <Bar
              key={entry.hour}
              type={interactive ? "button" : undefined}
              onClick={interactive ? () => onSelectHour(entry.hour) : undefined}
              aria-pressed={interactive ? selected : undefined}
              aria-label={`${formatHour(entry.hour)}, score ${entry.score}`}
              className={`flex flex-1 flex-col justify-end ${interactive ? "cursor-pointer" : ""}`}
              style={{ height }}
            >
              <span
                className="block w-full rounded-[3px] transition-all"
                style={{
                  height: barHeight,
                  background: tierFill(entry.score, isDark),
                  opacity: selected ? 1 : inWindow(entry.hour) ? 0.85 : 0.4,
                  boxShadow: selected ? `0 0 0 2px ${isDark ? "#f1f5f9" : "#111827"}` : "none"
                }}
              />
            </Bar>
          );
        })}
      </div>

      {!compact && (
        <div className="mt-1.5 flex">
          {hourly.map((entry) => (
            <span
              key={entry.hour}
              className={`flex-1 basis-0 text-center text-[9px] font-semibold tabular-nums ${
                entry.hour === selectedHour
                  ? "text-gray-900 dark:text-slate-100"
                  : "text-gray-400 dark:text-slate-500"
              }`}
            >
              {entry.hour % labelEvery === 0 ? String(entry.hour).padStart(2, "0") : ""}
            </span>
          ))}
        </div>
      )}
    </div>
  );
};

export default HourStrip;

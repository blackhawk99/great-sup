import React from "react";
import { Home, Trash2, ChevronRight } from "lucide-react";
import ScoreRing from "./ScoreRing.jsx";
import { formatHour, formatWindow } from "../utils/conditionTiers.js";

/**
 * One spot in the ranked list: where it stands on the chosen day, and when to
 * go. Selecting a row lifts it into the card at the top so spots can be
 * compared without leaving the dashboard; the chevron opens the full forecast.
 */
const SpotRow = ({
  rank,
  beach,
  summary,
  status,
  isHome,
  isSelected,
  isDark,
  onSelect,
  onOpen,
  onDelete
}) => {
  const window = formatWindow(summary?.window);

  const meta = () => {
    if (status === "pending") return "Checking conditions…";
    if (status === "error") return "Forecast unavailable";
    if (!summary) return "No forecast for this day";
    const wind = summary.breakdown?.wind?.value;
    const wave = summary.breakdown?.waves?.value;
    const parts = [];
    if (Number.isFinite(wind)) parts.push(`${Math.round(wind)} km/h`);
    if (Number.isFinite(wave)) parts.push(`${wave.toFixed(2)} m`);
    parts.push(window || `best ${formatHour(summary.peakHour)}`);
    return parts.join(" · ");
  };

  return (
    <div
      className={`flex items-center gap-1 rounded-xl pr-2 transition ${
        isSelected
          ? "bg-blue-50 shadow-[inset_0_0_0_2px_#2563eb] dark:bg-slate-800 dark:shadow-[inset_0_0_0_2px_#3b82f6]"
          : "bg-white shadow-[inset_0_0_0_1px_#dbeafe] dark:bg-slate-800 dark:shadow-[inset_0_0_0_1px_#334155]"
      }`}
    >
      <button
        type="button"
        onClick={() => onSelect(beach)}
        aria-pressed={isSelected}
        aria-label={`Select ${beach.name}${summary ? `, score ${summary.score} out of 100` : ""}`}
        className="flex min-w-0 flex-grow items-center gap-2.5 rounded-xl p-3 text-left"
      >
        <span className="w-3.5 flex-shrink-0 text-xs font-semibold tabular-nums text-gray-400 dark:text-slate-500">
          {rank}
        </span>

        <span className="flex min-w-0 flex-grow flex-col gap-0.5">
          <span className="flex items-center gap-1.5">
            {isHome && <Home className="h-3.5 w-3.5 flex-shrink-0 text-orange-500" aria-hidden />}
            <span className="truncate text-[15px] font-semibold text-gray-900 dark:text-slate-100">
              {beach.name}
            </span>
          </span>
          <span className="truncate text-[11px] tabular-nums text-gray-500 dark:text-slate-400">
            {meta()}
          </span>
        </span>

        {status === "pending" ? (
          <span
            className="h-10 w-10 flex-shrink-0 animate-pulse rounded-full bg-gray-100 dark:bg-slate-700"
            aria-hidden
          />
        ) : (
          <ScoreRing score={summary?.score} size={40} isDark={isDark} />
        )}
      </button>

      <button
        type="button"
        onClick={() => onOpen(beach)}
        aria-label={`Open forecast for ${beach.name}`}
        className="flex h-11 w-8 flex-shrink-0 items-center justify-center rounded-lg text-gray-400 transition hover:bg-blue-100 hover:text-blue-700 dark:text-slate-500 dark:hover:bg-slate-700 dark:hover:text-blue-200"
      >
        <ChevronRight className="h-5 w-5" aria-hidden />
      </button>

      <button
        type="button"
        onClick={() => onDelete(beach.id)}
        aria-label={`Delete ${beach.name}`}
        className="flex h-11 w-8 flex-shrink-0 items-center justify-center rounded-lg text-gray-300 transition hover:bg-red-50 hover:text-red-500 dark:text-slate-600 dark:hover:bg-slate-700 dark:hover:text-red-400"
      >
        <Trash2 className="h-4 w-4" aria-hidden />
      </button>
    </div>
  );
};

export default SpotRow;

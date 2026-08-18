import React from "react";
import { Sunrise, ChevronRight } from "lucide-react";
import ScoreRing from "./ScoreRing.jsx";
import HourStrip from "./HourStrip.jsx";
import { getTier, formatHour, formatWindow } from "../utils/conditionTiers.js";

/**
 * The answer, up front: which spot, and when.
 *
 * The dashboard used to open on a decorative hero and a grid of spots you had
 * to check one at a time. This card names the best spot for the chosen day and
 * the window to paddle it, with the whole day's shape underneath.
 */
const BestSpotCard = ({ beach, summary, isTopRanked, dayLabel, onOpen, loading }) => {
  if (!beach) return null;

  const window = formatWindow(summary?.window);
  const tier = summary ? getTier(summary.score) : null;

  const eyebrow = isTopRanked
    ? dayLabel === "today"
      ? "Best right now"
      : "Best tomorrow"
    : "Selected spot";

  return (
    <section className="rounded-2xl bg-blue-600 p-4 text-white shadow-lg shadow-blue-600/25 dark:bg-blue-700">
      <div className="flex items-start gap-3">
        <div className="flex min-w-0 flex-grow flex-col gap-1">
          <span className="text-[10px] font-bold uppercase tracking-[0.12em] text-blue-200">
            {eyebrow}
          </span>
          <h2 className="text-[21px] font-bold leading-tight">{beach.name}</h2>
          <div className="mt-0.5 flex flex-wrap items-center gap-1.5">
            {tier && (
              <span className="rounded-full bg-white/20 px-2 py-0.5 text-[11px] font-bold">
                {tier.label}
              </span>
            )}
            <span className="text-[11px] tabular-nums text-blue-100">
              {beach.latitude.toFixed(3)}, {beach.longitude.toFixed(3)}
            </span>
          </div>
        </div>

        <ScoreRing
          score={summary?.score}
          size={72}
          caption="SCORE"
          ink="#ffffff"
          trackColor="rgba(255,255,255,0.22)"
          numeralColor="#ffffff"
        />
      </div>

      <div className="my-3 h-px bg-white/20" />

      <div className="mb-2.5 flex items-center gap-2">
        <Sunrise className="h-4 w-4 flex-shrink-0" aria-hidden />
        <span className="flex-grow text-[13px] font-semibold">
          {loading && !summary
            ? "Working out the best window…"
            : window
              ? `Best window ${window}`
              : summary
                ? "No calm window all day"
                : "Forecast unavailable"}
        </span>
        {summary && (
          <span className="flex-shrink-0 text-[11px] tabular-nums text-blue-100">
            peak {formatHour(summary.peakHour)}
          </span>
        )}
      </div>

      {summary?.hourly?.length > 0 && (
        <>
          <HourStrip
            hourly={summary.hourly}
            selectedHour={summary.peakHour}
            window={summary.window}
            isDark
            height={34}
            compact
          />
          <div className="mt-1.5 flex justify-between text-[9px] font-semibold tracking-wide text-blue-200">
            <span>{formatHour(summary.hourly[0].hour)}</span>
            <span>{formatHour(summary.hourly[Math.floor(summary.hourly.length / 2)].hour)}</span>
            <span>{formatHour(summary.hourly[summary.hourly.length - 1].hour)}</span>
          </div>
        </>
      )}

      <button
        type="button"
        onClick={() => onOpen(beach)}
        className="mt-3.5 flex h-11 w-full items-center justify-center gap-1.5 rounded-[10px] bg-white text-sm font-semibold text-blue-700 transition hover:bg-blue-50"
      >
        Open forecast
        <ChevronRight className="h-4 w-4" aria-hidden />
      </button>
    </section>
  );
};

export default BestSpotCard;

import React from "react";
import { getTier, tierInk } from "../utils/conditionTiers.js";

/**
 * A score as a numeral inside a proportional ring.
 *
 * Replaces the emoji that used to carry the score: a number reads precisely
 * at any size and renders identically on every device.
 */
const ScoreRing = ({
  score,
  size = 40,
  isDark = false,
  caption,
  ink,
  trackColor,
  numeralColor
}) => {
  const stroke = size >= 80 ? 8 : size >= 56 ? 5 : 3.5;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const hasScore = Number.isFinite(score);
  const progress = hasScore ? Math.max(0, Math.min(100, score)) : 0;
  const strokeColor = ink ?? tierInk(score, isDark);
  const track = trackColor ?? (isDark ? "#334155" : "#f3f4f6");
  const numeral = numeralColor ?? strokeColor;
  const center = size / 2;

  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      className="flex-shrink-0"
      role="img"
      aria-label={hasScore ? `Score ${progress} out of 100, ${getTier(score).label}` : "Score unavailable"}
    >
      <circle cx={center} cy={center} r={radius} fill="none" stroke={track} strokeWidth={stroke} />
      {hasScore && (
        <circle
          cx={center}
          cy={center}
          r={radius}
          fill="none"
          stroke={strokeColor}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={`${(circumference * progress) / 100} ${circumference}`}
          transform={`rotate(-90 ${center} ${center})`}
        />
      )}
      <text
        x={center}
        y={caption ? center + size * 0.03 : center + size * 0.12}
        textAnchor="middle"
        fill={numeral}
        fontSize={size * 0.34}
        fontWeight="700"
        fontFamily="ui-sans-serif, system-ui, sans-serif"
      >
        {hasScore ? progress : "–"}
      </text>
      {caption && (
        <text
          x={center}
          y={center + size * 0.2}
          textAnchor="middle"
          fill={isDark ? "#94a3b8" : "#9ca3af"}
          fontSize={size * 0.11}
          fontWeight="600"
          fontFamily="ui-sans-serif, system-ui, sans-serif"
        >
          {caption}
        </text>
      )}
    </svg>
  );
};

export default ScoreRing;

// src/utils/conditionTiers.js

/**
 * The four condition bands, matching the thresholds the score has always
 * used. Each carries an ink colour for numerals and strokes, and a fill for
 * bars, in both themes - these end up in inline SVG attributes where Tailwind
 * classes cannot reach.
 */
export const TIERS = [
  { key: 'perfect', min: 85, label: 'Perfect',   ink: '#16a34a', darkInk: '#4ade80', fill: '#22c55e', darkFill: '#4ade80' },
  { key: 'okay',    min: 70, label: 'Okay-ish',  ink: '#ca8a04', darkInk: '#facc15', fill: '#eab308', darkFill: '#facc15' },
  { key: 'poor',    min: 50, label: 'Not great', ink: '#ea580c', darkInk: '#fb923c', fill: '#f97316', darkFill: '#fb923c' },
  { key: 'nope',    min: 0,  label: 'Nope',      ink: '#dc2626', darkInk: '#f87171', fill: '#ef4444', darkFill: '#f87171' }
];

export function getTier(score) {
  const value = Number.isFinite(score) ? score : 0;
  return TIERS.find((tier) => value >= tier.min) ?? TIERS[TIERS.length - 1];
}

/** Ink for numerals and ring strokes in the active theme. */
export function tierInk(score, isDark) {
  const tier = getTier(score);
  return isDark ? tier.darkInk : tier.ink;
}

/** Fill for timeline and factor bars in the active theme. */
export function tierFill(score, isDark) {
  const tier = getTier(score);
  return isDark ? tier.darkFill : tier.fill;
}

/** Format an hour-of-day as the app writes times elsewhere. */
export function formatHour(hour) {
  return `${String(hour).padStart(2, '0')}:00`;
}

/** "06:00 – 12:00" for a window, or null when there isn't one. */
export function formatWindow(window) {
  if (!window) return null;
  return `${formatHour(window.startHour)} – ${formatHour(window.endHour)}`;
}

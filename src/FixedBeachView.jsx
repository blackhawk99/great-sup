// src/FixedBeachView.jsx
import React, { useState, useEffect } from "react";
import {
  Home,
  ChevronLeft,
  RefreshCw,
  AlertCircle,
  MapPin,
  Map,
  Wind,
  Thermometer,
  Droplets,
  Waves,
  Sun,
  Clock,
  Calendar,
  Info
} from "lucide-react";
import { calculateGeographicProtection } from "./utils/coastlineAnalysis";
import { getCardinalDirection } from "./helpers";

export default function FixedBeachView({
  beach,
  homeBeach,
  onSetHomeBeach,
  setView,
  onDataUpdate,
  timeRange,
  onTimeRangeChange,
  debugMode
}) {
  const [weatherData, setWeatherData] = useState(null);
  const [marineData, setMarineData] = useState(null);
  const [scoreBreakdown, setScoreBreakdown] = useState(null);
  const [geoProtection, setGeoProtection] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Re-fetch whenever beach or timeRange changes
  useEffect(() => {
    if (beach) {
      fetchWeatherData();
    }
  }, [beach?.id, timeRange.date, timeRange.startTime, timeRange.endTime]);

  // ─────────── Fetch weather + marine data ───────────
  async function fetchWeatherData() {
    if (!beach) return;
    setLoading(true);
    setError(null);

    try {
      const day0 = new Date(timeRange.date).toISOString().slice(0, 10);
      const tomorrow = new Date(timeRange.date);
      tomorrow.setDate(tomorrow.getDate() + 1);
      const day1 = tomorrow.toISOString().slice(0, 10);

      // Meteorological data
      const weatherUrl =
        `https://api.open-meteo.com/v1/forecast` +
        `?latitude=${beach.latitude}&longitude=${beach.longitude}` +
        `&hourly=temperature_2m,precipitation,cloudcover,windspeed_10m,winddirection_10m` +
        `&start_date=${day0}&end_date=${day1}&timezone=auto`;

      // Marine data: waves, tide & currents (correct parameter names)
      const marineUrl =
        `https://marine-api.open-meteo.com/v1/marine` +
        `?latitude=${beach.latitude}&longitude=${beach.longitude}` +
        `&hourly=wave_height,swell_wave_height,wave_direction,sea_level_height_msl,ocean_current_velocity,ocean_current_direction` +
        `&daily=wave_height_max,wave_direction_dominant` +
        `&start_date=${day0}&end_date=${day1}&timezone=auto`;

      const [wRes, mRes] = await Promise.all([fetch(weatherUrl), fetch(marineUrl)]);
      if (!wRes.ok) throw new Error(`Weather API ${wRes.status}`);
      if (!mRes.ok) throw new Error(`Marine API ${mRes.status}`);

      const weatherJson = await wRes.json();
      const marineJson = await mRes.json();
      setWeatherData(weatherJson);
      setMarineData(marineJson);

      calculateScores(weatherJson, marineJson);
      onDataUpdate && onDataUpdate();
    } catch (err) {
      console.error("Fetch error:", err);
      setError(err.message || "Failed to fetch data");
    } finally {
      setLoading(false);
    }
  }

  // ─────────── Compute paddle score breakdown ───────────
  function calculateScores(weather, marine) {
    // select hour indexes between startTime and endTime
    const [h0, h1] = timeRange.startTime.split(":").map(Number);
    const hours = weather.hourly.time.map((t) => new Date(t).getHours());
    let picks = hours
      .map((h, i) => (h >= h0 && h <= h1 ? i : -1))
      .filter((i) => i >= 0);

    // fallback: all hours of that date
    if (picks.length === 0) {
      const targetDay = new Date(timeRange.date).getDate();
      picks = weather.hourly.time
        .map((t, i) => (new Date(t).getDate() === targetDay ? i : -1))
        .filter((i) => i >= 0);
    }

    const avg = (arr) => arr.reduce((s, v) => s + v, 0) / arr.length;

    // meteorological averages
    const avgTemp = avg(picks.map((i) => weather.hourly.temperature_2m[i]));
    const avgWind = avg(picks.map((i) => weather.hourly.windspeed_10m[i]));
    const avgCloud = avg(picks.map((i) => weather.hourly.cloudcover[i]));
    const maxPrecip = Math.max(...picks.map((i) => weather.hourly.precipitation[i]));
    const avgDir = avg(picks.map((i) => weather.hourly.winddirection_10m[i]));
    const avgSwell = avg(picks.map((i) => marine.hourly.swell_wave_height[i]));
    // tide from sea_level_height_msl
    const avgTide = avg(picks.map((i) => marine.hourly.sea_level_height_msl[i]));
    // currents from ocean_current_velocity
    const avgCurr = avg(picks.map((i) => marine.hourly.ocean_current_velocity[i]));

    // geographic protection
    const domWaveDir = marine.daily.wave_direction_dominant[0];
    const geo = calculateGeographicProtection(beach, avgDir, domWaveDir);
    setGeoProtection(geo);

    // protected values
    const protWind = avgWind * (1 - geo.windProtection * 0.9);
    const protWave = marine.daily.wave_height_max[0] * (1 - geo.waveProtection * 0.9);

    // initialize breakdown object
    const bd = {
      wind: { raw: avgWind, prot: protWind, score: 0, max: 40 },
      waves: { raw: marine.daily.wave_height_max[0], prot: protWave, score: 0, max: 20 },
      swell: { raw: avgSwell, score: 0, max: 10 },
      precipitation: { raw: maxPrecip, score: 0, max: 10 },
      temperature: { raw: avgTemp, score: 0, max: 10 },
      cloudcover: { raw: avgCloud, score: 0, max: 10 },
      geographic: { raw: geo.protectionScore, score: 0, max: 15 },
      tide: { raw: avgTide, score: 0, max: 10 },
      currents: { raw: avgCurr, score: 0, max: 5 },
      total: { score: 0, max: 100 }
    };

    // scoring logic
    let total = 0;
    bd.wind.score = protWind < 8 ? 40 : Math.max(0, 40 - (protWind - 8) * (40 / 12));
    total += bd.wind.score;

    bd.waves.score = protWave < 0.2 ? 20 : Math.max(0, 20 - (protWave - 0.2) * (20 / 0.4));
    total += bd.waves.score;

    bd.swell.score = avgSwell < 0.3 ? 10 : Math.max(0, 10 - (avgSwell - 0.3) * (10 / 0.3));
    total += bd.swell.score;

    bd.precipitation.score = maxPrecip < 1 ? 10 : 0;
    total += bd.precipitation.score;

    if (avgTemp >= 22 && avgTemp <= 30) bd.temperature.score = 10;
    else if (avgTemp < 22) bd.temperature.score = Math.max(0, 10 - (22 - avgTemp));
    else bd.temperature.score = Math.max(0, 10 - (avgTemp - 30));
    total += bd.temperature.score;

    bd.cloudcover.score = avgCloud < 40 ? 10 : Math.max(0, 10 - (avgCloud - 40) / 6);
    total += bd.cloudcover.score;

    bd.geographic.score = (geo.protectionScore / 100) * 15;
    total += bd.geographic.score;

    // tide scoring (ideal 0.5–2.0 m)
    let tscore = avgTide >= 0.5 && avgTide <= 2.0
      ? 10
      : avgTide < 0.5
        ? (avgTide / 0.5) * 10
        : ((2.0 * 2 - avgTide) / 2.0) * 10;
    bd.tide.score = Math.round(Math.max(0, tscore));
    total += bd.tide.score;

    // currents scoring (penalize >1.5 m/s)
    bd.currents.score = Math.round(Math.max(0, (1 - Math.min(avgCurr / 1.5, 1)) * 5));
    total += bd.currents.score;

    // cap total
    bd.total.score = Math.round(Math.min(100, total));
    if (maxPrecip >= 1.5) {
      bd.precipitation.score = 0;
      bd.total.score = Math.min(bd.total.score, 40);
    }

    setScoreBreakdown(bd);
  }

  // ─────────── Render breakdown table ───────────
  function renderScoreBreakdown() {
    if (!scoreBreakdown) return null;
    const sb = scoreBreakdown;
    return (
      <div className="bg-white p-6 rounded-xl shadow-md border">
        <h4 className="flex items-center mb-4 text-gray-800 font-medium">
          <Info className="h-5 w-5 mr-2 text-blue-600" />
          Score Breakdown
        </h4>
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Factor</th>
              <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">Value</th>
              <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">Score</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {/* Wind */}
            <tr>
              <td className="px-4 py-2 text-sm text-gray-700">Wind Speed</td>
              <td className="px-4 py-2 text-sm text-gray-500 text-right">
                {sb.wind.raw.toFixed(1)} km/h <span className="text-xs text-gray-400">(Prot {sb.wind.prot.toFixed(1)})</span>
              </td>
              <td className={`px-4 py-2 text-sm font-medium text-right ${
                sb.wind.score>30?'text-green-600':sb.wind.score>20?'text-yellow-600':'text-red-600'
              }`}>
                {sb.wind.score}/{sb.wind.max}
              </td>
            </tr>
            {/* Waves */}
            <tr>
              <td className="px-4 py-2 text-sm text-gray-700">Wave Height</td>
              <td className="px-4 py-2 text-sm text-gray-500 text-right">
                {sb.waves.raw.toFixed(2)} m <span className="text-xs text-gray-400">(Prot {sb.waves.prot.toFixed(2)})</span>
              </td>
              <td className={`px-4 py-2 text-sm font-medium text-right ${
                sb.waves.score>15?'text-green-600':sb.waves.score>10?'text-yellow-600':'text-red-600'
              }`}>
                {sb.waves.score}/{sb.waves.max}
              </td>
            </tr>
            {/* Swell */}
            <tr>
              <td className="px-4 py-2 text-sm text-gray-700">Swell Height</td>
              <td className="px-4 py-2 text-sm text-gray-500 text-right">{sb.swell.raw.toFixed(2)} m</td>
              <td className={`px-4 py-2 text-sm font-medium text-right ${
                sb.swell.score>7?'text-green-600':sb.swell.score>5?'text-yellow-600':'text-red-600'
              }`}>
                {sb.swell.score}/{sb.swell.max}
              </td>
            </tr>
            {/* Precipitation */}
            <tr>
              <td className="px-4 py-2 text-sm text-gray-700">Precipitation</td>
              <td className="px-4 py-2 text-sm text-gray-500 text-right">{sb.precipitation.raw.toFixed(1)} mm</td>
              <td className={`px-4 py-2 text-sm font-medium text-right ${
                sb.precipitation.raw<1?'text-green-600':'text-red-600'
              }`}>
                {sb.precipitation.score}/{sb.precipitation.max}
              </td>
            </tr>
            {/* Temperature */}
            <tr>
              <td className="px-4 py-2 text-sm text-gray-700">Temperature</td>
              <td className="px-4 py-2 text-sm text-gray-500 text-right">{sb.temperature.raw.toFixed(1)} °C</td>
              <td className={`px-4 py-2 text-sm font-medium text-right ${
                sb.temperature.score>7?'text-green-600':'text-yellow-600'
              }`}>
                {sb.temperature.score}/{sb.temperature.max}
              </td>
            </tr>
            {/* Cloud Cover */}
            <tr>
              <td className="px-4 py-2 text-sm text-gray-700">Cloud Cover</td>
              <td className="px-4 py-2 text-sm text-gray-500 text-right">{sb.cloudcover.raw.toFixed(0)} %</td>
              <td className={`px-4 py-2 text-sm font-medium text-right ${
                sb.cloudcover.score>7?'text-green-600':sb.cloudcover.score>5?'text-yellow-600':'text-red-600'
              }`}>
                {sb.cloudcover.score}/{sb.cloudcover.max}
              </td>
            </tr>
            {/* Geographic Protection */}
            <tr>
              <td className="px-4 py-2 text-sm text-gray-700">Geographic Protection</td>
              <td className="px-4 py-2 text-sm text-gray-500 text-right">{sb.geographic.raw.toFixed(0)}/100</td>
              <td className={`px-4 py-2 text-sm font-medium text-right ${
                sb.geographic.score>10?'text-green-600':sb.geographic.score>5?'text-yellow-600':'text-red-600'
              }`}>
                {sb.geographic.score}/{sb.geographic.max}
              </td>
            </tr>
            {/* Tide */}
            <tr>
              <td className="px-4 py-2 text-sm text-gray-700">Tide</td>
              <td className="px-4 py-2 text-sm text-gray-500 text-right">{sb.tide.raw.toFixed(2)} m</td>
              <td className={`px-4 py-2 text-sm font-medium text-right ${
                sb.tide.score>7?'text-green-600':'text-red-600'
              }`}>
                {sb.tide.score}/{sb.tide.max}
              </td>
            </tr>
            {/* Currents */}
            <tr>
              <td className="px-4 py-2 text-sm text-gray-700">Currents</td>
              <td className="px-4 py-2 text-sm text-gray-500 text-right">{sb.currents.raw.toFixed(2)} m/s</td>
              <td className={`px-4 py-2 text-sm font-medium text-right ${
                sb.currents.score>3?'text-green-600':'text-red-600'
              }`}>
                {sb.currents.score}/{sb.currents.max}
              </td>
            </tr>
            {/* Total */}
            <tr className="bg-blue-50">
              <td className="px-4 py-3 text-sm font-bold text-gray-900">TOTAL SCORE</td>
              <td className="px-4 py-3"></td>
              <td className={`px-4 py-3 text-sm font-bold text-right ${
                sb.total.score>=85?'text-green-600':
                sb.total.score>=70?'text-yellow-600':
                sb.total.score>=50?'text-orange-600':'text-red-600'
              }`}>
                {sb.total.score}/{sb.total.max}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    );
  }

  // ─────────── Component render ───────────
  return (
    <div className="bg-white rounded-lg shadow-lg overflow-hidden">
      {/* Loading / Error */}
      {error && (
        <div className="p-4 text-red-600">
          <AlertCircle className="inline-block mr-2" /> {error}
        </div>
      )}
      {!error && loading && (
        <div className="p-4 text-gray-600">
          <RefreshCw className="animate-spin inline-block mr-2" /> Loading…
        </div>
      )}

      {/* Main content */}
      {!error && !loading && scoreBreakdown && (
        <div className="p-6">
          {/* ... your header, map/list toggle, cards, etc. ... */}
          {renderScoreBreakdown()}
          {/* ... geographic protection info, hourly wind chart ... */}
        </div>
      )}
    </div>
  );
}

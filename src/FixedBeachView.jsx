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

const FixedBeachView = ({
  beach,
  homeBeach,
  onSetHomeBeach,
  setView,
  onDataUpdate,
  timeRange,
  onTimeRangeChange,
  debugMode
}) => {
  const [weatherData, setWeatherData] = useState(null);
  const [marineData, setMarineData] = useState(null);
  const [scoreBreakdown, setScoreBreakdown] = useState(null);
  const [geoProtection, setGeoProtection] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Fetch when beach or date/time changes
  useEffect(() => {
    if (beach) fetchWeatherData();
  }, [beach?.id, timeRange.date, timeRange.startTime, timeRange.endTime]);

  // ─────────── Fetcher ───────────
  const fetchWeatherData = async () => {
    if (!beach) return;
    setLoading(true);
    setError(null);

    try {
      // Format dates
      const today = new Date(timeRange.date);
      const d0 = today.toISOString().slice(0, 10);
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);
      const d1 = tomorrow.toISOString().slice(0, 10);

      // Meteorological endpoint
      const weatherUrl = `https://api.open-meteo.com/v1/forecast` +
        `?latitude=${beach.latitude}&longitude=${beach.longitude}` +
        `&hourly=temperature_2m,precipitation,cloudcover,windspeed_10m,winddirection_10m` +
        `&start_date=${d0}&end_date=${d1}&timezone=auto`;

      // Marine endpoint (waves, tide, currents) - corrected parameter names
      const marineUrl = `https://marine-api.open-meteo.com/v1/marine` +
        `?latitude=${beach.latitude}&longitude=${beach.longitude}` +
        `&hourly=wave_height,swell_wave_height,wave_direction,sea_level_height_msl,ocean_current_velocity,ocean_current_direction` +
        `&daily=wave_height_max,wave_direction_dominant` +
        `&start_date=${d0}&end_date=${d1}&timezone=auto`;

      // Parallel fetch
      const [wRes, mRes] = await Promise.all([
        fetch(weatherUrl),
        fetch(marineUrl)
      ]);
      if (!wRes.ok) throw new Error(`Weather API ${wRes.status}`);
      if (!mRes.ok) throw new Error(`Marine API ${mRes.status}`);

      const weatherJson = await wRes.json();
      const marineJson  = await mRes.json();
      setWeatherData(weatherJson);
      setMarineData(marineJson);

      // Compute scores
      calculateScores(weatherJson, marineJson);

      // Notify parent
      onDataUpdate?.();
    } catch (err) {
      console.error(err);
      setError(err.message || "Fetch error");
    } finally {
      setLoading(false);
    }
  };

  // ─────────── Scoring ───────────
  const calculateScores = (weather, marine) => {
    // Build index range
    const startH = +timeRange.startTime.split(":")[0];
    const endH   = +timeRange.endTime.split(":")[0];
    const hours  = weather.hourly.time.map(t => new Date(t).getHours());
    let picks   = hours
      .map((h,i) => (h >= startH && h <= endH) ? i : -1)
      .filter(i => i >= 0);

    // If none in window, pick all today’s hours
    if (!picks.length) {
      const targetDay = new Date(timeRange.date).getDate();
      picks = weather.hourly.time
        .map((t,i) => (new Date(t).getDate() === targetDay ? i : -1))
        .filter(i => i >= 0);
    }

    const avg = arr => arr.reduce((s,v) => s + v, 0) / arr.length;
    // Averages
    const avgTemp  = avg(picks.map(i => weather.hourly.temperature_2m[i]));
    const avgWind  = avg(picks.map(i => weather.hourly.windspeed_10m[i]));
    const avgCloud = avg(picks.map(i => weather.hourly.cloudcover[i]));
    const maxPrecip= Math.max(...picks.map(i => weather.hourly.precipitation[i]));
    const avgDir   = avg(picks.map(i => weather.hourly.winddirection_10m[i]));
    const avgSwell = avg(picks.map(i => marine.hourly.swell_wave_height[i]));
    // **Tide** from sea_level_height_msl
    const avgTide  = avg(picks.map(i => marine.hourly.sea_level_height_msl[i]));
    // **Currents** from ocean_current_velocity
    const avgCurr  = avg(picks.map(i => marine.hourly.ocean_current_velocity[i]));

    // Geographic protection
    const domWaveDir = marine.daily.wave_direction_dominant[0];
    const geo = calculateGeographicProtection(beach, avgDir, domWaveDir);
    setGeoProtection(geo);

    const protWind = avgWind * (1 - geo.windProtection * 0.9);
    const protWave = marine.daily.wave_height_max[0] * (1 - geo.waveProtection * 0.9);

    // Breakdown initialization
    const bd = {
      windSpeed:     { raw: avgWind,  protected: protWind, score: 0, maxPossible: 40 },
      waveHeight:    { raw: marine.daily.wave_height_max[0], protected: protWave, score: 0, maxPossible: 20 },
      swellHeight:   { raw: avgSwell, protected: protWave, score: 0, maxPossible: 10 },
      precipitation: { value: maxPrecip, score: 0, maxPossible: 10 },
      temperature:   { value: avgTemp, score: 0, maxPossible: 10 },
      cloudCover:    { value: avgCloud, score: 0, maxPossible: 10 },
      geoProtection: { value: geo.protectionScore, score: 0, maxPossible: 15 },
      tide:          { value: avgTide, score: 0, maxPossible: 10 },
      currents:      { value: avgCurr, score: 0, maxPossible: 5 },
      total:         { score: 0, maxPossible: 100 }
    };

    // Scoring logic
    let total = 0;
    bd.windSpeed.score = protWind < 8 ? 40 : Math.max(0, 40 - (protWind - 8) * (40/12));
    total += bd.windSpeed.score;
    bd.waveHeight.score = protWave < 0.2 ? 20 : Math.max(0, 20 - (protWave - 0.2) * (20/0.4));
    total += bd.waveHeight.score;
    bd.swellHeight.score = protWave < 0.3 ? 10 : Math.max(0, 10 - (protWave - 0.3) * (10/0.3));
    total += bd.swellHeight.score;
    bd.precipitation.score = maxPrecip < 1 ? 10 : 0;
    total += bd.precipitation.score;
    // Temp
    if (avgTemp >= 22 && avgTemp <= 30) bd.temperature.score = 10;
    else if (avgTemp < 22) bd.temperature.score = Math.max(0, 10 - (22 - avgTemp));
    else bd.temperature.score = Math.max(0, 10 - (avgTemp - 30));
    total += bd.temperature.score;
    // Cloud
    bd.cloudCover.score = avgCloud < 40 ? 10 : Math.max(0, 10 - (avgCloud - 40)/6);
    total += bd.cloudCover.score;
    // Geo
    bd.geoProtection.score = (geo.protectionScore / 100) * 15;
    total += bd.geoProtection.score;
    // Tide (ideal 0.5–2.0m)
    let tScore = avgTide >= 0.5 && avgTide <= 2.0
      ? 10
      : avgTide < 0.5
        ? (avgTide / 0.5) * 10
        : ((2.0*2 - avgTide)/2.0) * 10;
    bd.tide.score = Math.round(Math.max(0, tScore));
    total += bd.tide.score;
    // Currents (penalize >1.5 m/s)
    const cScore = (1 - Math.min(avgCurr/1.5,1)) * 5;
    bd.currents.score = Math.round(Math.max(0, cScore));
    total += bd.currents.score;

    // Cap & finalize
    bd.total.score = Math.round(Math.min(100, total));
    if (maxPrecip >= 1.5) {
      bd.precipitation.score = 0;
      bd.total.score = Math.min(bd.total.score, 40);
    }

    setScoreBreakdown(bd);
  };

  // ─────────── UI ───────────
  const renderScoreBreakdown = () => {
    if (!scoreBreakdown) return null;
    const sb = scoreBreakdown;
    return (
      <div className="bg-white p-5 rounded-lg mt-4 shadow-sm border">
        <h4 className="font-medium mb-4 flex items-center text-gray-800">
          <Info className="h-5 w-5 mr-2 text-blue-600" />
          Score Breakdown
        </h4>
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Factor</th>
              <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Value</th>
              <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Score</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {/* ... existing rows for wind, waves, etc. */}
            {/* Tide */}
            <tr>
              <td className="px-4 py-2 text-sm font-medium text-gray-700">Tide</td>
              <td className="px-4 py-2 text-sm text-gray-500 text-right">{sb.tide.value.toFixed(2)} m</td>
              <td className={`px-4 py-2 text-sm font-medium text-right ${sb.tide.score>7?'text-green-600':'text-gray-600'}`}>
                {sb.tide.score}/{sb.tide.maxPossible}
              </td>
            </tr>
            {/* Currents */}
            <tr>
              <td className="px-4 py-2 text-sm font-medium text-gray-700">Currents</td>
              <td className="px-4 py-2 text-sm text-gray-500 text-right">{sb.currents.value.toFixed(2)} m/s</td>
              <td className={`px-4 py-2 text-sm font-medium text-right ${sb.currents.score>3?'text-green-600':'text-gray-600'}`}>
                {sb.currents.score}/{sb.currents.maxPossible}
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
              }`}>{sb.total.score}/{sb.total.maxPossible}</td>
            </tr>
          </tbody>
        </table>
      </div>
    );
  };

  return (
    <div className="bg-white rounded-lg shadow-lg overflow-hidden">
      {error && (
        <div className="p-4 text-red-600">
          <AlertCircle className="inline-block mr-2" />{error}
        </div>
      )}
      {!error && loading && (
        <div className="p-4 text-gray-600">
          <RefreshCw className="animate-spin inline-block mr-2" />Loading…
        </div>
      )}
      {!error && !loading && scoreBreakdown && (
        <div className="p-6">
          {/* … your existing header, weather cards, alerts, etc. … */}
          {renderScoreBreakdown()}
          {/* … geographic protection, hourly charts, etc. … */}
        </div>
      )}
    </div>
  );
};

export default FixedBeachView;

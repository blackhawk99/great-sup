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
  const [paddleScore, setPaddleScore] = useState(null);
  const [scoreBreakdown, setScoreBreakdown] = useState(null);
  const [geoProtection, setGeoProtection] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Safe default for condition
  const condition = paddleScore !== null && scoreBreakdown
    ? computeCondition(paddleScore, weatherData, scoreBreakdown)
    : { emoji: "⏳", label: "Loading", message: "Calculating conditions...", color: "text-gray-500" };

  useEffect(() => {
    if (beach) {
      fetchWeatherData();
    }
  }, [beach?.id, timeRange.date, timeRange.startTime, timeRange.endTime]);

  async function fetchWeatherData() {
    if (!beach) return;
    setLoading(true);
    setError(null);

    try {
      const d0 = new Date(timeRange.date).toISOString().slice(0, 10);
      const tmp = new Date(timeRange.date);
      tmp.setDate(tmp.getDate() + 1);
      const d1 = tmp.toISOString().slice(0, 10);

      const weatherUrl =
        `https://api.open-meteo.com/v1/forecast` +
        `?latitude=${beach.latitude}&longitude=${beach.longitude}` +
        `&hourly=temperature_2m,precipitation,cloudcover,windspeed_10m,winddirection_10m` +
        `&daily=precipitation_sum,windspeed_10m_max` +
        `&start_date=${d0}&end_date=${d1}&timezone=auto`;

      const marineUrl =
        `https://marine-api.open-meteo.com/v1/marine` +
        `?latitude=${beach.latitude}&longitude=${beach.longitude}` +
        `&hourly=wave_height,swell_wave_height,wave_direction,sea_level_height_msl,ocean_current_velocity,ocean_current_direction` +
        `&daily=wave_height_max,wave_direction_dominant` +
        `&start_date=${d0}&end_date=${d1}&timezone=auto`;

      const [wRes, mRes] = await Promise.all([fetch(weatherUrl), fetch(marineUrl)]);
      if (!wRes.ok) throw new Error(`Weather API ${wRes.status}`);
      if (!mRes.ok) throw new Error(`Marine API ${mRes.status}`);

      const weatherJson = await wRes.json();
      const marineJson = await mRes.json();
      setWeatherData(weatherJson);
      setMarineData(marineJson);

      await calculateScores(weatherJson, marineJson);
      onDataUpdate?.();
    } catch (err) {
      console.error(err);
      setError(err.message || "Failed to fetch data");
    } finally {
      setLoading(false);
    }
  }

  async function calculateScores(weather, marine) {
    const [h0, h1] = timeRange.startTime.split(":").map(Number);
    const hours = weather.hourly.time.map(t => new Date(t).getHours());
    let picks = hours.map((h, i) => (h >= h0 && h <= h1 ? i : -1)).filter(i => i >= 0);
    if (!picks.length) {
      const targetDay = new Date(timeRange.date).getDate();
      picks = weather.hourly.time
        .map((t, i) => (new Date(t).getDate() === targetDay ? i : -1))
        .filter(i => i >= 0);
    }

    const avg = arr => arr.reduce((s, v) => s + v, 0) / arr.length;
    const avgTemp = avg(picks.map(i => weather.hourly.temperature_2m[i]));
    const avgWind = avg(picks.map(i => weather.hourly.windspeed_10m[i]));
    const avgCloud = avg(picks.map(i => weather.hourly.cloudcover[i]));
    const maxPrecip = Math.max(...picks.map(i => weather.hourly.precipitation[i]));
    const avgDir = avg(picks.map(i => weather.hourly.winddirection_10m[i]));
    const waveMax = marine.daily.wave_height_max[0];
    const avgSwell = avg(picks.map(i => marine.hourly.swell_wave_height[i]));
    const avgTide = avg(picks.map(i => marine.hourly.sea_level_height_msl[i]));
    const avgCurr = avg(picks.map(i => marine.hourly.ocean_current_velocity[i]));

    const domWaveDir = marine.daily.wave_direction_dominant[0];
    const geo = await calculateGeographicProtection(beach, avgDir, domWaveDir);
    setGeoProtection(geo);

    const protWind = avgWind * (1 - geo.windProtection * 0.9);
    const protWave = waveMax * (1 - geo.waveProtection * 0.9);
    const protSwell = avgSwell * (1 - geo.waveProtection * 0.85);

    const bd = {
      windSpeed: { raw: avgWind, protected: protWind, score: 0, maxPossible: 40 },
      waveHeight: { raw: waveMax, protected: protWave, score: 0, maxPossible: 20 },
      swellHeight: { raw: avgSwell, protected: protSwell, score: 0, maxPossible: 10 },
      precipitation: { raw: maxPrecip, score: 0, maxPossible: 10 },
      temperature: { raw: avgTemp, score: 0, maxPossible: 10 },
      cloudCover: { raw: avgCloud, score: 0, maxPossible: 10 },
      geoProtection: { raw: geo.protectionScore, score: 0, maxPossible: 15 },
      tide: { raw: avgTide, score: 0, maxPossible: 10 },
      currents: { raw: avgCurr, score: 0, maxPossible: 5 },
      total: { score: 0, maxPossible: 100 }
    };

    let total = 0;
    bd.windSpeed.score = protWind < 8 ? 40 : Math.max(0, 40 - (protWind - 8) * (40 / 12)); total += bd.windSpeed.score;
    bd.waveHeight.score = protWave < 0.2 ? 20 : Math.max(0, 20 - (protWave - 0.2) * (20 / 0.4)); total += bd.waveHeight.score;
    bd.swellHeight.score = avgSwell < 0.3 ? 10 : Math.max(0, 10 - (avgSwell - 0.3) * (10 / 0.3)); total += bd.swellHeight.score;
    bd.precipitation.score = maxPrecip < 1 ? 10 : 0; total += bd.precipitation.score;
    bd.temperature.score = avgTemp >= 22 && avgTemp <= 30
      ? 10
      : avgTemp < 22
        ? Math.max(0, 10 - (22 - avgTemp))
        : Math.max(0, 10 - (avgTemp - 30)); total += bd.temperature.score;
    bd.cloudCover.score = avgCloud < 40 ? 10 : Math.max(0, 10 - (avgCloud - 40) / 6); total += bd.cloudCover.score;
    bd.geoProtection.score = (geo.protectionScore / 100) * 15; total += bd.geoProtection.score;
    const tideScore = avgTide >= 0.5 && avgTide <= 2.0
      ? 10
      : avgTide < 0.5
        ? (avgTide / 0.5) * 10
        : ((2.0 * 2 - avgTide) / 2.0) * 10;
    bd.tide.score = Math.round(Math.max(0, tideScore)); total += bd.tide.score;
    bd.currents.score = Math.round(Math.max(0, (1 - Math.min(avgCurr / 1.5, 1)) * 5)); total += bd.currents.score;

    bd.total.score = Math.round(Math.min(100, total));
    if (maxPrecip >= 1.5) {
      bd.precipitation.score = 0;
      bd.total.score = Math.min(bd.total.score, 40);
    }

    ["windSpeed","waveHeight","s…

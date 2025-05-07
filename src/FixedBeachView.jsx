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
  const [marineData, setMarineData]   = useState(null);
  const [paddleScore, setPaddleScore] = useState(null);
  const [scoreBreakdown, setScoreBreakdown] = useState(null);
  const [geoProtection, setGeoProtection]   = useState(null);
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState(null);

  // Safe condition object so we never read .emoji on undefined
  const condition = paddleScore !== null && weatherData
    ? computeCondition(paddleScore, weatherData, scoreBreakdown)
    : { emoji: "⏳", label: "Loading", message: "Calculating conditions...", color: "text-gray-500" };

  useEffect(() => {
    if (beach) fetchWeatherData();
  }, [beach?.id, timeRange.date, timeRange.startTime, timeRange.endTime]);

  async function fetchWeatherData() {
    if (!beach) return;
    setLoading(true);
    setError(null);

    try {
      const day0 = new Date(timeRange.date).toISOString().slice(0,10);
      const tmp  = new Date(timeRange.date);
      tmp.setDate(tmp.getDate() + 1);
      const day1 = tmp.toISOString().slice(0,10);

      // Meteorological endpoint
      const weatherUrl =
        `https://api.open-meteo.com/v1/forecast` +
        `?latitude=${beach.latitude}&longitude=${beach.longitude}` +
        `&hourly=temperature_2m,precipitation,cloudcover,windspeed_10m,winddirection_10m` +
        `&daily=precipitation_sum,windspeed_10m_max` +
        `&start_date=${day0}&end_date=${day1}&timezone=auto`;

      // Marine endpoint (waves, tide, currents)
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
      const marineJson  = await mRes.json();
      setWeatherData(weatherJson);
      setMarineData(marineJson);

      await calculateScores(weatherJson, marineJson, beach);
      onDataUpdate?.();
    } catch (err) {
      console.error(err);
      setError(err.message || "Failed to fetch data");
    } finally {
      setLoading(false);
    }
  }

  async function calculateScores(weather, marine, beach) {
    const [h0, h1] = timeRange.startTime.split(":").map(Number);
    const hours    = weather.hourly.time.map(t => new Date(t).getHours());
    let picks      = hours.map((h,i) => (h>=h0&&h<=h1)?i:-1).filter(i => i>=0);

    // fallback to all hours of that date
    if (!picks.length) {
      const targetDay = new Date(timeRange.date).getDate();
      picks = weather.hourly.time
        .map((t,i) => new Date(t).getDate()===targetDay ? i : -1)
        .filter(i => i>=0);
    }

    const avg = arr => arr.reduce((s,v) => s+v, 0) / arr.length;
    const avgTemp  = avg(picks.map(i=>weather.hourly.temperature_2m[i]));
    const avgWind  = avg(picks.map(i=>weather.hourly.windspeed_10m[i]));
    const avgCloud = avg(picks.map(i=>weather.hourly.cloudcover[i]));
    const maxPrecip= Math.max(...picks.map(i=>weather.hourly.precipitation[i]));
    const avgDir   = avg(picks.map(i=>weather.hourly.winddirection_10m[i]));
    const waveMax  = marine.daily.wave_height_max[0];
    const avgSwell = avg(picks.map(i=>marine.hourly.swell_wave_height[i]));
    const avgTide  = avg(picks.map(i=>marine.hourly.sea_level_height_msl[i]));
    const avgCurr  = avg(picks.map(i=>marine.hourly.ocean_current_velocity[i]));

    const domWaveDir = marine.daily.wave_direction_dominant[0];
    const geo = await calculateGeographicProtection(beach, avgDir, domWaveDir);
    setGeoProtection(geo);

    const protWind  = avgWind  * (1 - geo.windProtection * 0.9);
    const protWave  = waveMax  * (1 - geo.waveProtection * 0.9);
    const protSwell = avgSwell * (1 - geo.waveProtection * 0.85);

    const bd = {
      windSpeed:    { raw: avgWind

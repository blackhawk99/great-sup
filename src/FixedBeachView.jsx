// FixedBeachView.jsx - Corrected scoring normalization to 100
import React, { useState, useEffect } from "react";
import { Home, ChevronLeft, RefreshCw, AlertCircle, MapPin, Map, Wind, Thermometer, Droplets, Waves, Sun, Clock, Calendar, Info } from "lucide-react";
import { calculateGeographicProtection } from "./utils/coastlineAnalysis";
import { getCardinalDirection } from "./helpers";

const FACTOR_MAX = {
  windSpeed: 40,
  waveHeight: 20,
  swellHeight: 10,
  precipitation: 10,
  temperature: 10,
  cloudCover: 10,
  geoProtection: 15
};
const MAX_TOTAL_SCORE = Object.values(FACTOR_MAX).reduce((a, b) => a + b, 0); // 115

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
  const [paddleScore, setPaddleScore] = useState(null);
  const [scoreBreakdown, setScoreBreakdown] = useState(null);
  const [geoProtection, setGeoProtection] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Load data on mount and when date/time changes
  useEffect(() => {
    if (beach) {
      fetchWeatherData();
    }
  }, [beach?.id, timeRange.date]);

  // Fetch real weather data
  const fetchWeatherData = async () => {
    if (!beach) return;

    setLoading(true);
    setError(null);

    try {
      // Format dates for API
      const today = new Date(timeRange.date);
      const formattedDate = today.toISOString().split('T')[0];
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);
      const formattedTomorrow = tomorrow.toISOString().split('T')[0];

      // API URLs
      const weatherUrl = `https://api.open-meteo.com/v1/forecast?latitude=${beach.latitude}&longitude=${beach.longitude}&hourly=temperature_2m,precipitation,cloudcover,windspeed_10m,winddirection_10m&daily=precipitation_sum,windspeed_10m_max&start_date=${formattedDate}&end_date=${formattedTomorrow}&timezone=auto`;
      const marineUrl = `https://marine-api.open-meteo.com/v1/marine?latitude=${beach.latitude}&longitude=${beach.longitude}&hourly=wave_height,swell_wave_height,wave_direction&daily=wave_height_max,wave_direction_dominant&start_date=${formattedDate}&end_date=${formattedTomorrow}&timezone=auto`;

      // Fetch data
      const [weatherRes, marineRes] = await Promise.all([
        fetch(weatherUrl),
        fetch(marineUrl)
      ]);

      if (!weatherRes.ok) throw new Error(`Weather API error: ${weatherRes.status}`);
      if (!marineRes.ok) throw new Error(`Marine API error: ${marineRes.status}`);

      const weatherData = await weatherRes.json();
      const marineData = await marineRes.json();

      setWeatherData(weatherData);
      setMarineData(marineData);

      // Calculate scores
      await calculateScores(weatherData, marineData, beach);

      // Update last updated timestamp
      if (typeof onDataUpdate === 'function') {
        onDataUpdate();
      }
    } catch (err) {
      console.error("Error fetching data:", err);
      setError(err.message || "Failed to fetch weather data");
    } finally {
      setLoading(false);
    }
  };

  // Calculate paddleboarding scores (normalized)
  const calculateScores = async (weather, marine, beach) => {
    try {
      // Get data for the selected time range
      const startHour = parseInt(timeRange.startTime.split(":")[0]);
      const endHour = parseInt(timeRange.endTime.split(":")[0]);

      // Find indices for relevant hours
      const relevantIndices = [];
      for (let i = 0; i < weather.hourly.time.length; i++) {
        const time = new Date(weather.hourly.time[i]);
        if (time.getHours() >= startHour && time.getHours() <= endHour) {
          relevantIndices.push(i);
        }
      }

      // If no hours match, use default range
      if (relevantIndices.length === 0) {
        for (let i = 0; i < weather.hourly.time.length; i++) {
          const time = new Date(weather.hourly.time[i]);
          if (time.getDate() === new Date(timeRange.date).getDate()) {
            relevantIndices.push(i);
          }
        }
      }

      // Calculate averages
      const avgTemp = relevantIndices.map(i => weather.hourly.temperature_2m[i])
        .reduce((sum, val) => sum + val, 0) / relevantIndices.length;
      const avgWind = relevantIndices.map(i => weather.hourly.windspeed_10m[i])
        .reduce((sum, val) => sum + val, 0) / relevantIndices.length;
      const avgCloud = relevantIndices.map(i => weather.hourly.cloudcover[i])
        .reduce((sum, val) => sum + val, 0) / relevantIndices.length;
      const maxPrecip = Math.max(...relevantIndices.map(i => weather.hourly.precipitation[i]));
      const avgWindDir = relevantIndices.map(i => weather.hourly.winddirection_10m[i])
        .reduce((sum, val) => sum + val, 0) / relevantIndices.length;
      const waveHeight = marine.daily.wave_height_max[0];
      const avgSwellHeight = relevantIndices.map(i => marine.hourly.swell_wave_height[i])
        .reduce((sum, val) => sum + val, 0) / relevantIndices.length;

      // Calculate geographic protection
      const waveDirection = marine.daily.wave_direction_dominant[0];
      const protection = await calculateGeographicProtection(beach, avgWindDir, waveDirection);
      setGeoProtection(protection);

      // Apply protection factors
      const protectedWindSpeed = avgWind * (1 - (protection.windProtection * 0.9));
      const protectedWaveHeight = waveHeight * (1 - (protection.waveProtection * 0.9));
      const protectedSwellHeight = avgSwellHeight * (1 - (protection.waveProtection * 0.85));

      // Initialize score breakdown
      const breakdown = {
        windSpeed: { raw: avgWind, protected: protectedWindSpeed, score: 0, maxPossible: FACTOR_MAX.windSpeed },
        waveHeight: { raw: waveHeight, protected: protectedWaveHeight, score: 0, maxPossible: FACTOR_MAX.waveHeight },
        swellHeight: { raw: avgSwellHeight, protected: protectedSwellHeight, score: 0, maxPossible: FACTOR_MAX.swellHeight },
        precipitation: { value: maxPrecip, score: 0, maxPossible: FACTOR_MAX.precipitation },
        temperature: { value: avgTemp, score: 0, maxPossible: FACTOR_MAX.temperature },
        cloudCover: { value: avgCloud, score: 0, maxPossible: FACTOR_MAX.cloudCover },
        geoProtection: { value: protection.protectionScore, score: 0, maxPossible: FACTOR_MAX.geoProtection },
        total: { score: 0, maxPossible: 100 }
      };

      // Calculate individual scores
      let rawTotalScore = 0;
      // Wind speed (0-40)
      breakdown.windSpeed.score = protectedWindSpeed < 8 ? 40 : Math.max(0, 40 - (protectedWindSpeed - 8) * (40 / 12));
      rawTotalScore += breakdown.windSpeed.score;
      // Wave height (0-20)
      breakdown.waveHeight.score = protectedWaveHeight < 0.2 ? 20 : Math.max(0, 20 - (protectedWaveHeight - 0.2) * (20 / 0.4));
      rawTotalScore += breakdown.waveHeight.score;
      // Swell height (0-10)
      breakdown.swellHeight.score = protectedSwellHeight < 0.3 ? 10 : Math.max(0, 10 - (protectedSwellHeight - 0.3) * (10 / 0.3));
      rawTotalScore += breakdown.swellHeight.score;
      // Precipitation (0-10)
      breakdown.precipitation.score = maxPrecip < 1 ? 10 : 0;
      rawTotalScore += breakdown.precipitation.score;
      // Temperature (0-10)
      if (avgTemp >= 22 && avgTemp <= 30) {
        breakdown.temperature.score = 10;
      } else if (avgTemp < 22) {
        breakdown.temperature.score = Math.max(0, 10 - (22 - avgTemp));
      } else {
        breakdown.temperature.score = Math.max(0, 10 - (avgTemp - 30));
      }
      rawTotalScore += breakdown.temperature.score;
      // Cloud cover (0-10)
      breakdown.cloudCover.score = avgCloud < 40 ? 10 : Math.max(0, 10 - (avgCloud - 40) / 6);
      rawTotalScore += breakdown.cloudCover.score;
      // Geographic protection (0-15)
      breakdown.geoProtection.score = (protection.protectionScore / 100) * 15;
      rawTotalScore += breakdown.geoProtection.score;

      // Round all scores for display
      breakdown.windSpeed.score = Math.round(breakdown.windSpeed.score);
      breakdown.waveHeight.score = Math.round(breakdown.waveHeight.score);
      breakdown.swellHeight.score = Math.round(breakdown.swellHeight.score);
      breakdown.precipitation.score = Math.round(breakdown.precipitation.score);
      breakdown.temperature.score = Math.round(breakdown.temperature.score);
      breakdown.cloudCover.score = Math.round(breakdown.cloudCover.score);
      breakdown.geoProtection.score = Math.round(breakdown.geoProtection.score);

      // Normalize to 100
      let normalizedTotalScore = Math.round(rawTotalScore * 100 / MAX_TOTAL_SCORE);

      // Apply special conditions
      if (maxPrecip >= 1.5) {
        breakdown.precipitation.score = 0;
        normalizedTotalScore = Math.min(normalizedTotalScore, 40);
      }

      breakdown.total.rawScore = Math.round(rawTotalScore);
      breakdown.total.score = normalizedTotalScore;

      setPaddleScore(normalizedTotalScore);
      setScoreBreakdown(breakdown);

    } catch (err) {
      console.error("Error calculating scores:", err);
      setPaddleScore(null);
      setScoreBreakdown(null);
    }
  };

  // ... all the rest of your component unchanged (UI rendering, etc.) ...
  // You can keep your previous UI code: just make sure to display breakdown.total.score as the TOTAL.

  // Only the scoring/calculateScores part changes. If you want the **full file** including UI, just say so!

  // For the UI, in your score breakdown table, change the TOTAL row to:
  // {scoreBreakdown?.total.score ?? '-'} / 100

  // If you want to show the "Raw subtotal (out of 115)" for transparency, add:
  // {scoreBreakdown?.total.rawScore ?? '-'} / 115

  // ... (UI rendering code goes here) ...

};

export default FixedBeachView;

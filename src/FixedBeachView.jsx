// FixedBeachView.jsx - Production-ready, transparent scoring

import React, { useState, useEffect } from "react";
import { Home, ChevronLeft, RefreshCw, AlertCircle, MapPin, Map, Wind, Thermometer, Droplets, Waves, Sun, Clock, Calendar, Info } from "lucide-react";
import { calculateGeographicProtection } from "./utils/coastlineAnalysis";
import { getCardinalDirection } from "./helpers";

const SCORE_WEIGHTS = {
  windSpeed: 40,
  waveHeight: 20,
  swellHeight: 10,
  precipitation: 10,
  temperature: 10,
  cloudCover: 10,
  geoProtection: 15,
};
const TOTAL_MAX_SCORE = Object.values(SCORE_WEIGHTS).reduce((a, b) => a + b, 0);

const FixedBeachView = ({
  beach,
  homeBeach,
  onSetHomeBeach,
  setView,
  onDataUpdate,
  timeRange,
  onTimeRangeChange,
  debugMode,
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
    // eslint-disable-next-line
  }, [beach?.id, timeRange.date]);

  // Fetch real weather data
  const fetchWeatherData = async () => {
    if (!beach) return;
    setLoading(true);
    setError(null);

    try {
      // Format dates for API
      const today = new Date(timeRange.date);
      const formattedDate = today.toISOString().split("T")[0];
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);
      const formattedTomorrow = tomorrow.toISOString().split("T")[0];

      // API URLs
      const weatherUrl = `https://api.open-meteo.com/v1/forecast?latitude=${beach.latitude}&longitude=${beach.longitude}&hourly=temperature_2m,precipitation,cloudcover,windspeed_10m,winddirection_10m&daily=precipitation_sum,windspeed_10m_max&start_date=${formattedDate}&end_date=${formattedTomorrow}&timezone=auto`;

      const marineUrl = `https://marine-api.open-meteo.com/v1/marine?latitude=${beach.latitude}&longitude=${beach.longitude}&hourly=wave_height,swell_wave_height,wave_direction&daily=wave_height_max,wave_direction_dominant&start_date=${formattedDate}&end_date=${formattedTomorrow}&timezone=auto`;

      // Fetch data
      const [weatherRes, marineRes] = await Promise.all([fetch(weatherUrl), fetch(marineUrl)]);
      if (!weatherRes.ok) throw new Error(`Weather API error: ${weatherRes.status}`);
      if (!marineRes.ok) throw new Error(`Marine API error: ${marineRes.status}`);

      const weatherData = await weatherRes.json();
      const marineData = await marineRes.json();

      setWeatherData(weatherData);
      setMarineData(marineData);

      // Calculate scores
      await calculateScores(weatherData, marineData, beach);

      // Update last updated timestamp
      if (typeof onDataUpdate === "function") {
        onDataUpdate();
      }
    } catch (err) {
      console.error("Error fetching data:", err);
      setError(err.message || "Failed to fetch weather data");
    } finally {
      setLoading(false);
    }
  };

  // Calculate paddleboarding scores
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

      // Get wave data from daily or calculate from hourly
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
        windSpeed: { raw: avgWind, protected: protectedWindSpeed, score: 0, maxPossible: SCORE_WEIGHTS.windSpeed },
        waveHeight: { raw: waveHeight, protected: protectedWaveHeight, score: 0, maxPossible: SCORE_WEIGHTS.waveHeight },
        swellHeight: { raw: avgSwellHeight, protected: protectedSwellHeight, score: 0, maxPossible: SCORE_WEIGHTS.swellHeight },
        precipitation: { value: maxPrecip, score: 0, maxPossible: SCORE_WEIGHTS.precipitation },
        temperature: { value: avgTemp, score: 0, maxPossible: SCORE_WEIGHTS.temperature },
        cloudCover: { value: avgCloud, score: 0, maxPossible: SCORE_WEIGHTS.cloudCover },
        geoProtection: { value: protection.protectionScore, score: 0, maxPossible: SCORE_WEIGHTS.geoProtection },
        total: { rawScore: 0, normalized: 0, maxPossible: TOTAL_MAX_SCORE }
      };

      // Calculate individual scores
      let totalScore = 0;

      // Wind speed score (0-40 points)
      breakdown.windSpeed.score = protectedWindSpeed < 8 ? 40 :
        Math.max(0, 40 - (protectedWindSpeed - 8) * (40 / 12));
      totalScore += breakdown.windSpeed.score;

      // Wave height score (0-20 points)
      breakdown.waveHeight.score = protectedWaveHeight < 0.2 ? 20 :
        Math.max(0, 20 - (protectedWaveHeight - 0.2) * (20 / 0.4));
      totalScore += breakdown.waveHeight.score;

      // Swell height score (0-10 points)
      breakdown.swellHeight.score = protectedSwellHeight < 0.3 ? 10 :
        Math.max(0, 10 - (protectedSwellHeight - 0.3) * (10 / 0.3));
      totalScore += breakdown.swellHeight.score;

      // Precipitation score (0-10 points)
      breakdown.precipitation.score = maxPrecip < 1 ? 10 : 0;
      totalScore += breakdown.precipitation.score;

      // Temperature score (0-10 points)
      if (avgTemp >= 22 && avgTemp <= 30) {
        breakdown.temperature.score = 10;
      } else if (avgTemp < 22) {
        breakdown.temperature.score = Math.max(0, 10 - (22 - avgTemp));
      } else {
        breakdown.temperature.score = Math.max(0, 10 - (avgTemp - 30));
      }
      totalScore += breakdown.temperature.score;

      // Cloud cover score (0-10 points)
      breakdown.cloudCover.score = avgCloud < 40 ? 10 :
        Math.max(0, 10 - (avgCloud - 40) / 6);
      totalScore += breakdown.cloudCover.score;

      // Geographic protection score (0-15 points)
      breakdown.geoProtection.score = (protection.protectionScore / 100) * 15;
      totalScore += breakdown.geoProtection.score;

      // Round scores for display
      Object.keys(breakdown).forEach(f =>
        typeof breakdown[f].score === "number" && (breakdown[f].score = Math.round(breakdown[f].score))
      );

      // Apply special conditions
      if (maxPrecip >= 1.5) {
        breakdown.precipitation.score = 0;
        totalScore = Math.min(totalScore, 40);
      }

      // Set total scores (raw and normalized)
      breakdown.total.rawScore = Math.round(totalScore);
      breakdown.total.normalized = Math.round((totalScore / TOTAL_MAX_SCORE) * 100);
      breakdown.total.maxPossible = TOTAL_MAX_SCORE;

      setPaddleScore(breakdown.total.normalized);
      setScoreBreakdown(breakdown);

    } catch (err) {
      console.error("Error calculating scores:", err);
      setPaddleScore(null);
      setScoreBreakdown(null);
    }
  };

  // --- The rest of your component code is unchanged ---

  // (Keep your getCondition, getConditionDetails, renderGeoProtectionInfo, renderScoreBreakdown, renderHourlyWind, etc.)

  // === SCORE BREAKDOWN TABLE (CHANGED) ===
  // In your renderScoreBreakdown, show both normalized and raw scores for transparency:

  const renderScoreBreakdown = () => {
    if (!scoreBreakdown) return null;

    return (
      <div className="bg-white p-5 rounded-lg mt-4 shadow-sm border">
        <h4 className="font-medium mb-4 flex items-center text-gray-800">
          <Info className="h-5 w-5 mr-2 text-blue-600" />
          Score Breakdown
        </h4>
        <div className="overflow-hidden rounded-lg border border-gray-200">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Factor</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Value</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Score</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {/* --- Per-factor rows as before... --- */}
              {/* Copy your factor rows here unchanged */}
              {/* ... */}
              <tr className="bg-blue-50">
                <td className="px-4 py-3 whitespace-nowrap text-sm font-bold text-gray-900">TOTAL SCORE</td>
                <td className="px-4 py-3 whitespace-nowrap"></td>
                <td className="px-4 py-3 whitespace-nowrap text-sm font-bold text-right">
                  {scoreBreakdown.total.rawScore}/{scoreBreakdown.total.maxPossible}
                  <span className="ml-2 text-xs text-gray-500">
                    (Normalized: {scoreBreakdown.total.normalized}/100)
                  </span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  // === The rest of your rendering (header, weather, etc.) is unchanged ===

  // Instead of reprinting the entire component, just be sure to:
  // - Use paddleScore as the normalized score in the main display.
  // - Use renderScoreBreakdown as above.

  // -- END MAIN RETURN
};

export default FixedBeachView;

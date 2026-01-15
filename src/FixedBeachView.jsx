// FixedBeachView.jsx - Production-ready with all required features
import React, { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
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
  Clock,
  Calendar,
  Info,
  LifeBuoy,
  CheckCircle2,
  Sun,
  Sunrise,
  Sunset,
  Navigation,
  Shield,
  Star
} from "lucide-react";
import { MapContainer, TileLayer, Marker, Popup } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { calculateGeographicProtection } from "./utils/coastlineAnalysis";
import { getCardinalDirection, DatePickerModal } from "./helpers.jsx";

// Greek timezone constant for consistent time display
const GREEK_TIMEZONE = 'Europe/Athens';

// Helper to format time in Greek timezone
const formatGreekTime = (date, options = { hour: '2-digit', minute: '2-digit' }) => {
  if (!date) return 'N/A';
  const d = date instanceof Date ? date : new Date(date);
  return d.toLocaleTimeString('el-GR', { ...options, timeZone: GREEK_TIMEZONE });
};

// Fix for default marker icon in Leaflet with bundlers
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
});

const FixedBeachView = ({
  beach,
  homeBeach,
  onSetHomeBeach,
  setView,
  onDataUpdate,
  timeRange,
  onTimeRangeChange
}) => {
  const { t } = useTranslation();
  const [weatherData, setWeatherData] = useState(null);
  const [marineData, setMarineData] = useState(null);
  const [paddleScore, setPaddleScore] = useState(null);
  const [scoreBreakdown, setScoreBreakdown] = useState(null);
  const [geoProtection, setGeoProtection] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [showDebug, setShowDebug] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [weeklyScores, setWeeklyScores] = useState([]);
  const [conditionTrends, setConditionTrends] = useState(null);

  const toNumberOr = (value, fallback = 0) => {
    const number = typeof value === "number" ? value : Number(value);
    return Number.isFinite(number) ? number : fallback;
  };

  const average = (values, fallback = 0) => {
    if (!values.length) {
      return fallback;
    }
    return values.reduce((sum, value) => sum + value, 0) / values.length;
  };

  const selectValues = (series, indices, fallbackValue = null) => {
    if (!Array.isArray(series)) {
      return [];
    }
    return indices
      .map((index) => (index >= 0 && index < series.length ? series[index] : fallbackValue))
      .map((value) => (value === null ? null : toNumberOr(value, fallbackValue)))
      .filter((value) => value !== null);
  };

  const buildIndicesForRange = (timeStrings, targetDate, startHour, endHour) => {
    if (!Array.isArray(timeStrings)) {
      return [];
    }

    const indices = [];
    const targetDateString = targetDate.toISOString().split("T")[0];

    timeStrings.forEach((timeString, index) => {
      const current = new Date(timeString);
      if (Number.isNaN(current.getTime())) {
        return;
      }

      const currentDate = current.toISOString().split("T")[0];
      if (currentDate !== targetDateString) {
        return;
      }

      const hour = current.getHours();
      if (hour >= startHour && hour <= endHour) {
        indices.push(index);
      }
    });

    return indices;
  };
  
  // Load data on mount and when date/time changes
  useEffect(() => {
    if (beach) {
      fetchWeatherData();
    }
  }, [beach?.id, timeRange.date]);

  useEffect(() => {
    if (!weatherData || !marineData || !beach) {
      return;
    }

    const updateScores = async () => {
      await calculateScores(weatherData, marineData, beach);
      // Calculate weekly forecast and trends after main score
      if (geoProtection) {
        calculateWeeklyForecast(weatherData, marineData, geoProtection);
      }
      calculateTrends(weatherData);
    };

    updateScores();
  }, [timeRange.startTime, timeRange.endTime, weatherData, marineData, beach, geoProtection]);

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
      
      // Calculate 7-day range for "Best Day This Week" feature
      const weekEnd = new Date(today);
      weekEnd.setDate(weekEnd.getDate() + 6);
      const formattedWeekEnd = weekEnd.toISOString().split('T')[0];

      // API URLs - include gusts, UV index, sunrise/sunset (7 days for best day feature)
      // Using Europe/Athens timezone for consistent Greek time display
      const weatherUrl = `https://api.open-meteo.com/v1/forecast?latitude=${beach.latitude}&longitude=${beach.longitude}&hourly=temperature_2m,precipitation,cloudcover,windspeed_10m,winddirection_10m,windgusts_10m,uv_index&daily=precipitation_sum,windspeed_10m_max,sunrise,sunset,uv_index_max&start_date=${formattedDate}&end_date=${formattedWeekEnd}&timezone=Europe/Athens`;

      // Marine API - include swell period, ocean currents, and sea level for tides (7 days)
      const marineUrl = `https://marine-api.open-meteo.com/v1/marine?latitude=${beach.latitude}&longitude=${beach.longitude}&hourly=wave_height,swell_wave_height,swell_wave_period,wave_direction,sea_surface_temperature,ocean_current_velocity&daily=wave_height_max,wave_direction_dominant&start_date=${formattedDate}&end_date=${formattedWeekEnd}&timezone=Europe/Athens`;
      
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
  
  // Calculate paddleboarding scores
  const calculateScores = async (weather, marine, beach) => {
    try {
      // Get data for the selected time range
      const startHour = parseInt(timeRange.startTime.split(":")[0], 10);
      const endHour = parseInt(timeRange.endTime.split(":")[0], 10);
      const targetDate = new Date(timeRange.date);

      let relevantIndices = buildIndicesForRange(weather?.hourly?.time, targetDate, startHour, endHour);
      if (!relevantIndices.length) {
        relevantIndices = buildIndicesForRange(weather?.hourly?.time, targetDate, 0, 23);
      }
      if (!relevantIndices.length && Array.isArray(weather?.hourly?.time)) {
        relevantIndices = weather.hourly.time.map((_, index) => index);
      }

      if (!relevantIndices.length) {
        throw new Error("No hourly data available for the selected beach");
      }

      const tempValues = selectValues(weather?.hourly?.temperature_2m, relevantIndices);
      const windValues = selectValues(weather?.hourly?.windspeed_10m, relevantIndices);
      const gustValues = selectValues(weather?.hourly?.windgusts_10m, relevantIndices);
      const cloudValues = selectValues(weather?.hourly?.cloudcover, relevantIndices);
      const precipValues = selectValues(weather?.hourly?.precipitation, relevantIndices);
      const windDirValues = selectValues(weather?.hourly?.winddirection_10m, relevantIndices);

      // Track data quality - count available vs expected data points
      const expectedDataPoints = relevantIndices.length * 8; // 8 metrics per hour (added gusts)
      const availableDataPoints = tempValues.length + windValues.length + gustValues.length +
        cloudValues.length + precipValues.length + windDirValues.length;

      const avgTemp = average(tempValues, toNumberOr(weather?.hourly?.temperature_2m?.[0], 0));
      const avgWind = average(windValues, 0);
      const avgGusts = average(gustValues, 0);
      const avgCloud = average(cloudValues, 0);
      const maxPrecip = precipValues.length ? Math.max(...precipValues) : 0;

      let avgWindDir = 0;
      if (windDirValues.length) {
        let sinSum = 0;
        let cosSum = 0;
        windDirValues.forEach((direction) => {
          const radians = (direction * Math.PI) / 180;
          sinSum += Math.sin(radians);
          cosSum += Math.cos(radians);
        });
        avgWindDir = (Math.atan2(sinSum / windDirValues.length, cosSum / windDirValues.length) * 180) / Math.PI;
        avgWindDir = (avgWindDir + 360) % 360;
      }

      // UV Index
      const uvValues = selectValues(weather?.hourly?.uv_index, relevantIndices);
      const maxUvIndex = uvValues.length ? Math.max(...uvValues) : toNumberOr(weather?.daily?.uv_index_max?.[0], 0);

      const hourlyWaveValues = selectValues(marine?.hourly?.wave_height, relevantIndices);
      const waveHeight = average(hourlyWaveValues, toNumberOr(marine?.daily?.wave_height_max?.[0], 0));

      const swellValues = selectValues(marine?.hourly?.swell_wave_height, relevantIndices);
      const avgSwellHeight = average(swellValues, toNumberOr(marine?.daily?.wave_height_max?.[0], 0));

      // Water temperature from marine data
      const waterTempValues = selectValues(marine?.hourly?.sea_surface_temperature, relevantIndices);
      const avgWaterTemp = waterTempValues.length ? average(waterTempValues, null) : null;

      // Swell period and currents
      const swellPeriodValues = selectValues(marine?.hourly?.swell_wave_period, relevantIndices);
      const avgSwellPeriod = swellPeriodValues.length ? average(swellPeriodValues, 6) : 6; // Default 6s (normal)
      const currentValues = selectValues(marine?.hourly?.ocean_current_velocity, relevantIndices);
      const avgCurrentSpeed = currentValues.length ? average(currentValues, 0) : 0;

      // Add marine data to quality calculation
      const marineDataPoints = hourlyWaveValues.length + swellValues.length + waterTempValues.length +
        swellPeriodValues.length + currentValues.length;
      const totalAvailable = availableDataPoints + marineDataPoints;
      const totalExpected = expectedDataPoints + relevantIndices.length * 5; // +5 for wave, swell, waterTemp, swellPeriod, currents
      const dataQuality = Math.round((totalAvailable / totalExpected) * 100);

      const waveDirection = toNumberOr(marine?.daily?.wave_direction_dominant?.[0], avgWindDir);
      const protection = await calculateGeographicProtection(
        beach,
        avgWindDir,
        waveDirection,
        targetDate
      );
      setGeoProtection(protection);

      const windProtectionFactor = toNumberOr(protection?.windProtection, 0);
      const waveProtectionFactor = toNumberOr(protection?.waveProtection, 0);
      const protectionScore = toNumberOr(protection?.protectionScore, 0);

      // Apply protection factors
      const protectedWindSpeed = avgWind * (1 - windProtectionFactor * 0.9);
      const protectedWaveHeight = waveHeight * (1 - waveProtectionFactor * 0.9);
      const protectedSwellHeight = avgSwellHeight * (1 - waveProtectionFactor * 0.85);

      // Calculate gust factor for safety warnings
      const gustFactor = avgWind > 0 ? avgGusts / avgWind : 1;

      // Initialize score breakdown (weights sum to 100)
      // For SUP: wind & waves critical, gusts/currents for safety, water temp important
      const breakdown = {
        windSpeed: { raw: avgWind, protected: protectedWindSpeed, score: 0, maxPossible: 20 },
        gusts: { value: avgGusts, factor: gustFactor, score: 0, maxPossible: 5 },
        waveHeight: { raw: waveHeight, protected: protectedWaveHeight, score: 0, maxPossible: 20 },
        swellHeight: { raw: avgSwellHeight, protected: protectedSwellHeight, period: avgSwellPeriod, score: 0, maxPossible: 8 },
        currents: { value: avgCurrentSpeed, score: 0, maxPossible: 10 },
        precipitation: { value: maxPrecip, score: 0, maxPossible: 5 },
        temperature: { value: avgTemp, score: 0, maxPossible: 4 },
        waterTemperature: { value: avgWaterTemp, score: 0, maxPossible: 12 },
        cloudCover: { value: avgCloud, score: 0, maxPossible: 4 },
        geoProtection: { value: protectionScore, score: 0, maxPossible: 12 },
        uvIndex: { value: maxUvIndex }, // Informational, not scored
        windDirection: { value: avgWindDir }, // Informational, not scored
        total: { score: 0, rawScore: 0, bonus: 0, maxPossible: 100 },
        dataQuality: dataQuality // 0-100% indicating data completeness
      };

      // Calculate individual scores (weights sum to 100)
      let totalScore = 0;

      // Wind speed score (0-20 points) - critical for SUP stability
      breakdown.windSpeed.score = Math.max(0, 20 - protectedWindSpeed * (20 / 20));
      totalScore += breakdown.windSpeed.score;

      // Gusts score (0-5 points) - gusty conditions are dangerous
      // Gust factor > 1.5 means unpredictable conditions
      const gustPenalty = gustFactor > 1.5 ? (gustFactor - 1.5) * 0.5 : 0;
      breakdown.gusts.score = Math.max(0, 5 * (1 - gustPenalty));
      totalScore += breakdown.gusts.score;

      // Wave height score (0-20 points) - equally critical for SUP
      breakdown.waveHeight.score = protectedWaveHeight < 0.2 ? 20 :
                                  Math.max(0, 20 - (protectedWaveHeight - 0.2) * (20 / 0.4));
      totalScore += breakdown.waveHeight.score;

      // Swell height score (0-8 points) - adjusted by period
      // Long period (>10s) = gentle rollers, short period (<6s) = choppy
      const swellPeriodFactor = avgSwellPeriod >= 10 ? 1.5 : avgSwellPeriod >= 7 ? 1.0 : 0.7;
      const effectiveSwell = protectedSwellHeight / swellPeriodFactor;
      breakdown.swellHeight.score = effectiveSwell < 0.3 ? 8 :
                                   Math.max(0, 8 - (effectiveSwell - 0.3) * (8 / 0.3));
      totalScore += breakdown.swellHeight.score;

      // Currents score (0-10 points) - strong currents are dangerous
      // 0 km/h = perfect, >5 km/h = dangerous
      breakdown.currents.score = avgCurrentSpeed < 1 ? 10 :
                                Math.max(0, 10 - (avgCurrentSpeed - 1) * 2.5);
      totalScore += breakdown.currents.score;

      // Precipitation score (0-5 points)
      breakdown.precipitation.score = maxPrecip < 1 ? 5 : 0;
      totalScore += breakdown.precipitation.score;

      // Air temperature score (0-4 points) - less critical, can wear layers
      if (avgTemp >= 15 && avgTemp <= 30) {
        breakdown.temperature.score = 4;
      } else if (avgTemp < 15) {
        breakdown.temperature.score = Math.max(0, 4 - (15 - avgTemp) * 0.4);
      } else {
        breakdown.temperature.score = Math.max(0, 4 - (avgTemp - 30) * 0.4);
      }
      totalScore += breakdown.temperature.score;

      // Water temperature score (0-12 points) - important for safety if you fall in
      if (avgWaterTemp !== null) {
        if (avgWaterTemp >= 18 && avgWaterTemp <= 26) {
          breakdown.waterTemperature.score = 12;
        } else if (avgWaterTemp < 18) {
          breakdown.waterTemperature.score = Math.max(0, 12 - (18 - avgWaterTemp) * 1.2);
        } else {
          breakdown.waterTemperature.score = Math.max(0, 12 - (avgWaterTemp - 26) * 1.2);
        }
        totalScore += breakdown.waterTemperature.score;
      }

      // Cloud cover score (0-4 points)
      breakdown.cloudCover.score = avgCloud < 50 ? 4 :
                                  Math.max(0, 4 - (avgCloud - 50) / 12.5);
      totalScore += breakdown.cloudCover.score;

      // Geographic protection score (0-12 points)
      breakdown.geoProtection.score = (protection.protectionScore / 100) * 12;
      totalScore += breakdown.geoProtection.score;

      // Round scores for display
      breakdown.windSpeed.score = Math.round(breakdown.windSpeed.score);
      breakdown.gusts.score = Math.round(breakdown.gusts.score);
      breakdown.waveHeight.score = Math.round(breakdown.waveHeight.score);
      breakdown.swellHeight.score = Math.round(breakdown.swellHeight.score);
      breakdown.currents.score = Math.round(breakdown.currents.score);
      breakdown.precipitation.score = Math.round(breakdown.precipitation.score);
      breakdown.temperature.score = Math.round(breakdown.temperature.score);
      breakdown.waterTemperature.score = Math.round(breakdown.waterTemperature.score);
      breakdown.cloudCover.score = Math.round(breakdown.cloudCover.score);
      breakdown.geoProtection.score = Math.round(breakdown.geoProtection.score);
      breakdown.total.rawScore = Math.round(totalScore);
      breakdown.total.bonus = Math.max(0, breakdown.total.rawScore - 100);
      breakdown.total.score = Math.round(Math.min(100, totalScore));
      
      // Apply special conditions
      if (maxPrecip >= 1.5) {
        breakdown.precipitation.score = 0;
        breakdown.total.score = Math.min(breakdown.total.score, 40);
      }
      
      setPaddleScore(breakdown.total.score);
      setScoreBreakdown(breakdown);

    } catch (err) {
      console.error("Error calculating scores:", err);
      setPaddleScore(null);
      setScoreBreakdown(null);
    }
  };

  // Calculate 7-day forecast scores for "Best Day This Week"
  const calculateWeeklyForecast = (weather, marine, geoProtection) => {
    if (!weather?.hourly?.time || !weather?.daily) return [];

    const scores = [];
    const today = new Date(timeRange.date);

    for (let dayOffset = 0; dayOffset < 7; dayOffset++) {
      const targetDate = new Date(today);
      targetDate.setDate(targetDate.getDate() + dayOffset);
      const dateStr = targetDate.toISOString().split('T')[0];

      // Find indices for morning (8-12) - typically best SUP time
      const morningIndices = [];
      const afternoonIndices = [];

      weather.hourly.time.forEach((t, i) => {
        const d = new Date(t);
        if (d.toISOString().split('T')[0] === dateStr) {
          const hour = d.getHours();
          if (hour >= 8 && hour <= 12) morningIndices.push(i);
          if (hour >= 14 && hour <= 18) afternoonIndices.push(i);
        }
      });

      const calcPeriodScore = (indices) => {
        if (!indices.length) return null;
        const wind = average(selectValues(weather.hourly.windspeed_10m, indices));
        const wave = average(selectValues(marine?.hourly?.wave_height, indices)) || 0;
        const precip = Math.max(...selectValues(weather.hourly.precipitation, indices).map(v => v || 0), 0);

        // Simplified score calculation
        let score = 100;
        score -= Math.min(40, wind * 2.5); // Wind penalty
        score -= Math.min(30, wave * 60);  // Wave penalty
        if (precip > 0.5) score -= 20;
        if (geoProtection?.protectionScore > 50) score += 5;
        return Math.max(0, Math.min(100, Math.round(score)));
      };

      const morningScore = calcPeriodScore(morningIndices);
      const afternoonScore = calcPeriodScore(afternoonIndices);
      const bestScore = Math.max(morningScore || 0, afternoonScore || 0);
      const bestPeriod = (morningScore || 0) >= (afternoonScore || 0) ? 'AM' : 'PM';

      // Get daily data
      const dayIndex = weather.daily.time?.findIndex(t => t === dateStr) ?? -1;
      const maxWind = dayIndex >= 0 ? weather.daily.windspeed_10m_max?.[dayIndex] : null;
      const maxPrecip = dayIndex >= 0 ? weather.daily.precipitation_sum?.[dayIndex] : null;

      scores.push({
        date: targetDate,
        dateStr,
        dayName: targetDate.toLocaleDateString('en-US', { weekday: 'short' }),
        morningScore,
        afternoonScore,
        bestScore,
        bestPeriod,
        maxWind: maxWind?.toFixed(0) || '?',
        hasRain: (maxPrecip || 0) > 1,
        isToday: dayOffset === 0
      });
    }

    setWeeklyScores(scores);
    return scores;
  };

  // Calculate condition trends (improving/worsening)
  const calculateTrends = (weather) => {
    if (!weather?.hourly?.time) return null;

    const now = new Date();
    const nowHour = now.getHours();
    const todayStr = now.toISOString().split('T')[0];

    // Find current hour index
    const currentIndex = weather.hourly.time.findIndex(t => {
      const d = new Date(t);
      return d.toISOString().split('T')[0] === todayStr && d.getHours() === nowHour;
    });

    if (currentIndex < 0 || currentIndex + 3 >= weather.hourly.time.length) return null;

    const currentWind = weather.hourly.windspeed_10m?.[currentIndex] || 0;
    const futureWind = weather.hourly.windspeed_10m?.[currentIndex + 3] || 0;
    const windChange = futureWind - currentWind;

    let windTrend = 'stable';
    if (windChange < -3) windTrend = 'improving';
    else if (windChange > 3) windTrend = 'worsening';

    const trends = {
      wind: {
        current: currentWind.toFixed(0),
        future: futureWind.toFixed(0),
        change: windChange.toFixed(0),
        trend: windTrend,
        message: windTrend === 'improving'
          ? `Wind dropping ${currentWind.toFixed(0)}→${futureWind.toFixed(0)} km/h`
          : windTrend === 'worsening'
            ? `Wind rising ${currentWind.toFixed(0)}→${futureWind.toFixed(0)} km/h`
            : 'Wind steady'
      }
    };

    setConditionTrends(trends);
    return trends;
  };

  // Get equipment recommendations based on conditions
  const getEquipmentRecommendations = () => {
    if (!scoreBreakdown) return [];
    const recs = [];

    const waterTemp = scoreBreakdown.waterTemperature?.value;
    const airTemp = scoreBreakdown.temperature?.value;
    const wind = scoreBreakdown.windSpeed?.protected;
    const uvIndex = scoreBreakdown.uvIndex?.value;

    if (waterTemp !== null && waterTemp < 18) {
      recs.push({ icon: '🧥', item: 'Wetsuit', reason: `Water ${waterTemp.toFixed(0)}°C - hypothermia risk` });
    } else if (waterTemp !== null && waterTemp < 22) {
      recs.push({ icon: '👕', item: 'Rashguard', reason: `Water ${waterTemp.toFixed(0)}°C - can get chilly` });
    }

    if (uvIndex !== null && uvIndex >= 6) {
      recs.push({ icon: '🧴', item: 'Sunscreen SPF50+', reason: `UV Index ${uvIndex.toFixed(0)} - high exposure` });
      recs.push({ icon: '🕶️', item: 'Sunglasses', reason: 'Protect eyes from glare' });
    } else if (uvIndex !== null && uvIndex >= 3) {
      recs.push({ icon: '🧴', item: 'Sunscreen SPF30', reason: `UV Index ${uvIndex.toFixed(0)}` });
    }

    if (wind !== null && wind > 10) {
      recs.push({ icon: '🦺', item: 'Leash (coiled)', reason: `Wind ${wind.toFixed(0)} km/h - board can blow away` });
    }

    if (airTemp !== null && airTemp < 15) {
      recs.push({ icon: '🧢', item: 'Windproof layer', reason: `Air ${airTemp.toFixed(0)}°C` });
    }

    // Always recommend
    recs.push({ icon: '💧', item: 'Water bottle', reason: 'Stay hydrated' });

    return recs;
  };

  const getPaddleReadiness = () => {
    if (!scoreBreakdown || !weatherData || !marineData) {
      return null;
    }

    const protectedWind = scoreBreakdown.windSpeed?.protected ?? null;
    const protectedWave = scoreBreakdown.waveHeight?.protected ?? null;
    const protectedSwell = scoreBreakdown.swellHeight?.protected ?? null;
    const precipitation = scoreBreakdown.precipitation?.value ?? 0;
    const avgTemp = scoreBreakdown.temperature?.value ?? null;
    const waterTemp = scoreBreakdown.waterTemperature?.value ?? null;

    if (
      protectedWind === null ||
      protectedWave === null ||
      protectedSwell === null ||
      avgTemp === null
    ) {
      return null;
    }

    let skillLevel = "Beginner friendly";
    let badgeClass = "bg-white/20 text-white border border-white/30";
    let headline = "Glassy session ahead";
    let message = "Expect calm water – ideal for easy cruises.";
    let emoji = "🛶";

    if (protectedWind > 12 || protectedWave > 0.5) {
      skillLevel = "Advanced paddlers only";
      badgeClass = "bg-red-500/30 text-white border border-white/40";
      headline = "Challenging conditions";
      message = "Plan a backup route and stay close to shore.";
      emoji = "⚠️";
    } else if (protectedWind > 8 || protectedWave > 0.35) {
      skillLevel = "Intermediate focus";
      badgeClass = "bg-yellow-400/30 text-white border border-white/40";
      headline = "Manageable but watch the bumps";
      message = "Expect some texture on the water – warm up with crosswind drills.";
      emoji = "🌊";
    }

    if (paddleScore >= 90) {
      headline = "Mirror-flat window";
      message = "Perfect for distance paddles or SUP yoga sessions.";
      emoji = "✨";
    } else if (paddleScore >= 75 && protectedWind <= 10) {
      headline = "Solid session";
      message = "Plenty of glide with just a hint of breeze.";
      emoji = "👍";
    }

    const startHour = parseInt(timeRange.startTime.split(":")[0], 10);
    const endHour = parseInt(timeRange.endTime.split(":")[0], 10);
    const targetDate = new Date(timeRange.date);

    const selectedHours = [];

    weatherData.hourly.time.forEach((timeString, index) => {
      const current = new Date(timeString);
      if (
        current.getFullYear() === targetDate.getFullYear() &&
        current.getMonth() === targetDate.getMonth() &&
        current.getDate() === targetDate.getDate() &&
        current.getHours() >= startHour &&
        current.getHours() <= endHour
      ) {
        selectedHours.push({
          index,
          time: current,
          wind: weatherData.hourly.windspeed_10m?.[index] ?? 0,
          wave: marineData.hourly?.wave_height?.[index] ?? protectedWave,
          precipitation: weatherData.hourly.precipitation?.[index] ?? 0,
          temperature: weatherData.hourly.temperature_2m?.[index] ?? avgTemp,
          cloudcover: weatherData.hourly.cloudcover?.[index] ?? 50,
          uvIndex: weatherData.hourly.uv_index?.[index] ?? 0
        });
      }
    });

    let bestHour = null;
    let bestComposite = Number.POSITIVE_INFINITY;

    selectedHours.forEach((hour) => {
      const composite = hour.wind + hour.wave * 12 + hour.precipitation * 6;
      if (composite < bestComposite) {
        bestComposite = composite;
        bestHour = hour;
      }
    });

    const suggestions = [];

    // Analyze wind patterns for smarter recommendations
    const morningHours = selectedHours.filter(h => h.time.getHours() < 12);
    const afternoonHours = selectedHours.filter(h => h.time.getHours() >= 12);
    const avgMorningWind = morningHours.length > 0
      ? morningHours.reduce((sum, h) => sum + h.wind, 0) / morningHours.length
      : null;
    const avgAfternoonWind = afternoonHours.length > 0
      ? afternoonHours.reduce((sum, h) => sum + h.wind, 0) / afternoonHours.length
      : null;

    // Smart time-based recommendations
    if (avgMorningWind !== null && avgAfternoonWind !== null) {
      if (avgAfternoonWind > avgMorningWind + 5) {
        // Wind picks up in afternoon
        const calmEndHour = morningHours.find(h => h.wind > avgMorningWind + 3)?.time.getHours() || 11;
        suggestions.push(
          `⚡ Wind builds after ${calmEndHour}:00 — paddle before ${calmEndHour + 1}:00 for calmer water.`
        );
        headline = "Best conditions morning";
        message = `Wind picks up to ${Math.round(avgAfternoonWind)} km/h this afternoon. Start early!`;
      } else if (avgMorningWind > avgAfternoonWind + 5) {
        // Morning is windier, afternoon calms
        suggestions.push(
          `🌅 Calmer conditions after midday — afternoon session recommended.`
        );
        headline = "Better in the afternoon";
        message = `Morning winds around ${Math.round(avgMorningWind)} km/h settle to ${Math.round(avgAfternoonWind)} km/h later.`;
      }
    }

    // Check for gusty conditions
    const gustyHours = selectedHours.filter(h => h.wind > protectedWind * 1.3);
    if (gustyHours.length > selectedHours.length * 0.3) {
      const gustyPeriod = gustyHours[0]?.time.getHours() || 12;
      suggestions.push(
        `💨 Gusty around ${gustyPeriod}:00 — stay close to shore or avoid that window.`
      );
    }

    // Find warmest, sunniest hour - especially useful in cooler months
    let warmestHour = null;
    let warmestScore = Number.NEGATIVE_INFINITY;

    selectedHours.forEach((hour) => {
      // Score combines temperature (higher is better) and cloud cover (lower is better)
      // Temperature weighted more heavily, cloud cover inverted (100 - cloudcover)
      const sunScore = hour.temperature * 2 + (100 - hour.cloudcover) / 2 + hour.uvIndex * 3;
      if (sunScore > warmestScore && hour.precipitation < 0.5) {
        warmestScore = sunScore;
        warmestHour = hour;
      }
    });

    if (warmestHour && selectedHours.length > 1) {
      const warmestTime = warmestHour.time.toLocaleTimeString('el-GR', {
        hour: '2-digit',
        minute: '2-digit',
        timeZone: GREEK_TIMEZONE
      });
      const isSunny = warmestHour.cloudcover < 30;
      const isWarm = warmestHour.temperature >= 22;
      const isCoolerDay = avgTemp < 22;

      // Show sunny/warm recommendation, especially prominent in cooler weather
      if (isCoolerDay || isSunny) {
        const sunEmoji = isSunny ? '☀️' : warmestHour.cloudcover < 60 ? '🌤️' : '⛅';
        const tempRounded = Math.round(warmestHour.temperature);
        suggestions.unshift(
          `${sunEmoji} Warmest at ${warmestTime} (${tempRounded}°C${isSunny ? ', sunny' : ''}) — best for ${isCoolerDay ? 'winter' : 'sun'} paddling.`
        );
      } else if (isWarm && isSunny) {
        suggestions.push(
          `☀️ Peak sunshine at ${warmestTime} — ${Math.round(warmestHour.temperature)}°C with clear skies.`
        );
      }
    }

    if (bestHour) {
      const bestLabel = bestHour.time.toLocaleTimeString('el-GR', {
        hour: '2-digit',
        minute: '2-digit',
        timeZone: GREEK_TIMEZONE
      });
      const waveText = Number.isFinite(bestHour.wave)
        ? bestHour.wave.toFixed(1)
        : '0.0';
      suggestions.push(
        `🎯 Sweet spot around ${bestLabel} — wind ${Math.round(bestHour.wind)} km/h, waves ${waveText} m.`
      );
    }

    if (protectedWave < 0.25 && protectedWind < 9) {
      suggestions.push("Great chance to work on technique drills or SUP yoga poses.");
    }

    if (protectedWind >= 10) {
      suggestions.push("Plan your route with an easy downwind finish or hug the coastline on the way back.");
    }

    if (avgTemp <= 20) {
      suggestions.push("Layer with a light wetsuit top or thermal rash vest.");
    } else if (avgTemp >= 28) {
      suggestions.push("Pack extra hydration and reapply sunscreen every hour.");
    }

    if (waterTemp !== null && waterTemp < 15) {
      suggestions.push("Cold water — wear a wetsuit to prevent hypothermia if you fall in.");
    }

    if (precipitation >= 1) {
      suggestions.push("Expect showers — stash dry gear and keep electronics in a dry bag.");
    }

    if (!suggestions.length) {
      suggestions.push("Quick safety recap, leash on, and enjoy the glide!");
    }

    return {
      icon: emoji,
      skillLevel,
      badgeClass,
      headline,
      message,
      suggestions,
      windowLabel: `${timeRange.startTime} – ${timeRange.endTime}`,
      bestHour,
      warmestHour,
      wind: protectedWind,
      wave: protectedWave,
      temperature: avgTemp,
      waterTemperature: waterTemp,
      swell: protectedSwell
    };
  };
  
  // Get condition text based on score AND actual conditions
  // This ensures messaging is consistent with getPaddleReadiness
  const getCondition = (score) => {
    if (!scoreBreakdown) {
      return { label: "Loading", emoji: "⏳", message: "Calculating conditions...", color: "text-gray-500" };
    }

    const temp = toNumberOr(scoreBreakdown.temperature?.value, 0);
    const waterTemp = toNumberOr(scoreBreakdown.waterTemperature?.value, 20);
    const windSpeed = toNumberOr(scoreBreakdown.windSpeed?.protected, 0);
    const waveHeight = toNumberOr(scoreBreakdown.waveHeight?.protected, 0);
    const precipitation = toNumberOr(scoreBreakdown.precipitation?.value, 0);

    // Check if core paddling conditions (wind & waves) are excellent
    const excellentWindWaves = windSpeed < 8 && waveHeight < 0.3;
    const goodWindWaves = windSpeed < 12 && waveHeight < 0.5;

    // Excellent core conditions - show positive even if score lower due to temp/geo
    if (excellentWindWaves) {
      if (temp < 15 || waterTemp < 15) {
        return {
          label: "Chilly but Calm",
          emoji: "🧊",
          message: "Flat water, but dress warm.",
          color: "text-blue-500"
        };
      }
      if (precipitation >= 0.5) {
        return {
          label: "Calm but Wet",
          emoji: "🌧️",
          message: "Light rain, but excellent water conditions.",
          color: "text-blue-500"
        };
      }
      if (score >= 85) {
        return {
          label: "Perfect",
          emoji: "✅",
          message: "Flat like oil. Paddle on.",
          color: "text-green-500"
        };
      }
      return {
        label: "Solid",
        emoji: "👍",
        message: "Great paddling conditions.",
        color: "text-green-500"
      };
    }

    // Good core conditions
    if (goodWindWaves) {
      if (temp < 15 || waterTemp < 15) {
        return {
          label: "Cool & Manageable",
          emoji: "🧊",
          message: "Light chop possible, dress warm.",
          color: "text-blue-500"
        };
      }
      return {
        label: "Good",
        emoji: "👍",
        message: "Nice conditions with light texture.",
        color: "text-green-500"
      };
    }

    // Score-based fallback for challenging conditions
    if (score >= 70) {
      return {
        label: "Okay-ish",
        emoji: "⚠️",
        message: "Some chop expected. Stay alert.",
        color: "text-yellow-500"
      };
    }

    if (score >= 50) {
      return {
        label: "Challenging",
        emoji: "⚠️",
        message: "Wind or waves make it tricky.",
        color: "text-orange-500"
      };
    }

    return {
      label: "Not Recommended",
      emoji: "🚫",
      message: "Conditions too rough for SUP.",
      color: "text-red-500"
    };
  };

  // Generate condition details tooltip content
  const getConditionDetails = () => {
    if (!scoreBreakdown) return "";

    const temp = toNumberOr(scoreBreakdown.temperature?.value, 0);
    const windSpeed = toNumberOr(scoreBreakdown.windSpeed?.protected, 0);
    const precipitation = toNumberOr(scoreBreakdown.precipitation?.value, 0);
    const cloudCover = toNumberOr(scoreBreakdown.cloudCover?.value, 0);
    
    // Create array of condition notes
    const notes = [];
    
    if (temp < 16) {
      notes.push("Water will be quite cold");
    } else if (temp < 20) {
      notes.push("Water will be cool");
    }
    
    if (precipitation > 0 && precipitation < 1) {
      notes.push("Light rain possible");
    }
    
    if (cloudCover > 60) {
      notes.push("Mostly cloudy");
    }
    
    if (windSpeed > 10 && windSpeed < 20) {
      notes.push("Some wind, but manageable");
    }
    
    // Join with bullet points if we have notes
    if (notes.length > 0) {
      return notes.join(" • ");
    }
    
    // Default message if no specific notes
    return paddleScore >= 80 ? "Great overall conditions" : "Check individual factors";
  };
  
  // Render geographic protection information
  const renderGeoProtectionInfo = () => {
    if (!geoProtection) return null;

    // Calculate the bonus points added to score from geographic protection (max 12 pts)
    const geoBonus = Math.round((geoProtection.protectionScore / 100) * 12);
    const avgWindDirection = toNumberOr(
      geoProtection?.debugInfo?.windDirection ??
      geoProtection?.dominantWindDirection ??
      geoProtection?.windDirection ??
      0,
      0
    );
    
    // Get protection level label
    const protectionLabel = geoProtection.protectionScore > 60
      ? 'Well Protected'
      : geoProtection.protectionScore > 30
        ? 'Moderate'
        : 'Exposed';

    return (
      <div className="bg-blue-50 rounded-lg mt-4 border border-blue-200 shadow-inner">
        <div className="p-5">
          <h4 className="font-medium text-lg flex items-center text-blue-800 mb-4">
            <MapPin className="h-5 w-5 mr-2 text-blue-600" />
            Geographic Protection
            <span className={`ml-2 text-sm font-normal px-2 py-0.5 rounded-full ${
              geoProtection.protectionScore > 60
                ? 'bg-green-100 text-green-700'
                : geoProtection.protectionScore > 30
                  ? 'bg-yellow-100 text-yellow-700'
                  : 'bg-red-100 text-red-700'
            }`}>
              {protectionLabel}
            </span>
          </h4>
            <div className="flex justify-end mb-2">
              <button
                onClick={() => setShowDebug(!showDebug)}
                className="text-xs text-blue-600 underline"
              >
                {showDebug ? 'Hide debug' : 'Show debug'}
              </button>
            </div>
            <div className="grid md:grid-cols-2 gap-6">
          <ul className="space-y-3">
            <li className="flex justify-between items-center bg-white p-3 rounded border">
              <span className="font-medium text-gray-700">Bay Enclosure:</span>
              <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                geoProtection.bayEnclosure > 0.6 
                  ? 'bg-green-100 text-green-800' 
                  : geoProtection.bayEnclosure > 0.3 
                    ? 'bg-yellow-100 text-yellow-800' 
                    : 'bg-red-100 text-red-800'
              }`}>
                {geoProtection.bayEnclosure > 0.7 
                  ? 'Well Protected' 
                  : geoProtection.bayEnclosure > 0.4 
                    ? 'Moderately Protected' 
                    : 'Exposed'}
              </span>
            </li>
            <li className="flex justify-between items-center bg-white p-3 rounded border">
              <span className="font-medium text-gray-700">Wind Direction:</span>
              <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                geoProtection.windProtection > 0.7 
                  ? 'bg-green-100 text-green-800' 
                  : geoProtection.windProtection > 0.3 
                    ? 'bg-yellow-100 text-yellow-800' 
                    : 'bg-red-100 text-red-800'
              }`}>
                {getCardinalDirection(avgWindDirection)} 
                {geoProtection.windProtection > 0.7 
                  ? ' (Protected)' 
                  : geoProtection.windProtection > 0.3 
                    ? ' (Partially Exposed)' 
                    : ' (Fully Exposed)'}
              </span>
            </li>
            <li className="flex justify-between items-center bg-white p-3 rounded border">
              <span className="font-medium text-gray-700">Overall Protection:</span>
              <div className="flex items-center">
                <div className="w-24 h-3 bg-gray-200 rounded-full overflow-hidden mr-2">
                  <div 
                    className={`h-full ${
                      geoProtection.protectionScore > 70 
                        ? 'bg-green-500' 
                        : geoProtection.protectionScore > 40 
                          ? 'bg-yellow-500' 
                          : 'bg-red-500'
                    }`}
                    style={{ width: `${geoProtection.protectionScore}%` }}
                  />
                </div>
                <span className={`font-medium ${
                  geoProtection.protectionScore > 70 
                    ? 'text-green-600' 
                    : geoProtection.protectionScore > 40 
                      ? 'text-yellow-600' 
                      : 'text-red-600'
                }`}>
                  {Math.round(geoProtection.protectionScore)}/100
                </span>
              </div>
            </li>
          </ul>
          
          <div className="bg-white p-4 rounded border">
            <h5 className="font-medium mb-2 text-gray-800">Impact on Score</h5>
            <p className="text-gray-700 mb-3">
              Geographic protection is contributing <span className="font-bold text-blue-600">
              +{geoBonus} points</span> to your overall score.
            </p>
            <div className={`p-3 rounded-lg ${
              geoProtection.protectionScore > 60 
                ? 'bg-green-50 border border-green-200' 
                : geoProtection.protectionScore > 30 
                  ? 'bg-yellow-50 border border-yellow-200' 
                  : 'bg-red-50 border border-red-200'
            }`}>
              <p className="text-sm">
                {geoProtection.protectionScore > 60 
                  ? `${beach.name} is well protected from ${getCardinalDirection(avgWindDirection)} winds, making it an excellent choice today.` 
                  : geoProtection.protectionScore > 30 
                    ? `${beach.name} has moderate protection from ${getCardinalDirection(avgWindDirection)} winds.` 
                    : `${beach.name} is exposed to ${getCardinalDirection(avgWindDirection)} winds today, consider an alternative beach.`}
              </p>
            </div>
            {showDebug && (
              <pre className="mt-3 text-xs bg-gray-100 p-2 rounded overflow-x-auto">
{JSON.stringify(geoProtection.debugInfo, null, 2)}
              </pre>
            )}
          </div>
            </div>
        </div>
      </div>
    );
  };

  // Render score breakdown
  const renderScoreBreakdown = () => {
    if (!scoreBreakdown) return null;

    const Progress = ({ score, max, color }) => (
      <div className="w-24 bg-gray-200 h-2 rounded mt-1 overflow-hidden">
        <div
          className={`${color} h-2 rounded`}
          style={{ width: `${Math.min(100, (score / max) * 100)}%` }}
        ></div>
      </div>
    );

    // Info tooltip component
    const InfoTip = ({ tip }) => (
      <span className="relative group ml-1 cursor-help">
        <Info className="h-3.5 w-3.5 text-gray-400 inline hover:text-blue-500" />
        <span className="absolute left-0 bottom-full mb-2 w-64 p-2 text-xs text-white bg-gray-800 rounded shadow-lg opacity-0 group-hover:opacity-100 transition-opacity z-50 pointer-events-none whitespace-normal">
          {tip}
        </span>
      </span>
    );

    // Score item component for mobile-friendly display
    const ScoreItem = ({ label, tip, maxPts, value, score, max, extraInfo }) => {
      const percentage = (score / max) * 100;
      const color = percentage >= 75 ? 'bg-emerald-500' : percentage >= 50 ? 'bg-amber-500' : 'bg-red-500';
      const textColor = percentage >= 75 ? 'text-emerald-600' : percentage >= 50 ? 'text-amber-600' : 'text-red-600';

      return (
        <div className="bg-white rounded-xl border border-gray-100 p-3 hover:shadow-md transition-shadow">
          <div className="flex items-start justify-between mb-2">
            <div className="flex items-center gap-1">
              <span className="font-medium text-gray-800 text-sm">{label}</span>
              <InfoTip tip={tip} />
            </div>
            <span className={`font-bold text-sm ${textColor}`}>{score}/{max}</span>
          </div>
          <div className="h-2 bg-gray-100 rounded-full overflow-hidden mb-2">
            <div className={`h-full ${color} rounded-full transition-all`} style={{ width: `${percentage}%` }} />
          </div>
          <div className="flex justify-between text-xs text-gray-500">
            <span>{value}</span>
            {extraInfo && <span className="text-gray-400">{extraInfo}</span>}
          </div>
        </div>
      );
    };

    return (
      <div className="bg-gradient-to-br from-slate-50 to-blue-50 rounded-2xl mt-4 shadow-sm border border-blue-100">
        <div className="p-4">
          <div className="flex items-center justify-between mb-4">
            <h4 className="font-semibold flex items-center text-gray-800">
              <div className="p-2 bg-blue-100 rounded-lg mr-3">
                <Info className="h-4 w-4 text-blue-600" />
              </div>
              {t('score.breakdown')}
            </h4>
            <span className={`text-lg font-bold ${
              scoreBreakdown.total.score >= 85 ? 'text-emerald-600' :
              scoreBreakdown.total.score >= 70 ? 'text-amber-600' :
              scoreBreakdown.total.score >= 50 ? 'text-orange-600' : 'text-red-600'
            }`}>
              {scoreBreakdown.total.score}/100
            </span>
          </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
              <ScoreItem
                label="Wind"
                tip="Lower wind = better stability. Under 10 km/h is ideal for SUP."
                value={`${scoreBreakdown.windSpeed.protected.toFixed(1)} km/h`}
                score={scoreBreakdown.windSpeed.score}
                max={scoreBreakdown.windSpeed.maxPossible}
                extraInfo={`Raw: ${scoreBreakdown.windSpeed.raw.toFixed(0)}`}
              />
              <ScoreItem
                label="Waves"
                tip="Flat water (<0.2m) is ideal. Larger waves make balancing harder."
                value={`${scoreBreakdown.waveHeight.protected.toFixed(2)} m`}
                score={scoreBreakdown.waveHeight.score}
                max={scoreBreakdown.waveHeight.maxPossible}
                extraInfo={`Raw: ${scoreBreakdown.waveHeight.raw.toFixed(2)}`}
              />
              <ScoreItem
                label="Water Temp"
                tip="18-26°C is ideal. Below 15°C risks hypothermia — wetsuit required!"
                value={scoreBreakdown.waterTemperature?.value != null ? `${scoreBreakdown.waterTemperature.value.toFixed(1)}°C` : 'N/A'}
                score={scoreBreakdown.waterTemperature?.score ?? 0}
                max={scoreBreakdown.waterTemperature?.maxPossible ?? 12}
              />
              <ScoreItem
                label="Protection"
                tip="How much the coastline shelters this beach from wind and waves."
                value={`${scoreBreakdown.geoProtection.value.toFixed(0)}/100`}
                score={scoreBreakdown.geoProtection.score}
                max={scoreBreakdown.geoProtection.maxPossible}
              />
              <ScoreItem
                label="Currents"
                tip="Strong currents (>3 km/h) can push you off course or make returning difficult."
                value={`${scoreBreakdown.currents?.value?.toFixed(1) ?? 'N/A'} km/h`}
                score={scoreBreakdown.currents?.score ?? 0}
                max={scoreBreakdown.currents?.maxPossible ?? 10}
              />
              <ScoreItem
                label="Swell"
                tip="Ocean swells from distant storms. Long period (>10s) = gentle rollers."
                value={`${scoreBreakdown.swellHeight.raw.toFixed(2)} m`}
                score={scoreBreakdown.swellHeight.score}
                max={scoreBreakdown.swellHeight.maxPossible}
                extraInfo={`${scoreBreakdown.swellHeight.period?.toFixed(0) ?? '?'}s period`}
              />
              <ScoreItem
                label="Gusts"
                tip="Sudden wind bursts that can knock you off balance."
                value={`${scoreBreakdown.gusts?.value?.toFixed(1) ?? 'N/A'} km/h`}
                score={scoreBreakdown.gusts?.score ?? 0}
                max={scoreBreakdown.gusts?.maxPossible ?? 5}
              />
              <ScoreItem
                label="Rain"
                tip="No rain is best. Heavy rain reduces visibility and makes the board slippery."
                value={`${scoreBreakdown.precipitation.value.toFixed(1)} mm`}
                score={scoreBreakdown.precipitation.score}
                max={scoreBreakdown.precipitation.maxPossible}
              />
              <ScoreItem
                label="Air Temp"
                tip="Comfortable range is 15-30°C. Less critical than water temp."
                value={`${scoreBreakdown.temperature.value.toFixed(1)}°C`}
                score={scoreBreakdown.temperature.score}
                max={scoreBreakdown.temperature.maxPossible}
              />
              <ScoreItem
                label="Clouds"
                tip="Clear skies preferred but clouds don't affect paddling much."
                value={`${scoreBreakdown.cloudCover.value.toFixed(0)}%`}
                score={scoreBreakdown.cloudCover.score}
                max={scoreBreakdown.cloudCover.maxPossible}
              />
            </div>

            {/* Total Score */}
            <div className={`mt-4 p-4 rounded-xl border-2 ${
              scoreBreakdown.total.score >= 85 ? 'bg-emerald-50 border-emerald-200' :
              scoreBreakdown.total.score >= 70 ? 'bg-amber-50 border-amber-200' :
              scoreBreakdown.total.score >= 50 ? 'bg-orange-50 border-orange-200' : 'bg-red-50 border-red-200'
            }`}>
              <div className="flex items-center justify-between">
                <span className="font-semibold text-gray-700">Total Score</span>
                <span className={`text-2xl font-bold ${
                  scoreBreakdown.total.score >= 85 ? 'text-emerald-600' :
                  scoreBreakdown.total.score >= 70 ? 'text-amber-600' :
                  scoreBreakdown.total.score >= 50 ? 'text-orange-600' : 'text-red-600'
                }`}>
                  {scoreBreakdown.total.score}<span className="text-base font-normal text-gray-400">/100</span>
                </span>
              </div>
              <div className="h-3 bg-white/50 rounded-full overflow-hidden mt-2">
                <div
                  className={`h-full rounded-full transition-all ${
                    scoreBreakdown.total.score >= 85 ? 'bg-emerald-500' :
                    scoreBreakdown.total.score >= 70 ? 'bg-amber-500' :
                    scoreBreakdown.total.score >= 50 ? 'bg-orange-500' : 'bg-red-500'
                  }`}
                  style={{ width: `${scoreBreakdown.total.score}%` }}
                />
              </div>
            </div>
        </div>
      </div>
    );
  };

  // Render 7-day forecast "Best Day This Week"
  const renderWeeklyForecast = () => {
    if (!weeklyScores.length) return null;

    const bestDay = weeklyScores.reduce((best, day) =>
      day.bestScore > (best?.bestScore || 0) ? day : best, null);

    return (
      <div className="bg-gradient-to-br from-indigo-50 to-purple-50 rounded-2xl mt-4 shadow-sm border border-indigo-100">
        <div className="p-4">
          <div className="flex items-center justify-between mb-4">
            <h4 className="font-semibold flex items-center text-gray-800">
              <div className="p-2 bg-indigo-100 rounded-lg mr-3">
                <Calendar className="h-4 w-4 text-indigo-600" />
              </div>
              Best Day This Week
            </h4>
            {bestDay && (
              <span className="text-sm font-medium text-indigo-600">
                {bestDay.dayName} {bestDay.bestPeriod} ({bestDay.bestScore}/100)
              </span>
            )}
          </div>
            <div className="grid grid-cols-7 gap-1 sm:gap-2">
              {weeklyScores.map((day, i) => {
                const isBest = day === bestDay;
                const scoreColor = day.bestScore >= 80 ? 'bg-emerald-500' :
                  day.bestScore >= 60 ? 'bg-amber-500' :
                  day.bestScore >= 40 ? 'bg-orange-500' : 'bg-red-500';

                return (
                  <div
                    key={i}
                    className={`text-center p-2 rounded-xl transition-all ${
                      isBest ? 'bg-indigo-100 ring-2 ring-indigo-400' :
                      day.isToday ? 'bg-white shadow-sm' : 'bg-white/50'
                    }`}
                  >
                    <div className={`text-xs font-medium ${day.isToday ? 'text-indigo-600' : 'text-gray-500'}`}>
                      {day.dayName}
                    </div>
                    <div className={`text-lg font-bold mt-1 ${
                      day.bestScore >= 70 ? 'text-emerald-600' :
                      day.bestScore >= 50 ? 'text-amber-600' : 'text-red-600'
                    }`}>
                      {day.bestScore}
                    </div>
                    <div className="text-[10px] text-gray-400">{day.bestPeriod}</div>
                    <div className={`h-1 rounded-full mt-1 ${scoreColor}`} style={{width: `${day.bestScore}%`, margin: '0 auto'}} />
                    {day.hasRain && <span className="text-xs">🌧️</span>}
                    {isBest && <span className="text-xs">⭐</span>}
                  </div>
                );
              })}
            </div>
            {bestDay && !bestDay.isToday && (
              <div className="mt-3 p-3 bg-indigo-100 rounded-xl text-sm text-indigo-800">
                <strong>{bestDay.dayName} {bestDay.bestPeriod}</strong> looks perfect!
                {bestDay.bestScore >= 80 ? ' Expect glassy conditions.' :
                 bestDay.bestScore >= 60 ? ' Should be a solid session.' : ' Better than other days.'}
              </div>
            )}
        </div>
      </div>
    );
  };

  // Render condition trends
  const renderConditionTrends = () => {
    if (!conditionTrends) return null;

    const { wind } = conditionTrends;
    const trendIcon = wind.trend === 'improving' ? '↓' :
      wind.trend === 'worsening' ? '↑' : '→';
    const trendColor = wind.trend === 'improving' ? 'text-emerald-600 bg-emerald-50' :
      wind.trend === 'worsening' ? 'text-red-600 bg-red-50' : 'text-gray-600 bg-gray-50';

    return (
      <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium ${trendColor}`}>
        <span className="text-lg">{trendIcon}</span>
        <span>{wind.message}</span>
        <span className="text-xs opacity-70">(next 3hrs)</span>
      </div>
    );
  };

  // Render equipment recommendations
  const renderEquipment = () => {
    const equipment = getEquipmentRecommendations();
    if (!equipment.length) return null;

    return (
      <div className="bg-amber-50 rounded-xl p-4 border border-amber-200">
        <h4 className="font-medium text-amber-800 mb-3 flex items-center">
          <span className="mr-2">🎒</span> What to Bring
        </h4>
        <div className="flex flex-wrap gap-2">
          {equipment.slice(0, 5).map((item, i) => (
            <div key={i} className="bg-white rounded-lg px-3 py-2 text-sm border border-amber-100 shadow-sm">
              <span className="mr-1">{item.icon}</span>
              <span className="font-medium">{item.item}</span>
              <span className="text-gray-500 text-xs ml-1">({item.reason})</span>
            </div>
          ))}
        </div>
      </div>
    );
  };

  // Share functionality
  const handleShare = async () => {
    const text = `🏄 SUP Conditions at ${beach?.name}\n` +
      `📊 Score: ${paddleScore}/100\n` +
      `💨 Wind: ${scoreBreakdown?.windSpeed?.protected?.toFixed(1) || '?'} km/h\n` +
      `🌊 Waves: ${scoreBreakdown?.waveHeight?.protected?.toFixed(2) || '?'} m\n` +
      `🌡️ Water: ${scoreBreakdown?.waterTemperature?.value?.toFixed(0) || '?'}°C\n` +
      `📅 ${new Date(timeRange.date).toLocaleDateString()} ${timeRange.startTime}-${timeRange.endTime}`;

    if (navigator.share) {
      try {
        await navigator.share({
          title: `SUP Conditions - ${beach?.name}`,
          text: text
        });
      } catch (err) {
        if (err.name !== 'AbortError') {
          // Fallback to clipboard
          await navigator.clipboard.writeText(text);
          alert('Conditions copied to clipboard!');
        }
      }
    } else {
      await navigator.clipboard.writeText(text);
      alert('Conditions copied to clipboard!');
    }
  };

  // Render hourly wind speed visualization (FIXED VERSION)
  const renderHourlyWind = () => {
    if (!weatherData || !weatherData.hourly) return null;
    
    const startHour = parseInt(timeRange.startTime.split(":")[0]);
    const endHour = parseInt(timeRange.endTime.split(":")[0]);
    
    // Initialize arrays to store hourly data for each day
    const todayHours = [];
    const tomorrowHours = [];
    
    // Get the selected date and calculate tomorrow's date
    const todayDate = new Date(timeRange.date);
    const tomorrowDate = new Date(timeRange.date);
    tomorrowDate.setDate(tomorrowDate.getDate() + 1);
    
    // Format dates for comparison
    const todayStr = todayDate.toISOString().split('T')[0];
    const tomorrowStr = tomorrowDate.toISOString().split('T')[0];

    // Process hourly data
    for (let i = 0; i < weatherData.hourly.time.length; i++) {
      const hourTime = new Date(weatherData.hourly.time[i]);
      const hour = hourTime.getHours();
      const dateStr = hourTime.toISOString().split('T')[0];
      
      // Only include hours within our time range
      if (hour >= startHour && hour <= endHour) {
        const hourData = {
          hour,
          index: i,
          windSpeed: Math.round(weatherData.hourly.windspeed_10m[i]),
          time: weatherData.hourly.time[i],
          date: dateStr
        };
        
        // Sort into today or tomorrow
        if (dateStr === todayStr) {
          todayHours.push(hourData);
        } else if (dateStr === tomorrowStr) {
          tomorrowHours.push(hourData);
        }
      }
    }
    
    // Combine the hours, clearly labeled
    const allHours = [
      ...todayHours.map(h => ({ ...h, label: "Today" })),
      ...tomorrowHours.map(h => ({ ...h, label: "Tomorrow" }))
    ];
    
    // Exit gracefully if no hours to display
    if (allHours.length === 0) {
      return (
        <div className="bg-white rounded-lg p-5 border shadow-sm mt-4">
          <h4 className="font-medium mb-4 flex items-center text-gray-800">
            <Clock className="h-5 w-5 mr-2 text-blue-600" />
            Hourly Wind Speed
          </h4>
          <p className="text-gray-600">No wind data available for this period.</p>
        </div>
      );
    }
    
    return (
      <div className="bg-white rounded-lg p-5 border shadow-sm mt-4">
        <h4 className="font-medium mb-4 flex items-center text-gray-800">
          <Clock className="h-5 w-5 mr-2 text-blue-600" /> 
          Hourly Wind Speed
        </h4>
        
        <div className="space-y-3">
          {allHours.map(hour => {
            const windSpeed = hour.windSpeed;
            const barWidth = Math.min(80, windSpeed * 6); // Cap at 80% width
            
            let barColor = "bg-green-500";
            let textColor = "text-green-800";
            let bgColor = "bg-green-100";
            
            if (windSpeed >= 12) {
              barColor = "bg-red-500";
              textColor = "text-red-800";
              bgColor = "bg-red-100";
            } else if (windSpeed >= 8) {
              barColor = "bg-yellow-500";
              textColor = "text-yellow-800";
              bgColor = "bg-yellow-100";
            }
            
            return (
              <div key={`${hour.date}-${hour.hour}`} className="flex items-center">
                <div className="w-32 text-gray-600 font-medium">
                  {new Date(hour.time).toLocaleString([], {
                    month: 'short',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                    hour12: false
                  })}
                </div>
                <div className="flex-grow mx-3 bg-gray-200 h-6 rounded-full overflow-hidden">
                  <div 
                    className={`h-full ${barColor} rounded-l-full`} 
                    style={{ width: `${barWidth}%` }} 
                  ></div>
                </div>
                <div className={`px-2 py-1 rounded-md ${bgColor} ${textColor} font-medium text-sm min-w-[70px] text-center`}>
                  {windSpeed} km/h
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  // Get current condition with improved logic
  const condition = paddleScore !== null && weatherData ? getCondition(paddleScore) : { 
    label: "Loading", 
    emoji: "⏳", 
    message: "Calculating conditions...",
    color: "text-gray-500"
  };

  // Get condition details for tooltip
  const conditionDetails = getConditionDetails();
  const readiness = getPaddleReadiness();

  const breakdownMetrics = scoreBreakdown
    ? {
        windRaw: toNumberOr(scoreBreakdown.windSpeed?.raw, 0),
        windProtected: toNumberOr(scoreBreakdown.windSpeed?.protected, 0),
        windDirection: toNumberOr(scoreBreakdown.windDirection?.value, 0),
        waveRaw: toNumberOr(scoreBreakdown.waveHeight?.raw, 0),
        waveProtected: toNumberOr(scoreBreakdown.waveHeight?.protected, 0),
        swellProtected: toNumberOr(scoreBreakdown.swellHeight?.protected, 0),
        temperature: toNumberOr(scoreBreakdown.temperature?.value, 0),
        waterTemperature: toNumberOr(scoreBreakdown.waterTemperature?.value, null),
        precipitation: toNumberOr(scoreBreakdown.precipitation?.value, 0),
        cloudCover: toNumberOr(scoreBreakdown.cloudCover?.value, 0),
        uvIndex: toNumberOr(scoreBreakdown.uvIndex?.value, 0)
      }
    : null;

  // Get sunrise/sunset from weather data
  const sunTimes = weatherData?.daily ? {
    sunrise: weatherData.daily.sunrise?.[0],
    sunset: weatherData.daily.sunset?.[0]
  } : null;

  return (
    <>
      {showDatePicker && (
        <DatePickerModal
          currentDate={new Date(timeRange.date)}
          onSelect={(date) => {
            onTimeRangeChange?.('date', date);
            setShowDatePicker(false);
          }}
          onClose={() => setShowDatePicker(false)}
        />
      )}
      <div className="bg-white rounded-lg shadow-lg overflow-hidden">
      {/* Header with beach info */}
      <div className="p-4 border-b flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-semibold flex items-center">
            {beach?.id === homeBeach?.id && (
              <Home className="h-5 w-5 text-orange-500 mr-2" />
            )}
            {beach?.name || "Beach"}
          </h2>
          <div className="flex items-center mt-1 text-gray-600">
            <p className="text-gray-600 mr-3">
              {beach ? `${beach.latitude.toFixed(4)}, ${beach.longitude.toFixed(4)}` : ""}
            </p>
            {beach && (
              <a
                href={beach.googleMapsUrl || `https://www.google.com/maps?q=${beach.latitude},${beach.longitude}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-blue-600 hover:underline flex items-center"
              >
                <Map className="h-3 w-3 mr-1" />
                View on Maps
              </a>
            )}
          </div>
        </div>
        <div className="flex space-x-2">
          {beach && beach.id !== homeBeach?.id && (
            <button
              onClick={() => onSetHomeBeach?.(beach)}
              className="bg-orange-500 text-white px-3 py-1 rounded-lg hover:bg-orange-600 transition-colors flex items-center"
              aria-label="Set this beach as home"
            >
              <Home className="h-4 w-4 mr-1" /> Set as Home
            </button>
          )}
          <button
            onClick={() => setView?.("dashboard")}
            className="bg-gray-200 text-gray-800 px-3 py-1 rounded-lg hover:bg-gray-300 transition-colors flex items-center"
            aria-label="Back to dashboard"
          >
            <ChevronLeft className="h-4 w-4 mr-1" /> Back
          </button>
        </div>
      </div>
      <div className="border-b bg-gray-50 px-4 py-3">
        <div className="flex flex-wrap items-center gap-2 text-sm text-gray-700" aria-label="Quick actions for this beach">
          <button
            type="button"
            onClick={() => fetchWeatherData()}
            className="inline-flex items-center gap-1 rounded-full bg-white px-3 py-1 font-semibold text-blue-700 shadow-sm transition hover:bg-blue-50"
            aria-label="Refresh forecast data"
          >
            <RefreshCw className="h-4 w-4" />
            Refresh
          </button>
          <button
            type="button"
            onClick={() => setShowDatePicker(true)}
            className="inline-flex items-center gap-1 rounded-full bg-white px-3 py-1 font-semibold text-blue-700 shadow-sm transition hover:bg-blue-50"
            aria-label="Change forecast date"
          >
            <Calendar className="h-4 w-4" />
            Date
          </button>
          {beach && (
            <a
              href={beach.googleMapsUrl || `https://www.google.com/maps?q=${beach.latitude},${beach.longitude}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 rounded-full bg-white px-3 py-1 font-semibold text-blue-700 shadow-sm transition hover:bg-blue-50"
              aria-label={`Open ${beach.name} on Google Maps`}
            >
              <MapPin className="h-4 w-4" />
              Maps
            </a>
          )}
          {beach && beach.id !== homeBeach?.id && (
            <button
              type="button"
              onClick={() => onSetHomeBeach?.(beach)}
              className="inline-flex items-center gap-1 rounded-full bg-orange-100 px-3 py-1 font-semibold text-orange-700 shadow-sm transition hover:bg-orange-200"
              aria-label="Pin this beach as home"
            >
              <Home className="h-4 w-4" />
              Pin home
            </button>
          )}
        </div>
      </div>

      {/* Time range selector */}
      <div className="p-4 border-b bg-gray-50">
        <h3 className="text-lg font-medium mb-4">Choose Date & Time Window</h3>
        
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-2">Date</label>
          <div className="relative cursor-pointer" onClick={() => setShowDatePicker(true)}>
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Calendar className="h-5 w-5 text-gray-400" />
            </div>
            <input
              type="text"
              readOnly
              value={timeRange.date}
              className="w-full pl-10 p-3 bg-white border rounded-lg cursor-pointer text-lg"
            />
          </div>
        </div>
        
        <div className="flex space-x-4 mb-4">
          <button 
            onClick={() => onTimeRangeChange?.('date', new Date().toISOString().split('T')[0])}
            className="flex-1 bg-blue-500 text-white py-3 px-4 rounded-lg text-lg font-medium hover:bg-blue-600"
          >
            Today
          </button>
          <button 
            onClick={() => {
              const tomorrow = new Date();
              tomorrow.setDate(tomorrow.getDate() + 1);
              onTimeRangeChange?.('date', tomorrow.toISOString().split('T')[0]);
            }}
            className="flex-1 bg-blue-500 text-white py-3 px-4 rounded-lg text-lg font-medium hover:bg-blue-600"
          >
            Tomorrow
          </button>
        </div>
        
        <div className="grid grid-cols-2 gap-4 mb-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              {t('time.startTime')}
            </label>
            <select
              value={timeRange.startTime}
              onChange={(e) => {
                const newStart = e.target.value;
                const newStartHour = parseInt(newStart.split(':')[0], 10);
                const endHour = parseInt(timeRange.endTime.split(':')[0], 10);
                onTimeRangeChange?.('startTime', newStart);
                // Auto-adjust end time if start >= end
                if (newStartHour >= endHour) {
                  const newEndHour = Math.min(newStartHour + 2, 23);
                  onTimeRangeChange?.('endTime', `${String(newEndHour).padStart(2, '0')}:00`);
                }
              }}
              className="w-full p-2 border rounded appearance-none bg-white text-lg"
            >
              {Array.from({ length: 24 }, (_, i) => (
                <option key={i} value={`${String(i).padStart(2, '0')}:00`}>
                  {`${String(i).padStart(2, '0')}:00`}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              {t('time.endTime')}
            </label>
            <select
              value={timeRange.endTime}
              onChange={(e) => {
                const newEnd = e.target.value;
                const newEndHour = parseInt(newEnd.split(':')[0], 10);
                const startHour = parseInt(timeRange.startTime.split(':')[0], 10);
                onTimeRangeChange?.('endTime', newEnd);
                // Auto-adjust start time if end <= start
                if (newEndHour <= startHour) {
                  const newStartHour = Math.max(newEndHour - 2, 0);
                  onTimeRangeChange?.('startTime', `${String(newStartHour).padStart(2, '0')}:00`);
                }
              }}
              className="w-full p-2 border rounded appearance-none bg-white text-lg"
            >
              {Array.from({ length: 24 }, (_, i) => (
                <option key={i} value={`${String(i).padStart(2, '0')}:00`}>
                  {`${String(i).padStart(2, '0')}:00`}
                </option>
              ))}
            </select>
          </div>
        </div>
        
        <button
          onClick={fetchWeatherData}
          className="w-full bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700 flex items-center justify-center text-lg"
        >
          <RefreshCw className="h-5 w-5 mr-2" />
          {t('weather.refresh', 'Update Forecast')}
        </button>
      </div>

      {/* Loading state */}
      {loading && (
        <div className="p-8 text-center">
          <div className="inline-block animate-spin h-10 w-10 border-4 border-blue-500 border-t-transparent rounded-full mb-4"></div>
          <p className="text-gray-600">{t('weather.loading')}</p>
        </div>
      )}
      
      {/* Error state */}
      {error && !loading && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-md text-red-800 mx-4 my-4">
          <p className="flex items-center font-medium">
            <AlertCircle className="w-5 h-5 mr-2 text-red-600" />
            {error}
          </p>
          <button 
            onClick={fetchWeatherData}
            className="mt-4 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 w-full flex items-center justify-center"
          >
            <RefreshCw className="h-5 w-5 mr-2" />
            Try Again
          </button>
        </div>
      )}
      
      {/* Weather data with score */}
      {weatherData && marineData && !loading && !error && (
        <div className="p-6">
          {/* Score display - Simplified Layout */}
          {paddleScore !== null && (
            <div className="space-y-4 mb-6">
              {/* Main Score Card with Protection Badge */}
              <div className="bg-white rounded-2xl shadow-md p-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className={`text-5xl ${condition.color}`}>{condition.emoji}</div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className={`text-2xl font-bold ${condition.color}`}>{paddleScore}/100</h3>
                        <span className="text-lg text-gray-600">{condition.label}</span>
                      </div>
                      <p className="text-gray-500">{condition.message}</p>
                    </div>
                  </div>
                  {/* Protection Badge */}
                  {geoProtection && (
                    <div className={`flex items-center gap-2 px-3 py-2 rounded-full text-sm font-medium ${
                      geoProtection.protectionScore > 60
                        ? 'bg-green-100 text-green-700'
                        : geoProtection.protectionScore > 30
                          ? 'bg-yellow-100 text-yellow-700'
                          : 'bg-red-100 text-red-700'
                    }`}>
                      <Shield className="h-4 w-4" />
                      {geoProtection.protectionScore > 60 ? 'Well Protected' :
                       geoProtection.protectionScore > 30 ? 'Moderate' : 'Exposed'}
                    </div>
                  )}
                </div>
                {/* Condition Trends */}
                {conditionTrends && (
                  <div className="mt-3 pt-3 border-t">
                    {renderConditionTrends()}
                  </div>
                )}
              </div>

              {/* Key Metrics - Wind, Waves, Water Temp (Prominent) */}
              {breakdownMetrics && (
                <div className="grid grid-cols-3 gap-3">
                  {/* Wind */}
                  <div className={`bg-white rounded-xl p-4 shadow-sm border-l-4 ${
                    breakdownMetrics.windProtected < 8 ? 'border-green-500' :
                    breakdownMetrics.windProtected < 15 ? 'border-yellow-500' : 'border-red-500'
                  }`}>
                    <div className="flex items-center gap-2 mb-2">
                      <Wind className="h-5 w-5 text-blue-600" />
                      <span className="text-sm font-medium text-gray-600">Wind</span>
                    </div>
                    <div className={`text-2xl font-bold ${
                      breakdownMetrics.windProtected < 8 ? 'text-green-600' :
                      breakdownMetrics.windProtected < 15 ? 'text-yellow-600' : 'text-red-600'
                    }`}>
                      {Math.round(breakdownMetrics.windProtected)} km/h
                    </div>
                    <div className="text-xs text-gray-400 mt-1">
                      {breakdownMetrics.windProtected < 8 ? 'Light' :
                       breakdownMetrics.windProtected < 15 ? 'Moderate' : 'Strong'}
                    </div>
                  </div>

                  {/* Waves */}
                  <div className={`bg-white rounded-xl p-4 shadow-sm border-l-4 ${
                    breakdownMetrics.waveProtected < 0.2 ? 'border-green-500' :
                    breakdownMetrics.waveProtected < 0.4 ? 'border-yellow-500' : 'border-red-500'
                  }`}>
                    <div className="flex items-center gap-2 mb-2">
                      <Waves className="h-5 w-5 text-blue-600" />
                      <span className="text-sm font-medium text-gray-600">Waves</span>
                    </div>
                    <div className={`text-2xl font-bold ${
                      breakdownMetrics.waveProtected < 0.2 ? 'text-green-600' :
                      breakdownMetrics.waveProtected < 0.4 ? 'text-yellow-600' : 'text-red-600'
                    }`}>
                      {breakdownMetrics.waveProtected.toFixed(1)} m
                    </div>
                    <div className="text-xs text-gray-400 mt-1">
                      {breakdownMetrics.waveProtected < 0.2 ? 'Calm' :
                       breakdownMetrics.waveProtected < 0.4 ? 'Light chop' : 'Choppy'}
                    </div>
                  </div>

                  {/* Water Temp */}
                  <div className={`bg-white rounded-xl p-4 shadow-sm border-l-4 ${
                    breakdownMetrics.waterTemperature !== null
                      ? breakdownMetrics.waterTemperature >= 18 && breakdownMetrics.waterTemperature <= 26
                        ? 'border-green-500'
                        : breakdownMetrics.waterTemperature >= 15
                          ? 'border-yellow-500'
                          : 'border-blue-500'
                      : 'border-gray-300'
                  }`}>
                    <div className="flex items-center gap-2 mb-2">
                      <Thermometer className="h-5 w-5 text-cyan-500" />
                      <span className="text-sm font-medium text-gray-600">Water</span>
                    </div>
                    <div className={`text-2xl font-bold ${
                      breakdownMetrics.waterTemperature !== null
                        ? breakdownMetrics.waterTemperature >= 18 && breakdownMetrics.waterTemperature <= 26
                          ? 'text-green-600'
                          : breakdownMetrics.waterTemperature >= 15
                            ? 'text-yellow-600'
                            : 'text-blue-600'
                        : 'text-gray-400'
                    }`}>
                      {breakdownMetrics.waterTemperature !== null
                        ? `${Math.round(breakdownMetrics.waterTemperature)}°C`
                        : 'N/A'}
                    </div>
                    <div className="text-xs text-gray-400 mt-1">
                      {breakdownMetrics.waterTemperature !== null
                        ? breakdownMetrics.waterTemperature >= 22 ? 'Warm' :
                          breakdownMetrics.waterTemperature >= 18 ? 'Comfortable' :
                          breakdownMetrics.waterTemperature >= 15 ? 'Cool - wetsuit' : 'Cold!'
                        : 'Unknown'}
                    </div>
                  </div>
                </div>
              )}

              {/* Secondary Metrics - Compact Row */}
              {breakdownMetrics && (
                <div className="bg-white rounded-xl shadow-sm p-4">
                  <div className="flex flex-wrap items-center justify-between gap-4 text-sm">
                    {/* Air Temp */}
                    <div className="flex items-center gap-2">
                      <Thermometer className="h-4 w-4 text-orange-500" />
                      <span className="text-gray-500">Air:</span>
                      <span className="font-medium">{Math.round(breakdownMetrics.temperature)}°C</span>
                    </div>

                    {/* UV */}
                    <div className="flex items-center gap-2">
                      <Sun className={`h-4 w-4 ${
                        breakdownMetrics.uvIndex >= 8 ? 'text-red-500' :
                        breakdownMetrics.uvIndex >= 6 ? 'text-orange-500' : 'text-yellow-500'
                      }`} />
                      <span className="text-gray-500">UV:</span>
                      <span className={`font-medium ${
                        breakdownMetrics.uvIndex >= 8 ? 'text-red-600' :
                        breakdownMetrics.uvIndex >= 6 ? 'text-orange-600' : 'text-gray-700'
                      }`}>
                        {breakdownMetrics.uvIndex.toFixed(0)}
                        {breakdownMetrics.uvIndex >= 6 && <span className="text-xs ml-1">(High)</span>}
                      </span>
                    </div>

                    {/* Rain */}
                    <div className="flex items-center gap-2">
                      <Droplets className="h-4 w-4 text-blue-500" />
                      <span className="text-gray-500">Rain:</span>
                      <span className={`font-medium ${
                        breakdownMetrics.precipitation < 1 ? 'text-green-600' : 'text-red-600'
                      }`}>
                        {breakdownMetrics.precipitation < 0.1 ? 'None' : `${breakdownMetrics.precipitation.toFixed(1)}mm`}
                      </span>
                    </div>

                    {/* Wind Direction */}
                    <div className="flex items-center gap-2">
                      <Navigation
                        className="h-4 w-4 text-blue-500"
                        style={{ transform: `rotate(${breakdownMetrics.windDirection}deg)` }}
                      />
                      <span className="text-gray-500">From:</span>
                      <span className="font-medium">{getCardinalDirection(breakdownMetrics.windDirection)}</span>
                    </div>

                    {/* Sunrise/Sunset */}
                    {sunTimes && (
                      <div className="flex items-center gap-3">
                        <div className="flex items-center gap-1">
                          <Sunrise className="h-4 w-4 text-orange-400" />
                          <span className="text-gray-600">
                            {sunTimes.sunrise ? new Date(sunTimes.sunrise).toLocaleTimeString('el-GR', { hour: '2-digit', minute: '2-digit', timeZone: GREEK_TIMEZONE }) : 'N/A'}
                          </span>
                        </div>
                        <div className="flex items-center gap-1">
                          <Sunset className="h-4 w-4 text-orange-500" />
                          <span className="text-gray-600">
                            {sunTimes.sunset ? new Date(sunTimes.sunset).toLocaleTimeString('el-GR', { hour: '2-digit', minute: '2-digit', timeZone: GREEK_TIMEZONE }) : 'N/A'}
                          </span>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Beach Location Map - Compact */}
          {beach && (
            <div className="mt-4 bg-white rounded-lg shadow-sm border overflow-hidden">
              <div className="h-48 relative">
                <MapContainer
                  center={[beach.latitude, beach.longitude]}
                  zoom={14}
                  style={{ height: "100%", width: "100%" }}
                  scrollWheelZoom={false}
                >
                  <TileLayer
                    attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                  />
                  <Marker position={[beach.latitude, beach.longitude]}>
                    <Popup>
                      <strong>{beach.name}</strong>
                    </Popup>
                  </Marker>
                </MapContainer>
              </div>
              <div className="px-4 py-2 flex justify-between items-center text-sm border-t bg-gray-50">
                <span className="text-gray-600">
                  {beach.latitude.toFixed(4)}, {beach.longitude.toFixed(4)}
                </span>
                <a
                  href={`https://www.google.com/maps/dir/?api=1&destination=${beach.latitude},${beach.longitude}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-600 hover:underline flex items-center font-medium"
                >
                  <Navigation className="h-4 w-4 mr-1" />
                  Directions
                </a>
              </div>
            </div>
          )}

          {readiness && (
            <div className="mt-6 space-y-4">
              <div className="grid gap-4 lg:grid-cols-2">
                <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-blue-600 via-sky-500 to-cyan-500 p-6 text-white shadow-lg">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <div className="text-4xl">{readiness.icon}</div>
                      <div>
                        <p className="text-xs uppercase tracking-widest text-blue-100">Paddle readiness</p>
                        <h4 className="text-2xl font-semibold">{readiness.headline}</h4>
                      </div>
                    </div>
                    <span className={`px-3 py-1 rounded-full text-sm font-semibold ${readiness.badgeClass}`}>
                      {readiness.skillLevel}
                    </span>
                  </div>

                  <p className="mt-4 text-sm leading-relaxed text-blue-50">{readiness.message}</p>

                  <div className="mt-6 grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
                    <div className="rounded-lg bg-white/20 p-3 backdrop-blur">
                      <div className="text-xs uppercase text-blue-100">{t('weather.wind')}</div>
                      <div className="text-lg font-semibold">{Math.round(readiness.wind)} km/h</div>
                    </div>
                    <div className="rounded-lg bg-white/20 p-3 backdrop-blur">
                      <div className="text-xs uppercase text-blue-100">{t('weather.waves')}</div>
                      <div className="text-lg font-semibold">{readiness.wave.toFixed(2)} m</div>
                    </div>
                    <div className="rounded-lg bg-white/20 p-3 backdrop-blur">
                      <div className="text-xs uppercase text-blue-100">{t('weather.airTemp')}</div>
                      <div className="text-lg font-semibold">{Math.round(readiness.temperature)}°C</div>
                    </div>
                    <div className="rounded-lg bg-white/20 p-3 backdrop-blur">
                      <div className="text-xs uppercase text-blue-100">{t('weather.waterTemp')}</div>
                      <div className="text-lg font-semibold">
                        {readiness.waterTemperature !== null
                          ? `${Math.round(readiness.waterTemperature)}°C`
                          : 'N/A'}
                      </div>
                    </div>
                  </div>

                  {readiness.bestHour && (
                    <div className="mt-6 flex items-center rounded-xl bg-white/15 px-4 py-3 text-sm backdrop-blur">
                      <Clock className="mr-3 h-5 w-5 text-white" />
                      <div>
                        <p className="font-semibold">{t('safety.sweetSpot')}</p>
                        <p className="text-blue-100">
                          {readiness.bestHour.time.toLocaleTimeString('el-GR', { hour: '2-digit', minute: '2-digit', timeZone: GREEK_TIMEZONE })} — {t('weather.wind').toLowerCase()} {Math.round(readiness.bestHour.wind)} km/h
                        </p>
                      </div>
                    </div>
                  )}
                </div>

                <div className="rounded-2xl border bg-white p-5 shadow-sm">
                  <h4 className="flex items-center text-lg font-semibold text-gray-800">
                    <LifeBuoy className="mr-2 h-5 w-5 text-blue-500" /> Session game plan
                  </h4>
                  <p className="mt-2 text-sm text-gray-500">Forecast window: {readiness.windowLabel}</p>
                  <ul className="mt-4 space-y-3">
                    {readiness.suggestions.map((tip, index) => (
                      <li key={index} className="flex items-start text-sm text-gray-600">
                        <CheckCircle2 className="mr-2 h-5 w-5 flex-shrink-0 text-blue-500" />
                        <span>{tip}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>

            </div>
          )}

          {/* Daylight warning */}
          {sunTimes?.sunrise && sunTimes?.sunset && (() => {
            const sunriseHour = new Date(sunTimes.sunrise).getHours();
            const sunsetHour = new Date(sunTimes.sunset).getHours();
            const startHour = parseInt(timeRange.startTime.split(':')[0], 10);
            const endHour = parseInt(timeRange.endTime.split(':')[0], 10);
            const isBeforeSunrise = startHour < sunriseHour;
            const isAfterSunset = endHour > sunsetHour;
            const isFullyDark = startHour >= sunsetHour || endHour <= sunriseHour;

            if (isFullyDark) {
              return (
                <div className="bg-purple-50 p-4 rounded-lg border border-purple-200 mb-4">
                  <h4 className="font-bold text-purple-700 flex items-center mb-2">
                    <AlertCircle className="h-5 w-5 mr-2" />
                    NIGHTTIME SELECTED
                  </h4>
                  <p className="text-purple-700">
                    Your selected time ({timeRange.startTime}-{timeRange.endTime}) is outside daylight hours.
                    Sunrise is at {new Date(sunTimes.sunrise).toLocaleTimeString('el-GR', { hour: '2-digit', minute: '2-digit', timeZone: GREEK_TIMEZONE })} and
                    sunset at {new Date(sunTimes.sunset).toLocaleTimeString('el-GR', { hour: '2-digit', minute: '2-digit', timeZone: GREEK_TIMEZONE })}.
                    Paddleboarding in the dark is not recommended.
                  </p>
                </div>
              );
            }

            if (isBeforeSunrise || isAfterSunset) {
              return (
                <div className="bg-amber-50 p-4 rounded-lg border border-amber-200 mb-4">
                  <h4 className="font-bold text-amber-700 flex items-center mb-2">
                    <AlertCircle className="h-5 w-5 mr-2" />
                    PARTIAL DARKNESS
                  </h4>
                  <p className="text-amber-700">
                    Part of your selected time window is outside daylight hours.
                    Sunrise: {new Date(sunTimes.sunrise).toLocaleTimeString('el-GR', { hour: '2-digit', minute: '2-digit', timeZone: GREEK_TIMEZONE })},
                    Sunset: {new Date(sunTimes.sunset).toLocaleTimeString('el-GR', { hour: '2-digit', minute: '2-digit', timeZone: GREEK_TIMEZONE })}.
                  </p>
                </div>
              );
            }

            return null;
          })()}

          {/* Safety alert */}
          {scoreBreakdown && scoreBreakdown.windSpeed.raw > 30 && (
            <div className="bg-red-50 p-4 rounded-lg border border-red-200 mb-4">
              <h4 className="font-bold text-red-700 flex items-center mb-2">
                <AlertCircle className="h-5 w-5 mr-2" />
                HIGH WIND ALERT
              </h4>
              <p className="text-red-700">
                Wind speeds above 30 km/h can be unsafe for paddleboarding. Please exercise extreme caution.
              </p>
            </div>
          )}
          
          {/* Equipment Recommendations */}
          {renderEquipment()}

          {/* 7-Day Forecast */}
          {renderWeeklyForecast()}

          {/* Score Breakdown */}
          {renderScoreBreakdown()}

          {/* Geographic Protection */}
          {renderGeoProtectionInfo()}

          {/* Hourly Wind */}
          {renderHourlyWind()}

          <div className="text-center mt-6 space-y-3">
            <button
              onClick={handleShare}
              className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              <Navigation className="h-4 w-4" />
              Share Conditions
            </button>
            <p className="text-sm text-gray-600">
              Real-time data from Open-Meteo API. Always verify conditions before paddleboarding.
            </p>
          </div>
        </div>
      )}
    </div>
    </>
  );
};

export default FixedBeachView;

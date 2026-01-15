// FixedBeachView.jsx - Production-ready with all required features
import React, { useState, useEffect } from "react";
import {
  Home,
  ChevronLeft,
  ChevronDown,
  ChevronUp,
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
  Navigation
} from "lucide-react";
import { MapContainer, TileLayer, Marker, Popup } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { calculateGeographicProtection } from "./utils/coastlineAnalysis";
import { getCardinalDirection, DatePickerModal } from "./helpers.jsx";

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
  const [weatherData, setWeatherData] = useState(null);
  const [marineData, setMarineData] = useState(null);
  const [paddleScore, setPaddleScore] = useState(null);
  const [scoreBreakdown, setScoreBreakdown] = useState(null);
  const [geoProtection, setGeoProtection] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [showDebug, setShowDebug] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [expandedSections, setExpandedSections] = useState({
    scoreBreakdown: true,
    geoProtection: true,
    hourlyWind: true
  });

  const toggleSection = (section) => {
    setExpandedSections(prev => ({ ...prev, [section]: !prev[section] }));
  };

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
    };

    updateScores();
  }, [timeRange.startTime, timeRange.endTime, weatherData, marineData, beach]);

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
      
      // API URLs - include gusts, UV index, sunrise/sunset
      const weatherUrl = `https://api.open-meteo.com/v1/forecast?latitude=${beach.latitude}&longitude=${beach.longitude}&hourly=temperature_2m,precipitation,cloudcover,windspeed_10m,winddirection_10m,windgusts_10m,uv_index&daily=precipitation_sum,windspeed_10m_max,sunrise,sunset,uv_index_max&start_date=${formattedDate}&end_date=${formattedTomorrow}&timezone=auto`;

      // Marine API - include swell period and ocean currents
      const marineUrl = `https://marine-api.open-meteo.com/v1/marine?latitude=${beach.latitude}&longitude=${beach.longitude}&hourly=wave_height,swell_wave_height,swell_wave_period,wave_direction,sea_surface_temperature,ocean_current_velocity&daily=wave_height_max,wave_direction_dominant&start_date=${formattedDate}&end_date=${formattedTomorrow}&timezone=auto`;
      
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
          precipitation: weatherData.hourly.precipitation?.[index] ?? 0
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

    if (bestHour) {
      const bestLabel = bestHour.time.toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit'
      });
      const waveText = Number.isFinite(bestHour.wave)
        ? bestHour.wave.toFixed(1)
        : '0.0';
      suggestions.push(
        `Sweet spot around ${bestLabel} — wind near ${Math.round(bestHour.wind)} km/h and waves about ${waveText} m.`
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
        <button
          onClick={() => toggleSection('geoProtection')}
          className="w-full p-5 flex items-center justify-between text-left hover:bg-blue-100/50 transition-colors rounded-lg"
        >
          <h4 className="font-medium text-lg flex items-center text-blue-800">
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
          {expandedSections.geoProtection ? (
            <ChevronUp className="h-5 w-5 text-blue-400" />
          ) : (
            <ChevronDown className="h-5 w-5 text-blue-400" />
          )}
        </button>

        {expandedSections.geoProtection && (
          <div className="px-5 pb-5">
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
        )}
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
        <button
          onClick={() => toggleSection('scoreBreakdown')}
          className="w-full p-4 flex items-center justify-between text-left hover:bg-white/50 transition-colors rounded-2xl"
        >
          <h4 className="font-semibold flex items-center text-gray-800">
            <div className="p-2 bg-blue-100 rounded-lg mr-3">
              <Info className="h-4 w-4 text-blue-600" />
            </div>
            Score Breakdown
          </h4>
          <div className="flex items-center gap-3">
            <span className={`text-lg font-bold ${
              scoreBreakdown.total.score >= 85 ? 'text-emerald-600' :
              scoreBreakdown.total.score >= 70 ? 'text-amber-600' :
              scoreBreakdown.total.score >= 50 ? 'text-orange-600' : 'text-red-600'
            }`}>
              {scoreBreakdown.total.score}/100
            </span>
            {expandedSections.scoreBreakdown ? (
              <ChevronUp className="h-5 w-5 text-gray-400" />
            ) : (
              <ChevronDown className="h-5 w-5 text-gray-400" />
            )}
          </div>
        </button>

        {expandedSections.scoreBreakdown && (
          <div className="px-4 pb-4">
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
        )}
      </div>
    );
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
      <div className="bg-white rounded-lg shadow-lg overflow-hidden dark:bg-slate-900 dark:border dark:border-slate-800">
      {/* Header with beach info */}
      <div className="p-4 border-b flex justify-between items-center dark:border-slate-800">
        <div>
          <h2 className="text-2xl font-semibold flex items-center">
            {beach?.id === homeBeach?.id && (
              <Home className="h-5 w-5 text-orange-500 mr-2" />
            )}
            {beach?.name || "Beach"}
          </h2>
          <div className="flex items-center mt-1 text-gray-600 dark:text-slate-200">
            <p className="text-gray-600 mr-3 dark:text-slate-300">
              {beach ? `${beach.latitude.toFixed(4)}, ${beach.longitude.toFixed(4)}` : ""}
            </p>
            {beach && (
              <a
                href={beach.googleMapsUrl || `https://www.google.com/maps?q=${beach.latitude},${beach.longitude}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-blue-600 hover:underline flex items-center dark:text-blue-300"
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
            className="bg-gray-200 text-gray-800 px-3 py-1 rounded-lg hover:bg-gray-300 transition-colors flex items-center dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-700"
            aria-label="Back to dashboard"
          >
            <ChevronLeft className="h-4 w-4 mr-1" /> Back
          </button>
        </div>
      </div>
      <div className="border-b bg-gray-50 px-4 py-3 dark:border-slate-800 dark:bg-slate-800/50">
        <div className="flex flex-wrap items-center gap-2 text-sm text-gray-700 dark:text-slate-200" aria-label="Quick actions for this beach">
          <button
            type="button"
            onClick={() => fetchWeatherData()}
            className="inline-flex items-center gap-1 rounded-full bg-white px-3 py-1 font-semibold text-blue-700 shadow-sm transition hover:bg-blue-50 dark:bg-slate-900 dark:text-blue-200 dark:hover:bg-slate-700"
            aria-label="Refresh forecast data"
          >
            <RefreshCw className="h-4 w-4" />
            Refresh
          </button>
          <button
            type="button"
            onClick={() => setShowDatePicker(true)}
            className="inline-flex items-center gap-1 rounded-full bg-white px-3 py-1 font-semibold text-blue-700 shadow-sm transition hover:bg-blue-50 dark:bg-slate-900 dark:text-blue-200 dark:hover:bg-slate-700"
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
              className="inline-flex items-center gap-1 rounded-full bg-white px-3 py-1 font-semibold text-blue-700 shadow-sm transition hover:bg-blue-50 dark:bg-slate-900 dark:text-blue-200 dark:hover:bg-slate-700"
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
              className="inline-flex items-center gap-1 rounded-full bg-orange-100 px-3 py-1 font-semibold text-orange-700 shadow-sm transition hover:bg-orange-200 dark:bg-orange-900/40 dark:text-orange-100 dark:hover:bg-orange-800/60"
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
              Start Time
            </label>
            <select
              value={timeRange.startTime}
              onChange={(e) => onTimeRangeChange?.('startTime', e.target.value)}
              className="w-full p-2 border rounded appearance-none bg-white text-lg"
            >
              {Array.from({ length: 24 }, (_, i) => {
                const hourLabel = `${String(i).padStart(2, '0')}:00`;
                const endHour = parseInt(timeRange.endTime.split(':')[0], 10);
                return (
                  <option
                    key={i}
                    value={hourLabel}
                    disabled={i > endHour}
                  >
                    {hourLabel}
                  </option>
                );
              })}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              End Time
            </label>
            <select
              value={timeRange.endTime}
              onChange={(e) => onTimeRangeChange?.('endTime', e.target.value)}
              className="w-full p-2 border rounded appearance-none bg-white text-lg"
            >
              {Array.from({ length: 24 }, (_, i) => {
                const hourLabel = `${String(i).padStart(2, '0')}:00`;
                const startHour = parseInt(timeRange.startTime.split(':')[0], 10);
                return (
                  <option
                    key={i}
                    value={hourLabel}
                    disabled={i < startHour}
                  >
                    {hourLabel}
                  </option>
                );
              })}
            </select>
          </div>
        </div>
        
        <button 
          onClick={fetchWeatherData}
          className="w-full bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700 flex items-center justify-center text-lg"
        >
          <RefreshCw className="h-5 w-5 mr-2" />
          Update Forecast
        </button>
      </div>
      
      {/* Loading state */}
      {loading && (
        <div className="p-8 text-center">
          <div className="inline-block animate-spin h-10 w-10 border-4 border-blue-500 border-t-transparent rounded-full mb-4"></div>
          <p className="text-gray-600">Loading real-time weather data...</p>
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
          {/* Score display */}
          {paddleScore !== null && (
            <div className="flex flex-col md:flex-row gap-6 mb-6">
              {/* Score card - LEFT SIDE */}
              <div className="md:w-1/3 bg-white rounded-lg shadow-md p-6 text-center flex flex-col justify-center relative">
                <div
                  className={`text-6xl mb-3 ${condition.color}`}
                >
                  {condition.emoji}
                </div>
                <h3 className="text-3xl font-bold mb-2 flex items-center justify-center">
                  {condition.label}
                  <div className="group relative ml-2">
                    <div className="cursor-help">
                      <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" 
                          stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" 
                          className="text-gray-400">
                        <circle cx="12" cy="12" r="10"></circle>
                        <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"></path>
                        <line x1="12" y1="17" x2="12.01" y2="17"></line>
                      </svg>
                    </div>
                    <div className="opacity-0 group-hover:opacity-100 transition-opacity duration-200 
                                  absolute z-10 w-64 p-3 -left-24 bottom-8 bg-white 
                                  border border-gray-200 rounded-lg shadow-lg text-sm text-left">
                      {conditionDetails}
                    </div>
                  </div>
                </h3>
                <p className="text-gray-600 text-lg mb-4">{condition.message}</p>
                <div className="mt-2 bg-gray-100 rounded-full h-5 overflow-hidden">
                  <div
                    className={`h-full ${condition.color}`}
                    style={{ width: `${paddleScore}%` }}
                  ></div>
                </div>
                <p className="mt-2 text-lg font-medium text-gray-700">
                  Score: {paddleScore}/100
                </p>
                <div className="mt-1 text-xs text-gray-500 flex items-center justify-center gap-2">
                  <span>Data quality:</span>
                  <span className={`font-medium ${
                    scoreBreakdown?.dataQuality >= 90 ? 'text-green-600' :
                    scoreBreakdown?.dataQuality >= 70 ? 'text-yellow-600' : 'text-red-600'
                  }`}>
                    {scoreBreakdown?.dataQuality ?? 100}%
                  </span>
                  {scoreBreakdown?.dataQuality < 70 && (
                    <span className="text-red-500" title="Some weather data is missing - score may be less accurate">
                      ⚠️
                    </span>
                  )}
                </div>
              </div>
              
              {/* Weather Factors - RIGHT SIDE */}
              <div className="md:w-2/3">
                <div className="grid grid-cols-2 gap-3">
                  {breakdownMetrics ? (
                    <>
                      <div className="bg-white rounded-lg p-3 border flex items-center shadow-sm">
                        <Wind className="h-6 w-6 mr-3 text-blue-600" />
                        <div className="flex-grow">
                          <div className="text-sm text-gray-500">Wind</div>
                          <div className={`text-lg font-medium ${
                            breakdownMetrics.windProtected < 8
                              ? 'text-green-600'
                              : breakdownMetrics.windProtected < 15
                                ? 'text-yellow-600'
                                : 'text-red-600'
                          }`}>
                            {Math.round(breakdownMetrics.windRaw)} km/h
                            <span className="text-xs ml-2 text-gray-500">
                              (Protected: {Math.round(breakdownMetrics.windProtected)} km/h)
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="bg-white rounded-lg p-3 border flex items-center shadow-sm">
                        <Waves className="h-6 w-6 mr-3 text-blue-600" />
                        <div className="flex-grow">
                          <div className="text-sm text-gray-500">Wave Height</div>
                          <div className={`text-lg font-medium ${
                            breakdownMetrics.waveProtected < 0.2
                              ? 'text-green-600'
                              : breakdownMetrics.waveProtected < 0.4
                                ? 'text-yellow-600'
                                : 'text-red-600'
                          }`}>
                            {breakdownMetrics.waveRaw.toFixed(2)} m
                            <span className="text-xs ml-2 text-gray-500">
                              (Protected: {breakdownMetrics.waveProtected.toFixed(2)} m)
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="bg-white rounded-lg p-3 border flex items-center shadow-sm">
                        <Thermometer className="h-6 w-6 mr-3 text-orange-500" />
                        <div className="flex-grow">
                          <div className="text-sm text-gray-500">Air Temp</div>
                          <div className={`text-lg font-medium ${
                            breakdownMetrics.temperature >= 22 && breakdownMetrics.temperature <= 30
                              ? 'text-green-600'
                              : breakdownMetrics.temperature >= 18
                                ? 'text-yellow-600'
                                : 'text-blue-600'
                          }`}>
                            {Math.round(breakdownMetrics.temperature)}°C
                          </div>
                        </div>
                      </div>

                      <div className="bg-white rounded-lg p-3 border flex items-center shadow-sm">
                        <Waves className="h-6 w-6 mr-3 text-cyan-500" />
                        <div className="flex-grow">
                          <div className="text-sm text-gray-500">Water Temp</div>
                          <div className={`text-lg font-medium ${
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
                          {breakdownMetrics.waterTemperature !== null && breakdownMetrics.waterTemperature < 15 && (
                            <div className="text-xs text-blue-600">Wetsuit recommended</div>
                          )}
                        </div>
                      </div>

                      <div className="bg-white rounded-lg p-3 border flex items-center shadow-sm">
                        <Droplets className="h-6 w-6 mr-3 text-blue-600" />
                        <div className="flex-grow">
                          <div className="text-sm text-gray-500">Precipitation</div>
                          <div className={`text-lg font-medium ${
                            breakdownMetrics.precipitation < 1 ? 'text-green-600' : 'text-red-600'
                          }`}>
                            {breakdownMetrics.precipitation.toFixed(1)} mm
                          </div>
                          <div className="mt-1 text-xs text-gray-500">
                            Cloud cover {Math.round(breakdownMetrics.cloudCover)}%
                          </div>
                        </div>
                      </div>

                      <div className="bg-white rounded-lg p-3 border flex items-center shadow-sm">
                        <Sun className={`h-6 w-6 mr-3 ${
                          breakdownMetrics.uvIndex >= 8 ? 'text-red-500' :
                          breakdownMetrics.uvIndex >= 6 ? 'text-orange-500' :
                          breakdownMetrics.uvIndex >= 3 ? 'text-yellow-500' : 'text-green-500'
                        }`} />
                        <div className="flex-grow">
                          <div className="text-sm text-gray-500">UV Index</div>
                          <div className={`text-lg font-medium ${
                            breakdownMetrics.uvIndex >= 8 ? 'text-red-600' :
                            breakdownMetrics.uvIndex >= 6 ? 'text-orange-600' :
                            breakdownMetrics.uvIndex >= 3 ? 'text-yellow-600' : 'text-green-600'
                          }`}>
                            {breakdownMetrics.uvIndex.toFixed(1)}
                            <span className="text-xs ml-1">
                              {breakdownMetrics.uvIndex >= 11 ? '(Extreme)' :
                               breakdownMetrics.uvIndex >= 8 ? '(Very High)' :
                               breakdownMetrics.uvIndex >= 6 ? '(High)' :
                               breakdownMetrics.uvIndex >= 3 ? '(Moderate)' : '(Low)'}
                            </span>
                          </div>
                          {breakdownMetrics.uvIndex >= 6 && (
                            <div className="text-xs text-orange-600">
                              {breakdownMetrics.uvIndex >= 8 ? 'SPF 50+, hat & rash vest!' : 'Sunscreen every 2 hours'}
                            </div>
                          )}
                        </div>
                      </div>

                      {sunTimes && (
                        <div className="bg-white rounded-lg p-3 border flex items-center shadow-sm col-span-2">
                          <div className="flex items-center justify-around w-full">
                            <div className="flex items-center">
                              <Sunrise className="h-5 w-5 mr-2 text-orange-400" />
                              <div>
                                <div className="text-xs text-gray-500">Sunrise</div>
                                <div className="text-sm font-medium">
                                  {sunTimes.sunrise ? new Date(sunTimes.sunrise).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'N/A'}
                                </div>
                              </div>
                            </div>
                            <div className="flex items-center">
                              <Navigation
                                className="h-8 w-8 text-blue-500 mx-4"
                                style={{ transform: `rotate(${breakdownMetrics.windDirection}deg)` }}
                              />
                              <div className="text-xs text-gray-500">
                                Wind from {getCardinalDirection(breakdownMetrics.windDirection)}
                              </div>
                            </div>
                            <div className="flex items-center">
                              <Sunset className="h-5 w-5 mr-2 text-orange-500" />
                              <div>
                                <div className="text-xs text-gray-500">Sunset</div>
                                <div className="text-sm font-medium">
                                  {sunTimes.sunset ? new Date(sunTimes.sunset).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'N/A'}
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      )}
                    </>
                  ) : (
                    <div className="col-span-2 rounded-lg border border-dashed border-blue-200 p-4 text-sm text-gray-500">
                      Forecast metrics will appear once weather data loads.
                    </div>
                  )}
                </div>
              </div>
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
                      <div className="text-xs uppercase text-blue-100">Wind</div>
                      <div className="text-lg font-semibold">{Math.round(readiness.wind)} km/h</div>
                    </div>
                    <div className="rounded-lg bg-white/20 p-3 backdrop-blur">
                      <div className="text-xs uppercase text-blue-100">Waves</div>
                      <div className="text-lg font-semibold">{readiness.wave.toFixed(2)} m</div>
                    </div>
                    <div className="rounded-lg bg-white/20 p-3 backdrop-blur">
                      <div className="text-xs uppercase text-blue-100">Air temp</div>
                      <div className="text-lg font-semibold">{Math.round(readiness.temperature)}°C</div>
                    </div>
                    <div className="rounded-lg bg-white/20 p-3 backdrop-blur">
                      <div className="text-xs uppercase text-blue-100">Water temp</div>
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
                        <p className="font-semibold">Sweet spot timing</p>
                        <p className="text-blue-100">
                          {readiness.bestHour.time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} — wind {Math.round(readiness.bestHour.wind)} km/h
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
                    Sunrise is at {new Date(sunTimes.sunrise).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} and
                    sunset at {new Date(sunTimes.sunset).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}.
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
                    Sunrise: {new Date(sunTimes.sunrise).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })},
                    Sunset: {new Date(sunTimes.sunset).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}.
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
          
          {/* Score Breakdown */}
          {renderScoreBreakdown()}
          
          {/* Geographic Protection */}
          {renderGeoProtectionInfo()}

          {/* Hourly Wind */}
          {renderHourlyWind()}
          
          <div className="text-center mt-6">
            <p className="text-sm text-gray-600">
              This is real-time weather data from Open-Meteo API. Always verify conditions before paddleboarding.
            </p>
          </div>
        </div>
      )}
    </div>
    </>
  );
};

export default FixedBeachView;

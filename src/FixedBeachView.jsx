// FixedBeachView.jsx - Production-ready with all required features
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
  Calendar,
  Info,
  Sunrise
} from "lucide-react";
import { calculateGeographicProtection } from "./utils/coastlineAnalysis";
import { getCardinalDirection, DatePickerModal } from "./helpers.jsx";

import { fetchPaddleConditions } from "./WeatherService";
import { scoreHourlySeries, findBestWindow, findPeakHour } from "./utils/dayPlan.js";
import { getTier, tierInk, formatHour, formatWindow } from "./utils/conditionTiers.js";
import ScoreRing from "./components/ScoreRing.jsx";
import HourStrip from "./components/HourStrip.jsx";
import FactorBars from "./components/FactorBars.jsx";
import { useTheme } from "./utils/themeContext.jsx";

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
  const [daySeries, setDaySeries] = useState(null);
  const [selectedHour, setSelectedHour] = useState(null);
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === "dark";

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

  // The day scored hour by hour, using the same scoring as the dashboard so a
  // spot cannot read one score in the list and another when you open it.
  useEffect(() => {
    if (!beach) return undefined;
    let cancelled = false;

    (async () => {
      try {
        const hours = await fetchPaddleConditions({
          latitude: beach.latitude,
          longitude: beach.longitude,
          startDate: timeRange.date,
          endDate: timeRange.date
        });
        const { hourly, protection } = await scoreHourlySeries(beach, hours);
        if (cancelled) return;
        const peak = findPeakHour(hourly);
        setDaySeries({ hourly, protection, window: findBestWindow(hourly), peak });
        setSelectedHour((current) =>
          current !== null && hourly.some((entry) => entry.hour === current)
            ? current
            : peak?.hour ?? null
        );
      } catch (err) {
        if (!cancelled) {
          console.error("Could not build the hourly outlook", err);
          setDaySeries(null);
        }
      }
    })();

    return () => { cancelled = true; };
  }, [beach?.id, beach?.latitude, beach?.longitude, timeRange.date]);

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
      
      // API URLs
      const weatherUrl = `https://api.open-meteo.com/v1/forecast?latitude=${beach.latitude}&longitude=${beach.longitude}&hourly=temperature_2m,precipitation,cloudcover,windspeed_10m,winddirection_10m&daily=precipitation_sum,windspeed_10m_max&start_date=${formattedDate}&end_date=${formattedTomorrow}&timezone=auto`;
      
      const marineUrl = `https://marine-api.open-meteo.com/v1/marine?latitude=${beach.latitude}&longitude=${beach.longitude}&hourly=wave_height,swell_wave_height,wave_direction,sea_surface_temperature&daily=wave_height_max,wave_direction_dominant&start_date=${formattedDate}&end_date=${formattedTomorrow}&timezone=auto`;
      
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
      const cloudValues = selectValues(weather?.hourly?.cloudcover, relevantIndices);
      const precipValues = selectValues(weather?.hourly?.precipitation, relevantIndices);
      const windDirValues = selectValues(weather?.hourly?.winddirection_10m, relevantIndices);

      // Track data quality - count available vs expected data points
      const expectedDataPoints = relevantIndices.length * 7; // 7 metrics per hour
      const availableDataPoints = tempValues.length + windValues.length + cloudValues.length +
        precipValues.length + windDirValues.length;

      const avgTemp = average(tempValues, toNumberOr(weather?.hourly?.temperature_2m?.[0], 0));
      const avgWind = average(windValues, 0);
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

      const hourlyWaveValues = selectValues(marine?.hourly?.wave_height, relevantIndices);
      const waveHeight = average(hourlyWaveValues, toNumberOr(marine?.daily?.wave_height_max?.[0], 0));

      const swellValues = selectValues(marine?.hourly?.swell_wave_height, relevantIndices);
      const avgSwellHeight = average(swellValues, toNumberOr(marine?.daily?.wave_height_max?.[0], 0));

      // Water temperature from marine data
      const waterTempValues = selectValues(marine?.hourly?.sea_surface_temperature, relevantIndices);
      const avgWaterTemp = waterTempValues.length ? average(waterTempValues, null) : null;

      // Add marine data to quality calculation
      const marineDataPoints = hourlyWaveValues.length + swellValues.length;
      const totalAvailable = availableDataPoints + marineDataPoints;
      const totalExpected = expectedDataPoints + relevantIndices.length * 2; // +2 for wave & swell
      // Available points can exceed expected when the API returns extra
      // entries, which used to surface as "Data quality 105%".
      const dataQuality = Math.min(100, Math.round((totalAvailable / totalExpected) * 100));

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

      // Initialize score breakdown (weights sum to 100)
      const breakdown = {
        windSpeed: { raw: avgWind, protected: protectedWindSpeed, score: 0, maxPossible: 37 },
        waveHeight: { raw: waveHeight, protected: protectedWaveHeight, score: 0, maxPossible: 17 },
        swellHeight: { raw: avgSwellHeight, protected: protectedSwellHeight, score: 0, maxPossible: 10 },
        precipitation: { value: maxPrecip, score: 0, maxPossible: 5 },
        temperature: { value: avgTemp, score: 0, maxPossible: 8 },
        waterTemperature: { value: avgWaterTemp, score: 0, maxPossible: 10 },
        cloudCover: { value: avgCloud, score: 0, maxPossible: 4 },
        geoProtection: { value: protectionScore, score: 0, maxPossible: 9 },
        total: { score: 0, rawScore: 0, bonus: 0, maxPossible: 100 },
        dataQuality: dataQuality // 0-100% indicating data completeness
      };
      
      // Calculate individual scores (weights sum to 100)
      let totalScore = 0;

      // Wind speed score (0-37 points)
      breakdown.windSpeed.score = Math.max(0, 37 - protectedWindSpeed * (37 / 20));
      totalScore += breakdown.windSpeed.score;

      // Wave height score (0-17 points)
      breakdown.waveHeight.score = protectedWaveHeight < 0.2 ? 17 :
                                  Math.max(0, 17 - (protectedWaveHeight - 0.2) * (17 / 0.4));
      totalScore += breakdown.waveHeight.score;

      // Swell height score (0-10 points)
      breakdown.swellHeight.score = protectedSwellHeight < 0.3 ? 10 :
                                   Math.max(0, 10 - (protectedSwellHeight - 0.3) * (10 / 0.3));
      totalScore += breakdown.swellHeight.score;

      // Precipitation score (0-5 points)
      breakdown.precipitation.score = maxPrecip < 1 ? 5 : 0;
      totalScore += breakdown.precipitation.score;

      // Air temperature score (0-8 points) - bell curve 22-32°C ideal
      if (avgTemp >= 22 && avgTemp <= 32) {
        breakdown.temperature.score = 8;
      } else if (avgTemp < 22) {
        breakdown.temperature.score = Math.max(0, 8 - (22 - avgTemp) * 0.8);
      } else {
        breakdown.temperature.score = Math.max(0, 8 - (avgTemp - 32) * 0.8);
      }
      totalScore += breakdown.temperature.score;

      // Water temperature score (0-10 points) - bell curve 18-26°C ideal for paddleboarding
      if (avgWaterTemp !== null) {
        if (avgWaterTemp >= 18 && avgWaterTemp <= 26) {
          breakdown.waterTemperature.score = 10;
        } else if (avgWaterTemp < 18) {
          breakdown.waterTemperature.score = Math.max(0, 10 - (18 - avgWaterTemp));
        } else {
          breakdown.waterTemperature.score = Math.max(0, 10 - (avgWaterTemp - 26));
        }
        totalScore += breakdown.waterTemperature.score;
      }

      // Cloud cover score (0-4 points)
      breakdown.cloudCover.score = avgCloud < 40 ? 4 :
                                  Math.max(0, 4 - (avgCloud - 40) / 15);
      totalScore += breakdown.cloudCover.score;

      // Geographic protection score (0-9 points)
      breakdown.geoProtection.score = (protection.protectionScore / 100) * 9;
      totalScore += breakdown.geoProtection.score;

      // Round scores for display
      breakdown.windSpeed.score = Math.round(breakdown.windSpeed.score);
      breakdown.waveHeight.score = Math.round(breakdown.waveHeight.score);
      breakdown.swellHeight.score = Math.round(breakdown.swellHeight.score);
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

  const getCondition = (score) => {
    if (!scoreBreakdown) {
      return { label: "Loading", emoji: "⏳", message: "Calculating conditions...", color: "text-gray-500" };
    }

    const temp = toNumberOr(scoreBreakdown.temperature?.value, 0);
    const windSpeed = toNumberOr(scoreBreakdown.windSpeed?.protected, 0);
    const precipitation = toNumberOr(scoreBreakdown.precipitation?.value, 0);

    if (score >= 85) {
      if (temp < 18) {
        return {
          label: "Chilly but Calm",
          emoji: "🧊",
          message: "Great conditions, but bring a wetsuit.",
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
      if (windSpeed > 15) {
        return {
          label: "Excellent",
          emoji: "✅",
          message: "Some wind, but well-protected location.",
          color: "text-green-500"
        };
      }
      return {
        label: "Perfect",
        emoji: "✅",
        message: "Flat like oil. Paddle on.",
        color: "text-green-500"
      };
    }

    if (score >= 70) {
      return {
        label: "Okay-ish",
        emoji: "⚠️",
        message: "Minor chop. Go early.",
        color: "text-yellow-500"
      };
    }

    if (score >= 50) {
      return {
        label: "Not Great",
        emoji: "❌",
        message: "Wind or waves make it tricky.",
        color: "text-orange-500"
      };
    }

    return {
      label: "Nope",
      emoji: "🚫",
      message: "Not recommended.",
      color: "text-red-500"
    };
  };

  const renderGeoProtectionInfo = () => {
    if (!geoProtection) return null;
    
    // Calculate the bonus points added to score from geographic protection
    const geoBonus = Math.round((geoProtection.protectionScore / 100) * 10);
    const avgWindDirection = toNumberOr(
      geoProtection?.debugInfo?.windDirection ??
      geoProtection?.dominantWindDirection ??
      geoProtection?.windDirection ??
      0,
      0
    );
    
    return (
      <div className="bg-blue-50 dark:bg-slate-800 p-5 rounded-lg mt-4 border border-blue-200 dark:border-slate-700 shadow-inner">
        <h4 className="font-medium mb-4 text-lg flex items-center text-blue-800 dark:text-blue-300">
          <MapPin className="h-5 w-5 mr-2 text-blue-600 dark:text-blue-400" />
          Geographic Protection Analysis
          <button
            onClick={() => setShowDebug(!showDebug)}
            className="ml-auto text-xs text-blue-600 dark:text-blue-400 underline"
          >
            {showDebug ? 'Hide debug' : 'Show debug'}
          </button>
        </h4>
        
        <div className="grid md:grid-cols-2 gap-6">
          <ul className="space-y-3">
            <li className="flex justify-between items-center bg-white dark:bg-slate-700 p-3 rounded border dark:border-slate-600">
              <span className="font-medium text-gray-700 dark:text-slate-200">Bay Enclosure:</span>
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
            <li className="flex justify-between items-center bg-white dark:bg-slate-700 p-3 rounded border dark:border-slate-600">
              <span className="font-medium text-gray-700 dark:text-slate-200">Wind Direction:</span>
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
            <li className="flex justify-between items-center bg-white dark:bg-slate-700 p-3 rounded border dark:border-slate-600">
              <span className="font-medium text-gray-700 dark:text-slate-200">Overall Protection:</span>
              <div className="flex items-center">
                <div className="w-24 h-3 bg-gray-200 dark:bg-slate-600 rounded-full overflow-hidden mr-2">
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
          
          <div className="bg-white dark:bg-slate-700 p-4 rounded border dark:border-slate-600">
            <h5 className="font-medium mb-2 text-gray-800 dark:text-slate-100">Impact on Score</h5>
            <p className="text-gray-700 dark:text-slate-200 mb-3">
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
              <pre className="mt-3 text-xs bg-gray-100 dark:bg-slate-800 dark:text-slate-300 p-2 rounded overflow-x-auto">
{JSON.stringify(geoProtection.debugInfo, null, 2)}
              </pre>
            )}
          </div>
        </div>
      </div>
    );
  };
  
  // Render score breakdown
  const headlineScore = daySeries?.peak?.score ?? paddleScore;
  const headlineTier = Number.isFinite(headlineScore) ? getTier(headlineScore) : null;
  const bestWindowText = formatWindow(daySeries?.window);
  const selectedEntry =
    daySeries?.hourly?.find((entry) => entry.hour === selectedHour) ?? daySeries?.peak ?? null;

  // Label and message must describe the score actually on screen, so both
  // read from the headline score rather than the legacy per-range one.
  const condition = Number.isFinite(headlineScore) && weatherData
    ? getCondition(headlineScore)
    : { label: "Loading", message: "Calculating conditions…", color: "text-gray-500" };

  // Get condition details for tooltip
  // Metric tiles follow the hour you have selected on the strip, so the
  // numbers beside the chart always describe the same moment it does.
  const breakdownMetrics = (() => {
    const b = selectedEntry?.breakdown;
    if (b) {
      const windShelter = 1 - toNumberOr(daySeries?.protection?.windProtection, 0);
      const waveShelter = 1 - toNumberOr(daySeries?.protection?.waveProtection, 0);
      const windProtected = toNumberOr(b.wind?.value, 0);
      const waveProtected = toNumberOr(b.waves?.value, 0);
      return {
        windRaw: windShelter > 0 ? windProtected / windShelter : windProtected,
        windProtected,
        waveRaw: waveShelter > 0 ? waveProtected / waveShelter : waveProtected,
        waveProtected,
        swellProtected: toNumberOr(b.swell?.value, 0),
        temperature: toNumberOr(b.temperature?.value, 0),
        waterTemperature: toNumberOr(b.waterTemperature?.value, null),
        precipitation: toNumberOr(b.precipitation?.value, 0),
        cloudCover: toNumberOr(b.cloudcover?.value, 0)
      };
    }
    if (!scoreBreakdown) return null;
    return {
      windRaw: toNumberOr(scoreBreakdown.windSpeed?.raw, 0),
      windProtected: toNumberOr(scoreBreakdown.windSpeed?.protected, 0),
      waveRaw: toNumberOr(scoreBreakdown.waveHeight?.raw, 0),
      waveProtected: toNumberOr(scoreBreakdown.waveHeight?.protected, 0),
      swellProtected: toNumberOr(scoreBreakdown.swellHeight?.protected, 0),
      temperature: toNumberOr(scoreBreakdown.temperature?.value, 0),
      waterTemperature: toNumberOr(scoreBreakdown.waterTemperature?.value, null),
      precipitation: toNumberOr(scoreBreakdown.precipitation?.value, 0),
      cloudCover: toNumberOr(scoreBreakdown.cloudCover?.value, 0)
    };
  })();

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
          <h2 className="flex items-center text-xl font-semibold sm:text-2xl">
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
      <div className="p-4 border-b bg-gray-50 dark:bg-slate-800 dark:border-slate-700">
        <h3 className="text-lg font-medium mb-4 dark:text-slate-100">Choose a day</h3>

        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 dark:text-slate-200 mb-2">Date</label>
          <div className="relative cursor-pointer" onClick={() => setShowDatePicker(true)}>
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Calendar className="h-5 w-5 text-gray-400 dark:text-slate-500" />
            </div>
            <input
              type="text"
              readOnly
              value={timeRange.date}
              className="w-full pl-10 p-3 bg-white dark:bg-slate-700 dark:text-slate-100 border dark:border-slate-600 rounded-lg cursor-pointer text-lg"
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
        
        <button 
          onClick={fetchWeatherData}
          className="w-full bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700 flex items-center justify-center text-lg"
        >
          <RefreshCw className="h-5 w-5 mr-2" />
          Refresh forecast
        </button>
      </div>
      
      {/* Loading state */}
      {loading && (
        <div className="p-8 text-center">
          <div className="inline-block animate-spin h-10 w-10 border-4 border-blue-500 border-t-transparent rounded-full mb-4"></div>
          <p className="text-gray-600 dark:text-slate-300">Loading real-time weather data...</p>
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
              {/* Score, window and the shape of the day */}
              <div className="md:w-1/3 flex flex-col gap-3">
                <div className="flex items-center gap-4 rounded-lg border bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-800">
                  <ScoreRing
                    score={headlineScore}
                    size={92}
                    caption="OF 100"
                    isDark={isDark}
                    numeralColor={isDark ? "#f1f5f9" : "#111827"}
                  />
                  <div className="flex min-w-0 flex-col gap-1">
                    <h3
                      className="text-2xl font-bold leading-tight"
                      style={{ color: headlineTier?.ink && (isDark ? headlineTier.darkInk : headlineTier.ink) }}
                    >
                      {condition.label}
                    </h3>
                    <p className="text-[13px] leading-snug text-gray-600 dark:text-slate-300">
                      {condition.message}
                    </p>
                    <p className="mt-1 text-[11px] text-gray-500 dark:text-slate-400">
                      Data quality {selectedEntry?.dataQuality ?? scoreBreakdown?.dataQuality ?? 100}%
                    </p>
                  </div>
                </div>

                <div
                  className={`flex items-center gap-3 rounded-lg border p-3 ${
                    bestWindowText
                      ? "border-green-200 bg-green-50 dark:border-green-900 dark:bg-green-900/20"
                      : "border-red-200 bg-red-50 dark:border-red-900 dark:bg-red-900/20"
                  }`}
                >
                  <Sunrise
                    className={`h-5 w-5 flex-shrink-0 ${
                      bestWindowText ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"
                    }`}
                    aria-hidden
                  />
                  <div className="flex flex-col gap-0.5">
                    <span
                      className={`text-sm font-bold ${
                        bestWindowText ? "text-green-700 dark:text-green-300" : "text-red-700 dark:text-red-300"
                      }`}
                    >
                      {bestWindowText ? `Go between ${bestWindowText}` : "No usable window today"}
                    </span>
                    <span
                      className={`text-[11px] ${
                        bestWindowText ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"
                      }`}
                    >
                      {daySeries?.peak
                        ? `Glassiest at ${formatHour(daySeries.peak.hour)}${
                            daySeries.window ? ` · ${daySeries.window.length} usable hours` : ""
                          }`
                        : "Building the hourly outlook…"}
                    </span>
                  </div>
                </div>
              </div>

              {/* Weather Factors - RIGHT SIDE */}
              <div className="md:w-2/3">
                <div className="grid grid-cols-2 gap-3">
                  {breakdownMetrics ? (
                    <>
                      <div className="bg-white dark:bg-slate-800 rounded-lg p-3 border dark:border-slate-700 flex items-center shadow-sm">
                        <Wind className="h-6 w-6 mr-3 text-blue-600" />
                        <div className="flex-grow">
                          <div className="text-sm text-gray-500 dark:text-slate-400">Wind</div>
                          <div className={`text-lg font-medium ${
                            breakdownMetrics.windProtected < 8
                              ? 'text-green-600'
                              : breakdownMetrics.windProtected < 15
                                ? 'text-yellow-600'
                                : 'text-red-600'
                          }`}>
                            {Math.round(breakdownMetrics.windRaw)} km/h
                            <span className="text-xs ml-2 text-gray-500 dark:text-slate-400">
                              (Protected: {Math.round(breakdownMetrics.windProtected)} km/h)
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="bg-white dark:bg-slate-800 rounded-lg p-3 border dark:border-slate-700 flex items-center shadow-sm">
                        <Waves className="h-6 w-6 mr-3 text-blue-600" />
                        <div className="flex-grow">
                          <div className="text-sm text-gray-500 dark:text-slate-400">Wave Height</div>
                          <div className={`text-lg font-medium ${
                            breakdownMetrics.waveProtected < 0.2
                              ? 'text-green-600'
                              : breakdownMetrics.waveProtected < 0.4
                                ? 'text-yellow-600'
                                : 'text-red-600'
                          }`}>
                            {breakdownMetrics.waveRaw.toFixed(2)} m
                            <span className="text-xs ml-2 text-gray-500 dark:text-slate-400">
                              (Protected: {breakdownMetrics.waveProtected.toFixed(2)} m)
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="bg-white dark:bg-slate-800 rounded-lg p-3 border dark:border-slate-700 flex items-center shadow-sm">
                        <Thermometer className="h-6 w-6 mr-3 text-orange-500" />
                        <div className="flex-grow">
                          <div className="text-sm text-gray-500 dark:text-slate-400">Air Temp</div>
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

                      <div className="bg-white dark:bg-slate-800 rounded-lg p-3 border dark:border-slate-700 flex items-center shadow-sm">
                        <Waves className="h-6 w-6 mr-3 text-cyan-500" />
                        <div className="flex-grow">
                          <div className="text-sm text-gray-500 dark:text-slate-400">Water Temp</div>
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

                      <div className="bg-white dark:bg-slate-800 rounded-lg p-3 border dark:border-slate-700 flex items-center shadow-sm">
                        <Droplets className="h-6 w-6 mr-3 text-blue-600" />
                        <div className="flex-grow">
                          <div className="text-sm text-gray-500 dark:text-slate-400">Precipitation</div>
                          <div className={`text-lg font-medium ${
                            breakdownMetrics.precipitation < 1 ? 'text-green-600' : 'text-red-600'
                          }`}>
                            {breakdownMetrics.precipitation.toFixed(1)} mm
                          </div>
                          <div className="mt-1 text-xs text-gray-500 dark:text-slate-400">
                            Cloud cover {Math.round(breakdownMetrics.cloudCover)}%
                          </div>
                        </div>
                      </div>
                    </>
                  ) : (
                    <div className="col-span-2 rounded-lg border border-dashed border-blue-200 dark:border-slate-600 p-4 text-sm text-gray-500 dark:text-slate-400">
                      Forecast metrics will appear once weather data loads.
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {daySeries?.hourly?.length > 0 && (
            <div className="mb-6 rounded-lg border bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-800">
              <div className="mb-3 flex items-end gap-3">
                <div className="flex flex-grow flex-col gap-0.5">
                  <span className="text-[10px] font-bold uppercase tracking-[0.1em] text-gray-400 dark:text-slate-500">
                    Hour by hour · tap to scrub
                  </span>
                  <div className="flex items-baseline gap-2">
                    <span className="text-xl font-bold tabular-nums text-gray-900 dark:text-slate-100">
                      {selectedEntry ? formatHour(selectedEntry.hour) : "–"}
                    </span>
                    <span
                      className="text-sm font-semibold"
                      style={{ color: selectedEntry ? tierInk(selectedEntry.score, isDark) : undefined }}
                    >
                      {selectedEntry ? getTier(selectedEntry.score).label : ""}
                    </span>
                  </div>
                </div>
                <div className="flex items-baseline gap-1">
                  <span
                    className="text-2xl font-bold tabular-nums"
                    style={{ color: selectedEntry ? tierInk(selectedEntry.score, isDark) : undefined }}
                  >
                    {selectedEntry?.score ?? "–"}
                  </span>
                  <span className="text-xs font-semibold text-gray-400 dark:text-slate-500">/100</span>
                </div>
              </div>

              <HourStrip
                hourly={daySeries.hourly}
                selectedHour={selectedHour}
                onSelectHour={setSelectedHour}
                window={daySeries.window}
                isDark={isDark}
                height={104}
              />
            </div>
          )}

          {/* Safety alert */}
          {scoreBreakdown && scoreBreakdown.windSpeed.raw > 30 && (
            <div className="bg-red-50 p-4 rounded-lg border border-red-200 mb-6">
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
          {selectedEntry?.breakdown && (
            <div className="mb-6 rounded-lg border bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-800">
              <h4 className="mb-1 flex items-center font-medium text-gray-800 dark:text-slate-100">
                <Info className="mr-2 h-5 w-5 text-blue-600" />
                How this score was built
              </h4>
              <p className="mb-4 text-sm text-gray-600 dark:text-slate-300">
                Conditions at {formatHour(selectedEntry.hour)}. Track length is the factor's
                share of the score, so the biggest levers read first.
              </p>
              <FactorBars breakdown={selectedEntry.breakdown} protection={daySeries?.protection} />
            </div>
          )}
          
          {/* Geographic Protection */}
          {renderGeoProtectionInfo()}
          
          
          <div className="text-center mt-6">
            <p className="text-sm text-gray-600 dark:text-slate-400">
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

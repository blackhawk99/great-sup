// FixedBeachView.jsx - Production-ready with all required features
import React, { useState, useEffect } from "react";
import { Home, ChevronLeft, RefreshCw, AlertCircle, MapPin, Map, Wind, Thermometer, Droplets, Waves, Clock, Calendar, Info } from "lucide-react";
import { calculateGeographicProtection } from "./utils/coastlineAnalysis";
import { getCardinalDirection } from "./helpers.js";

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
      const protection = await calculateGeographicProtection(
        beach,
        avgWindDir,
        waveDirection,
        new Date(timeRange.date)
      );
      setGeoProtection(protection);
      
      // Apply protection factors
      const protectedWindSpeed = avgWind * (1 - (protection.windProtection * 0.9));
      const protectedWaveHeight = waveHeight * (1 - (protection.waveProtection * 0.9));
      const protectedSwellHeight = avgSwellHeight * (1 - (protection.waveProtection * 0.85));
      
      // Initialize score breakdown
      const breakdown = {
        windSpeed: { raw: avgWind, protected: protectedWindSpeed, score: 0, maxPossible: 40 },
        waveHeight: { raw: waveHeight, protected: protectedWaveHeight, score: 0, maxPossible: 20 },
        swellHeight: { raw: avgSwellHeight, protected: protectedSwellHeight, score: 0, maxPossible: 10 },
        precipitation: { value: maxPrecip, score: 0, maxPossible: 10 },
        temperature: { value: avgTemp, score: 0, maxPossible: 10 },
        cloudCover: { value: avgCloud, score: 0, maxPossible: 10 },
        geoProtection: { value: protection.protectionScore, score: 0, maxPossible: 15 },
        total: { score: 0, rawScore: 0, bonus: 0, maxPossible: 100 }
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
      breakdown.windSpeed.score = Math.round(breakdown.windSpeed.score);
      breakdown.waveHeight.score = Math.round(breakdown.waveHeight.score);
      breakdown.swellHeight.score = Math.round(breakdown.swellHeight.score);
      breakdown.precipitation.score = Math.round(breakdown.precipitation.score);
      breakdown.temperature.score = Math.round(breakdown.temperature.score);
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
  
  // Get condition text based on score and actual conditions
  const getCondition = (score) => {
    if (!scoreBreakdown || !weatherData) return { label: "Loading", emoji: "⏳", message: "Calculating conditions...", color: "text-gray-500" };
    
    // Extract key metrics
    const temp = weatherData.hourly.temperature_2m[12]; // Midday temperature
    const windSpeed = scoreBreakdown.windSpeed.protected;
    const precipitation = weatherData.hourly.precipitation[12]; // Midday precipitation
    
    // Base conditions on score
    if (score >= 85) {
      // Perfect score, but check for non-perfect conditions
      if (temp < 18) {
        return {
          label: "Chilly but Calm",
          emoji: "🧊",
          message: "Great conditions, but bring a wetsuit.",
          color: "text-blue-500"
        };
      } else if (precipitation >= 0.5) {
        return {
          label: "Calm but Wet",
          emoji: "🌧️",
          message: "Light rain, but excellent water conditions.",
          color: "text-blue-500"
        };
      } else if (windSpeed > 15) {
        return {
          label: "Excellent",
          emoji: "✅",
          message: "Some wind, but well-protected location.",
          color: "text-green-500"
        };
      } else {
        return {
          label: "Perfect",
          emoji: "✅",
          message: "Flat like oil. Paddle on.",
          color: "text-green-500"
        };
      }
    } else if (score >= 70) {
      return {
        label: "Okay-ish",
        emoji: "⚠️",
        message: "Minor chop. Go early.",
        color: "text-yellow-500"
      };
    } else if (score >= 50) {
      return {
        label: "Not Great",
        emoji: "❌",
        message: "Wind or waves make it tricky.",
        color: "text-orange-500" 
      };
    } else {
      return { 
        label: "Nope", 
        emoji: "🚫", 
        message: "Not recommended.",
        color: "text-red-500"
      };
    }
  };
  
  // Generate condition details tooltip content
  const getConditionDetails = () => {
    if (!scoreBreakdown || !weatherData) return "";
    
    const temp = weatherData.hourly.temperature_2m[12]; // Midday temperature
    const windSpeed = scoreBreakdown.windSpeed.protected;
    const precipitation = weatherData.hourly.precipitation[12]; // Midday precipitation
    const cloudCover = weatherData.hourly.cloudcover[12]; // Midday cloud cover
    
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
    
    // Calculate the bonus points added to score from geographic protection
    const geoBonus = Math.round((geoProtection.protectionScore / 100) * 15);
    const avgWindDirection = weatherData?.hourly?.winddirection_10m?.[12] || 0;
    
    return (
      <div className="bg-blue-50 p-5 rounded-lg mt-4 border border-blue-200 shadow-inner">
        <h4 className="font-medium mb-4 text-lg flex items-center text-blue-800">
          <MapPin className="h-5 w-5 mr-2 text-blue-600" />
          Geographic Protection Analysis
          <button
            onClick={() => setShowDebug(!showDebug)}
            className="ml-auto text-xs text-blue-600 underline"
          >
            {showDebug ? 'Hide debug' : 'Show debug'}
          </button>
        </h4>
        
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
    );
  };
  
  // Render score breakdown
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
              <tr>
                <td className="px-4 py-2 whitespace-nowrap text-sm font-medium text-gray-700">Wind Speed</td>
                <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-500 text-right">
                  {scoreBreakdown.windSpeed.raw.toFixed(1)} km/h 
                  <span className="text-xs text-gray-400 ml-1">
                    (Protected: {scoreBreakdown.windSpeed.protected.toFixed(1)})
                  </span>
                </td>
                <td className={`px-4 py-2 whitespace-nowrap text-sm font-medium text-right ${
                  scoreBreakdown.windSpeed.score > 30 ? 'text-green-600' : 
                  scoreBreakdown.windSpeed.score > 20 ? 'text-yellow-600' : 'text-red-600'
                }`}>
                  {scoreBreakdown.windSpeed.score}/{scoreBreakdown.windSpeed.maxPossible}
                </td>
              </tr>
              <tr>
                <td className="px-4 py-2 whitespace-nowrap text-sm font-medium text-gray-700">Wave Height</td>
                <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-500 text-right">
                  {scoreBreakdown.waveHeight.raw.toFixed(2)} m
                  <span className="text-xs text-gray-400 ml-1">
                    (Protected: {scoreBreakdown.waveHeight.protected.toFixed(2)})
                  </span>
                </td>
                <td className={`px-4 py-2 whitespace-nowrap text-sm font-medium text-right ${
                  scoreBreakdown.waveHeight.score > 15 ? 'text-green-600' : 
                  scoreBreakdown.waveHeight.score > 10 ? 'text-yellow-600' : 'text-red-600'
                }`}>
                  {scoreBreakdown.waveHeight.score}/{scoreBreakdown.waveHeight.maxPossible}
                </td>
              </tr>
              <tr>
                <td className="px-4 py-2 whitespace-nowrap text-sm font-medium text-gray-700">Swell Height</td>
                <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-500 text-right">
                  {scoreBreakdown.swellHeight.raw.toFixed(2)} m
                </td>
                <td className={`px-4 py-2 whitespace-nowrap text-sm font-medium text-right ${
                  scoreBreakdown.swellHeight.score > 7 ? 'text-green-600' : 
                  scoreBreakdown.swellHeight.score > 5 ? 'text-yellow-600' : 'text-red-600'
                }`}>
                  {scoreBreakdown.swellHeight.score}/{scoreBreakdown.swellHeight.maxPossible}
                </td>
              </tr>
              <tr>
                <td className="px-4 py-2 whitespace-nowrap text-sm font-medium text-gray-700">Precipitation</td>
                <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-500 text-right">
                  {scoreBreakdown.precipitation.value.toFixed(1)} mm
                </td>
                <td className={`px-4 py-2 whitespace-nowrap text-sm font-medium text-right ${
                  scoreBreakdown.precipitation.value < 1 ? 'text-green-600' : 'text-red-600'
                }`}>
                  {scoreBreakdown.precipitation.score}/{scoreBreakdown.precipitation.maxPossible}
                </td>
              </tr>
              <tr>
                <td className="px-4 py-2 whitespace-nowrap text-sm font-medium text-gray-700">Temperature</td>
                <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-500 text-right">
                  {scoreBreakdown.temperature.value.toFixed(1)} °C
                </td>
                <td className={`px-4 py-2 whitespace-nowrap text-sm font-medium text-right ${
                  scoreBreakdown.temperature.score > 7 ? 'text-green-600' : 'text-yellow-600'
                }`}>
                  {scoreBreakdown.temperature.score}/{scoreBreakdown.temperature.maxPossible}
                </td>
              </tr>
              <tr>
                <td className="px-4 py-2 whitespace-nowrap text-sm font-medium text-gray-700">Cloud Cover</td>
                <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-500 text-right">
                  {scoreBreakdown.cloudCover.value.toFixed(0)}%
                </td>
                <td className={`px-4 py-2 whitespace-nowrap text-sm font-medium text-right ${
                  scoreBreakdown.cloudCover.score > 7 ? 'text-green-600' : 
                  scoreBreakdown.cloudCover.score > 5 ? 'text-yellow-600' : 'text-gray-600'
                }`}>
                  {scoreBreakdown.cloudCover.score}/{scoreBreakdown.cloudCover.maxPossible}
                </td>
              </tr>
              <tr>
                <td className="px-4 py-2 whitespace-nowrap text-sm font-medium text-gray-700">Geographic Protection</td>
                <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-500 text-right">
                  {scoreBreakdown.geoProtection.value.toFixed(0)}/100
                </td>
                <td className={`px-4 py-2 whitespace-nowrap text-sm font-medium text-right ${
                  scoreBreakdown.geoProtection.score > 10 ? 'text-green-600' : 
                  scoreBreakdown.geoProtection.score > 5 ? 'text-yellow-600' : 'text-red-600'
                }`}>
                  {scoreBreakdown.geoProtection.score}/{scoreBreakdown.geoProtection.maxPossible}
                </td>
              </tr>
              <tr className="bg-blue-50">
                <td className="px-4 py-3 whitespace-nowrap text-sm font-bold text-gray-900">
                  TOTAL SCORE
                </td>
                <td className="px-4 py-3 whitespace-nowrap"></td>
                <td className={`px-4 py-3 whitespace-nowrap text-sm font-bold text-right ${
                  scoreBreakdown.total.score >= 85 ? 'text-green-600' :
                  scoreBreakdown.total.score >= 70 ? 'text-yellow-600' :
                  scoreBreakdown.total.score >= 50 ? 'text-orange-600' : 'text-red-600'
                }`}>
                  {scoreBreakdown.total.score}/{scoreBreakdown.total.maxPossible}
                  {scoreBreakdown.total.rawScore > scoreBreakdown.total.maxPossible && (
                    <span className="text-xs text-gray-500 ml-1">
                      (raw {scoreBreakdown.total.rawScore})
                    </span>
                  )}
                </td>
              </tr>
            </tbody>
          </table>
          <p className="text-xs text-gray-500 mt-2 px-4">
            Scores above 100 are capped. Geographic protection can add up to 15 bonus points.
          </p>
        </div>
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

  return (
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
          <div className="flex items-center mt-1">
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
            >
              <Home className="h-4 w-4 mr-1" /> Set as Home
            </button>
          )}
          <button
            onClick={() => setView?.("dashboard")}
            className="bg-gray-200 text-gray-800 px-3 py-1 rounded-lg hover:bg-gray-300 transition-colors flex items-center"
          >
            <ChevronLeft className="h-4 w-4 mr-1" /> Back
          </button>
        </div>
      </div>

      {/* Time range selector */}
      <div className="p-4 border-b bg-gray-50">
        <h3 className="text-lg font-medium mb-4">Choose Date & Time Window</h3>
        
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-2">Date</label>
          <div className="relative cursor-pointer">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Calendar className="h-5 w-5 text-gray-400" />
            </div>
            <input
              type="date"
              value={timeRange.date}
              onChange={(e) => onTimeRangeChange?.('date', e.target.value)}
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
                <div className="mt-1 text-xs text-gray-500">
                  Using real-time weather data
                </div>
              </div>
              
              {/* Weather Factors - RIGHT SIDE */}
              <div className="md:w-2/3">
                <div className="grid grid-cols-2 gap-3">
                  {weatherData.hourly && (
                    <div className="bg-white rounded-lg p-3 border flex items-center shadow-sm">
                      <Wind className="h-6 w-6 mr-3 text-blue-600" />
                      <div className="flex-grow">
                        <div className="text-sm text-gray-500">Wind</div>
                        <div className={`text-lg font-medium ${
                          weatherData.hourly.windspeed_10m[12] < 8
                            ? "text-green-600"
                            : weatherData.hourly.windspeed_10m[12] < 15
                            ? "text-yellow-600"
                            : "text-red-600"
                        }`}>
                          {Math.round(weatherData.hourly.windspeed_10m[12])} km/h
                          {scoreBreakdown && scoreBreakdown.windSpeed && (
                            <span className="text-xs ml-2 text-gray-500">
                              (Protected: {Math.round(scoreBreakdown.windSpeed.protected)} km/h)
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  )}
                  
                  {marineData.daily && (
                    <div className="bg-white rounded-lg p-3 border flex items-center shadow-sm">
                      <Waves className="h-6 w-6 mr-3 text-blue-600" />
                      <div className="flex-grow">
                        <div className="text-sm text-gray-500">Wave Height</div>
                        <div className={`text-lg font-medium ${
                          marineData.daily.wave_height_max[0] < 0.2
                            ? "text-green-600"
                            : marineData.daily.wave_height_max[0] < 0.4
                            ? "text-yellow-600"
                            : "text-red-600"
                        }`}>
                          {marineData.daily.wave_height_max[0].toFixed(1)} m
                          {scoreBreakdown && scoreBreakdown.waveHeight && (
                            <span className="text-xs ml-2 text-gray-500">
                              (Protected: {scoreBreakdown.waveHeight.protected.toFixed(2)} m)
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  )}
                  
                  {weatherData.hourly && (
                    <div className="bg-white rounded-lg p-3 border flex items-center shadow-sm">
                      <Thermometer className="h-6 w-6 mr-3 text-blue-600" />
                      <div className="flex-grow">
                        <div className="text-sm text-gray-500">Temperature</div>
                        <div className={`text-lg font-medium ${
                          weatherData.hourly.temperature_2m[12] >= 22 &&
                          weatherData.hourly.temperature_2m[12] <= 30
                            ? "text-green-600"
                            : weatherData.hourly.temperature_2m[12] >= 18
                            ? "text-yellow-600"
                            : "text-blue-600"
                        }`}>
                          {Math.round(weatherData.hourly.temperature_2m[12])}°C
                        </div>
                      </div>
                    </div>
                  )}
                  
                  {weatherData.hourly && (
                    <div className="bg-white rounded-lg p-3 border flex items-center shadow-sm">
                      <Droplets className="h-6 w-6 mr-3 text-blue-600" />
                      <div className="flex-grow">
                        <div className="text-sm text-gray-500">Precipitation</div>
                        <div className={`text-lg font-medium ${
                          weatherData.hourly.precipitation[12] < 1
                            ? "text-green-600"
                            : "text-red-600"
                        }`}>
                          {weatherData.hourly.precipitation[12].toFixed(1)} mm
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
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
  );
};

export default FixedBeachView;

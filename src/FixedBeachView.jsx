// FixedBeachView.jsx - SAFE, FULL VERSION - Score Normalization & All Blanks Handled

import React, { useState, useEffect } from "react";
import {
  Home, ChevronLeft, RefreshCw, AlertCircle, MapPin, Map, Wind,
  Thermometer, Droplets, Waves, Clock, Calendar, Info
} from "lucide-react";
import { calculateGeographicProtection } from "./utils/coastlineAnalysis";
import { getCardinalDirection } from "./helpers";

// ----- CONSTANTS -----
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

// ----- COMPONENT -----
const FixedBeachView = ({
  beach,
  homeBeach,
  onSetHomeBeach,
  setView,
  onDataUpdate,
  timeRange,
  onTimeRangeChange,
}) => {
  const [weatherData, setWeatherData] = useState(null);
  const [marineData, setMarineData] = useState(null);
  const [paddleScore, setPaddleScore] = useState(null);
  const [scoreBreakdown, setScoreBreakdown] = useState(null);
  const [geoProtection, setGeoProtection] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Data load
  useEffect(() => {
    if (beach) fetchWeatherData();
    // eslint-disable-next-line
  }, [beach?.id, timeRange?.date]);

  // API fetch logic
  const fetchWeatherData = async () => {
    if (!beach) return;
    setLoading(true);
    setError(null);

    try {
      const today = new Date(timeRange?.date || Date.now());
      const formattedDate = today.toISOString().split("T")[0];
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);
      const formattedTomorrow = tomorrow.toISOString().split("T")[0];

      const weatherUrl = `https://api.open-meteo.com/v1/forecast?latitude=${beach.latitude}&longitude=${beach.longitude}&hourly=temperature_2m,precipitation,cloudcover,windspeed_10m,winddirection_10m&daily=precipitation_sum,windspeed_10m_max&start_date=${formattedDate}&end_date=${formattedTomorrow}&timezone=auto`;
      const marineUrl = `https://marine-api.open-meteo.com/v1/marine?latitude=${beach.latitude}&longitude=${beach.longitude}&hourly=wave_height,swell_wave_height,wave_direction&daily=wave_height_max,wave_direction_dominant&start_date=${formattedDate}&end_date=${formattedTomorrow}&timezone=auto`;

      const [weatherRes, marineRes] = await Promise.all([fetch(weatherUrl), fetch(marineUrl)]);
      if (!weatherRes.ok) throw new Error(`Weather API error: ${weatherRes.status}`);
      if (!marineRes.ok) throw new Error(`Marine API error: ${marineRes.status}`);

      const weatherData = await weatherRes.json();
      const marineData = await marineRes.json();

      setWeatherData(weatherData);
      setMarineData(marineData);

      await calculateScores(weatherData, marineData, beach);

      if (typeof onDataUpdate === "function") onDataUpdate();
    } catch (err) {
      setError(err.message || "Failed to fetch weather data");
      setWeatherData(null);
      setMarineData(null);
      setScoreBreakdown(null);
      setGeoProtection(null);
      setPaddleScore(null);
    } finally {
      setLoading(false);
    }
  };

  // Score calculation
  const calculateScores = async (weather, marine, beach) => {
    try {
      const startHour = parseInt(timeRange.startTime.split(":")[0], 10);
      const endHour = parseInt(timeRange.endTime.split(":")[0], 10);

      // Defensive
      if (!weather?.hourly?.time?.length || !marine?.hourly?.wave_height) throw new Error("No data found for date");

      // Find relevant indices
      const relevantIndices = [];
      for (let i = 0; i < weather.hourly.time.length; i++) {
        const time = new Date(weather.hourly.time[i]);
        if (time.getHours() >= startHour && time.getHours() <= endHour) relevantIndices.push(i);
      }
      if (relevantIndices.length === 0) relevantIndices.push(12); // fallback: midday

      // Calculate averages
      const safeAvg = (arr) =>
        arr && arr.length
          ? arr.reduce((sum, v) => sum + (v || 0), 0) / arr.length
          : 0;

      const avgTemp = safeAvg(relevantIndices.map(i => weather.hourly.temperature_2m?.[i] ?? 0));
      const avgWind = safeAvg(relevantIndices.map(i => weather.hourly.windspeed_10m?.[i] ?? 0));
      const avgCloud = safeAvg(relevantIndices.map(i => weather.hourly.cloudcover?.[i] ?? 0));
      const maxPrecip = Math.max(...relevantIndices.map(i => weather.hourly.precipitation?.[i] ?? 0));
      const avgWindDir = safeAvg(relevantIndices.map(i => weather.hourly.winddirection_10m?.[i] ?? 0));
      const waveHeight = marine?.daily?.wave_height_max?.[0] ?? 0;
      const avgSwellHeight = safeAvg(relevantIndices.map(i => marine.hourly.swell_wave_height?.[i] ?? 0));
      const waveDirection = marine?.daily?.wave_direction_dominant?.[0] ?? 0;

      // Geo protection
      const protection = await calculateGeographicProtection(beach, avgWindDir, waveDirection);
      setGeoProtection(protection);

      // Apply protection
      const protectedWindSpeed = avgWind * (1 - (protection.windProtection * 0.9));
      const protectedWaveHeight = waveHeight * (1 - (protection.waveProtection * 0.9));
      const protectedSwellHeight = avgSwellHeight * (1 - (protection.waveProtection * 0.85));

      // Score breakdown
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

      // Calculate scores
      let totalScore = 0;
      breakdown.windSpeed.score = protectedWindSpeed < 8 ? 40 : Math.max(0, 40 - (protectedWindSpeed - 8) * (40 / 12));
      breakdown.waveHeight.score = protectedWaveHeight < 0.2 ? 20 : Math.max(0, 20 - (protectedWaveHeight - 0.2) * (20 / 0.4));
      breakdown.swellHeight.score = protectedSwellHeight < 0.3 ? 10 : Math.max(0, 10 - (protectedSwellHeight - 0.3) * (10 / 0.3));
      breakdown.precipitation.score = maxPrecip < 1 ? 10 : 0;
      if (avgTemp >= 22 && avgTemp <= 30) breakdown.temperature.score = 10;
      else if (avgTemp < 22) breakdown.temperature.score = Math.max(0, 10 - (22 - avgTemp));
      else breakdown.temperature.score = Math.max(0, 10 - (avgTemp - 30));
      breakdown.cloudCover.score = avgCloud < 40 ? 10 : Math.max(0, 10 - (avgCloud - 40) / 6);
      breakdown.geoProtection.score = (protection.protectionScore / 100) * 15;

      // Sum
      ["windSpeed", "waveHeight", "swellHeight", "precipitation", "temperature", "cloudCover", "geoProtection"].forEach(k => {
        breakdown[k].score = Math.round(breakdown[k].score);
        totalScore += breakdown[k].score;
      });

      // Precip penalty
      if (maxPrecip >= 1.5) {
        breakdown.precipitation.score = 0;
        totalScore = Math.min(totalScore, 40);
      }

      // Final total/normalized
      breakdown.total.rawScore = Math.round(totalScore);
      breakdown.total.normalized = Math.round((totalScore / TOTAL_MAX_SCORE) * 100);

      setPaddleScore(breakdown.total.normalized);
      setScoreBreakdown(breakdown);
    } catch (err) {
      setScoreBreakdown(null);
      setPaddleScore(null);
      setGeoProtection(null);
      setError("Could not calculate scores: " + (err.message || err));
    }
  };

  // Display condition
  const getCondition = (score) => {
    if (!scoreBreakdown || !weatherData) return { label: "Loading", emoji: "⏳", message: "Calculating...", color: "text-gray-500" };
    if (score >= 85) return { label: "Perfect", emoji: "✅", message: "Flat like oil. Paddle on.", color: "text-green-600" };
    if (score >= 70) return { label: "Okay-ish", emoji: "⚠️", message: "Minor chop. Go early.", color: "text-yellow-600" };
    if (score >= 50) return { label: "Not Great", emoji: "❌", message: "Wind or waves make it tricky.", color: "text-orange-600" };
    return { label: "Nope", emoji: "🚫", message: "Not recommended.", color: "text-red-600" };
  };

  // Main render
  return (
    <div className="bg-white rounded-lg shadow-lg overflow-hidden">
      {/* --- HEADER --- */}
      <div className="p-4 border-b flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-semibold flex items-center">
            {beach?.id === homeBeach?.id && <Home className="h-5 w-5 text-orange-500 mr-2" />}
            {beach?.name || "Beach"}
          </h2>
          <div className="flex items-center mt-1">
            <p className="text-gray-600 mr-3">
              {beach ? `${beach.latitude?.toFixed(4)}, ${beach.longitude?.toFixed(4)}` : ""}
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
          {beach && homeBeach && beach.id !== homeBeach.id && (
            <button
              onClick={() => onSetHomeBeach?.(beach)}
              className="bg-orange-500 text-white px-3 py-1 rounded-lg hover:bg-orange-600 flex items-center"
            >
              <Home className="h-4 w-4 mr-1" /> Set as Home
            </button>
          )}
          <button
            onClick={() => setView?.("dashboard")}
            className="bg-gray-200 text-gray-800 px-3 py-1 rounded-lg hover:bg-gray-300 flex items-center"
          >
            <ChevronLeft className="h-4 w-4 mr-1" /> Back
          </button>
        </div>
      </div>

      {/* --- TIME RANGE SELECTOR --- */}
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
              value={timeRange?.date || ""}
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
            <label className="block text-sm font-medium text-gray-700 mb-2">Start Time</label>
            <select
              value={timeRange?.startTime || "09:00"}
              onChange={(e) => onTimeRangeChange?.('startTime', e.target.value)}
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
            <label className="block text-sm font-medium text-gray-700 mb-2">End Time</label>
            <select
              value={timeRange?.endTime || "13:00"}
              onChange={(e) => onTimeRangeChange?.('endTime', e.target.value)}
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
          Update Forecast
        </button>
      </div>

      {/* --- LOADING STATE --- */}
      {loading && (
        <div className="p-8 text-center">
          <div className="inline-block animate-spin h-10 w-10 border-4 border-blue-500 border-t-transparent rounded-full mb-4"></div>
          <p className="text-gray-600">Loading real-time weather data...</p>
        </div>
      )}

      {/* --- ERROR STATE --- */}
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

      {/* --- WEATHER DATA WITH SCORE --- */}
      {weatherData && marineData && !loading && !error && (
        <div className="p-6">
          {/* Score card */}
          {paddleScore !== null && scoreBreakdown && (
            <div className="flex flex-col md:flex-row gap-6 mb-6">
              <div className="md:w-1/3 bg-white rounded-lg shadow-md p-6 text-center flex flex-col justify-center relative">
                <div className={`text-6xl mb-3 ${getCondition(paddleScore).color}`}>
                  {getCondition(paddleScore).emoji}
                </div>
                <h3 className="text-3xl font-bold mb-2 flex items-center justify-center">
                  {getCondition(paddleScore).label}
                </h3>
                <p className="text-gray-600 text-lg mb-4">{getCondition(paddleScore).message}</p>
                <div className="mt-2 bg-gray-100 rounded-full h-5 overflow-hidden">
                  <div className={`h-full ${getCondition(paddleScore).color}`} style={{ width: `${paddleScore}%` }} />
                </div>
                <p className="mt-2 text-lg font-medium text-gray-700">
                  Score: {scoreBreakdown.total.normalized}/100
                  <span className="text-xs text-gray-500 ml-2">
                    ({scoreBreakdown.total.rawScore}/{scoreBreakdown.total.maxPossible})
                  </span>
                </p>
                <div className="mt-1 text-xs text-gray-500">Using real-time weather data</div>
              </div>
              {/* (Optionally show quick weather metrics here as before) */}
            </div>
          )}

          {/* --- SCORE BREAKDOWN TABLE --- */}
          {scoreBreakdown && (
            <div className="bg-white p-5 rounded-lg mt-4 shadow-sm border">
              <h4 className="font-medium mb-4 flex items-center text-gray-800">
                <Info className="h-5 w-5 mr-2 text-blue-600" /> Score Breakdown
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
                      <td className="px-4 py-2">Wind Speed</td>
                      <td className="px-4 py-2 text-right">{scoreBreakdown.windSpeed.raw.toFixed(1)} km/h <span className="text-xs text-gray-400 ml-1">(Protected: {scoreBreakdown.windSpeed.protected.toFixed(1)})</span></td>
                      <td className="px-4 py-2 text-right">{scoreBreakdown.windSpeed.score}/{scoreBreakdown.windSpeed.maxPossible}</td>
                    </tr>
                    <tr>
                      <td className="px-4 py-2">Wave Height</td>
                      <td className="px-4 py-2 text-right">{scoreBreakdown.waveHeight.raw.toFixed(2)} m <span className="text-xs text-gray-400 ml-1">(Protected: {scoreBreakdown.waveHeight.protected.toFixed(2)})</span></td>
                      <td className="px-4 py-2 text-right">{scoreBreakdown.waveHeight.score}/{scoreBreakdown.waveHeight.maxPossible}</td>
                    </tr>
                    <tr>
                      <td className="px-4 py-2">Swell Height</td>
                      <td className="px-4 py-2 text-right">{scoreBreakdown.swellHeight.raw.toFixed(2)} m</td>
                      <td className="px-4 py-2 text-right">{scoreBreakdown.swellHeight.score}/{scoreBreakdown.swellHeight.maxPossible}</td>
                    </tr>
                    <tr>
                      <td className="px-4 py-2">Precipitation</td>
                      <td className="px-4 py-2 text-right">{scoreBreakdown.precipitation.value.toFixed(1)} mm</td>
                      <td className="px-4 py-2 text-right">{scoreBreakdown.precipitation.score}/{scoreBreakdown.precipitation.maxPossible}</td>
                    </tr>
                    <tr>
                      <td className="px-4 py-2">Temperature</td>
                      <td className="px-4 py-2 text-right">{scoreBreakdown.temperature.value.toFixed(1)} °C</td>
                      <td className="px-4 py-2 text-right">{scoreBreakdown.temperature.score}/{scoreBreakdown.temperature.maxPossible}</td>
                    </tr>
                    <tr>
                      <td className="px-4 py-2">Cloud Cover</td>
                      <td className="px-4 py-2 text-right">{scoreBreakdown.cloudCover.value.toFixed(0)}%</td>
                      <td className="px-4 py-2 text-right">{scoreBreakdown.cloudCover.score}/{scoreBreakdown.cloudCover.maxPossible}</td>
                    </tr>
                    <tr>
                      <td className="px-4 py-2">Geographic Protection</td>
                      <td className="px-4 py-2 text-right">{scoreBreakdown.geoProtection.value.toFixed(0)}/100</td>
                      <td className="px-4 py-2 text-right">{scoreBreakdown.geoProtection.score}/{scoreBreakdown.geoProtection.maxPossible}</td>
                    </tr>
                    <tr className="bg-blue-50">
                      <td className="px-4 py-3 font-bold">TOTAL SCORE</td>
                      <td className="px-4 py-3"></td>
                      <td className="px-4 py-3 text-right font-bold">
                        {scoreBreakdown.total.rawScore}/{scoreBreakdown.total.maxPossible}
                        <span className="ml-2 text-xs text-gray-500">(Normalized: {scoreBreakdown.total.normalized}/100)</span>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          )}
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

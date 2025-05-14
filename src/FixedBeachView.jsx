import React, { useState, useEffect } from "react";
import {
  Home, ChevronLeft, RefreshCw, AlertCircle, MapPin, Map,
  Wind, Thermometer, Droplets, Waves, Calendar, Clock, Info
} from "lucide-react";
import { calculateGeographicProtection } from "./utils/coastlineAnalysis";
import { getCardinalDirection } from "./helpers";

const UNSAFE_WIND = 15; // km/h

const FixedBeachView = ({
  beach, homeBeach, onSetHomeBeach, setView,
  onDataUpdate, timeRange, onTimeRangeChange
}) => {
  const [weatherData, setWeatherData] = useState(null);
  const [marineData, setMarineData] = useState(null);
  const [scoreBreakdown, setScoreBreakdown] = useState(null);
  const [geoProtection, setGeoProtection] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [timeError, setTimeError] = useState(null);

  // Load data on mount/date/time change
  useEffect(() => {
    if (beach) fetchWeatherData();
    // eslint-disable-next-line
  }, [beach?.id, timeRange.date, timeRange.startTime, timeRange.endTime]);

  // Validate and fix time range
  useEffect(() => {
    const s = parseInt(timeRange.startTime.split(":")[0]);
    const e = parseInt(timeRange.endTime.split(":")[0]);
    if (s >= e) setTimeError("Start time must be before end time.");
    else setTimeError(null);
  }, [timeRange.startTime, timeRange.endTime]);

  // Fetch real weather/marine data
  const fetchWeatherData = async () => {
    if (!beach) return;
    setLoading(true); setError(null);
    try {
      const today = new Date(timeRange.date);
      const formattedDate = today.toISOString().split('T')[0];
      const tomorrow = new Date(today); tomorrow.setDate(today.getDate() + 1);
      const formattedTomorrow = tomorrow.toISOString().split('T')[0];
      const weatherUrl = `https://api.open-meteo.com/v1/forecast?latitude=${beach.latitude}&longitude=${beach.longitude}&hourly=temperature_2m,precipitation,cloudcover,windspeed_10m,winddirection_10m&daily=precipitation_sum,windspeed_10m_max&start_date=${formattedDate}&end_date=${formattedTomorrow}&timezone=auto`;
      const marineUrl = `https://marine-api.open-meteo.com/v1/marine?latitude=${beach.latitude}&longitude=${beach.longitude}&hourly=wave_height,swell_wave_height,wave_direction&daily=wave_height_max,wave_direction_dominant&start_date=${formattedDate}&end_date=${formattedTomorrow}&timezone=auto`;
      const [weatherRes, marineRes] = await Promise.all([fetch(weatherUrl), fetch(marineUrl)]);
      if (!weatherRes.ok) throw new Error(`Weather API error: ${weatherRes.status}`);
      if (!marineRes.ok) throw new Error(`Marine API error: ${marineRes.status}`);
      const weather = await weatherRes.json(), marine = await marineRes.json();
      setWeatherData(weather); setMarineData(marine);
      await calculateScores(weather, marine, beach);
      if (typeof onDataUpdate === 'function') onDataUpdate();
    } catch (err) {
      setError(err.message || "Failed to fetch weather data");
    } finally { setLoading(false); }
  };

  // Score calculation: use MAX for wind/wave, clear warning if any unsafe hour
  const calculateScores = async (weather, marine, beach) => {
    try {
      const sH = parseInt(timeRange.startTime.split(":")[0]), eH = parseInt(timeRange.endTime.split(":")[0]);
      const relIdx = [];
      for (let i = 0; i < weather.hourly.time.length; i++) {
        const d = new Date(weather.hourly.time[i]);
        if (d.getHours() >= sH && d.getHours() < eH && d.toISOString().split('T')[0] === timeRange.date)
          relIdx.push(i);
      }
      if (relIdx.length === 0) return setScoreBreakdown(null);

      // Use MAX wind/wave/swell/precip in range for safety
      const windVals = relIdx.map(i => weather.hourly.windspeed_10m[i]);
      const waveVals = relIdx.map(i => marine.hourly.wave_height[i]);
      const swellVals = relIdx.map(i => marine.hourly.swell_wave_height[i]);
      const precipVals = relIdx.map(i => weather.hourly.precipitation[i]);
      const tempVals = relIdx.map(i => weather.hourly.temperature_2m[i]);
      const cloudVals = relIdx.map(i => weather.hourly.cloudcover[i]);
      const windDirVals = relIdx.map(i => weather.hourly.winddirection_10m[i]);

      const maxWind = Math.max(...windVals), minWind = Math.min(...windVals), avgWind = windVals.reduce((a, b) => a + b, 0) / windVals.length;
      const maxWave = Math.max(...waveVals), avgWave = waveVals.reduce((a, b) => a + b, 0) / waveVals.length;
      const maxSwell = Math.max(...swellVals), avgSwell = swellVals.reduce((a, b) => a + b, 0) / swellVals.length;
      const maxPrecip = Math.max(...precipVals), avgTemp = tempVals.reduce((a, b) => a + b, 0) / tempVals.length;
      const avgCloud = cloudVals.reduce((a, b) => a + b, 0) / cloudVals.length;
      const avgWindDir = windDirVals.reduce((a, b) => a + b, 0) / windDirVals.length;

      // Geographic protection
      const waveDir = marine.daily.wave_direction_dominant[0];
      const protection = await calculateGeographicProtection(beach, avgWindDir, waveDir);
      setGeoProtection(protection);

      // Apply protection
      const protectedWind = maxWind * (1 - (protection.windProtection * 0.9));
      const protectedWave = maxWave * (1 - (protection.waveProtection * 0.9));
      const protectedSwell = maxSwell * (1 - (protection.waveProtection * 0.85));

      // Scoring (Total: 100)
      let windScore = protectedWind < 8 ? 40 : Math.max(0, 40 - (protectedWind - 8) * (40 / 12));
      let waveScore = protectedWave < 0.2 ? 20 : Math.max(0, 20 - (protectedWave - 0.2) * (20 / 0.4));
      let swellScore = protectedSwell < 0.3 ? 10 : Math.max(0, 10 - (protectedSwell - 0.3) * (10 / 0.3));
      let precipScore = maxPrecip < 1 ? 10 : 0;
      let tempScore = (avgTemp >= 22 && avgTemp <= 30) ? 10 : avgTemp < 22 ? Math.max(0, 10 - (22 - avgTemp)) : Math.max(0, 10 - (avgTemp - 30));
      let cloudScore = avgCloud < 40 ? 10 : Math.max(0, 10 - (avgCloud - 40) / 6);
      let geoScore = (protection.protectionScore / 100) * 15;

      // Warnings: If *any* hour is red, total score capped
      let warning = null;
      if (maxWind >= UNSAFE_WIND) {
        warning = `Unsafe wind detected (${Math.round(maxWind)} km/h) during selected period.`;
        windScore = 0; // Zero out wind for score
      }
      // Final
      windScore = Math.round(windScore); waveScore = Math.round(waveScore); swellScore = Math.round(swellScore);
      precipScore = Math.round(precipScore); tempScore = Math.round(tempScore); cloudScore = Math.round(cloudScore); geoScore = Math.round(geoScore);

      let rawTotal = windScore + waveScore + swellScore + precipScore + tempScore + cloudScore + geoScore;
      let totalScore = Math.max(0, Math.min(100, rawTotal)); // Clamp 0-100

      setScoreBreakdown({
        windSpeed: { raw: maxWind, protected: protectedWind, score: windScore, maxPossible: 40 },
        waveHeight: { raw: maxWave, protected: protectedWave, score: waveScore, maxPossible: 20 },
        swellHeight: { raw: maxSwell, protected: protectedSwell, score: swellScore, maxPossible: 10 },
        precipitation: { value: maxPrecip, score: precipScore, maxPossible: 10 },
        temperature: { value: avgTemp, score: tempScore, maxPossible: 10 },
        cloudCover: { value: avgCloud, score: cloudScore, maxPossible: 10 },
        geoProtection: { value: protection.protectionScore, score: geoScore, maxPossible: 15 },
        total: { score: totalScore, raw: rawTotal, warning }
      });
    } catch (err) {
      setScoreBreakdown(null);
    }
  };

  // Get current condition label
  const getCondition = () => {
    if (!scoreBreakdown) return { label: "Loading", emoji: "⏳", message: "Calculating conditions...", color: "text-gray-500" };
    if (scoreBreakdown.total.warning)
      return { label: "Unsafe", emoji: "🚫", message: scoreBreakdown.total.warning, color: "text-red-600" };
    if (scoreBreakdown.total.score >= 85)
      return { label: "Perfect", emoji: "✅", message: "Flat like oil. Paddle on.", color: "text-green-600" };
    if (scoreBreakdown.total.score >= 70)
      return { label: "Okay-ish", emoji: "⚠️", message: "Minor chop. Go early.", color: "text-yellow-600" };
    if (scoreBreakdown.total.score >= 50)
      return { label: "Not Great", emoji: "❌", message: "Wind or waves make it tricky.", color: "text-orange-600" };
    return { label: "Nope", emoji: "🚫", message: "Not recommended.", color: "text-red-600" };
  };

  // Hourly Wind Table (date included)
  const renderHourlyWind = () => {
    if (!weatherData || !weatherData.hourly) return null;
    const sH = parseInt(timeRange.startTime.split(":")[0]), eH = parseInt(timeRange.endTime.split(":")[0]);
    const today = new Date(timeRange.date).toISOString().split("T")[0];
    const rows = [];
    for (let i = 0; i < weatherData.hourly.time.length; i++) {
      const d = new Date(weatherData.hourly.time[i]);
      const hour = d.getHours();
      const dateStr = d.toISOString().split("T")[0];
      if (hour >= sH && hour < eH && dateStr === today) {
        const windSpeed = Math.round(weatherData.hourly.windspeed_10m[i]);
        let barColor = "bg-green-500", textColor = "text-green-800", bgColor = "bg-green-100";
        if (windSpeed >= 12) { barColor = "bg-red-500"; textColor = "text-red-800"; bgColor = "bg-red-100"; }
        else if (windSpeed >= 8) { barColor = "bg-yellow-500"; textColor = "text-yellow-800"; bgColor = "bg-yellow-100"; }
        rows.push(
          <div key={i} className="flex items-center mb-1">
            <div className="w-56 text-gray-600 font-medium">
              {d.toLocaleString("en-US", { weekday: 'short', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false })}
            </div>
            <div className="flex-grow mx-3 bg-gray-200 h-6 rounded-full overflow-hidden">
              <div className={`h-full ${barColor} rounded-l-full`} style={{ width: `${Math.min(80, windSpeed * 6)}%` }}></div>
            </div>
            <div className={`px-2 py-1 rounded-md ${bgColor} ${textColor} font-medium text-sm min-w-[70px] text-center`}>
              {windSpeed} km/h
            </div>
          </div>
        );
      }
    }
    if (rows.length === 0) return <div className="p-4 text-gray-500">No data for this window.</div>;
    return (
      <div className="bg-white rounded-lg p-5 border shadow-sm mt-4">
        <h4 className="font-medium mb-4 flex items-center text-gray-800">
          <Clock className="h-5 w-5 mr-2 text-blue-600" /> Hourly Wind Speed
        </h4>
        <div>{rows}</div>
      </div>
    );
  };

  // Score Breakdown Table
  const renderScoreBreakdown = () => {
    if (!scoreBreakdown) return null;
    return (
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
                <td className="px-4 py-2 text-sm font-medium text-gray-700">Wind Speed</td>
                <td className="px-4 py-2 text-sm text-gray-500 text-right">
                  {scoreBreakdown.windSpeed.raw.toFixed(1)} km/h
                  <span className="text-xs text-gray-400 ml-1">(Protected: {scoreBreakdown.windSpeed.protected.toFixed(1)})</span>
                </td>
                <td className={`px-4 py-2 text-sm font-medium text-right ${
                  scoreBreakdown.windSpeed.score > 30 ? 'text-green-600' :
                  scoreBreakdown.windSpeed.score > 20 ? 'text-yellow-600' : 'text-red-600'
                }`}>
                  {scoreBreakdown.windSpeed.score}/{scoreBreakdown.windSpeed.maxPossible}
                </td>
              </tr>
              <tr>
                <td className="px-4 py-2 text-sm font-medium text-gray-700">Wave Height</td>
                <td className="px-4 py-2 text-sm text-gray-500 text-right">
                  {scoreBreakdown.waveHeight.raw.toFixed(2)} m
                  <span className="text-xs text-gray-400 ml-1">(Protected: {scoreBreakdown.waveHeight.protected.toFixed(2)})</span>
                </td>
                <td className={`px-4 py-2 text-sm font-medium text-right ${
                  scoreBreakdown.waveHeight.score > 15 ? 'text-green-600' :
                  scoreBreakdown.waveHeight.score > 10 ? 'text-yellow-600' : 'text-red-600'
                }`}>
                  {scoreBreakdown.waveHeight.score}/{scoreBreakdown.waveHeight.maxPossible}
                </td>
              </tr>
              <tr>
                <td className="px-4 py-2 text-sm font-medium text-gray-700">Swell Height</td>
                <td className="px-4 py-2 text-sm text-gray-500 text-right">
                  {scoreBreakdown.swellHeight.raw.toFixed(2)} m
                </td>
                <td className={`px-4 py-2 text-sm font-medium text-right ${
                  scoreBreakdown.swellHeight.score > 7 ? 'text-green-600' :
                  scoreBreakdown.swellHeight.score > 5 ? 'text-yellow-600' : 'text-red-600'
                }`}>
                  {scoreBreakdown.swellHeight.score}/{scoreBreakdown.swellHeight.maxPossible}
                </td>
              </tr>
              <tr>
                <td className="px-4 py-2 text-sm font-medium text-gray-700">Precipitation</td>
                <td className="px-4 py-2 text-sm text-gray-500 text-right">
                  {scoreBreakdown.precipitation.value.toFixed(1)} mm
                </td>
                <td className={`px-4 py-2 text-sm font-medium text-right ${
                  scoreBreakdown.precipitation.value < 1 ? 'text-green-600' : 'text-red-600'
                }`}>
                  {scoreBreakdown.precipitation.score}/{scoreBreakdown.precipitation.maxPossible}
                </td>
              </tr>
              <tr>
                <td className="px-4 py-2 text-sm font-medium text-gray-700">Temperature</td>
                <td className="px-4 py-2 text-sm text-gray-500 text-right">
                  {scoreBreakdown.temperature.value.toFixed(1)} °C
                </td>
                <td className={`px-4 py-2 text-sm font-medium text-right ${
                  scoreBreakdown.temperature.score > 7 ? 'text-green-600' : 'text-yellow-600'
                }`}>
                  {scoreBreakdown.temperature.score}/{scoreBreakdown.temperature.maxPossible}
                </td>
              </tr>
              <tr>
                <td className="px-4 py-2 text-sm font-medium text-gray-700">Cloud Cover</td>
                <td className="px-4 py-2 text-sm text-gray-500 text-right">
                  {scoreBreakdown.cloudCover.value.toFixed(0)}%
                </td>
                <td className={`px-4 py-2 text-sm font-medium text-right ${
                  scoreBreakdown.cloudCover.score > 7 ? 'text-green-600' :
                  scoreBreakdown.cloudCover.score > 5 ? 'text-yellow-600' : 'text-gray-600'
                }`}>
                  {scoreBreakdown.cloudCover.score}/{scoreBreakdown.cloudCover.maxPossible}
                </td>
              </tr>
              <tr>
                <td className="px-4 py-2 text-sm font-medium text-gray-700">Geographic Protection</td>
                <td className="px-4 py-2 text-sm text-gray-500 text-right">
                  {scoreBreakdown.geoProtection.value.toFixed(0)}/100
                </td>
                <td className={`px-4 py-2 text-sm font-medium text-right ${
                  scoreBreakdown.geoProtection.score > 10 ? 'text-green-600' :
                  scoreBreakdown.geoProtection.score > 5 ? 'text-yellow-600' : 'text-red-600'
                }`}>
                  {scoreBreakdown.geoProtection.score}/{scoreBreakdown.geoProtection.maxPossible}
                </td>
              </tr>
              <tr className="bg-blue-50">
                <td className="px-4 py-3 text-sm font-bold text-gray-900">TOTAL SCORE</td>
                <td className="px-4 py-3"></td>
                <td className={`px-4 py-3 text-sm font-bold text-right ${
                  scoreBreakdown.total.score >= 85 ? 'text-green-600' :
                  scoreBreakdown.total.score >= 70 ? 'text-yellow-600' :
                  scoreBreakdown.total.score >= 50 ? 'text-orange-600' : 'text-red-600'
                }`}>
                  {scoreBreakdown.total.score}/100
                  {scoreBreakdown.total.raw > 100 && (
                    <span className="text-xs text-gray-400 ml-2">(Uncapped: {scoreBreakdown.total.raw})</span>
                  )}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  // Render
  const condition = getCondition();

  return (
    <div className="bg-white rounded-lg shadow-lg overflow-hidden">
      <div className="p-4 border-b flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-semibold flex items-center">
            {beach?.id === homeBeach?.id && (<Home className="h-5 w-5 text-orange-500 mr-2" />)}
            {beach?.name || "Beach"}
          </h2>
          <div className="flex items-center mt-1">
            <p className="text-gray-600 mr-3">
              {beach ? `${beach.latitude.toFixed(4)}, ${beach.longitude.toFixed(4)}` : ""}
            </p>
            {beach && (
              <a href={beach.googleMapsUrl || `https://www.google.com/maps?q=${beach.latitude},${beach.longitude}`}
                 target="_blank" rel="noopener noreferrer"
                 className="text-xs text-blue-600 hover:underline flex items-center">
                <Map className="h-3 w-3 mr-1" /> View on Maps
              </a>
            )}
          </div>
        </div>
        <div className="flex space-x-2">
          {beach && beach.id !== homeBeach?.id && (
            <button onClick={() => onSetHomeBeach?.(beach)}
              className="bg-orange-500 text-white px-3 py-1 rounded-lg hover:bg-orange-600 transition-colors flex items-center">
              <Home className="h-4 w-4 mr-1" /> Set as Home
            </button>
          )}
          <button onClick={() => setView?.("dashboard")}
            className="bg-gray-200 text-gray-800 px-3 py-1 rounded-lg hover:bg-gray-300 transition-colors flex items-center">
            <ChevronLeft className="h-4 w-4 mr-1" /> Back
          </button>
        </div>
      </div>

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
              min={new Date().toISOString().split('T')[0]}
            />
          </div>
        </div>
        <div className="flex space-x-4 mb-4">
          <button
            onClick={() => onTimeRangeChange?.('date', new Date().toISOString().split('T')[0])}
            className="flex-1 bg-blue-500 text-white py-3 px-4 rounded-lg text-lg font-medium hover:bg-blue-600">
            Today
          </button>
          <button
            onClick={() => {
              const tomorrow = new Date();
              tomorrow.setDate(tomorrow.getDate() + 1);
              onTimeRangeChange?.('date', tomorrow.toISOString().split('T')[0]);
            }}
            className="flex-1 bg-blue-500 text-white py-3 px-4 rounded-lg text-lg font-medium hover:bg-blue-600">
            Tomorrow
          </button>
        </div>
        <div className="grid grid-cols-2 gap-4 mb-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Start Time</label>
            <select
              value={timeRange.startTime}
              onChange={(e) => onTimeRangeChange?.('startTime', e.target.value)}
              className="w-full p-2 border rounded appearance-none bg-white text-lg">
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
              value={timeRange.endTime}
              onChange={(e) => onTimeRangeChange?.('endTime', e.target.value)}
              className="w-full p-2 border rounded appearance-none bg-white text-lg">
              {Array.from({ length: 24 }, (_, i) => (
                <option key={i} value={`${String(i).padStart(2, '0')}:00`}>
                  {`${String(i).padStart(2, '0')}:00`}
                </option>
              ))}
            </select>
          </div>
        </div>
        {timeError && (
          <div className="text-red-600 text-sm font-semibold mb-2">
            {timeError}
          </div>
        )}
        <button
          onClick={fetchWeatherData}
          className={`w-full bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700 flex items-center justify-center text-lg ${timeError ? 'opacity-50 cursor-not-allowed' : ''}`}
          disabled={!!timeError}>
          <RefreshCw className="h-5 w-5 mr-2" /> Update Forecast
        </button>
      </div>

      {loading && (
        <div className="p-8 text-center">
          <div className="inline-block animate-spin h-10 w-10 border-4 border-blue-500 border-t-transparent rounded-full mb-4"></div>
          <p className="text-gray-600">Loading real-time weather data...</p>
        </div>
      )}

      {error && !loading && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-md text-red-800 mx-4 my-4">
          <p className="flex items-center font-medium">
            <AlertCircle className="w-5 h-5 mr-2 text-red-600" />
            {error}
          </p>
          <button
            onClick={fetchWeatherData}
            className="mt-4 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 w-full flex items-center justify-center">
            <RefreshCw className="h-5 w-5 mr-2" />
            Try Again
          </button>
        </div>
      )}

      {/* Main Score Card */}
      {scoreBreakdown && !loading && !error && (
        <div className="p-6">
          <div className="flex flex-col md:flex-row gap-6 mb-6">
            <div className="md:w-1/3 bg-white rounded-lg shadow-md p-6 text-center flex flex-col justify-center relative">
              <div className={`text-6xl mb-3 ${condition.color}`}>{condition.emoji}</div>
              <h3 className="text-3xl font-bold mb-2 flex items-center">{condition.label}</h3>
              <p className="text-gray-600 text-lg mb-4">{condition.message}</p>
              <div className="mt-2 bg-gray-100 rounded-full h-5 overflow-hidden">
                <div className={`h-full ${condition.color}`} style={{ width: `${scoreBreakdown.total.score}%` }}></div>
              </div>
              <p className="mt-2 text-lg font-medium text-gray-700">
                Score: {scoreBreakdown.total.score}/100
              </p>
              <div className="mt-1 text-xs text-gray-500">
                Using real-time weather data
              </div>
            </div>
            <div className="md:w-2/3 grid grid-cols-2 gap-3">
              <div className="bg-white rounded-lg p-3 border flex items-center shadow-sm">
                <Wind className="h-6 w-6 mr-3 text-blue-600" />
                <div className="flex-grow">
                  <div className="text-sm text-gray-500">Wind</div>
                  <div className={`text-lg font-medium ${
                    scoreBreakdown.windSpeed.raw < 8
                      ? "text-green-600"
                      : scoreBreakdown.windSpeed.raw < 15
                      ? "text-yellow-600"
                      : "text-red-600"
                  }`}>
                    {Math.round(scoreBreakdown.windSpeed.raw)} km/h
                    <span className="text-xs ml-2 text-gray-500">
                      (Protected: {Math.round(scoreBreakdown.windSpeed.protected)} km/h)
                    </span>
                  </div>
                </div>
              </div>
              <div className="bg-white rounded-lg p-3 border flex items-center shadow-sm">
                <Waves className="h-6 w-6 mr-3 text-blue-600" />
                <div className="flex-grow">
                  <div className="text-sm text-gray-500">Wave Height</div>
                  <div className={`text-lg font-medium ${
                    scoreBreakdown.waveHeight.raw < 0.2
                      ? "text-green-600"
                      : scoreBreakdown.waveHeight.raw < 0.4
                      ? "text-yellow-600"
                      : "text-red-600"
                  }`}>
                    {scoreBreakdown.waveHeight.raw.toFixed(2)} m
                    <span className="text-xs ml-2 text-gray-500">
                      (Protected: {scoreBreakdown.waveHeight.protected.toFixed(2)} m)
                    </span>
                  </div>
                </div>
              </div>
              <div className="bg-white rounded-lg p-3 border flex items-center shadow-sm">
                <Thermometer className="h-6 w-6 mr-3 text-blue-600" />
                <div className="flex-grow">
                  <div className="text-sm text-gray-500">Temperature</div>
                  <div className={`text-lg font-medium ${
                    scoreBreakdown.temperature.value >= 22 &&
                    scoreBreakdown.temperature.value <= 30
                      ? "text-green-600"
                      : scoreBreakdown.temperature.value >= 18
                      ? "text-yellow-600"
                      : "text-blue-600"
                  }`}>
                    {Math.round(scoreBreakdown.temperature.value)}°C
                  </div>
                </div>
              </div>
              <div className="bg-white rounded-lg p-3 border flex items-center shadow-sm">
                <Droplets className="h-6 w-6 mr-3 text-blue-600" />
                <div className="flex-grow">
                  <div className="text-sm text-gray-500">Precipitation</div>
                  <div className={`text-lg font-medium ${
                    scoreBreakdown.precipitation.value < 1
                      ? "text-green-600"
                      : "text-red-600"
                  }`}>
                    {scoreBreakdown.precipitation.value.toFixed(1)} mm
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Warning */}
          {scoreBreakdown.total.warning && (
            <div className="bg-red-50 p-4 rounded-lg border border-red-200 mb-6">
              <h4 className="font-bold text-red-700 flex items-center mb-2">
                <AlertCircle className="h-5 w-5 mr-2" />
                {scoreBreakdown.total.warning}
              </h4>
              <p className="text-red-700">
                Wind speeds above {UNSAFE_WIND} km/h can be unsafe for paddleboarding. Please exercise extreme caution.
              </p>
            </div>
          )}

          {renderScoreBreakdown()}

          {/* Geographic Protection (show same as before, omitted for brevity) */}
          {/* Add your renderGeoProtectionInfo() from before here if you want */}

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

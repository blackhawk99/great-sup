// PaddleboardBeachView.jsx

import React, { useState, useEffect } from "react";
import {
  Home, ChevronLeft, RefreshCw, AlertCircle, Map, Wind, Thermometer,
  Droplets, Waves, Calendar, Clock, Info
} from "lucide-react";
import { getCardinalDirection } from "./helpers";
import { calculateGeographicProtection } from "./utils/coastlineAnalysis";

export default function PaddleboardBeachView({
  beach,
  homeBeach,
  onSetHomeBeach,
  setView,
  onDataUpdate,
  timeRange,
  onTimeRangeChange,
  debugMode
}) {
  // STATE
  const [weatherData, setWeatherData] = useState(null);
  const [marineData, setMarineData] = useState(null);
  const [paddleScore, setPaddleScore] = useState(null);
  const [scoreBreakdown, setScoreBreakdown] = useState(null);
  const [geoProtection, setGeoProtection] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // LOAD DATA
  useEffect(() => {
    if (beach) fetchWeatherData();
    // eslint-disable-next-line
  }, [beach?.id, timeRange.date, timeRange.startTime, timeRange.endTime]);

  // FETCH WEATHER/MARINE DATA
  async function fetchWeatherData() {
    setLoading(true);
    setError(null);
    try {
      const today = new Date(timeRange.date);
      const formattedDate = today.toISOString().split('T')[0];
      const tomorrow = new Date(today); tomorrow.setDate(today.getDate() + 1);
      const formattedTomorrow = tomorrow.toISOString().split('T')[0];

      const weatherUrl =
        `https://api.open-meteo.com/v1/forecast?latitude=${beach.latitude}&longitude=${beach.longitude}` +
        `&hourly=temperature_2m,precipitation,cloudcover,windspeed_10m,winddirection_10m` +
        `&start_date=${formattedDate}&end_date=${formattedTomorrow}&timezone=auto`;

      const marineUrl =
        `https://marine-api.open-meteo.com/v1/marine?latitude=${beach.latitude}&longitude=${beach.longitude}` +
        `&hourly=wave_height,swell_wave_height,wave_direction` +
        `&daily=wave_height_max,wave_direction_dominant` +
        `&start_date=${formattedDate}&end_date=${formattedTomorrow}&timezone=auto`;

      const [weatherRes, marineRes] = await Promise.all([
        fetch(weatherUrl),
        fetch(marineUrl)
      ]);
      if (!weatherRes.ok) throw new Error(`Weather API error: ${weatherRes.status}`);
      if (!marineRes.ok) throw new Error(`Marine API error: ${marineRes.status}`);

      const weather = await weatherRes.json();
      const marine = await marineRes.json();

      setWeatherData(weather);
      setMarineData(marine);
      await calculateScores(weather, marine, beach);

      if (typeof onDataUpdate === 'function') onDataUpdate();
    } catch (err) {
      setError(err.message || "Failed to fetch weather data");
      setWeatherData(null);
      setMarineData(null);
      setPaddleScore(null);
      setScoreBreakdown(null);
      setGeoProtection(null);
    } finally {
      setLoading(false);
    }
  }

  // SCORE CALCULATION
  async function calculateScores(weather, marine, beach) {
    const startHour = parseInt(timeRange.startTime.split(":")[0], 10);
    const endHour = parseInt(timeRange.endTime.split(":")[0], 10);

    // Find relevant hourly indices
    const relevantIndices = [];
    for (let i = 0; i < weather.hourly.time.length; i++) {
      const d = new Date(weather.hourly.time[i]);
      if (d.getHours() >= startHour && d.getHours() <= endHour) relevantIndices.push(i);
    }
    if (relevantIndices.length === 0) {
      for (let i = 0; i < weather.hourly.time.length; i++) {
        const d = new Date(weather.hourly.time[i]);
        if (d.getDate() === new Date(timeRange.date).getDate()) relevantIndices.push(i);
      }
    }

    // Averages
    const avg = arr => arr.reduce((sum, v) => sum + v, 0) / arr.length;
    const avgTemp = avg(relevantIndices.map(i => weather.hourly.temperature_2m[i]));
    const avgWind = avg(relevantIndices.map(i => weather.hourly.windspeed_10m[i]));
    const avgCloud = avg(relevantIndices.map(i => weather.hourly.cloudcover[i]));
    const maxPrecip = Math.max(...relevantIndices.map(i => weather.hourly.precipitation[i]));
    const avgWindDir = avg(relevantIndices.map(i => weather.hourly.winddirection_10m[i]));

    // Daily marine data
    const waveHeight = marine.daily.wave_height_max[0];
    const avgSwellHeight = avg(relevantIndices.map(i => marine.hourly.swell_wave_height[i]));

    // Geographic protection calculation
    const waveDirection = marine.daily.wave_direction_dominant[0];
    const protection = await calculateGeographicProtection(beach, avgWindDir, waveDirection);
    setGeoProtection(protection);

    // Apply protection
    const protectedWindSpeed = avgWind * (1 - (protection.windProtection * 0.9));
    const protectedWaveHeight = waveHeight * (1 - (protection.waveProtection * 0.9));
    const protectedSwellHeight = avgSwellHeight * (1 - (protection.waveProtection * 0.85));

    // Scores
    const breakdown = {
      windSpeed: { raw: avgWind, protected: protectedWindSpeed, score: 0, maxPossible: 40 },
      waveHeight: { raw: waveHeight, protected: protectedWaveHeight, score: 0, maxPossible: 20 },
      swellHeight: { raw: avgSwellHeight, protected: protectedSwellHeight, score: 0, maxPossible: 10 },
      precipitation: { value: maxPrecip, score: 0, maxPossible: 10 },
      temperature: { value: avgTemp, score: 0, maxPossible: 10 },
      cloudCover: { value: avgCloud, score: 0, maxPossible: 10 },
      geoProtection: { value: protection.protectionScore, score: 0, maxPossible: 15 },
      total: { score: 0, maxPossible: 115 }
    };
    // Assign scores
    breakdown.windSpeed.score = protectedWindSpeed < 8 ? 40 : Math.max(0, 40 - (protectedWindSpeed - 8) * (40 / 12));
    breakdown.waveHeight.score = protectedWaveHeight < 0.2 ? 20 : Math.max(0, 20 - (protectedWaveHeight - 0.2) * (20 / 0.4));
    breakdown.swellHeight.score = protectedSwellHeight < 0.3 ? 10 : Math.max(0, 10 - (protectedSwellHeight - 0.3) * (10 / 0.3));
    breakdown.precipitation.score = maxPrecip < 1 ? 10 : 0;
    if (avgTemp >= 22 && avgTemp <= 30) breakdown.temperature.score = 10;
    else if (avgTemp < 22) breakdown.temperature.score = Math.max(0, 10 - (22 - avgTemp));
    else breakdown.temperature.score = Math.max(0, 10 - (avgTemp - 30));
    breakdown.cloudCover.score = avgCloud < 40 ? 10 : Math.max(0, 10 - (avgCloud - 40) / 6);
    breakdown.geoProtection.score = (protection.protectionScore / 100) * 15;

    // Round all
    Object.values(breakdown).forEach(f =>
      typeof f === "object" && f.score !== undefined && (f.score = Math.round(f.score))
    );

    // Special cases
    if (maxPrecip >= 1.5) {
      breakdown.precipitation.score = 0;
      breakdown.total.score = 40; // Rain override: unsafe
    } else {
      breakdown.total.score = Math.round(
        breakdown.windSpeed.score +
        breakdown.waveHeight.score +
        breakdown.swellHeight.score +
        breakdown.precipitation.score +
        breakdown.temperature.score +
        breakdown.cloudCover.score +
        breakdown.geoProtection.score
      );
    }
    setPaddleScore(Math.min(100, Math.round((breakdown.total.score / breakdown.total.maxPossible) * 100)));
    setScoreBreakdown(breakdown);
  }

  // CONDITION CARD LOGIC
  function getCondition(score) {
    if (!scoreBreakdown || !weatherData) return {
      label: "Loading", emoji: "⏳", message: "Calculating...", color: "text-gray-500"
    };
    const temp = weatherData.hourly.temperature_2m[12];
    const windSpeed = scoreBreakdown.windSpeed.protected;
    const precipitation = weatherData.hourly.precipitation[12];
    if (score >= 85) {
      if (temp < 18) return { label: "Chilly but Calm", emoji: "🧊", message: "Great conditions, but bring a wetsuit.", color: "text-blue-500" };
      if (precipitation >= 0.5) return { label: "Calm but Wet", emoji: "🌧️", message: "Light rain, but excellent water conditions.", color: "text-blue-500" };
      if (windSpeed > 15) return { label: "Excellent", emoji: "✅", message: "Some wind, but well-protected location.", color: "text-green-500" };
      return { label: "Perfect", emoji: "✅", message: "Flat like oil. Paddle on.", color: "text-green-500" };
    } else if (score >= 70) {
      return { label: "Okay-ish", emoji: "⚠️", message: "Minor chop. Go early.", color: "text-yellow-500" };
    } else if (score >= 50) {
      return { label: "Not Great", emoji: "❌", message: "Wind or waves make it tricky.", color: "text-orange-500" };
    } else {
      return { label: "Nope", emoji: "🚫", message: "Not recommended.", color: "text-red-500" };
    }
  }

  // RENDER SCORE BREAKDOWN
  function renderScoreBreakdown() {
    if (!scoreBreakdown) return null;
    const totalRaw = scoreBreakdown.total.score;
    const maxRaw = scoreBreakdown.total.maxPossible;
    const normalized = paddleScore;
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
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Factor</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Value</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Score</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              <tr><td className="px-4 py-2 text-sm font-medium text-gray-700">Wind Speed</td>
                  <td className="px-4 py-2 text-sm text-gray-500 text-right">
                    {scoreBreakdown.windSpeed.raw.toFixed(1)} km/h <span className="text-xs text-gray-400 ml-1">(Protected: {scoreBreakdown.windSpeed.protected.toFixed(1)})</span>
                  </td>
                  <td className={`px-4 py-2 text-sm font-medium text-right ${scoreBreakdown.windSpeed.score > 30 ? 'text-green-600' : scoreBreakdown.windSpeed.score > 20 ? 'text-yellow-600' : 'text-red-600'}`}>{scoreBreakdown.windSpeed.score}/40</td></tr>
              <tr><td className="px-4 py-2 text-sm font-medium text-gray-700">Wave Height</td>
                  <td className="px-4 py-2 text-sm text-gray-500 text-right">
                    {scoreBreakdown.waveHeight.raw.toFixed(2)} m <span className="text-xs text-gray-400 ml-1">(Protected: {scoreBreakdown.waveHeight.protected.toFixed(2)})</span>
                  </td>
                  <td className={`px-4 py-2 text-sm font-medium text-right ${scoreBreakdown.waveHeight.score > 15 ? 'text-green-600' : scoreBreakdown.waveHeight.score > 10 ? 'text-yellow-600' : 'text-red-600'}`}>{scoreBreakdown.waveHeight.score}/20</td></tr>
              <tr><td className="px-4 py-2 text-sm font-medium text-gray-700">Swell Height</td>
                  <td className="px-4 py-2 text-sm text-gray-500 text-right">
                    {scoreBreakdown.swellHeight.raw.toFixed(2)} m
                  </td>
                  <td className={`px-4 py-2 text-sm font-medium text-right ${scoreBreakdown.swellHeight.score > 7 ? 'text-green-600' : scoreBreakdown.swellHeight.score > 5 ? 'text-yellow-600' : 'text-red-600'}`}>{scoreBreakdown.swellHeight.score}/10</td></tr>
              <tr><td className="px-4 py-2 text-sm font-medium text-gray-700">Precipitation</td>
                  <td className="px-4 py-2 text-sm text-gray-500 text-right">{scoreBreakdown.precipitation.value.toFixed(1)} mm</td>
                  <td className={`px-4 py-2 text-sm font-medium text-right ${scoreBreakdown.precipitation.value < 1 ? 'text-green-600' : 'text-red-600'}`}>{scoreBreakdown.precipitation.score}/10</td></tr>
              <tr><td className="px-4 py-2 text-sm font-medium text-gray-700">Temperature</td>
                  <td className="px-4 py-2 text-sm text-gray-500 text-right">{scoreBreakdown.temperature.value.toFixed(1)}°C</td>
                  <td className={`px-4 py-2 text-sm font-medium text-right ${scoreBreakdown.temperature.score > 7 ? 'text-green-600' : 'text-yellow-600'}`}>{scoreBreakdown.temperature.score}/10</td></tr>
              <tr><td className="px-4 py-2 text-sm font-medium text-gray-700">Cloud Cover</td>
                  <td className="px-4 py-2 text-sm text-gray-500 text-right">{scoreBreakdown.cloudCover.value.toFixed(0)}%</td>
                  <td className={`px-4 py-2 text-sm font-medium text-right ${scoreBreakdown.cloudCover.score > 7 ? 'text-green-600' : scoreBreakdown.cloudCover.score > 5 ? 'text-yellow-600' : 'text-gray-600'}`}>{scoreBreakdown.cloudCover.score}/10</td></tr>
              <tr><td className="px-4 py-2 text-sm font-medium text-gray-700">Geographic Protection</td>
                  <td className="px-4 py-2 text-sm text-gray-500 text-right">{scoreBreakdown.geoProtection.value.toFixed(0)}/100</td>
                  <td className={`px-4 py-2 text-sm font-medium text-right ${scoreBreakdown.geoProtection.score > 10 ? 'text-green-600' : scoreBreakdown.geoProtection.score > 5 ? 'text-yellow-600' : 'text-red-600'}`}>{scoreBreakdown.geoProtection.score}/15</td></tr>
              <tr className="bg-blue-50"><td className="px-4 py-3 text-sm font-bold text-gray-900">TOTAL SCORE</td>
                  <td className="px-4 py-3"></td>
                  <td className="px-4 py-3 text-sm font-bold text-right text-blue-900">
                    {totalRaw}/{maxRaw} <span className="text-xs text-gray-500">(normalized: {normalized}/100)</span>
                  </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  // RENDER CONDITION CARD
  const condition = paddleScore !== null && weatherData ? getCondition(paddleScore) : {
    label: "Loading", emoji: "⏳", message: "Calculating...", color: "text-gray-500"
  };

  // HOURLY WIND VIS
  function renderHourlyWind() {
    if (!weatherData || !weatherData.hourly) return null;
    const startHour = parseInt(timeRange.startTime.split(":")[0], 10);
    const endHour = parseInt(timeRange.endTime.split(":")[0], 10);
    const todayDate = new Date(timeRange.date);
    const tomorrowDate = new Date(timeRange.date);
    tomorrowDate.setDate(tomorrowDate.getDate() + 1);

    const todayStr = todayDate.toISOString().split('T')[0];
    const tomorrowStr = tomorrowDate.toISOString().split('T')[0];

    const todayHours = [], tomorrowHours = [];
    for (let i = 0; i < weatherData.hourly.time.length; i++) {
      const hourTime = new Date(weatherData.hourly.time[i]);
      const hour = hourTime.getHours();
      const dateStr = hourTime.toISOString().split('T')[0];
      if (hour >= startHour && hour <= endHour) {
        const hourData = {
          hour, index: i,
          windSpeed: Math.round(weatherData.hourly.windspeed_10m[i]),
          time: weatherData.hourly.time[i], date: dateStr
        };
        if (dateStr === todayStr) todayHours.push(hourData);
        else if (dateStr === tomorrowStr) tomorrowHours.push(hourData);
      }
    }
    const allHours = [
      ...todayHours.map(h => ({ ...h, label: "Today" })),
      ...tomorrowHours.map(h => ({ ...h, label: "Tomorrow" }))
    ];
    if (allHours.length === 0) return null;

    return (
      <div className="bg-white rounded-lg p-5 border shadow-sm mt-4">
        <h4 className="font-medium mb-4 flex items-center text-gray-800">
          <Clock className="h-5 w-5 mr-2 text-blue-600" /> Hourly Wind Speed
        </h4>
        <div className="space-y-3">
          {allHours.map(hour => {
            const windSpeed = hour.windSpeed;
            const barWidth = Math.min(80, windSpeed * 6);
            let barColor = "bg-green-500", textColor = "text-green-800", bgColor = "bg-green-100";
            if (windSpeed >= 12) [barColor, textColor, bgColor] = ["bg-red-500", "text-red-800", "bg-red-100"];
            else if (windSpeed >= 8) [barColor, textColor, bgColor] = ["bg-yellow-500", "text-yellow-800", "bg-yellow-100"];
            return (
              <div key={`${hour.date}-${hour.hour}`} className="flex items-center">
                <div className="w-28 text-gray-600 font-medium">{hour.label} {hour.hour}:00</div>
                <div className="flex-grow mx-3 bg-gray-200 h-6 rounded-full overflow-hidden">
                  <div className={`h-full ${barColor} rounded-l-full`} style={{ width: `${barWidth}%` }}></div>
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
  }

  // GEOGRAPHIC PROTECTION INFO
  function renderGeoProtectionInfo() {
    if (!geoProtection) return null;
    const geoBonus = Math.round((geoProtection.protectionScore / 100) * 15);
    const avgWindDirection = weatherData?.hourly?.winddirection_10m?.[12] || 0;
    return (
      <div className="bg-blue-50 p-5 rounded-lg mt-4 border border-blue-200 shadow-inner">
        <h4 className="font-medium mb-4 text-lg flex items-center text-blue-800">
          <Map className="h-5 w-5 mr-2 text-blue-600" /> Geographic Protection Analysis
        </h4>
        <div className="grid md:grid-cols-2 gap-6">
          <ul className="space-y-3">
            <li className="flex justify-between items-center bg-white p-3 rounded border">
              <span className="font-medium text-gray-700">Bay Enclosure:</span>
              <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                geoProtection.bayEnclosure > 0.6 ? 'bg-green-100 text-green-800'
                : geoProtection.bayEnclosure > 0.3 ? 'bg-yellow-100 text-yellow-800'
                : 'bg-red-100 text-red-800'}`}>
                {geoProtection.bayEnclosure > 0.7 ? 'Well Protected'
                  : geoProtection.bayEnclosure > 0.4 ? 'Moderately Protected'
                  : 'Exposed'}
              </span>
            </li>
            <li className="flex justify-between items-center bg-white p-3 rounded border">
              <span className="font-medium text-gray-700">Wind Direction:</span>
              <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                geoProtection.windProtection > 0.7 ? 'bg-green-100 text-green-800'
                : geoProtection.windProtection > 0.3 ? 'bg-yellow-100 text-yellow-800'
                : 'bg-red-100 text-red-800'}`}>
                {getCardinalDirection(avgWindDirection)}
                {geoProtection.windProtection > 0.7 ? ' (Protected)' : geoProtection.windProtection > 0.3 ? ' (Partially Exposed)' : ' (Fully Exposed)'}
              </span>
            </li>
            <li className="flex justify-between items-center bg-white p-3 rounded border">
              <span className="font-medium text-gray-700">Overall Protection:</span>
              <div className="flex items-center">
                <div className="w-24 h-3 bg-gray-200 rounded-full overflow-hidden mr-2">
                  <div className={`h-full ${
                    geoProtection.protectionScore > 70 ? 'bg-green-500'
                    : geoProtection.protectionScore > 40 ? 'bg-yellow-500' : 'bg-red-500'}`}
                    style={{ width: `${geoProtection.protectionScore}%` }} />
                </div>
                <span className={`font-medium ${
                  geoProtection.protectionScore > 70 ? 'text-green-600'
                  : geoProtection.protectionScore > 40 ? 'text-yellow-600' : 'text-red-600'
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
              geoProtection.protectionScore > 60 ? 'bg-green-50 border border-green-200'
              : geoProtection.protectionScore > 30 ? 'bg-yellow-50 border border-yellow-200'
              : 'bg-red-50 border border-red-200'
            }`}>
              <p className="text-sm">
                {geoProtection.protectionScore > 60 ?
                  `${beach.name} is well protected from ${getCardinalDirection(avgWindDirection)} winds, making it an excellent choice today.`
                  : geoProtection.protectionScore > 30 ?
                  `${beach.name} has moderate protection from ${getCardinalDirection(avgWindDirection)} winds.`
                  : `${beach.name} is exposed to ${getCardinalDirection(avgWindDirection)} winds today, consider an alternative beach.`}
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // LOADING/ERROR STATES
  if (loading) {
    return <div className="p-10 text-center text-blue-700">
      <div className="inline-block animate-spin h-12 w-12 border-4 border-blue-500 border-t-transparent rounded-full mb-5"></div>
      <div>Loading real-time weather data...</div>
    </div>;
  }
  if (error) {
    return <div className="p-8 bg-red-50 rounded-lg border border-red-200 text-center">
      <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
      <h2 className="text-2xl font-bold text-red-700 mb-4">Something went wrong</h2>
      <p className="text-red-600 mb-4">{error}</p>
      <button onClick={fetchWeatherData} className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700">Try Again</button>
    </div>;
  }

  // RENDER MAIN VIEW
  return (
    <div className="bg-white rounded-lg shadow-lg overflow-hidden">
      {/* HEADER */}
      <div className="p-4 border-b flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-semibold flex items-center">
            {beach?.id === homeBeach?.id && <Home className="h-5 w-5 text-orange-500 mr-2" />}
            {beach?.name || "Beach"}
          </h2>
          <div className="flex items-center mt-1">
            <p className="text-gray-600 mr-3">{beach ? `${beach.latitude.toFixed(4)}, ${beach.longitude.toFixed(4)}` : ""}</p>
            {beach && (
              <a href={beach.googleMapsUrl || `https://www.google.com/maps?q=${beach.latitude},${beach.longitude}`}
                target="_blank" rel="noopener noreferrer" className="text-xs text-blue-600 hover:underline flex items-center">
                <Map className="h-3 w-3 mr-1" /> View on Maps
              </a>
            )}
          </div>
        </div>
        <div className="flex space-x-2">
          {beach && beach.id !== homeBeach?.id && (
            <button onClick={() => onSetHomeBeach?.(beach)} className="bg-orange-500 text-white px-3 py-1 rounded-lg hover:bg-orange-600 transition-colors flex items-center">
              <Home className="h-4 w-4 mr-1" /> Set as Home
            </button>
          )}
          <button onClick={() => setView?.("dashboard")}
            className="bg-gray-200 text-gray-800 px-3 py-1 rounded-lg hover:bg-gray-300 transition-colors flex items-center">
            <ChevronLeft className="h-4 w-4 mr-1" /> Back
          </button>
        </div>
      </div>
      {/* DATE/TIME RANGE PICKER */}
      <div className="p-4 border-b bg-gray-50">
        <h3 className="text-lg font-medium mb-4">Choose Date & Time Window</h3>
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-2">Date</label>
          <div className="relative cursor-pointer">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Calendar className="h-5 w-5 text-gray-400" />
            </div>
            <input type="date" value={timeRange.date}
              onChange={e => onTimeRangeChange?.('date', e.target.value)}
              className="w-full pl-10 p-3 bg-white border rounded-lg cursor-pointer text-lg" />
          </div>
        </div>
        <div className="flex space-x-4 mb-4">
          <button onClick={() => onTimeRangeChange?.('date', new Date().toISOString().split('T')[0])}
            className="flex-1 bg-blue-500 text-white py-3 px-4 rounded-lg text-lg font-medium hover:bg-blue-600">Today</button>
          <button onClick={() => { const tomorrow = new Date(); tomorrow.setDate(tomorrow.getDate() + 1); onTimeRangeChange?.('date', tomorrow.toISOString().split('T')[0]); }}
            className="flex-1 bg-blue-500 text-white py-3 px-4 rounded-lg text-lg font-medium hover:bg-blue-600">Tomorrow</button>
        </div>
        <div className="grid grid-cols-2 gap-4 mb-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Start Time</label>
            <select value={timeRange.startTime} onChange={e => onTimeRangeChange?.('startTime', e.target.value)}
              className="w-full p-2 border rounded appearance-none bg-white text-lg">
              {Array.from({ length: 24 }, (_, i) => (
                <option key={i} value={`${String(i).padStart(2, '0')}:00`}>{`${String(i).padStart(2, '0')}:00`}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">End Time</label>
            <select value={timeRange.endTime} onChange={e => onTimeRangeChange?.('endTime', e.target.value)}
              className="w-full p-2 border rounded appearance-none bg-white text-lg">
              {Array.from({ length: 24 }, (_, i) => (
                <option key={i} value={`${String(i).padStart(2, '0')}:00`}>{`${String(i).padStart(2, '0')}:00`}</option>
              ))}
            </select>
          </div>
        </div>
        <button onClick={fetchWeatherData}
          className="w-full bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700 flex items-center justify-center text-lg">
          <RefreshCw className="h-5 w-5 mr-2" /> Update Forecast
        </button>
      </div>
      {/* MAIN CARD */}
      {weatherData && marineData && paddleScore !== null && scoreBreakdown && (
        <div className="p-6">
          {/* Score/condition card */}
          <div className="flex flex-col md:flex-row gap-6 mb-6">
            <div className="md:w-1/3 bg-white rounded-lg shadow-md p-6 text-center flex flex-col justify-center relative">
              <div className={`text-6xl mb-3 ${condition.color}`}>{condition.emoji}</div>
              <h3 className="text-3xl font-bold mb-2 flex items-center">
                {condition.label}
                <div className="ml-2 text-gray-400" title={condition.message}>
                  <Info className="w-5 h-5" />
                </div>
              </h3>
              <p className="text-gray-600 text-lg mb-4">{condition.message}</p>
              <div className="mt-2 bg-gray-100 rounded-full h-5 overflow-hidden">
                <div className={`h-full ${condition.color}`} style={{ width: `${paddleScore}%` }} />
              </div>
              <p className="mt-2 text-lg font-medium text-gray-700">
                Score: {scoreBreakdown.total.score}/{scoreBreakdown.total.maxPossible}
                <span className="text-xs text-gray-500 ml-2">(normalized: {paddleScore}/100)</span>
              </p>
              <div className="mt-1 text-xs text-gray-500">Using real-time weather data</div>
            </div>
            {/* FACTORS */}
            <div className="md:w-2/3">
              <div className="grid grid-cols-2 gap-3">
                {weatherData.hourly && (
                  <div className="bg-white rounded-lg p-3 border flex items-center shadow-sm">
                    <Wind className="h-6 w-6 mr-3 text-blue-600" />
                    <div className="flex-grow">
                      <div className="text-sm text-gray-500">Wind</div>
                      <div className={`text-lg font-medium ${
                        weatherData.hourly.windspeed_10m[12] < 8 ? "text-green-600"
                        : weatherData.hourly.windspeed_10m[12] < 15 ? "text-yellow-600"
                        : "text-red-600"}`}>
                        {Math.round(weatherData.hourly.windspeed_10m[12])} km/h
                        <span className="text-xs ml-2 text-gray-500">
                          (Protected: {Math.round(scoreBreakdown.windSpeed.protected)} km/h)
                        </span>
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
                        marineData.daily.wave_height_max[0] < 0.2 ? "text-green-600"
                        : marineData.daily.wave_height_max[0] < 0.4 ? "text-yellow-600"
                        : "text-red-600"}`}>
                        {marineData.daily.wave_height_max[0].toFixed(2)} m
                        <span className="text-xs ml-2 text-gray-500">
                          (Protected: {scoreBreakdown.waveHeight.protected.toFixed(2)} m)
                        </span>
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
                        weatherData.hourly.temperature_2m[12] >= 22 && weatherData.hourly.temperature_2m[12] <= 30
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
                        weatherData.hourly.precipitation[12] < 1 ? "text-green-600" : "text-red-600"
                      }`}>
                        {weatherData.hourly.precipitation[12].toFixed(1)} mm
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
          {/* ALERT */}
          {scoreBreakdown && scoreBreakdown.windSpeed.raw > 30 && (
            <div className="bg-red-50 p-4 rounded-lg border border-red-200 mb-6">
              <h4 className="font-bold text-red-700 flex items-center mb-2">
                <AlertCircle className="h-5 w-5 mr-2" /> HIGH WIND ALERT
              </h4>
              <p className="text-red-700">
                Wind speeds above 30 km/h can be unsafe for paddleboarding. Please exercise extreme caution.
              </p>
            </div>
          )}
          {/* BREAKDOWN */}
          {renderScoreBreakdown()}
          {/* GEOGRAPHIC PROTECTION */}
          {renderGeoProtectionInfo()}
          {/* HOURLY WIND */}
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
}

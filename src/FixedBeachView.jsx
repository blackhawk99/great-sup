import React, { useState, useEffect } from "react";
import { Home, ChevronLeft, RefreshCw, AlertCircle, MapPin, Map, Wind, Thermometer, Droplets, Waves, Clock, Calendar, Info } from "lucide-react";
import { calculateGeographicProtection } from "./utils/coastlineAnalysis";
import { getCardinalDirection } from "./helpers";

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
  }, [beach?.id, timeRange.date, timeRange.startTime, timeRange.endTime]);

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

      const weather = await weatherRes.json();
      const marine = await marineRes.json();

      setWeatherData(weather);
      setMarineData(marine);
      await calculateScores(weather, marine, beach);

      if (typeof onDataUpdate === 'function') onDataUpdate();
    } catch (err) {
      setError(err.message || "Failed to fetch weather data");
    } finally {
      setLoading(false);
    }
  };

  // Calculate paddleboarding scores (preserves your raw/max logic!)
  const calculateScores = async (weather, marine, beach) => {
    try {
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
      if (relevantIndices.length === 0) {
        for (let i = 0; i < weather.hourly.time.length; i++) {
          const time = new Date(weather.hourly.time[i]);
          if (time.getDate() === new Date(timeRange.date).getDate()) {
            relevantIndices.push(i);
          }
        }
      }

      const avgTemp = relevantIndices.map(i => weather.hourly.temperature_2m[i]).reduce((sum, val) => sum + val, 0) / relevantIndices.length;
      const avgWind = relevantIndices.map(i => weather.hourly.windspeed_10m[i]).reduce((sum, val) => sum + val, 0) / relevantIndices.length;
      const avgCloud = relevantIndices.map(i => weather.hourly.cloudcover[i]).reduce((sum, val) => sum + val, 0) / relevantIndices.length;
      const maxPrecip = Math.max(...relevantIndices.map(i => weather.hourly.precipitation[i]));
      const avgWindDir = relevantIndices.map(i => weather.hourly.winddirection_10m[i]).reduce((sum, val) => sum + val, 0) / relevantIndices.length;
      const waveHeight = marine.daily.wave_height_max[0];
      const avgSwellHeight = relevantIndices.map(i => marine.hourly.swell_wave_height[i]).reduce((sum, val) => sum + val, 0) / relevantIndices.length;

      // Calculate geographic protection
      const waveDirection = marine.daily.wave_direction_dominant[0];
      const protection = await calculateGeographicProtection(beach, avgWindDir, waveDirection);
      setGeoProtection(protection);

      // Apply protection factors
      const protectedWindSpeed = avgWind * (1 - (protection.windProtection * 0.9));
      const protectedWaveHeight = waveHeight * (1 - (protection.waveProtection * 0.9));
      const protectedSwellHeight = avgSwellHeight * (1 - (protection.waveProtection * 0.85));

      // Score factors (can sum over 100)
      const breakdown = {
        windSpeed: { raw: avgWind, protected: protectedWindSpeed, score: 0, maxPossible: 40 },
        waveHeight: { raw: waveHeight, protected: protectedWaveHeight, score: 0, maxPossible: 20 },
        swellHeight: { raw: avgSwellHeight, protected: protectedSwellHeight, score: 0, maxPossible: 10 },
        precipitation: { value: maxPrecip, score: 0, maxPossible: 10 },
        temperature: { value: avgTemp, score: 0, maxPossible: 10 },
        cloudCover: { value: avgCloud, score: 0, maxPossible: 10 },
        geoProtection: { value: protection.protectionScore, score: 0, maxPossible: 15 },
        total: { rawScore: 0, maxPossible: 115, normalized: 0 }
      };

      // Individual scores
      breakdown.windSpeed.score = protectedWindSpeed < 8 ? 40 : Math.max(0, 40 - (protectedWindSpeed - 8) * (40 / 12));
      breakdown.waveHeight.score = protectedWaveHeight < 0.2 ? 20 : Math.max(0, 20 - (protectedWaveHeight - 0.2) * (20 / 0.4));
      breakdown.swellHeight.score = protectedSwellHeight < 0.3 ? 10 : Math.max(0, 10 - (protectedSwellHeight - 0.3) * (10 / 0.3));
      breakdown.precipitation.score = maxPrecip < 1 ? 10 : 0;
      if (avgTemp >= 22 && avgTemp <= 30) breakdown.temperature.score = 10;
      else if (avgTemp < 22) breakdown.temperature.score = Math.max(0, 10 - (22 - avgTemp));
      else breakdown.temperature.score = Math.max(0, 10 - (avgTemp - 30));
      breakdown.cloudCover.score = avgCloud < 40 ? 10 : Math.max(0, 10 - (avgCloud - 40) / 6);
      breakdown.geoProtection.score = (protection.protectionScore / 100) * 15;

      // Rounding
      for (const key of ['windSpeed', 'waveHeight', 'swellHeight', 'precipitation', 'temperature', 'cloudCover', 'geoProtection'])
        breakdown[key].score = Math.round(breakdown[key].score);

      // Total raw and normalized
      const totalRaw = breakdown.windSpeed.score + breakdown.waveHeight.score + breakdown.swellHeight.score +
        breakdown.precipitation.score + breakdown.temperature.score + breakdown.cloudCover.score + breakdown.geoProtection.score;
      breakdown.total.rawScore = totalRaw;
      breakdown.total.maxPossible = 40 + 20 + 10 + 10 + 10 + 10 + 15; // 115
      breakdown.total.normalized = Math.round((totalRaw / breakdown.total.maxPossible) * 100);

      setScoreBreakdown(breakdown);
    } catch (err) {
      setScoreBreakdown(null);
    }
  };

  // Score label logic
  function getCondition(score) {
    if (!scoreBreakdown) return { label: "Loading", emoji: "⏳", message: "Calculating...", color: "text-gray-500" };
    if (score >= 85) return { label: "Perfect", emoji: "✅", message: "Flat like oil. Paddle on.", color: "text-green-600" };
    if (score >= 70) return { label: "Okay-ish", emoji: "⚠️", message: "Minor chop. Go early.", color: "text-yellow-500" };
    if (score >= 50) return { label: "Not Great", emoji: "❌", message: "Wind or waves make it tricky.", color: "text-orange-600" };
    return { label: "Nope", emoji: "🚫", message: "Not recommended.", color: "text-red-600" };
  }

  return (
    <div className="bg-white rounded-lg shadow-lg overflow-hidden">
      <div className="p-4 border-b flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-semibold flex items-center">
            {beach?.id === homeBeach?.id && (<Home className="h-5 w-5 text-orange-500 mr-2" />)}
            {beach?.name || "Beach"}
          </h2>
          <div className="flex items-center mt-1">
            <p className="text-gray-600 mr-3">{beach ? `${beach.latitude.toFixed(4)}, ${beach.longitude.toFixed(4)}` : ""}</p>
            {beach && (
              <a href={beach.googleMapsUrl || `https://www.google.com/maps?q=${beach.latitude},${beach.longitude}`} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-600 hover:underline flex items-center">
                <Map className="h-3 w-3 mr-1" />View on Maps
              </a>
            )}
          </div>
        </div>
        <div className="flex space-x-2">
          {beach && beach.id !== homeBeach?.id && (
            <button onClick={() => onSetHomeBeach?.(beach)} className="bg-orange-500 text-white px-3 py-1 rounded-lg hover:bg-orange-600 flex items-center">
              <Home className="h-4 w-4 mr-1" />Set as Home
            </button>
          )}
          <button onClick={() => setView?.("dashboard")} className="bg-gray-200 text-gray-800 px-3 py-1 rounded-lg hover:bg-gray-300 flex items-center">
            <ChevronLeft className="h-4 w-4 mr-1" />Back
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
              value={timeRange.date}
              onChange={(e) => onTimeRangeChange?.('date', e.target.value)}
              className="w-full pl-10 p-3 bg-white border rounded-lg cursor-pointer text-lg"
            />
          </div>
        </div>
        <div className="flex space-x-4 mb-4">
          <button onClick={() => onTimeRangeChange?.('date', new Date().toISOString().split('T')[0])} className="flex-1 bg-blue-500 text-white py-3 px-4 rounded-lg text-lg font-medium hover:bg-blue-600">
            Today
          </button>
          <button onClick={() => {
            const tomorrow = new Date();
            tomorrow.setDate(tomorrow.getDate() + 1);
            onTimeRangeChange?.('date', tomorrow.toISOString().split('T')[0]);
          }} className="flex-1 bg-blue-500 text-white py-3 px-4 rounded-lg text-lg font-medium hover:bg-blue-600">
            Tomorrow
          </button>
        </div>
        <div className="grid grid-cols-2 gap-4 mb-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Start Time</label>
            <select value={timeRange.startTime} onChange={(e) => onTimeRangeChange?.('startTime', e.target.value)} className="w-full p-2 border rounded appearance-none bg-white text-lg">
              {Array.from({ length: 24 }, (_, i) => (
                <option key={i} value={`${String(i).padStart(2, '0')}:00`}>{`${String(i).padStart(2, '0')}:00`}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">End Time</label>
            <select value={timeRange.endTime} onChange={(e) => onTimeRangeChange?.('endTime', e.target.value)} className="w-full p-2 border rounded appearance-none bg-white text-lg">
              {Array.from({ length: 24 }, (_, i) => (
                <option key={i} value={`${String(i).padStart(2, '0')}:00`}>{`${String(i).padStart(2, '0')}:00`}</option>
              ))}
            </select>
          </div>
        </div>
        <button onClick={fetchWeatherData} className="w-full bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700 flex items-center justify-center text-lg">
          <RefreshCw className="h-5 w-5 mr-2" />Update Forecast
        </button>
      </div>

      {/* --- LOADING --- */}
      {loading && (
        <div className="p-8 text-center">
          <div className="inline-block animate-spin h-10 w-10 border-4 border-blue-500 border-t-transparent rounded-full mb-4"></div>
          <p className="text-gray-600">Loading real-time weather data...</p>
        </div>
      )}

      {/* --- ERROR --- */}
      {error && !loading && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-md text-red-800 mx-4 my-4">
          <p className="flex items-center font-medium"><AlertCircle className="w-5 h-5 mr-2 text-red-600" />{error}</p>
          <button onClick={fetchWeatherData} className="mt-4 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 w-full flex items-center justify-center">
            <RefreshCw className="h-5 w-5 mr-2" />Try Again
          </button>
        </div>
      )}

      {/* --- MAIN CONTENT --- */}
      {scoreBreakdown && weatherData && marineData && !loading && !error && (
        <div className="p-6">
          {/* --- SCORE CARD --- */}
          <div className="flex flex-col md:flex-row gap-6 mb-6">
            {/* Score Card */}
            <div className="md:w-1/3 bg-white rounded-lg shadow-md p-6 text-center flex flex-col justify-center relative">
              <div className={`text-6xl mb-3 ${getCondition(scoreBreakdown.total.normalized).color}`}>
                {getCondition(scoreBreakdown.total.normalized).emoji}
              </div>
              <h3 className="text-3xl font-bold mb-2 flex items-center justify-center">{getCondition(scoreBreakdown.total.normalized).label}</h3>
              <p className="text-gray-600 text-lg mb-4">{getCondition(scoreBreakdown.total.normalized).message}</p>
              <div className="mt-2 bg-gray-100 rounded-full h-5 overflow-hidden">
                <div className={`h-full ${getCondition(scoreBreakdown.total.normalized).color}`} style={{ width: `${scoreBreakdown.total.normalized}%` }} />
              </div>
              <p className="mt-2 text-lg font-medium text-gray-700">
                Score: {scoreBreakdown.total.normalized}/100
                {scoreBreakdown.total.maxPossible > 100 && (
                  <span className="text-xs text-gray-500 ml-2">
                    ({scoreBreakdown.total.rawScore}/{scoreBreakdown.total.maxPossible})
                  </span>
                )}
              </p>
              <div className="mt-1 text-xs text-gray-500">Using real-time weather data</div>
            </div>
            {/* Quick Factors */}
            <div className="md:w-2/3">
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-white rounded-lg p-3 border flex items-center shadow-sm">
                  <Wind className="h-6 w-6 mr-3 text-blue-600" />
                  <div className="flex-grow">
                    <div className="text-sm text-gray-500">Wind</div>
                    <div className={`text-lg font-medium ${
                      scoreBreakdown.windSpeed.protected < 8 ? "text-green-600" :
                      scoreBreakdown.windSpeed.protected < 15 ? "text-yellow-600" : "text-red-600"
                    }`}>
                      {scoreBreakdown.windSpeed.raw.toFixed(1)} km/h
                      <span className="text-xs ml-2 text-gray-500">
                        (Protected: {scoreBreakdown.windSpeed.protected.toFixed(1)})
                      </span>
                    </div>
                  </div>
                </div>
                <div className="bg-white rounded-lg p-3 border flex items-center shadow-sm">
                  <Waves className="h-6 w-6 mr-3 text-blue-600" />
                  <div className="flex-grow">
                    <div className="text-sm text-gray-500">Wave Height</div>
                    <div className={`text-lg font-medium ${
                      scoreBreakdown.waveHeight.protected < 0.2 ? "text-green-600" :
                      scoreBreakdown.waveHeight.protected < 0.4 ? "text-yellow-600" : "text-red-600"
                    }`}>
                      {scoreBreakdown.waveHeight.raw.toFixed(2)} m
                      <span className="text-xs ml-2 text-gray-500">
                        (Protected: {scoreBreakdown.waveHeight.protected.toFixed(2)})
                      </span>
                    </div>
                  </div>
                </div>
                <div className="bg-white rounded-lg p-3 border flex items-center shadow-sm">
                  <Thermometer className="h-6 w-6 mr-3 text-blue-600" />
                  <div className="flex-grow">
                    <div className="text-sm text-gray-500">Temperature</div>
                    <div className={`text-lg font-medium ${
                      scoreBreakdown.temperature.value >= 22 && scoreBreakdown.temperature.value <= 30
                        ? "text-green-600"
                        : scoreBreakdown.temperature.value >= 18
                        ? "text-yellow-600"
                        : "text-blue-600"
                    }`}>
                      {scoreBreakdown.temperature.value.toFixed(1)}°C
                    </div>
                  </div>
                </div>
                <div className="bg-white rounded-lg p-3 border flex items-center shadow-sm">
                  <Droplets className="h-6 w-6 mr-3 text-blue-600" />
                  <div className="flex-grow">
                    <div className="text-sm text-gray-500">Precipitation</div>
                    <div className={`text-lg font-medium ${
                      scoreBreakdown.precipitation.value < 1 ? "text-green-600" : "text-red-600"
                    }`}>
                      {scoreBreakdown.precipitation.value.toFixed(1)} mm
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Score breakdown */}
          <div className="bg-white p-5 rounded-lg mt-4 shadow-sm border">
            <h4 className="font-medium mb-4 flex items-center text-gray-800">
              <Info className="h-5 w-5 mr-2 text-blue-600" />Score Breakdown
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
                      <span className="text-xs text-gray-400 ml-1">(Protected: {scoreBreakdown.windSpeed.protected.toFixed(1)})</span>
                    </td>
                    <td className={`px-4 py-2 whitespace-nowrap text-sm font-medium text-right ${scoreBreakdown.windSpeed.score > 30 ? 'text-green-600' : scoreBreakdown.windSpeed.score > 20 ? 'text-yellow-600' : 'text-red-600'}`}>
                      {scoreBreakdown.windSpeed.score}/{scoreBreakdown.windSpeed.maxPossible}
                    </td>
                  </tr>
                  <tr>
                    <td className="px-4 py-2 whitespace-nowrap text-sm font-medium text-gray-700">Wave Height</td>
                    <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-500 text-right">
                      {scoreBreakdown.waveHeight.raw.toFixed(2)} m
                      <span className="text-xs text-gray-400 ml-1">(Protected: {scoreBreakdown.waveHeight.protected.toFixed(2)})</span>
                    </td>
                    <td className={`px-4 py-2 whitespace-nowrap text-sm font-medium text-right ${scoreBreakdown.waveHeight.score > 15 ? 'text-green-600' : scoreBreakdown.waveHeight.score > 10 ? 'text-yellow-600' : 'text-red-600'}`}>
                      {scoreBreakdown.waveHeight.score}/{scoreBreakdown.waveHeight.maxPossible}
                    </td>
                  </tr>
                  <tr>
                    <td className="px-4 py-2 whitespace-nowrap text-sm font-medium text-gray-700">Swell Height</td>
                    <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-500 text-right">
                      {scoreBreakdown.swellHeight.raw.toFixed(2)} m
                    </td>
                    <td className={`px-4 py-2 whitespace-nowrap text-sm font-medium text-right ${scoreBreakdown.swellHeight.score > 7 ? 'text-green-600' : scoreBreakdown.swellHeight.score > 5 ? 'text-yellow-600' : 'text-red-600'}`}>
                      {scoreBreakdown.swellHeight.score}/{scoreBreakdown.swellHeight.maxPossible}
                    </td>
                  </tr>
                  <tr>
                    <td className="px-4 py-2 whitespace-nowrap text-sm font-medium text-gray-700">Precipitation</td>
                    <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-500 text-right">
                      {scoreBreakdown.precipitation.value.toFixed(1)} mm
                    </td>
                    <td className={`px-4 py-2 whitespace-nowrap text-sm font-medium text-right ${scoreBreakdown.precipitation.value < 1 ? 'text-green-600' : 'text-red-600'}`}>
                      {scoreBreakdown.precipitation.score}/{scoreBreakdown.precipitation.maxPossible}
                    </td>
                  </tr>
                  <tr>
                    <td className="px-4 py-2 whitespace-nowrap text-sm font-medium text-gray-700">Temperature</td>
                    <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-500 text-right">
                      {scoreBreakdown.temperature.value.toFixed(1)} °C
                    </td>
                    <td className={`px-4 py-2 whitespace-nowrap text-sm font-medium text-right ${scoreBreakdown.temperature.score > 7 ? 'text-green-600' : 'text-yellow-600'}`}>
                      {scoreBreakdown.temperature.score}/{scoreBreakdown.temperature.maxPossible}
                    </td>
                  </tr>
                  <tr>
                    <td className="px-4 py-2 whitespace-nowrap text-sm font-medium text-gray-700">Cloud Cover</td>
                    <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-500 text-right">
                      {scoreBreakdown.cloudCover.value.toFixed(0)}%
                    </td>
                    <td className={`px-4 py-2 whitespace-nowrap text-sm font-medium text-right ${scoreBreakdown.cloudCover.score > 7 ? 'text-green-600' : scoreBreakdown.cloudCover.score > 5 ? 'text-yellow-600' : 'text-gray-600'}`}>
                      {scoreBreakdown.cloudCover.score}/{scoreBreakdown.cloudCover.maxPossible}
                    </td>
                  </tr>
                  <tr>
                    <td className="px-4 py-2 whitespace-nowrap text-sm font-medium text-gray-700">Geographic Protection</td>
                    <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-500 text-right">
                      {scoreBreakdown.geoProtection.value.toFixed(0)}/100
                    </td>
                    <td className={`px-4 py-2 whitespace-nowrap text-sm font-medium text-right ${scoreBreakdown.geoProtection.score > 10 ? 'text-green-600' : scoreBreakdown.geoProtection.score > 5 ? 'text-yellow-600' : 'text-red-600'}`}>
                      {scoreBreakdown.geoProtection.score}/{scoreBreakdown.geoProtection.maxPossible}
                    </td>
                  </tr>
                  <tr className="bg-blue-50">
                    <td className="px-4 py-3 whitespace-nowrap text-sm font-bold text-gray-900">TOTAL SCORE</td>
                    <td className="px-4 py-3 whitespace-nowrap"></td>
                    <td className={`px-4 py-3 whitespace-nowrap text-sm font-bold text-right ${
                      scoreBreakdown.total.normalized >= 85 ? 'text-green-600' :
                      scoreBreakdown.total.normalized >= 70 ? 'text-yellow-600' :
                      scoreBreakdown.total.normalized >= 50 ? 'text-orange-600' : 'text-red-600'
                    }`}>
                      {scoreBreakdown.total.rawScore}/{scoreBreakdown.total.maxPossible}
                      <span className="text-xs text-gray-500 ml-2">(normalized: {scoreBreakdown.total.normalized}/100)</span>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* --- ADD YOUR GEO PROTECTION + HOURLY CHARTS BACK BELOW HERE --- */}
          {/* ... just paste in your previous geo protection and hourly wind chart components ... */}
        </div>
      )}
    </div>
  );
};

export default FixedBeachView;

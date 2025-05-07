// FixedBeachView.jsx - Production-ready with tide & currents integration
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
  Sun,
  Clock,
  Calendar,
  Info
} from "lucide-react";
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

  // Fetch real weather, wave, tide & current data
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
      const weatherUrl = `https://api.open-meteo.com/v1/forecast?latitude=${beach.latitude}&longitude=${beach.longitude}` +
        `&hourly=temperature_2m,precipitation,cloudcover,windspeed_10m,winddirection_10m` +
        `&start_date=${formattedDate}&end_date=${formattedTomorrow}&timezone=auto`;

      const marineUrl = `https://marine-api.open-meteo.com/v1/marine?latitude=${beach.latitude}&longitude=${beach.longitude}` +
        `&hourly=wave_height,swell_wave_height,wave_direction,tide_height,current_speed,current_direction` +
        `&daily=wave_height_max,wave_direction_dominant&start_date=${formattedDate}&end_date=${formattedTomorrow}&timezone=auto`;

      // Fetch data
      const [weatherRes, marineRes] = await Promise.all([
        fetch(weatherUrl),
        fetch(marineUrl)
      ]);

      if (!weatherRes.ok)
        throw new Error(`Weather API error: ${weatherRes.status}`);
      if (!marineRes.ok)
        throw new Error(`Marine API error: ${marineRes.status}`);

      const weatherJson = await weatherRes.json();
      const marineJson = await marineRes.json();

      setWeatherData(weatherJson);
      setMarineData(marineJson);

      // Calculate scores
      await calculateScores(weatherJson, marineJson, beach);

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
      // Determine relevant hourly indexes
      const startHour = parseInt(timeRange.startTime.split(":")[0]);
      const endHour = parseInt(timeRange.endTime.split(":")[0]);
      const indices = [];

      for (let i = 0; i < weather.hourly.time.length; i++) {
        const date = new Date(weather.hourly.time[i]);
        if (date.getHours() >= startHour && date.getHours() <= endHour) {
          indices.push(i);
        }
      }

      // Fallback: use all hours of the day
      if (indices.length === 0) {
        for (let i = 0; i < weather.hourly.time.length; i++) {
          const date = new Date(weather.hourly.time[i]);
          if (date.getDate() === new Date(timeRange.date).getDate()) {
            indices.push(i);
          }
        }
      }

      const avg = (arr) => arr.reduce((sum, v) => sum + v, 0) / arr.length;

      // Compute averages
      const temps = indices.map(i => weather.hourly.temperature_2m[i]);
      const winds = indices.map(i => weather.hourly.windspeed_10m[i]);
      const clouds = indices.map(i => weather.hourly.cloudcover[i]);
      const precs = indices.map(i => weather.hourly.precipitation[i]);
      const windDirs = indices.map(i => weather.hourly.winddirection_10m[i]);
      const waveMax = marine.daily.wave_height_max[0];
      const swells = indices.map(i => marine.hourly.swell_wave_height[i]);
      const tides = indices.map(i => marine.hourly.tide_height[i]);
      const currents = indices.map(i => marine.hourly.current_speed[i]);

      const avgTemp = avg(temps);
      const avgWind = avg(winds);
      const avgCloud = avg(clouds);
      const maxPrecip = Math.max(...precs);
      const avgWindDir = avg(windDirs);
      const avgSwell = avg(swells);
      const avgTide = avg(tides);
      const avgCurrent = avg(currents);

      // Geographic protection
      const waveDir = marine.daily.wave_direction_dominant[0];
      const protection = await calculateGeographicProtection(beach, avgWindDir, waveDir);
      setGeoProtection(protection);

      const protectedWind = avgWind * (1 - protection.windProtection * 0.9);
      const protectedWave = waveMax * (1 - protection.waveProtection * 0.9);
      const protectedSwell = avgSwell * (1 - protection.waveProtection * 0.85);

      // Initialize breakdown
      const breakdown = {
        windSpeed:      { raw: avgWind, protected: protectedWind, score: 0, maxPossible: 40 },
        waveHeight:     { raw: waveMax, protected: protectedWave, score: 0, maxPossible: 20 },
        swellHeight:    { raw: avgSwell, protected: protectedSwell, score: 0, maxPossible: 10 },
        precipitation:  { value: maxPrecip, score: 0, maxPossible: 10 },
        temperature:    { value: avgTemp, score: 0, maxPossible: 10 },
        cloudCover:     { value: avgCloud, score: 0, maxPossible: 10 },
        geoProtection:  { value: protection.protectionScore, score: 0, maxPossible: 15 },
        tide:           { value: avgTide, score: 0, maxPossible: 10 },
        currents:       { value: avgCurrent, score: 0, maxPossible: 5 },
        total:          { score: 0, maxPossible: 100 }
      };

      let totalScore = 0;

      // Wind (40 pts)
      breakdown.windSpeed.score = protectedWind < 8
        ? 40
        : Math.max(0, 40 - (protectedWind - 8) * (40 / 12));
      totalScore += breakdown.windSpeed.score;

      // Waves (20 pts)
      breakdown.waveHeight.score = protectedWave < 0.2
        ? 20
        : Math.max(0, 20 - (protectedWave - 0.2) * (20 / 0.4));
      totalScore += breakdown.waveHeight.score;

      // Swell (10 pts)
      breakdown.swellHeight.score = protectedSwell < 0.3
        ? 10
        : Math.max(0, 10 - (protectedSwell - 0.3) * (10 / 0.3));
      totalScore += breakdown.swellHeight.score;

      // Precipitation (10 pts)
      breakdown.precipitation.score = maxPrecip < 1 ? 10 : 0;
      totalScore += breakdown.precipitation.score;

      // Temperature (10 pts)
      if (avgTemp >= 22 && avgTemp <= 30) {
        breakdown.temperature.score = 10;
      } else if (avgTemp < 22) {
        breakdown.temperature.score = Math.max(0, 10 - (22 - avgTemp));
      } else {
        breakdown.temperature.score = Math.max(0, 10 - (avgTemp - 30));
      }
      totalScore += breakdown.temperature.score;

      // Cloud cover (10 pts)
      breakdown.cloudCover.score = avgCloud < 40
        ? 10
        : Math.max(0, 10 - (avgCloud - 40) / 6);
      totalScore += breakdown.cloudCover.score;

      // Geographic protection (15 pts)
      breakdown.geoProtection.score = (protection.protectionScore / 100) * 15;
      totalScore += breakdown.geoProtection.score;

      // Tide (10 pts) – ideal between 0.5m and 2.0m
      let tideScore;
      if (avgTide >= 0.5 && avgTide <= 2.0) tideScore = 10;
      else if (avgTide < 0.5) tideScore = (avgTide / 0.5) * 10;
      else tideScore = ((2.0 * 2 - avgTide) / 2.0) * 10;
      breakdown.tide.score = Math.round(Math.max(0, tideScore));
      totalScore += breakdown.tide.score;

      // Currents (5 pts) – penalize >1.5 m/s
      const currScore = (1 - Math.min(avgCurrent / 1.5, 1)) * 5;
      breakdown.currents.score = Math.round(Math.max(0, currScore));
      totalScore += breakdown.currents.score;

      // Cap total at 100
      breakdown.total.score = Math.round(Math.min(100, totalScore));

      // Special: heavy rain limits score
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

  // Render the “Score Breakdown” table
  const renderScoreBreakdown = () => {
    if (!scoreBreakdown) return null;
    const sb = scoreBreakdown;

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
              {/* Wind */}
              <tr>
                <td className="px-4 py-2 text-sm font-medium text-gray-700">Wind Speed</td>
                <td className="px-4 py-2 text-sm text-gray-500 text-right">
                  {sb.windSpeed.raw.toFixed(1)} km/h <span className="text-xs text-gray-400">(Prot: {sb.windSpeed.protected.toFixed(1)})</span>
                </td>
                <td className={`px-4 py-2 text-sm font-medium text-right ${
                  sb.windSpeed.score > 30 ? 'text-green-600' :
                  sb.windSpeed.score > 20 ? 'text-yellow-600' : 'text-red-600'
                }`}>
                  {sb.windSpeed.score}/{sb.windSpeed.maxPossible}
                </td>
              </tr>
              {/* Waves */}
              <tr>
                <td className="px-4 py-2 text-sm font-medium text-gray-700">Wave Height</td>
                <td className="px-4 py-2 text-sm text-gray-500 text-right">
                  {sb.waveHeight.raw.toFixed(2)} m <span className="text-xs text-gray-400">(Prot: {sb.waveHeight.protected.toFixed(2)})</span>
                </td>
                <td className={`px-4 py-2 text-sm font-medium text-right ${
                  sb.waveHeight.score > 15 ? 'text-green-600' :
                  sb.waveHeight.score > 10 ? 'text-yellow-600' : 'text-red-600'
                }`}>
                  {sb.waveHeight.score}/{sb.waveHeight.maxPossible}
                </td>
              </tr>
              {/* Swell */}
              <tr>
                <td className="px-4 py-2 text-sm font-medium text-gray-700">Swell Height</td>
                <td className="px-4 py-2 text-sm text-gray-500 text-right">
                  {sb.swellHeight.raw.toFixed(2)} m
                </td>
                <td className={`px-4 py-2 text-sm font-medium text-right ${
                  sb.swellHeight.score > 7 ? 'text-green-600' :
                  sb.swellHeight.score > 5 ? 'text-yellow-600' : 'text-red-600'
                }`}>
                  {sb.swellHeight.score}/{sb.swellHeight.maxPossible}
                </td>
              </tr>
              {/* Precipitation */}
              <tr>
                <td className="px-4 py-2 text-sm font-medium text-gray-700">Precipitation</td>
                <td className="px-4 py-2 text-sm text-gray-500 text-right">
                  {sb.precipitation.value.toFixed(1)} mm
                </td>
                <td className={`px-4 py-2 text-sm font-medium text-right ${
                  sb.precipitation.value < 1 ? 'text-green-600' : 'text-red-600'
                }`}>
                  {sb.precipitation.score}/{sb.precipitation.maxPossible}
                </td>
              </tr>
              {/* Temperature */}
              <tr>
                <td className="px-4 py-2 text-sm font-medium text-gray-700">Temperature</td>
                <td className="px-4 py-2 text-sm text-gray-500 text-right">
                  {sb.temperature.value.toFixed(1)} °C
                </td>
                <td className={`px-4 py-2 text-sm font-medium text-right ${
                  sb.temperature.score > 7 ? 'text-green-600' : 'text-yellow-600'
                }`}>
                  {sb.temperature.score}/{sb.temperature.maxPossible}
                </td>
              </tr>
              {/* Cloud Cover */}
              <tr>
                <td className="px-4 py-2 text-sm font-medium text-gray-700">Cloud Cover</td>
                <td className="px-4 py-2 text-sm text-gray-500 text-right">
                  {sb.cloudCover.value.toFixed(0)} %
                </td>
                <td className={`px-4 py-2 text-sm font-medium text-right ${
                  sb.cloudCover.score > 7 ? 'text-green-600' :
                  sb.cloudCover.score > 5 ? 'text-yellow-600' : 'text-gray-600'
                }`}>
                  {sb.cloudCover.score}/{sb.cloudCover.maxPossible}
                </td>
              </tr>
              {/* Geographic Protection */}
              <tr>
                <td className="px-4 py-2 text-sm font-medium text-gray-700">Geographic Protection</td>
                <td className="px-4 py-2 text-sm text-gray-500 text-right">
                  {sb.geoProtection.value.toFixed(0)}/100
                </td>
                <td className={`px-4 py-2 text-sm font-medium text-right ${
                  sb.geoProtection.score > 10 ? 'text-green-600' :
                  sb.geoProtection.score > 5 ? 'text-yellow-600' : 'text-red-600'
                }`}>
                  {sb.geoProtection.score}/{sb.geoProtection.maxPossible}
                </td>
              </tr>
              {/* Tide (NEW) */}
              <tr>
                <td className="px-4 py-2 text-sm font-medium text-gray-700">Tide</td>
                <td className="px-4 py-2 text-sm text-gray-500 text-right">
                  {sb.tide.value.toFixed(2)} m
                </td>
                <td className={`px-4 py-2 text-sm font-medium text-right ${
                  sb.tide.score > 7 ? 'text-green-600' : 'text-gray-600'
                }`}>
                  {sb.tide.score}/{sb.tide.maxPossible}
                </td>
              </tr>
              {/* Currents (NEW) */}
              <tr>
                <td className="px-4 py-2 text-sm font-medium text-gray-700">Currents</td>
                <td className="px-4 py-2 text-sm text-gray-500 text-right">
                  {sb.currents.value.toFixed(2)} m/s
                </td>
                <td className={`px-4 py-2 text-sm font-medium text-right ${
                  sb.currents.score > 3 ? 'text-green-600' : 'text-gray-600'
                }`}>
                  {sb.currents.score}/{sb.currents.maxPossible}
                </td>
              </tr>
              {/* Total */}
              <tr className="bg-blue-50">
                <td className="px-4 py-3 text-sm font-bold text-gray-900">TOTAL SCORE</td>
                <td className="px-4 py-3"></td>
                <td className={`px-4 py-3 text-sm font-bold text-right ${
                  sb.total.score >= 85 ? 'text-green-600' :
                  sb.total.score >= 70 ? 'text-yellow-600' :
                  sb.total.score >= 50 ? 'text-orange-600' : 'text-red-600'
                }`}>
                  {sb.total.score}/{sb.total.maxPossible}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  // [The rest of your component (renderGeoProtectionInfo, renderHourlyWind, header, etc.) remains unchanged]

  return (
    <div className="bg-white rounded-lg shadow-lg overflow-hidden">
      {/* ... header, date/time picker, loading, error, condition card, etc. */}
      {weatherData && marineData && !loading && !error && (
        <div className="p-6">
          {/* Score display & weather cards */}
          {/* ... */}
          {/* Safety alert */}
          {/* ... */}
          {/* New Score Breakdown */}
          {renderScoreBreakdown()}
          {/* Geographic Protection Info */}
          {/* ... */}
          {/* Hourly Wind Chart */}
          {/* ... */}
        </div>
      )}
    </div>
  );
};

export default FixedBeachView;

// FixedBeachView.jsx - Production-ready with Tide & Currents Integration
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
  const [showDatePicker, setShowDatePicker] = useState(false);
  
  // Load data on mount and when date/time changes
  useEffect(() => {
    if (beach) {
      fetchWeatherData();
    }
  }, [beach?.id, timeRange.date, timeRange.startTime, timeRange.endTime]);
  
  // Fetch real weather and marine data (waves, tide, currents)
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
      const weatherUrl =
        `https://api.open-meteo.com/v1/forecast?latitude=${beach.latitude}&longitude=${beach.longitude}` +
        `&hourly=temperature_2m,precipitation,cloudcover,windspeed_10m,winddirection_10m` +
        `&daily=precipitation_sum,windspeed_10m_max` +
        `&start_date=${formattedDate}&end_date=${formattedTomorrow}&timezone=auto`;
      
      const marineUrl =
        `https://marine-api.open-meteo.com/v1/marine?latitude=${beach.latitude}&longitude=${beach.longitude}` +
        `&hourly=wave_height,swell_wave_height,wave_direction,sea_level_height_msl,ocean_current_velocity,ocean_current_direction` +
        `&daily=wave_height_max,wave_direction_dominant` +
        `&start_date=${formattedDate}&end_date=${formattedTomorrow}&timezone=auto`;
      
      // Fetch data
      const [weatherRes, marineRes] = await Promise.all([
        fetch(weatherUrl),
        fetch(marineUrl)
      ]);
      
      if (!weatherRes.ok) throw new Error(`Weather API error: ${weatherRes.status}`);
      if (!marineRes.ok)  throw new Error(`Marine API error: ${marineRes.status}`);
      
      const weatherJson = await weatherRes.json();
      const marineJson  = await marineRes.json();
      
      setWeatherData(weatherJson);
      setMarineData(marineJson);
      
      // Calculate scores including tide & currents
      await calculateScores(weatherJson, marineJson, beach);
      
      // Update last updated timestamp
      if (typeof onDataUpdate === 'function') onDataUpdate();
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
      const startHour = parseInt(timeRange.startTime.split(":")[0]);
      const endHour   = parseInt(timeRange.endTime.split(":")[0]);
      const relevantIndices = [];

      for (let i = 0; i < weather.hourly.time.length; i++) {
        const hr = new Date(weather.hourly.time[i]).getHours();
        if (hr >= startHour && hr <= endHour) relevantIndices.push(i);
      }
      // fallback: all hours of date
      if (!relevantIndices.length) {
        const targetDay = new Date(timeRange.date).getDate();
        for (let i = 0; i < weather.hourly.time.length; i++) {
          if (new Date(weather.hourly.time[i]).getDate() === targetDay)
            relevantIndices.push(i);
        }
      }
      const avg = arr => arr.reduce((s,v) => s+v,0)/arr.length;
      // Averages
      const avgTemp   = avg(relevantIndices.map(i => weather.hourly.temperature_2m[i]));
      const avgWind   = avg(relevantIndices.map(i => weather.hourly.windspeed_10m[i]));
      const avgCloud  = avg(relevantIndices.map(i => weather.hourly.cloudcover[i]));
      const maxPrecip = Math.max(...relevantIndices.map(i => weather.hourly.precipitation[i]));
      const avgDir    = avg(relevantIndices.map(i => weather.hourly.winddirection_10m[i]));
      const waveMax   = marine.daily.wave_height_max[0];
      const avgSwell  = avg(relevantIndices.map(i => marine.hourly.swell_wave_height[i]));
      const avgTide   = avg(relevantIndices.map(i => marine.hourly.sea_level_height_msl[i]));
      const avgCurr   = avg(relevantIndices.map(i => marine.hourly.ocean_current_velocity[i]));

      // Geographic protection
      const domWaveDir = marine.daily.wave_direction_dominant[0];
      const protection = await calculateGeographicProtection(beach, avgDir, domWaveDir);
      setGeoProtection(protection);

      const protWind  = avgWind * (1 - protection.windProtection * 0.9);
      const protWave  = waveMax  * (1 - protection.waveProtection * 0.9);
      const protSwell = avgSwell* (1 - protection.waveProtection * 0.85);
      
      // Breakdown
      const breakdown = {
        windSpeed:    { raw: avgWind,    protected: protWind,  score:0, maxPossible:40 },
        waveHeight:   { raw: waveMax,    protected: protWave,  score:0, maxPossible:20 },
        swellHeight:  { raw: avgSwell,   protected: protSwell, score:0, maxPossible:10 },
        precipitation:{ raw: maxPrecip,  score:0, maxPossible:10 },
        temperature:  { raw: avgTemp,    score:0, maxPossible:10 },
        cloudCover:   { raw: avgCloud,   score:0, maxPossible:10 },
        geoProtection:{ raw: protection.protectionScore, score:0, maxPossible:15 },
        tide:         { raw: avgTide,    score:0, maxPossible:10 },
        currents:     { raw: avgCurr,    score:0, maxPossible:5  },
        total:        { score:0, maxPossible:100 }
      };
      let totalScore = 0;
      // Wind
      breakdown.windSpeed.score    = protWind<8?40:Math.max(0,40-(protWind-8)*(40/12)); totalScore+=breakdown.windSpeed.score;
      // Waves
      breakdown.waveHeight.score   = protWave<0.2?20:Math.max(0,20-(protWave-0.2)*(20/0.4)); totalScore+=breakdown.waveHeight.score;
      // Swell
      breakdown.swellHeight.score  = protSwell<0.3?10:Math.max(0,10-(protSwell-0.3)*(10/0.3)); totalScore+=breakdown.swellHeight.score;
      // Precip
      breakdown.precipitation.score= maxPrecip<1?10:0; totalScore+=breakdown.precipitation.score;
      // Temp
      if (avgTemp>=22&&avgTemp<=30) breakdown.temperature.score=10;
      else if (avgTemp<22) breakdown.temperature.score=Math.max(0,10-(22-avgTemp));
      else breakdown.temperature.score=Math.max(0,10-(avgTemp-30)); totalScore+=breakdown.temperature.score;
      // Cloud
      breakdown.cloudCover.score   = avgCloud<40?10:Math.max(0,10-(avgCloud-40)/6); totalScore+=breakdown.cloudCover.score;
      // Geo
      breakdown.geoProtection.score= (protection.protectionScore/100)*15; totalScore+=breakdown.geoProtection.score;
      // Tide (ideal 0.5-2.0m)
      let tScore = avgTide>=0.5&&avgTide<=2.0?10:avgTide<0.5?(avgTide/0.5)*10:((2.0*2-avgTide)/2.0)*10;
      breakdown.tide.score = Math.round(Math.max(0,tScore)); totalScore+=breakdown.tide.score;
      // Currents (>1.5m/s penalize)
      breakdown.currents.score= Math.round(Math.max(0,(1-Math.min(avgCurr/1.5,1))*5)); totalScore+=breakdown.currents.score;
      // Cap total
      breakdown.total.score = Math.round(Math.min(100,totalScore));
      if (maxPrecip>=1.5) { breakdown.precipitation.score=0; breakdown.total.score=Math.min(breakdown.total.score,40);}      
      // Round individual
      ["windSpeed","waveHeight","swellHeight","precipitation","temperature","cloudCover","geoProtection"].forEach(k=>{breakdown[k].score=Math.round(breakdown[k].score);});
      setPaddleScore(breakdown.total.score);
      setScoreBreakdown(breakdown);

    } catch(err) {
      console.error("Error calculating scores:", err);
      setPaddleScore(null);
      setScoreBreakdown(null);
    }
  };

  // Helpers to render
  const getCondition = (score) => { /* unchanged from your code */ };
  const getConditionDetails = () => { /* unchanged from your code */ };
  const renderGeoProtectionInfo = () => { /* unchanged from your code */ };
  const renderHourlyWind      = () => { /* unchanged from your code */ };

  // Render Score Breakdown with Tide & Currents
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
              <tr>
                <td className="px-4 py-2 whitespace-nowrap text-sm font-medium text-gray-700">Wind Speed</td>
                <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-500 text-right">
                  {scoreBreakdown.windSpeed.raw.toFixed(1)} km/h <span className="text-xs text-gray-400 ml-1">(Protected: {scoreBreakdown.windSpeed.protected.toFixed(1)})</span>
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
                  {scoreBreakdown.waveHeight.raw.toFixed(2)} m <span className="text-xs text-gray-400 ml-1">(Protected: {scoreBreakdown.waveHeight.protected.toFixed(2)})</span>
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
              <tr>
                <td className="px-4 py-2 whitespace-nowrap text-sm font-medium text-gray-700">Tide</td>
                <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-500 text-right">
                  {scoreBreakdown.tide.raw.toFixed(2)} m
                </td>
                <td className={`px-4 py-2 whitespace-nowrap text-sm font-medium text-right ${
                  scoreBreakdown.tide.score > 7 ? 'text-green-600' : 'text-red-600'
                }`}>
                  {scoreBreakdown.tide.score}/{scoreBreakdown.tide.maxPossible}
                </td>
              </tr>
              <tr>
                <td className="px-4 py-2 whitespace-nowrap text-sm font-medium text-gray-700">Currents</td>
                <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-500 text-right">
                  {scoreBreakdown.currents.raw.toFixed(2)} m/s
                </td>
                <td className={`px-4 py-2 whitespace-nowrap text-sm font-medium text-right ${
                  scoreBreakdown.currents.score > 3 ? 'text-green-600' : 'text-red-600'
                }`}>
                  {scoreBreakdown.currents.score}/{scoreBreakdown.currents.maxPossible}
                </td>
              </tr>
              <tr className="bg-blue-50">
                <td className="px-4 py-3 whitespace-nowrap text-sm font-bold text-gray-900">TOTAL SCORE</td>
                <td className="px-4 py-3 whitespace-nowrap"></td>
                <td className={`px-4 py-3 whitespace-nowrap text-sm font-bold text-right ${
                  scoreBreakdown.total.score >= 85 ? 'text-green-600' :
                  scoreBreakdown.total.score >= 70 ? 'text-yellow-600' :
                  scoreBreakdown.total.score >= 50 ? 'text-orange-600' : 'text-red-600'
                }`}>
                  {scoreBreakdown.total.score}/{scoreBreakdown.total.maxPossible}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  // Main render
  return (
    <div className="bg-white rounded-lg shadow-lg overflow-hidden">
      {/* header, date/time, loading, error, etc. (unchanged) */}
      {weatherData && marineData && !loading && !error && (
        <div className="p-6">
          {/* condition card, weather cards (unchanged) */}
          {renderScoreBreakdown()}
          {renderGeoProtectionInfo()}
          {renderHourlyWind()}
          <div className="text-center mt-6 text-sm text-gray-600">
            This is real-time weather data from Open-Meteo API. Always verify conditions before paddleboarding.
          </div>
        </div>
      )}
    </div>
  );
};

export default FixedBeachView;

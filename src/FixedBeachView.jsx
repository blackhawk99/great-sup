// src/FixedBeachView.jsx
import React, { useState, useEffect } from "react";
import {
  Home,
  ChevronLeft,
  RefreshCw,
  AlertCircle,
  Map,
  Wind,
  Thermometer,
  Droplets,
  Waves,
  Clock,
  Calendar,
  Info,
  MapPin
} from "lucide-react";
import { calculateGeographicProtection } from "./utils/coastlineAnalysis";

export default function FixedBeachView({
  beach,
  homeBeach,
  onSetHomeBeach,
  setView,
  onDataUpdate,
  timeRange,
  onTimeRangeChange
}) {
  const [weatherData, setWeatherData] = useState(null);
  const [marineData, setMarineData] = useState(null);
  const [paddleScore, setPaddleScore] = useState(null);
  const [scoreBreakdown, setScoreBreakdown] = useState(null);
  const [geoProtection, setGeoProtection] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Safe fallback for the condition card
  const condition =
    paddleScore !== null && scoreBreakdown
      ? computeCondition(paddleScore, weatherData, scoreBreakdown)
      : { emoji: "⏳", label: "Loading", message: "Calculating...", color: "text-gray-500" };

  // Re-fetch on beach, date, or timeWindow change
  useEffect(() => {
    if (beach) fetchWeatherData();
  }, [beach?.id, timeRange.date, timeRange.startTime, timeRange.endTime]);

  // ─────────── Fetch data ───────────
  async function fetchWeatherData() {
    if (!beach) return;
    setLoading(true);
    setError(null);

    try {
      const d0 = new Date(timeRange.date).toISOString().slice(0, 10);
      const tmp = new Date(timeRange.date);
      tmp.setDate(tmp.getDate() + 1);
      const d1 = tmp.toISOString().slice(0, 10);

      const weatherUrl =
        `https://api.open-meteo.com/v1/forecast` +
        `?latitude=${beach.latitude}&longitude=${beach.longitude}` +
        `&hourly=temperature_2m,precipitation,cloudcover,windspeed_10m,winddirection_10m` +
        `&start_date=${d0}&end_date=${d1}&timezone=auto`;

      const marineUrl =
        `https://marine-api.open-meteo.com/v1/marine` +
        `?latitude=${beach.latitude}&longitude=${beach.longitude}` +
        `&hourly=wave_height,swell_wave_height,wave_direction,sea_level_height_msl,ocean_current_velocity,ocean_current_direction` +
        `&daily=wave_height_max,wave_direction_dominant` +
        `&start_date=${d0}&end_date=${d1}&timezone=auto`;

      const [wRes, mRes] = await Promise.all([fetch(weatherUrl), fetch(marineUrl)]);
      if (!wRes.ok) throw new Error(`Weather API ${wRes.status}`);
      if (!mRes.ok) throw new Error(`Marine API ${mRes.status}`);

      const wJson = await wRes.json();
      const mJson = await mRes.json();
      setWeatherData(wJson);
      setMarineData(mJson);

      await calculateScores(wJson, mJson);
      onDataUpdate?.();
    } catch (err) {
      console.error(err);
      setError(err.message || "Failed to fetch data");
    } finally {
      setLoading(false);
    }
  }

  // ─────────── Calculate scores ───────────
  async function calculateScores(weather, marine) {
    const [h0, h1] = timeRange.startTime.split(":").map(Number);
    const hours = weather.hourly.time.map((t) => new Date(t).getHours());
    let picks = hours
      .map((h, i) => (h >= h0 && h <= h1 ? i : -1))
      .filter((i) => i >= 0);

    // fallback to entire day if none in window
    if (!picks.length) {
      const targetDay = new Date(timeRange.date).getDate();
      picks = weather.hourly.time
        .map((t, i) => (new Date(t).getDate() === targetDay ? i : -1))
        .filter((i) => i >= 0);
    }

    const avg = (arr) => arr.reduce((s, v) => s + v, 0) / arr.length;
    const avgTemp = avg(picks.map((i) => weather.hourly.temperature_2m[i]));
    const avgWind = avg(picks.map((i) => weather.hourly.windspeed_10m[i]));
    const avgCloud = avg(picks.map((i) => weather.hourly.cloudcover[i]));
    const maxPrecip = Math.max(...picks.map((i) => weather.hourly.precipitation[i]));
    const avgDir = avg(picks.map((i) => weather.hourly.winddirection_10m[i]));
    const waveMax = marine.daily.wave_height_max[0];
    const avgSwell = avg(picks.map((i) => marine.hourly.swell_wave_height[i]));
    const avgTide = avg(picks.map((i) => marine.hourly.sea_level_height_msl[i]));
    const avgCurr = avg(picks.map((i) => marine.hourly.ocean_current_velocity[i]));

    // geographic protection
    const domWaveDir = marine.daily.wave_direction_dominant[0];
    const geo = await calculateGeographicProtection(beach, avgDir, domWaveDir);
    setGeoProtection(geo);

    // apply protection
    const protWind = avgWind * (1 - geo.windProtection * 0.9);
    const protWave = waveMax * (1 - geo.waveProtection * 0.9);
    const protSwell = avgSwell * (1 - geo.waveProtection * 0.85);

    // breakdown
    const bd = {
      windSpeed: { raw: avgWind, protected: protWind, score: 0, max: 40 },
      waveHeight: { raw: waveMax, protected: protWave, score: 0, max: 20 },
      swellHeight: { raw: avgSwell, protected: protSwell, score: 0, max: 10 },
      temperature: { raw: avgTemp, score: 0, max: 10 },
      precipitation: { raw: maxPrecip, score: 0, max: 10 },
      cloudCover: { raw: avgCloud, score: 0, max: 10 },
      geoProtection: { raw: geo.protectionScore, score: 0, max: 15 },
      tide: { raw: avgTide, score: 0, max: 10 },
      currents: { raw: avgCurr, score: 0, max: 5 },
      total: { score: 0, max: 100 }
    };

    // scoring logic
    let total = 0;
    bd.windSpeed.score = protWind < 8 ? 40 : Math.max(0, 40 - (protWind - 8) * (40 / 12)); total += bd.windSpeed.score;
    bd.waveHeight.score = protWave < 0.2 ? 20 : Math.max(0, 20 - (protWave - 0.2) * (20 / 0.4)); total += bd.waveHeight.score;
    bd.swellHeight.score = avgSwell < 0.3 ? 10 : Math.max(0, 10 - (avgSwell - 0.3) * (10 / 0.3)); total += bd.swellHeight.score;
    bd.temperature.score = avgTemp >= 22 && avgTemp <= 30
      ? 10
      : avgTemp < 22
        ? Math.max(0, 10 - (22 - avgTemp))
        : Math.max(0, 10 - (avgTemp - 30));
    total += bd.temperature.score;
    bd.precipitation.score = maxPrecip < 1 ? 10 : 0; total += bd.precipitation.score;
    bd.cloudCover.score = avgCloud < 40 ? 10 : Math.max(0, 10 - (avgCloud - 40) / 6); total += bd.cloudCover.score;
    bd.geoProtection.score = (geo.protectionScore / 100) * 15; total += bd.geoProtection.score;
    const tideScore = avgTide >= 0.5 && avgTide <= 2.0
      ? 10
      : avgTide < 0.5
        ? (avgTide / 0.5) * 10
        : ((2 * 2 - avgTide) / 2) * 10;
    bd.tide.score = Math.round(Math.max(0, tideScore)); total += bd.tide.score;
    bd.currents.score = Math.round(Math.max(0, (1 - Math.min(avgCurr / 1.5, 1)) * 5)); total += bd.currents.score;

    // cap total at 100
    bd.total.score = Math.round(Math.min(100, total));

    // heavy rain special
    if (maxPrecip >= 1.5) {
      bd.precipitation.score = 0;
      bd.total.score = Math.min(bd.total.score, 40);
    }

    // round each subscore
    ["windSpeed","waveHeight","swellHeight","temperature","precipitation","cloudCover","geoProtection"].forEach(k => {
      bd[k].score = Math.round(bd[k].score);
    });

    setPaddleScore(bd.total.score);
    setScoreBreakdown(bd);
  }

  // condition logic
  function computeCondition(score, w, bd) {
    const temp = w.hourly.temperature_2m[12];
    const wind = bd.windSpeed.protected;
    const rain = w.hourly.precipitation[12];
    if (score >= 85) {
      if (temp < 18) return { emoji: "🧊", label: "Chilly but Calm", message: "Great but bring a wetsuit.", color: "text-blue-500" };
      if (rain >= 0.5) return { emoji: "🌧️", label: "Calm but Wet", message: "Light rain but safe.", color: "text-blue-500" };
      if (wind > 15) return { emoji: "✅", label: "Excellent", message: "Well protected, enjoy!", color: "text-green-500" };
      return { emoji: "✅", label: "Perfect", message: "Flat like oil. Paddle on.", color: "text-green-500" };
    }
    if (score >= 70) return { emoji: "⚠️", label: "Okay-ish", message: "Minor chop. Go early.", color: "text-yellow-500" };
    if (score >= 50) return { emoji: "❌", label: "Not Great", message: "Wind or waves tricky.", color: "text-orange-500" };
    return { emoji: "🚫", label: "Nope", message: "Not recommended.", color: "text-red-500" };
  }

  // cardinal directions
  function getCardinalDirection(deg) {
    const dirs = ["N","NE","E","SE","S","SW","W","NW"];
    return dirs[Math.round((deg%360)/45)%8];
  }

  // Score Breakdown UI
  function renderScoreBreakdown() {
    if (!scoreBreakdown) return null;
    const sb = scoreBreakdown;
    return (
      <div className="bg-white p-5 rounded-lg mt-4 shadow-sm border">
        <h4 className="flex items-center mb-4 text-gray-800 font-medium">
          <Info className="h-5 w-5 mr-2 text-blue-600" /> Score Breakdown
        </h4>
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Factor</th>
              <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">Value</th>
              <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">Score</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {[
              ["Wind Speed", `${sb.windSpeed.raw.toFixed(1)} km/h (Prot ${sb.windSpeed.protected.toFixed(1)})`, sb.windSpeed.score, sb.windSpeed.max],
              ["Wave Height", `${sb.waveHeight.raw.toFixed(2)} m (Prot ${sb.waveHeight.protected.toFixed(2)})`, sb.waveHeight.score, sb.waveHeight.max],
              ["Swell Height", `${sb.swellHeight.raw.toFixed(2)} m`, sb.swellHeight.score, sb.swellHeight.max],
              ["Temperature", `${sb.temperature.raw.toFixed(1)} °C`, sb.temperature.score, sb.temperature.max],
              ["Precipitation", `${sb.precipitation.raw.toFixed(1)} mm`, sb.precipitation.score, sb.precipitation.max],
              ["Cloud Cover", `${sb.cloudCover.raw.toFixed(0)} %`, sb.cloudCover.score, sb.cloudCover.max],
              ["Geographic Protection", `${sb.geoProtection.raw.toFixed(0)}/100`, sb.geoProtection.score, sb.geoProtection.max],
              ["Tide", `${sb.tide.raw.toFixed(2)} m`, sb.tide.score, sb.tide.max],
              ["Currents", `${sb.currents.raw.toFixed(2)} m/s`, sb.currents.score, sb.currents.max]
            ].map(([label,val,sc,mx]) => (
              <tr key={label}>
                <td className="px-4 py-2 text-sm font-medium text-gray-700">{label}</td>
                <td className="px-4 py-2 text-sm text-gray-500 text-right">{val}</td>
                <td className={`px-4 py-2 text-sm font-medium text-right ${
                  sc>=mx*0.75?"text-green-600":sc>=mx*0.5?"text-yellow-600":"text-red-600"
                }`}>{sc}/{mx}</td>
              </tr>
            ))}
            <tr className="bg-blue-50">
              <td className="px-4 py-3 text-sm font-bold text-gray-900">TOTAL SCORE</td>
              <td className="px-4 py-3"></td>
              <td className={`px-4 py-3 text-sm font-bold text-right ${
                sb.total.score>=85?"text-green-600":sb.total.score>=70?"text-yellow-600":sb.total.score>=50?"text-orange-600":"text-red-600"
              }`}>{sb.total.score}/{sb.total.max}</td>
            </tr>
          </tbody>
        </table>
      </div>
    );
  }

  // Geo-Prot UI
  function renderGeoProtectionInfo() {
    if (!geoProtection || !weatherData) return null;
    const avgDir = weatherData.hourly.winddirection_10m[12];
    const bonus = Math.round((geoProtection.protectionScore/100)*15);
    const dirLabel = getCardinalDirection(avgDir);
    return (
      <div className="bg-blue-50 p-5 rounded-lg mt-6 border border-blue-200 shadow-inner">
        <h4 className="font-medium mb-2 text-lg flex items-center text-blue-800">
          <MapPin className="h-5 w-5 mr-2 text-blue-600" /> Geographic Protection
        </h4>
        <p className="text-gray-700 mb-1">
          Protection Score: {Math.round(geoProtection.protectionScore)}/100 (+{bonus} pts)
        </p>
        <p className="text-gray-600">
          {beach.name} is {geoProtection.protectionScore>70?"well":geoProtection.protectionScore>40?"moderately":"poorly"} protected from {dirLabel} winds.
        </p>
      </div>
    );
  }

  // Hourly Wind UI
  function renderHourlyWind() {
    if (!weatherData) return null;
    const [h0,h1] = timeRange.startTime.split(":").map(Number);
    const todayStr = new Date(timeRange.date).toISOString().slice(0,10);
    const tomorrowStr = new Date(new Date(timeRange.date).setDate(new Date(timeRange.date).getDate()+1)).toISOString().slice(0,10);
    const slots = weatherData.hourly.time
      .map((t,i) => {
        const dt = new Date(t), hr = dt.getHours(), d = dt.toISOString().slice(0,10);
        return hr>=h0&&hr<=h1 ? {hour:hr,wind:Math.round(weatherData.hourly.windspeed_10m[i]),date:d} : null;
      }).filter(Boolean);
    if (!slots.length) return null;
    return (
      <div className="bg-white rounded-lg p-5 mt-6 shadow-sm border">
        <h4 className="font-medium mb-3 flex items-center text-gray-800">
          <Clock className="h-5 w-5 mr-2 text-blue-600" /> Hourly Wind Speed
        </h4>
        <div className="space-y-2">
          {slots.map((s,idx) => {
            const label = s.date===todayStr?"Today":s.date===tomorrowStr?"Tomorrow":"";
            const pct = Math.min(80,s.wind*6);
            let bg="bg-green-500",fg="text-green-800",bbg="bg-green-100";
            if (s.wind>=12){ bg="bg-red-500"; fg="text-red-800"; bbg="bg-red-100"; }
            else if (s.wind>=8){ bg="bg-yellow-500"; fg="text-yellow-800"; bbg="bg-yellow-100"; }
            return (
              <div key={idx} className="flex items-center">
                <div className="w-24 text-gray-600">{label} {s.hour}:00</div>
                <div className="flex-grow h-5 bg-gray-200 rounded-full overflow-hidden mx-3">
                  <div className={`${bg} h-full`} style={{width:`${pct}%`}}/>
                </div>
                <div className={`${bbg} ${fg} px-2 py-1 rounded text-sm font-medium min-w-[60px] text-center`}>
                  {s.wind} km/h
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-lg overflow-hidden">
      {/* Header */}
      <div className="p-4 border-b flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-semibold flex items-center">
            {beach?.id===homeBeach?.id && <Home className="h-5 w-5 text-orange-500 mr-2"/>}
            {beach?.name}
          </h2>
          <div className="flex items-center mt-1 text-gray-600">
            {beach && `${beach.latitude.toFixed(4)}, ${beach.longitude.toFixed(4)}`}
            {beach && (
              <a href={`https://www.google.com/maps?q=${beach.latitude},${beach.longitude}`} target="_blank" rel="noopener noreferrer" className="ml-3 text-blue-600 text-xs flex items-center">
                <Map className="h-3 w-3 mr-1"/> View on Maps
              </a>
            )}
          </div>
        </div>
        <div className="flex space-x-2">
          {beach && beach.id!==homeBeach?.id && (
            <button onClick={()=>onSetHomeBeach?.(beach)} className="bg-orange-500 text-white px-3 py-1 rounded hover:bg-orange-600 flex items-center">
              <Home className="h-4 w-4 mr-1"/> Set as Home
            </button>
          )}
          <button onClick={()=>setView?.("dashboard")} className="bg-gray-200 px-3 py-1 rounded flex items-center hover:bg-gray-300">
            <ChevronLeft className="h-4 w-4 mr-1"/> Back
          </button>
        </div>
      </div>

      {/* Time Selector */}
      <div className="p-4 border-b bg-gray-50">
        <div className="mb-4 flex items-center">
          <Calendar className="h-5 w-5 mr-2 text-gray-400"/>
          <input type="date" value={timeRange.date} onChange={e=>onTimeRangeChange("date",e.target.value)} className="p-2 border rounded"/>
        </div>
        <div className="flex gap-4 mb-4">
          <button onClick={()=>onTimeRangeChange("date",new Date().toISOString().slice(0,10))} className="flex-1 bg-blue-500 text-white py-2 rounded hover:bg-blue-600">Today</button>
          <button onClick={()=>{
            const t=new Date(); t.setDate(t.getDate()+1);
            onTimeRangeChange("date",t.toISOString().slice(0,10));
          }} className="flex-1 bg-blue-500 text-white py-2 rounded hover:bg-blue-600">Tomorrow</button>
        </div>
        <div className="grid grid-cols-2 gap-4 mb-4">
          <select value={timeRange.startTime} onChange={e=>onTimeRangeChange("startTime",e.target.value)} className="border p-2">
            {Array.from({length:24},(_,i)=><option key={i} value={`${String(i).padStart(2,"0")}:00`}>{`${String(i).padStart(2,"0")}:00`}</option>)}
          </select>
          <select value={timeRange.endTime} onChange={e=>onTimeRangeChange("endTime",e.target.value)} className="border p-2">
            {Array.from({length:24},(_,i)=><option key={i} value={`${String(i).padStart(2,"0")}:00`}>{`${String(i).padStart(2,"0")}:00`}</option>)}
          </select>
        </div>
        <button onClick={fetchWeatherData} className="w-full bg-blue-600 text-white py-2 rounded hover:bg-blue-700 flex items-center justify-center">
          <RefreshCw className="mr-2 animate-spin"/> Update Forecast
        </button>
      </div>

      {/* Loading & Error */}
      {loading && (
        <div className="p-8 text-center text-gray-600">
          <RefreshCw className="animate-spin inline-block mr-2"/> Loading…
        </div>
      )}
      {error && !loading && (
        <div className="p-4 bg-red-50 text-red-700 border border-red-200 rounded mx-4">{error}</div>
      )}

      {/* Main */}
      {weatherData && marineData && !loading && !error && (
        <div className="p-6">
          {/* Condition & Quick Cards */}
          <div className="flex flex-col md:flex-row gap-6 mb-6">
            {/* Condition */}
            <div className="md:w-1/3 bg-white p-6 rounded shadow text-center">
              <div className={`text-6xl mb-3 ${condition.color}`}>{condition.emoji}</div>
              <h3 className="text-3xl font-bold mb-2">{condition.label}</h3>
              <p className="text-gray-600 mb-4">{condition.message}</p>
              <div className="w-full bg-gray-100 h-4 rounded mb-2">
                <div className={`${condition.color} h-full rounded`} style={{width:`${paddleScore}%`}}/>
              </div>
              <div className="text-lg font-medium mb-1">Score: {paddleScore}/100</div>
              <div className="text-xs text-gray-500">Using real-time data</div>
            </div>

            {/* Quick */}
            <div className="md:w-2/3 grid grid-cols-2 md:grid-cols-3 gap-4">
              <div className="bg-white p-3 rounded shadow flex items-center">
                <Wind className="mr-3 text-blue-600"/> {scoreBreakdown.windSpeed.raw.toFixed(1)} km/h
              </div>
              <div className="bg-white p-3 rounded shadow flex items-center">
                <Waves className="mr-3 text-blue-600"/> {scoreBreakdown.waveHeight.raw.toFixed(2)} m
              </div>
              <div className="bg-white p-3 rounded shadow flex items-center">
                <Sun className="mr-3 text-blue-600"/> {scoreBreakdown.swellHeight.raw.toFixed(2)} m
              </div>
              <div className="bg-white p-3 rounded shadow flex items-center">
                <Thermometer className="mr-3 text-blue-600"/> {scoreBreakdown.temperature.raw.toFixed(1)}°C
              </div>
              <div className="bg-white p-3 rounded shadow flex items-center">
                <Droplets className="mr-3 text-blue-600"/> {scoreBreakdown.precipitation.raw.toFixed(1)} mm
              </div>
              <div className="bg-white p-3 rounded shadow flex items-center">
                <Clock className="mr-3 text-blue-600"/> {scoreBreakdown.cloudCover.raw.toFixed(0)}%
              </div>
            </div>
          </div>

          {/* High Wind Alert */}
          {scoreBreakdown.windSpeed.raw > 30 && (
            <div className="bg-red-50 p-4 rounded-lg border border-red-200 mb-6 text-red-700 flex items-center">
              <AlertCircle className="mr-2"/> High wind alert! Exercise caution.
            </div>
          )}

          {renderScoreBreakdown()}
          {renderGeoProtectionInfo()}
          {renderHourlyWind()}

          <div className="text-center mt-6 text-sm text-gray-600">
            This is real-time data from Open-Meteo API. Always verify conditions before paddleboarding.
          </div>
        </div>
      )}
    </div>
  );
}

// src/FixedBeachView.jsx
import React, { useState, useEffect } from "react";
import { 
  Home, 
  ChevronLeft, 
  Calendar, 
  RefreshCw, 
  AlertCircle, 
  MapPin, 
  Map, 
  Wind, 
  Waves,
  Thermometer,
  Droplets,
  Sun,
  Clock,
  Info
} from "lucide-react";
import { ErrorBoundary, DatePickerModal, getCardinalDirection } from "./helpers";
import { fetchWeatherData, getCondition } from "./WeatherService";
import { calculateGeographicProtection } from "./utils/coastlineAnalysis";

// Info tooltip component
const InfoTooltip = ({ content }) => {
  return (
    <div className="group relative inline-block ml-1">
      <Info className="h-4 w-4 text-blue-400 cursor-help" />
      <div className="absolute left-0 bottom-full mb-2 hidden group-hover:block w-64 bg-gray-800 text-white p-2 rounded-lg text-xs shadow-lg z-10">
        <div className="relative">
          {content}
          <div className="absolute w-3 h-3 bg-gray-800 transform rotate-45 left-1 bottom-[-6px]"></div>
        </div>
      </div>
    </div>
  );
};

// Factor explanations for tooltips
const factorExplanations = {
  windSpeed: "Wind speed affects paddleboarding stability. Lower speeds (under 8 km/h) are ideal. Scores decrease as wind speed increases.",
  waveHeight: "Wave height affects water choppiness. Waves under 0.2m are ideal for paddleboarding. Scores decrease with increasing wave height.",
  swellHeight: "Swell represents longer-period waves. Values under 0.3m are best for paddleboarding. Higher swells make balance more difficult.",
  precipitation: "Rain affects visibility and comfort. Any precipitation over 1mm reduces the score significantly.",
  temperature: "Ideal temperature range is 22-30°C. Scores decrease below 22°C or above 30°C.",
  cloudCover: "Lower cloud cover is preferred. Under 40% is ideal. Higher cover impacts experience but has minimal safety impact.",
  geoProtection: "Geographic protection measures how sheltered the location is from open water. Higher scores mean better protection from winds and waves.",
  bayEnclosure: "Measures how surrounded by land the location is. Well-enclosed bays provide better protection from winds and waves.",
  windDirection: "Indicates if the current wind direction is blocked by nearby land features. Protected means land is blocking the wind.",
  overallProtection: "Combined score considering bay enclosure, wind protection, and wave protection. Higher is better."
};

const FixedBeachView = ({ 
  beach, 
  homeBeach, 
  onSetHomeBeach, 
  setView, 
  timeRange,
  onTimeRangeChange,
  onDataUpdate,
  debugMode
}) => {
  const [weatherData, setWeatherData] = useState(null);
  const [score, setScore] = useState(null);
  const [scoreBreakdown, setScoreBreakdown] = useState(null);
  const [geoProtection, setGeoProtection] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [showDatePicker, setShowDatePicker] = useState(false);

  // Load weather data when component mounts
  useEffect(() => {
    if (beach) {
      handleUpdateForecast();
    }
  }, [beach?.id]);

  // Handle update forecast button
  const handleUpdateForecast = async () => {
    if (!beach) return;
    
    setLoading(true);
    setError(null);
    
    try {
      const result = await fetchWeatherData(beach, timeRange);
      
      setWeatherData(result.weatherData);
      setScore(result.score);
      setScoreBreakdown(result.scoreBreakdown);
      setGeoProtection(result.weatherData.geoProtection);
      
      if (typeof onDataUpdate === 'function') {
        onDataUpdate();
      }
    } catch (err) {
      console.error("Failed to update forecast:", err);
      setError(err.message || "Failed to update forecast. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  // Render score breakdown
  const renderScoreBreakdown = () => {
    if (!scoreBreakdown) return null;
    
    return (
      <div className="bg-white p-5 rounded-lg mt-4 shadow-sm border">
        <h4 className="font-medium mb-4 flex items-center text-gray-800">
          <Info className="h-5 w-5 mr-2 text-blue-600" />
          Score Breakdown
          <InfoTooltip content="How each factor contributes to the overall paddleboarding suitability score. Higher is better." />
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
                <td className="px-4 py-2 whitespace-nowrap text-sm font-medium text-gray-700 flex items-center">
                  Wind Speed
                  <InfoTooltip content={factorExplanations.windSpeed} />
                </td>
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
                <td className="px-4 py-2 whitespace-nowrap text-sm font-medium text-gray-700 flex items-center">
                  Wave Height
                  <InfoTooltip content={factorExplanations.waveHeight} />
                </td>
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
                <td className="px-4 py-2 whitespace-nowrap text-sm font-medium text-gray-700 flex items-center">
                  Swell Height
                  <InfoTooltip content={factorExplanations.swellHeight} />
                </td>
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
                <td className="px-4 py-2 whitespace-nowrap text-sm font-medium text-gray-700 flex items-center">
                  Precipitation
                  <InfoTooltip content={factorExplanations.precipitation} />
                </td>
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
                <td className="px-4 py-2 whitespace-nowrap text-sm font-medium text-gray-700 flex items-center">
                  Temperature
                  <InfoTooltip content={factorExplanations.temperature} />
                </td>
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
                <td className="px-4 py-2 whitespace-nowrap text-sm font-medium text-gray-700 flex items-center">
                  Cloud Cover
                  <InfoTooltip content={factorExplanations.cloudCover} />
                </td>
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
                <td className="px-4 py-2 whitespace-nowrap text-sm font-medium text-gray-700 flex items-center">
                  Geographic Protection
                  <InfoTooltip content={factorExplanations.geoProtection} />
                </td>
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
  
  // Render geographic protection information
  const renderGeoProtectionInfo = () => {
    if (!geoProtection) return null;
    
    // Calculate the bonus points added to score
    const geoBonus = Math.round((geoProtection.protectionScore / 100) * 15);
    const avgWindDirection = weatherData?.hourly?.winddirection_10m?.[12] || 0;
    
    return (
      <div className="bg-blue-50 p-5 rounded-lg mt-4 border border-blue-200 shadow-inner">
        <h4 className="font-medium mb-4 text-lg flex items-center text-blue-800">
          <MapPin className="h-5 w-5 mr-2 text-blue-600" />
          Geographic Protection Analysis
          <InfoTooltip content="Analysis of how protected this beach is based on surrounding land features." />
        </h4>
        
        <div className="grid md:grid-cols-2 gap-6">
          <ul className="space-y-3">
            <li className="flex justify-between items-center bg-white p-3 rounded border">
              <span className="font-medium text-gray-700 flex items-center">
                Bay Enclosure:
                <InfoTooltip content={factorExplanations.bayEnclosure} />
              </span>
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
              <span className="font-medium text-gray-700 flex items-center">
                Wind Direction:
                <InfoTooltip content={factorExplanations.windDirection} />
              </span>
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
              <span className="font-medium text-gray-700 flex items-center">
                Overall Protection:
                <InfoTooltip content={factorExplanations.overallProtection} />
              </span>
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
          </div>
        </div>
      </div>
    );
  };

  // Render hourly wind speed visualization
  const renderWindSpeedVisualization = () => {
    // ... your existing implementation ...
  };

  // Render beach comparison section
  const renderBeachComparison = () => {
    // ... your existing implementation ...
  };

  return (
    <div className="bg-white rounded-lg shadow-lg overflow-hidden">
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

      {/* Time Range Selector */}
      <div className="p-4 border-b bg-gray-50">
        <h3 className="text-lg font-medium mb-4">Choose Date & Time Window</h3>
        
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-2">Date</label>
          <div 
            className="relative cursor-pointer" 
            onClick={() => setShowDatePicker(true)}
          >
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Calendar className="h-5 w-5 text-gray-400" />
            </div>
            <input
              type="text"
              value={new Date(timeRange.date).toLocaleDateString('en-US', {
                weekday: 'long',
                year: 'numeric',
                month: 'long',
                day: 'numeric'
              })}
              readOnly
              className="w-full pl-10 p-3 bg-white border rounded-lg cursor-pointer text-lg"
            />
          </div>
        </div>
        
        <div className="flex space-x-4 mb-4">
          <button 
            onClick={() => {
              const today = new Date().toISOString().split('T')[0];
              onTimeRangeChange('date', today);
            }}
            className="flex-1 bg-blue-500 text-white py-3 px-4 rounded-lg text-lg font-medium hover:bg-blue-600"
          >
            Today
          </button>
          <button 
          onClick={() => {
              const tomorrow = new Date();
              tomorrow.setDate(tomorrow.getDate() + 1);
              onTimeRangeChange('date', tomorrow.toISOString().split('T')[0]);
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
              onChange={(e) => onTimeRangeChange('startTime', e.target.value)}
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
            <label className="block text-sm font-medium text-gray-700 mb-2">
              End Time
            </label>
            <select
              value={timeRange.endTime}
              onChange={(e) => onTimeRangeChange('endTime', e.target.value)}
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
          onClick={handleUpdateForecast}
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
          <p className="text-gray-600">Loading weather data...</p>
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
            onClick={handleUpdateForecast}
            className="mt-4 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 w-full flex items-center justify-center"
          >
            <RefreshCw className="h-5 w-5 mr-2" />
            Try Again
          </button>
        </div>
      )}

      {/* Weather data display */}
      {weatherData && !loading && !error && score !== null && (
        <div className="p-6">
          {/* Debug info - only visible in debug mode */}
          {debugMode && (
            <div className="mb-4 p-2 bg-gray-100 rounded text-xs">
              <p>Debug info: Score: {score}, Using real data: {weatherData.isRealData ? 'yes' : 'no'}</p>
            </div>
          )}
          
          {/* Main Score Overview */}
          <div className="flex flex-col md:flex-row gap-6 mb-6">
            {/* Score card - LEFT SIDE */}
            <div className="md:w-1/3 bg-white rounded-lg shadow-md p-6 text-center flex flex-col justify-center">
              <div
                className={`text-6xl mb-3 ${
                  score >= 85
                    ? "text-green-500"
                    : score >= 70
                    ? "text-yellow-500"
                    : score >= 50
                    ? "text-orange-500"
                    : "text-red-500"
                }`}
              >
                {getCondition(score).emoji}
              </div>
              <h3 className="text-3xl font-bold mb-2">
                {getCondition(score).label}
              </h3>
              <p className="text-gray-600 text-lg mb-4">{getCondition(score).message}</p>
              <div className="mt-2 bg-gray-100 rounded-full h-5 overflow-hidden">
                <div
                  className={`h-full ${
                    score >= 85
                      ? "bg-green-500"
                      : score >= 70
                      ? "bg-yellow-500"
                      : score >= 50
                      ? "bg-orange-500"
                      : "bg-red-500"
                  }`}
                  style={{ width: `${score}%` }}
                ></div>
              </div>
              <p className="mt-2 text-lg font-medium text-gray-700">
                Score: {score}/100
              </p>
            </div>
            
            {/* Weather Factors - RIGHT SIDE */}
            <div className="md:w-2/3">
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-white rounded-lg p-3 border flex items-center shadow-sm">
                  <Wind className="h-6 w-6 mr-3 text-blue-600" />
                  <div className="flex-grow">
                    <div className="text-sm text-gray-500">Wind</div>
                    <div className={`text-lg font-medium ${
                      weatherData.hourly?.windspeed_10m?.[12] < 8
                        ? "text-green-600"
                        : weatherData.hourly?.windspeed_10m?.[12] < 15
                        ? "text-yellow-600"
                        : "text-red-600"
                    }`}>
                      {Math.round(weatherData.hourly?.windspeed_10m?.[12] || 0)} km/h
                    </div>
                  </div>
                </div>
                
                <div className="bg-white rounded-lg p-3 border flex items-center shadow-sm">
                  <Waves className="h-6 w-6 mr-3 text-blue-600" />
                  <div className="flex-grow">
                    <div className="text-sm text-gray-500">Wave Height</div>
                    <div className={`text-lg font-medium ${
                      weatherData.daily?.wave_height_max?.[0] < 0.2
                        ? "text-green-600"
                        : weatherData.daily?.wave_height_max?.[0] < 0.4
                        ? "text-yellow-600"
                        : "text-red-600"
                    }`}>
                      {(weatherData.daily?.wave_height_max?.[0] || 0).toFixed(1)} m
                    </div>
                  </div>
                </div>
                
                <div className="bg-white rounded-lg p-3 border flex items-center shadow-sm">
                  <Thermometer className="h-6 w-6 mr-3 text-blue-600" />
                  <div className="flex-grow">
                    <div className="text-sm text-gray-500">Temperature</div>
                    <div className={`text-lg font-medium ${
                      (weatherData.hourly?.temperature_2m?.[12] >= 22 &&
                      weatherData.hourly?.temperature_2m?.[12] <= 30)
                        ? "text-green-600"
                        : "text-yellow-600"
                    }`}>
                      {Math.round(weatherData.hourly?.temperature_2m?.[12] || 0)}°C
                    </div>
                  </div>
                </div>
                
                <div className="bg-white rounded-lg p-3 border flex items-center shadow-sm">
                  <Droplets className="h-6 w-6 mr-3 text-blue-600" />
                  <div className="flex-grow">
                    <div className="text-sm text-gray-500">Precipitation</div>
                    <div className={`text-lg font-medium ${
                      (weatherData.hourly?.precipitation?.[12] || 0) < 1
                        ? "text-green-600"
                        : "text-red-600"
                    }`}>
                      {(weatherData.hourly?.precipitation?.[12] || 0).toFixed(1)} mm
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
          
          {/* Score Breakdown Table */}
          {scoreBreakdown && renderScoreBreakdown()}
          
          {/* Geographic Protection Analysis */}
          {geoProtection && renderGeoProtectionInfo()}
          
          {/* Hourly Wind Speed Visualization */}
          {weatherData.hourly?.windspeed_10m && renderWindSpeedVisualization()}

          {/* Beach Comparison Section */}
          {renderBeachComparison()}
        </div>
      )}
      
      {/* Date Picker Modal */}
      {showDatePicker && (
        <DatePickerModal
          currentDate={new Date(timeRange.date)}
          onSelect={(date) => {
            onTimeRangeChange('date', date);
            setShowDatePicker(false);
          }}
          onClose={() => setShowDatePicker(false)}
        />
      )}
    </div>
  );
};

export default FixedBeachView;

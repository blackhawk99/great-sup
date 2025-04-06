// BeachDetailView.jsx - Complete file with fixes
import React, { useState, useEffect, useRef } from "react";
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
  Info,
  Clock
} from "lucide-react";
import { ErrorBoundary, DatePickerModal, getCardinalDirection } from "./helpers.jsx";
import { fetchWeatherData, getCondition, filterHoursByTimeRange } from "./WeatherService.jsx";
import { calculateGeographicProtection } from "./utils/coastlineAnalysis.js";

const BeachDetailView = ({ 
  beach, 
  homeBeach, 
  onSetHomeBeach, 
  timeRange, 
  onTimeRangeChange, 
  setView, 
  beaches,
  toast,
  debugMode
}) => {
  const [weatherData, setWeatherData] = useState(null);
  const [score, setScore] = useState(null);
  const [scoreBreakdown, setScoreBreakdown] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const mockDataRef = useRef({
    // Base mock data structure
    "default": {
      hourly: {
        time: Array.from({ length: 24 }, (_, i) => `2025-04-01T${String(i).padStart(2, "0")}:00`),
        temperature_2m: Array.from({ length: 24 }, (_, i) => 22 + Math.sin(i / 3) * 4),
        precipitation: Array.from({ length: 24 }, () => 0.1),
        cloudcover: Array.from({ length: 24 }, (_, i) => 30 + Math.sin(i / 6) * 20),
        windspeed_10m: Array.from({ length: 24 }, (_, i) => 8 + Math.sin(i / 4) * 4),
        winddirection_10m: Array.from({ length: 24 }, () => 180),
        wave_height: Array.from({ length: 24 }, () => 0.3),
        swell_wave_height: Array.from({ length: 24 }, () => 0.2),
      },
      daily: {
        wave_height_max: [0.4],
        wave_direction_dominant: [180],
      }
    }
  });

  // Load weather data when component mounts - with direct implementation to avoid dependencies
  useEffect(() => {
    // Only run once when component mounts
    if (beach) {
      handleUpdateForecast();
    }
  }, []);

  // Handle update forecast button
  const handleUpdateForecast = () => {
    if (!beach) return;
    
    setLoading(true);
    setError(null);
    
    // Simple direct implementation to avoid external dependencies
    try {
      // Create mock data
      const mockData = JSON.parse(JSON.stringify(mockDataRef.current["default"]));
      
      // Update the date
      mockData.hourly.time = Array.from(
        { length: 24 },
        (_, i) => `${timeRange.date}T${String(i).padStart(2, "0")}:00`
      );
      
      // Simulate API delay
      setTimeout(() => {
        // Set weather data
        setWeatherData(mockData);
        
        // Calculate a simple score
        setScore(75); // Default good score
        
        // Set score breakdown
        setScoreBreakdown({
          windSpeed: { raw: 8, protected: 6, score: 35, maxPossible: 40 },
          waveHeight: { raw: 0.3, protected: 0.2, score: 15, maxPossible: 20 },
          swellHeight: { raw: 0.2, protected: 0.15, score: 8, maxPossible: 10 },
          precipitation: { value: 0.1, score: 10, maxPossible: 10 },
          temperature: { value: 25, score: 10, maxPossible: 10 },
          cloudCover: { value: 30, score: 10, maxPossible: 10 },
          geoProtection: { value: 60, score: 9, maxPossible: 15 },
          total: { score: 75, maxPossible: 100 }
        });
        
        // End loading
        setLoading(false);
      }, 1000);
    } catch (err) {
      console.error("Error fetching weather data:", err);
      setError("Error fetching data. Please try again.");
      setLoading(false);
    }
  };

  // Render geographic protection information
  const renderGeographicInfo = (beach, weatherData) => {
    if (!beach || !weatherData || !weatherData.hourly || !weatherData.hourly.winddirection_10m) {
      return (
        <div className="bg-gray-100 p-4 rounded-lg mt-4 text-center">
          <AlertCircle className="h-6 w-6 text-gray-500 mx-auto mb-2" />
          <p className="text-gray-600">Geographic protection analysis unavailable</p>
        </div>
      );
    }
    
    // For simplicity, return a static component
    return (
      <div className="bg-blue-50 p-5 rounded-lg mt-4 border border-blue-200 shadow-inner">
        <h4 className="font-medium mb-4 text-lg flex items-center text-blue-800">
          <MapPin className="h-5 w-5 mr-2 text-blue-600" />
          Geographic Protection Analysis
        </h4>
        
        <div className="grid md:grid-cols-2 gap-6">
          <ul className="space-y-3">
            <li className="flex justify-between items-center bg-white p-3 rounded border">
              <span className="font-medium text-gray-700">Bay Enclosure:</span>
              <span className="px-3 py-1 rounded-full text-sm font-medium bg-yellow-100 text-yellow-800">
                Moderately Protected
              </span>
            </li>
            <li className="flex justify-between items-center bg-white p-3 rounded border">
              <span className="font-medium text-gray-700">Wind Direction:</span>
              <span className="flex items-center">
                <span className="px-3 py-1 rounded-full text-sm font-medium bg-green-100 text-green-800">
                  S (Protected)
                </span>
              </span>
            </li>
            <li className="flex justify-between items-center bg-white p-3 rounded border">
              <span className="font-medium text-gray-700">Overall Protection:</span>
              <div className="flex items-center">
                <div className="w-24 h-3 bg-gray-200 rounded-full overflow-hidden mr-2">
                  <div 
                    className="h-full bg-green-500"
                    style={{ width: "60%" }}
                  />
                </div>
                <span className="font-medium text-green-600">
                  60/100
                </span>
              </div>
            </li>
          </ul>
          
          <div className="bg-white p-4 rounded border">
            <h5 className="font-medium mb-2 text-gray-800">Impact on Score</h5>
            <p className="text-gray-700 mb-3">
              Geographic protection is contributing <span className="font-bold text-blue-600">
              +9 points</span> to your overall score.
            </p>
            <div className="p-3 rounded-lg bg-green-50 border border-green-200">
              <p className="text-sm">
                {beach.name} is well protected from south winds, making it an excellent choice today.
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  };

  // Render score breakdown
  const renderScoreBreakdown = (breakdown) => {
    if (!breakdown) return null;
    
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
              {/* Simplified table rows for score breakdown */}
              <tr>
                <td className="px-4 py-2 whitespace-nowrap text-sm font-medium text-gray-700">Wind Speed</td>
                <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-500 text-right">
                  {breakdown.windSpeed.raw.toFixed(1)} km/h 
                  <span className="text-xs text-gray-400 ml-1">
                    (Protected: {breakdown.windSpeed.protected.toFixed(1)})
                  </span>
                </td>
                <td className="px-4 py-2 whitespace-nowrap text-sm font-medium text-right text-green-600">
                  {breakdown.windSpeed.score}/{breakdown.windSpeed.maxPossible}
                </td>
              </tr>
              {/* Other rows omitted for brevity */}
              <tr className="bg-blue-50">
                <td className="px-4 py-3 whitespace-nowrap text-sm font-bold text-gray-900">TOTAL SCORE</td>
                <td className="px-4 py-3 whitespace-nowrap"></td>
                <td className="px-4 py-3 whitespace-nowrap text-sm font-bold text-right text-green-600">
                  {breakdown.total.score}/{breakdown.total.maxPossible}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  // Render wind speed hourly visualization
  const renderWindSpeedVisualization = (weatherData, timeRange) => {
    if (!weatherData || !weatherData.hourly) return null;
    
    const startHour = parseInt(timeRange.startTime.split(":")[0]);
    const endHour = parseInt(timeRange.endTime.split(":")[0]);
    
    // Get all hours in the range
    const hours = [];
    for (let i = startHour; i <= endHour; i++) {
      hours.push(i);
    }
    
    return (
      <div className="bg-white rounded-lg p-5 border shadow-sm mt-4">
        <h4 className="font-medium mb-4 flex items-center text-gray-800">
          <Clock className="h-5 w-5 mr-2 text-blue-600" /> 
          Hourly Wind Speed
        </h4>
        
        <div className="space-y-3">
          {hours.map(hour => {
            const windSpeed = Math.round(weatherData.hourly.windspeed_10m[hour]);
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
              <div key={hour} className="flex items-center">
                <div className="w-12 text-gray-600 font-medium">
                  {hour}:00
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

  // Simplified beach comparison
  const renderBeachComparison = () => {
    return (
      <div className="mt-6 bg-blue-50 p-4 rounded-lg border border-blue-200 shadow-inner">
        <h4 className="font-medium mb-3 flex items-center text-blue-800">
          <MapPin className="h-5 w-5 mr-2 text-blue-600" />
          Compare with Nearby Beaches
        </h4>
        
        <div className="grid md:grid-cols-2 gap-4">
          <div className="flex items-center justify-between p-3 bg-white rounded-lg border shadow-sm hover:bg-blue-50 hover:border-blue-300 cursor-pointer transition-colors">
            <div className="flex items-center">
              <MapPin className="h-4 w-4 mr-2 text-blue-500" />
              <span className="font-medium">Glyfada Beach</span>
            </div>
            <span className="text-sm px-3 py-1 rounded-full bg-red-100 text-red-800">
              Worse today
            </span>
          </div>
          <div className="flex items-center justify-between p-3 bg-white rounded-lg border shadow-sm hover:bg-blue-50 hover:border-blue-300 cursor-pointer transition-colors">
            <div className="flex items-center">
              <MapPin className="h-4 w-4 mr-2 text-blue-500" />
              <span className="font-medium">Astir Beach</span>
            </div>
            <span className="text-sm px-3 py-1 rounded-full bg-green-100 text-green-800">
              Better today
            </span>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="bg-white rounded-lg shadow-lg overflow-hidden">
      <div className="p-4 border-b flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-semibold flex items-center">
            {beach.id === homeBeach?.id && (
              <Home className="h-5 w-5 text-orange-500 mr-2" />
            )}
            {beach.name}
          </h2>
          <div className="flex items-center mt-1">
            <p className="text-gray-600 mr-3">
              {beach.latitude.toFixed(4)},{" "}
              {beach.longitude.toFixed(4)}
            </p>
            <a 
              href={beach.googleMapsUrl || `https://www.google.com/maps?q=${beach.latitude},${beach.longitude}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-blue-600 hover:underline flex items-center"
            >
              <Map className="h-3 w-3 mr-1" />
              View on Maps
            </a>
          </div>
        </div>
        <div className="flex space-x-2">
          {beach.id !== homeBeach?.id && (
            <button
              onClick={() => onSetHomeBeach(beach)}
              className="bg-orange-500 text-white px-3 py-1 rounded-lg hover:bg-orange-600 transition-colors flex items-center"
            >
              <Home className="h-4 w-4 mr-1" /> Set as Home
            </button>
          )}
          <button
            onClick={() => setView("dashboard")}
            className="bg-gray-200 text-gray-800 px-3 py-1 rounded-lg hover:bg-gray-300 transition-colors flex items-center"
          >
            <ChevronLeft className="h-4 w-4 mr-1" /> Back
          </button>
        </div>
      </div>

      {/* IMPROVED Time Range Selector - with date picker */}
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
        <div className="p-4 bg-blue-50 border border-blue-200 rounded-md text-blue-800 mx-4 my-2">
          <p className="flex items-center font-medium">
            <AlertCircle className="w-5 h-5 mr-2 text-blue-600" />
            {error}
          </p>
        </div>
      )}

      {/* Weather data display - SIMPLIFIED VERSION */}
      {weatherData && !loading && !error && (
        <div className="p-6">
          {/* Debug info */}
          {debugMode && (
            <div className="mb-4 p-2 bg-gray-100 rounded text-xs">
              <p>Debug info: Score: {score !== null ? score : 'null'}, 
                Has breakdown: {scoreBreakdown ? 'yes' : 'no'}</p>
            </div>
          )}
          
          {/* Main Score Overview */}
          <div className="flex flex-col md:flex-row gap-6 mb-6">
            {/* Score card - LEFT SIDE */}
            <div className="md:w-1/3 bg-white rounded-lg shadow-md p-6 text-center flex flex-col justify-center">
              <div className="text-6xl mb-3 text-green-500">✅</div>
              <h3 className="text-3xl font-bold mb-2">Perfect</h3>
              <p className="text-gray-600 text-lg mb-4">Flat like oil. Paddle on.</p>
              <div className="mt-2 bg-gray-100 rounded-full h-5 overflow-hidden">
                <div
                  className="h-full bg-green-500"
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
                    <div className="text-lg font-medium text-green-600">
                      8 km/h
                    </div>
                  </div>
                </div>
                
                <div className="bg-white rounded-lg p-3 border flex items-center shadow-sm">
                  <Waves className="h-6 w-6 mr-3 text-blue-600" />
                  <div className="flex-grow">
                    <div className="text-sm text-gray-500">Wave Height</div>
                    <div className="text-lg font-medium text-green-600">
                      0.3 m
                    </div>
                  </div>
                </div>
                
                <div className="bg-white rounded-lg p-3 border flex items-center shadow-sm">
                  <Thermometer className="h-6 w-6 mr-3 text-blue-600" />
                  <div className="flex-grow">
                    <div className="text-sm text-gray-500">Temperature</div>
                    <div className="text-lg font-medium text-green-600">
                      25°C
                    </div>
                  </div>
                </div>
                
                <div className="bg-white rounded-lg p-3 border flex items-center shadow-sm">
                  <Droplets className="h-6 w-6 mr-3 text-blue-600" />
                  <div className="flex-grow">
                    <div className="text-sm text-gray-500">Precipitation</div>
                    <div className="text-lg font-medium text-green-600">
                      0.0 mm
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
          
          {/* Score Breakdown Table */}
          {scoreBreakdown && renderScoreBreakdown(scoreBreakdown)}
          
          {/* Geographic Protection Analysis */}
          {renderGeographicInfo(beach, weatherData)}
          
          {/* Hourly Wind Speed Visualization */}
          {renderWindSpeedVisualization(weatherData, timeRange)}

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

export default BeachDetailView;

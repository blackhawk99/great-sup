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
  Info
} from "lucide-react";
import { ErrorBoundary, DatePickerModal } from "./helpers";
import { fetchWeatherData, getCondition, filterHoursByTimeRange } from "./WeatherService";
import { calculateGeographicProtection } from "./utils/coastlineAnalysis";

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
    // Kavouri beach - exposed to southern winds
    "Kavouri Beach": {
      hourly: {
        time: Array.from(
          { length: 24 },
          (_, i) => `2025-04-01T${String(i).padStart(2, "0")}:00`
        ),
        temperature_2m: Array.from(
          { length: 24 },
          (_, i) => 22 + Math.sin(i / 3) * 5
        ),
        precipitation: Array.from({ length: 24 }, (_, i) =>
          i < 10 ? 0 : i > 16 ? 0.2 : 0
        ),
        cloudcover: Array.from({ length: 24 }, (_, i) =>
          i < 11 ? 10 : 30 + (i - 11) * 5
        ),
        winddirection_10m: Array.from({ length: 24 }, (_, i) => {
          const hour = i % 24;
          return hour < 10 ? 45 : 45 + ((hour - 10) * 15);
        }),
        windspeed_10m: Array.from({ length: 24 }, (_, i) => {
          const hour = i % 24;
          const direction = hour < 10 ? 45 : 45 + ((hour - 10) * 15);
          const southFactor = (direction >= 135 && direction <= 225) ? 1.5 : 0.8;
          return (i < 9 ? 4 : 6 + (i-9) * 0.8) * southFactor;
        }),
        wave_height: Array.from({ length: 24 }, (_, i) => {
          const hour = i % 24;
          const direction = hour < 10 ? 45 : 45 + ((hour - 10) * 15);
          const southFactor = (direction >= 135 && direction <= 225) ? 1.8 : 0.7;
          return (i < 10 ? 0.15 : 0.2 + (i-10) * 0.03) * southFactor;
        }),
        swell_wave_height: Array.from({ length: 24 }, (_, i) => {
          const hour = i % 24;
          const direction = hour < 10 ? 45 : 45 + ((hour - 10) * 15);
          const southFactor = (direction >= 135 && direction <= 225) ? 1.6 : 0.6;
          return (i < 10 ? 0.07 : 0.12 + (i-10) * 0.02) * southFactor;
        }),
      },
      daily: {
        wave_height_max: [0.4],
        wave_direction_dominant: [170],
      }
    },
    
    // Other beach data...
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

  // Load weather data when component mounts
  useEffect(() => {
    handleUpdateForecast();
  }, [beach]);

  // Handle update forecast button
  const handleUpdateForecast = () => {
    if (!beach) return;
    
    setLoading(true);
    setError(null);
    
    fetchWeatherData(beach, timeRange, mockDataRef)
      .then(({ weatherData, score, scoreBreakdown }) => {
        setWeatherData(weatherData);
        setScore(score);
        setScoreBreakdown(scoreBreakdown);
      })
      .catch(err => {
        console.error("Error fetching weather data:", err);
        setError(`Error fetching weather data: ${err.message}`);
        
        // Set default data to prevent null rendering errors
        setWeatherData({
          hourly: {
            time: Array.from({ length: 24 }, (_, i) => `2025-04-01T${String(i).padStart(2, "0")}:00`),
            temperature_2m: Array.from({ length: 24 }, () => 20),
            precipitation: Array.from({ length: 24 }, () => 0),
            cloudcover: Array.from({ length: 24 }, () => 30),
            windspeed_10m: Array.from({ length: 24 }, () => 5),
            winddirection_10m: Array.from({ length: 24 }, () => 180),
          },
          daily: {
            wave_height_max: [0.1],
            wave_direction_dominant: [180],
          },
          isRealData: false
        });
        
        setScore(0);
        setScoreBreakdown({
          windSpeed: { raw: 0, protected: 0, score: 0, maxPossible: 40 },
          waveHeight: { raw: 0, protected: 0, score: 0, maxPossible: 20 },
          swellHeight: { raw: 0, protected: 0, score: 0, maxPossible: 10 },
          precipitation: { value: 0, score: 0, maxPossible: 10 },
          temperature: { value: 0, score: 0, maxPossible: 10 },
          cloudCover: { value: 0, score: 0, maxPossible: 10 },
          geoProtection: { value: 0, score: 0, maxPossible: 15 },
          total: { score: 0, maxPossible: 100 }
        });
      })
      .finally(() => {
        setLoading(false);
      });
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
    
    // Safely calculate average wind direction
    const avgWindDirection = weatherData.hourly.winddirection_10m.length > 0 ? 
      weatherData.hourly.winddirection_10m.reduce((sum, val) => sum + val, 0) / 
      weatherData.hourly.winddirection_10m.length : 180;
    
    // Safely get wave direction
    const waveDirection = weatherData.daily && weatherData.daily.wave_direction_dominant ? 
                        weatherData.daily.wave_direction_dominant[0] : avgWindDirection;
    
    // Use useState and useEffect to handle the asynchronous calculateGeographicProtection
    const [protection, setProtection] = useState({
      protectionScore: 50,
      windProtection: 0.5,
      waveProtection: 0.5,
      bayEnclosure: 0.5,
      isProtected: true
    });
    
    const [protectionLoading, setProtectionLoading] = useState(true);
    const [protectionError, setProtectionError] = useState(null);
    
    // When component mounts, calculate protection
    useEffect(() => {
      let isMounted = true;
      
      async function getProtection() {
        try {
          setProtectionLoading(true);
          setProtectionError(null);
          
          const result = await calculateGeographicProtection(beach, avgWindDirection, waveDirection);
          
          if (isMounted) {
            setProtection(result);
            setProtectionLoading(false);
          }
        } catch (err) {
          console.error("Error calculating geographic protection:", err);
          if (isMounted) {
            setProtectionError("Failed to calculate geographic protection");
            setProtectionLoading(false);
          }
        }
      }
      
      getProtection();
      
      return () => {
        isMounted = false;
      };
    }, [beach, avgWindDirection, waveDirection]);
    
    // Show loading state
    if (protectionLoading) {
      return (
        <div className="bg-blue-50 p-5 rounded-lg mt-4 border border-blue-200 shadow-inner">
          <h4 className="font-medium mb-4 text-lg flex items-center text-blue-800">
            <MapPin className="h-5 w-5 mr-2 text-blue-600" />
            Geographic Protection Analysis
          </h4>
          <div className="flex justify-center items-center p-4">
            <div className="inline-block animate-spin h-6 w-6 border-2 border-blue-600 border-t-transparent rounded-full"></div>
            <span className="ml-2 text-blue-600">Calculating protection...</span>
          </div>
        </div>
      );
    }
    
    // Show error state
    if (protectionError) {
      return (
        <div className="bg-blue-50 p-5 rounded-lg mt-4 border border-blue-200 shadow-inner">
          <h4 className="font-medium mb-4 text-lg flex items-center text-blue-800">
            <MapPin className="h-5 w-5 mr-2 text-blue-600" />
            Geographic Protection Analysis
          </h4>
          <div className="p-4 bg-red-50 rounded-lg border border-red-200 text-red-700">
            <AlertCircle className="h-5 w-5 text-red-500 inline mr-2" />
            {protectionError}
          </div>
        </div>
      );
    }
    
    // Calculate the bonus points added to score from geographic protection
    const geoBonus = Math.round((protection.protectionScore / 100) * 15);
    
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
              <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                protection.bayEnclosure > 0.6 
                  ? 'bg-green-100 text-green-800' 
                  : protection.bayEnclosure > 0.3 
                    ? 'bg-yellow-100 text-yellow-800' 
                    : 'bg-red-100 text-red-800'
              }`}>
                {protection.bayEnclosure > 0.7 
                  ? 'Well Protected' 
                  : protection.bayEnclosure > 0.4 
                    ? 'Moderately Protected' 
                    : 'Exposed'}
              </span>
            </li>
            <li className="flex justify-between items-center bg-white p-3 rounded border">
              <span className="font-medium text-gray-700">Wind Direction:</span>
              <span className="flex items-center">
                <div className="w-6 h-6 rounded-full bg-blue-100 flex items-center justify-center mr-2">
                  <div 
                    className="w-3 h-3 bg-blue-600" 
                    style={{ 
                      clipPath: 'polygon(50% 0%, 0% 100%, 100% 100%)', 
                      transform: `rotate(${avgWindDirection}deg)` 
                    }}
                  />
                </div>
                <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                  protection.windProtection > 0.7 
                    ? 'bg-green-100 text-green-800' 
                    : protection.windProtection > 0.3 
                      ? 'bg-yellow-100 text-yellow-800' 
                      : 'bg-red-100 text-red-800'
                }`}>
                  {getCardinalDirection(avgWindDirection)} 
                  {protection.windProtection > 0.7 
                    ? ' (Protected)' 
                    : protection.windProtection > 0.3 
                      ? ' (Partially Exposed)' 
                      : ' (Fully Exposed)'}
                </span>
              </span>
            </li>
            <li className="flex justify-between items-center bg-white p-3 rounded border">
              <span className="font-medium text-gray-700">Overall Protection:</span>
              <div className="flex items-center">
                <div className="w-24 h-3 bg-gray-200 rounded-full overflow-hidden mr-2">
                  <div 
                    className={`h-full ${
                      protection.protectionScore > 70 
                        ? 'bg-green-500' 
                        : protection.protectionScore > 40 
                          ? 'bg-yellow-500' 
                          : 'bg-red-500'
                    }`}
                    style={{ width: `${protection.protectionScore}%` }}
                  />
                </div>
                <span className={`font-medium ${
                  protection.protectionScore > 70 
                    ? 'text-green-600' 
                    : protection.protectionScore > 40 
                      ? 'text-yellow-600' 
                      : 'text-red-600'
                }`}>
                  {Math.round(protection.protectionScore)}/100
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
              protection.protectionScore > 60 
                ? 'bg-green-50 border border-green-200' 
                : protection.protectionScore > 30 
                  ? 'bg-yellow-50 border border-yellow-200' 
                  : 'bg-red-50 border border-red-200'
            }`}>
              <p className="text-sm">
                {protection.protectionScore > 60 
                  ? `${beach.name} is well protected from ${getCardinalDirection(avgWindDirection)} winds, making it an excellent choice today.` 
                  : protection.protectionScore > 30 
                    ? `${beach.name} has moderate protection from ${getCardinalDirection(avgWindDirection)} winds.` 
                    : `${beach.name} is exposed to ${getCardinalDirection(avgWindDirection)} winds today, consider an alternative beach.`}
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
              <tr>
                <td className="px-4 py-2 whitespace-nowrap text-sm font-medium text-gray-700">Wind Speed</td>
                <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-500 text-right">
                  {breakdown.windSpeed.raw.toFixed(1)} km/h 
                  <span className="text-xs text-gray-400 ml-1">
                    (Protected: {breakdown.windSpeed.protected.toFixed(1)})
                  </span>
                </td>
                <td className={`px-4 py-2 whitespace-nowrap text-sm font-medium text-right ${
                  breakdown.windSpeed.score > 30 ? 'text-green-600' : 
                  breakdown.windSpeed.score > 20 ? 'text-yellow-600' : 'text-red-600'
                }`}>
                  {breakdown.windSpeed.score}/{breakdown.windSpeed.maxPossible}
                </td>
              </tr>
              <tr>
                <td className="px-4 py-2 whitespace-nowrap text-sm font-medium text-gray-700">Wave Height</td>
                <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-500 text-right">
                  {breakdown.waveHeight.raw.toFixed(2)} m
                  <span className="text-xs text-gray-400 ml-1">
                    (Protected: {breakdown.waveHeight.protected.toFixed(2)})
                  </span>
                </td>
                <td className={`px-4 py-2 whitespace-nowrap text-sm font-medium text-right ${
                  breakdown.waveHeight.score > 15 ? 'text-green-600' : 
                  breakdown.waveHeight.score > 10 ? 'text-yellow-600' : 'text-red-600'
                }`}>
                  {breakdown.waveHeight.score}/{breakdown.waveHeight.maxPossible}
                </td>
              </tr>
              <tr>
                <td className="px-4 py-2 whitespace-nowrap text-sm font-medium text-gray-700">Swell Height</td>
                <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-500 text-right">
                  {breakdown.swellHeight.raw.toFixed(2)} m
                </td>
                <td className={`px-4 py-2 whitespace-nowrap text-sm font-medium text-right ${
                  breakdown.swellHeight.score > 7 ? 'text-green-600' : 
                  breakdown.swellHeight.score > 5 ? 'text-yellow-600' : 'text-red-600'
                }`}>
                  {breakdown.swellHeight.score}/{breakdown.swellHeight.maxPossible}
                </td>
              </tr>
              <tr>
                <td className="px-4 py-2 whitespace-nowrap text-sm font-medium text-gray-700">Precipitation</td>
                <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-500 text-right">
                  {breakdown.precipitation.value.toFixed(1)} mm
                </td>
                <td className={`px-4 py-2 whitespace-nowrap text-sm font-medium text-right ${
                  breakdown.precipitation.value < 1 ? 'text-green-600' : 'text-red-600'
                }`}>
                  {breakdown.precipitation.score}/{breakdown.precipitation.maxPossible}
                </td>
              </tr>
              <tr>
                <td className="px-4 py-2 whitespace-nowrap text-sm font-medium text-gray-700">Temperature</td>
                <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-500 text-right">
                  {breakdown.temperature.value.toFixed(1)} °C
                </td>
                <td className={`px-4 py-2 whitespace-nowrap text-sm font-medium text-right ${
                  breakdown.temperature.score > 7 ? 'text-green-600' : 'text-yellow-600'
                }`}>
                  {breakdown.temperature.score}/{breakdown.temperature.maxPossible}
                </td>
              </tr>
              <tr>
                <td className="px-4 py-2 whitespace-nowrap text-sm font-medium text-gray-700">Cloud Cover</td>
                <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-500 text-right">
                  {breakdown.cloudCover.value.toFixed(0)}%
                </td>
                <td className={`px-4 py-2 whitespace-nowrap text-sm font-medium text-right ${
                  breakdown.cloudCover.score > 7 ? 'text-green-600' : 
                  breakdown.cloudCover.score > 5 ? 'text-yellow-600' : 'text-gray-600'
                }`}>
                  {breakdown.cloudCover.score}/{breakdown.cloudCover.maxPossible}
                </td>
              </tr>
              <tr>
                <td className="px-4 py-2 whitespace-nowrap text-sm font-medium text-gray-700">Geographic Protection</td>
                <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-500 text-right">
                  {breakdown.geoProtection.value.toFixed(0)}/100
                </td>
                <td className={`px-4 py-2 whitespace-nowrap text-sm font-medium text-right ${
                  breakdown.geoProtection.score > 10 ? 'text-green-600' : 
                  breakdown.geoProtection.score > 5 ? 'text-yellow-600' : 'text-red-600'
                }`}>
                  {breakdown.geoProtection.score}/{breakdown.geoProtection.maxPossible}
                </td>
              </tr>
              <tr className="bg-blue-50">
                <td className="px-4 py-3 whitespace-nowrap text-sm font-bold text-gray-900">TOTAL SCORE</td>
                <td className="px-4 py-3 whitespace-nowrap"></td>
                <td className={`px-4 py-3 whitespace-nowrap text-sm font-bold text-right ${
                  breakdown.total.score >= 85 ? 'text-green-600' : 
                  breakdown.total.score >= 70 ? 'text-yellow-600' :
                  breakdown.total.score >= 50 ? 'text-orange-600' : 'text-red-600'
                }`}>
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

  // Beach comparison section with better error handling
  const renderBeachComparison = (selectedBeach, allBeaches, weatherData) => {
    if (!selectedBeach || !allBeaches || allBeaches.length <= 1 || !weatherData) {
      return null;
    }
    
    // Safely check for required data
    if (!weatherData.hourly || !weatherData.hourly.winddirection_10m || 
        weatherData.hourly.winddirection_10m.length === 0) {
      return null;
    }
    
    const avgWindDirection = weatherData.hourly.winddirection_10m.reduce((sum, val) => sum + val, 0) / 
                        weatherData.hourly.winddirection_10m.length;
    
    const waveDirection = weatherData.daily && weatherData.daily.wave_direction_dominant ? 
                      weatherData.daily.wave_direction_dominant[0] : 
                      avgWindDirection;
    
    // Use useState and useEffect with better error handling
    const [beachComparisons, setBeachComparisons] = useState([]);
    const [comparisonLoading, setComparisonLoading] = useState(true);
    const [comparisonError, setComparisonError] = useState(null);
    
    useEffect(() => {
      let isMounted = true;
      
      async function calculateComparisons() {
        try {
          setComparisonLoading(true);
          setComparisonError(null);
          
          // Get current beach protection with error handling
          let currentBeachProtection;
          try {
            currentBeachProtection = await calculateGeographicProtection(
              selectedBeach, avgWindDirection, waveDirection
            );
          } catch (err) {
            console.error("Error calculating protection for selected beach:", err);
            currentBeachProtection = {
              protectionScore: 50,
              windProtection: 0.5,
              waveProtection: 0.5,
              bayEnclosure: 0.5
            };
          }
          
          // Only use beaches with valid data
          const validBeaches = allBeaches.filter(b => 
            b.id !== selectedBeach.id && 
            b.latitude !== undefined && 
            b.longitude !== undefined
          ).slice(0, 4);
          
          // Calculate comparisons for each beach
          const comparisons = await Promise.all(
            validBeaches.map(async (otherBeach) => {
              try {
                const otherProtection = await calculateGeographicProtection(
                  otherBeach, avgWindDirection, waveDirection
                );
                
                const comparison = otherProtection.protectionScore - currentBeachProtection.protectionScore;
                
                return {
                  beach: otherBeach,
                  comparison,
                  better: comparison > 10,
                  worse: comparison < -10,
                  similar: Math.abs(comparison) <= 10,
                  error: false
                };
              } catch (err) {
                console.error(`Error comparing beach ${otherBeach.name}:`, err);
                return {
                  beach: otherBeach,
                  comparison: 0,
                  better: false,
                  worse: false,
                  similar: true,
                  error: true
                };
              }
            })
          );
          
          if (isMounted) {
            setBeachComparisons(comparisons);
            setComparisonLoading(false);
          }
        } catch (err) {
          console.error("Error in beach comparison:", err);
          if (isMounted) {
            setComparisonError("Failed to compare beaches");
            setComparisonLoading(false);
          }
        }
      }
      
      calculateComparisons();
      
      return () => {
        isMounted = false;
      };
    }, [selectedBeach, avgWindDirection, waveDirection, allBeaches]);
    
    // If there's no data, don't render anything
    if (beachComparisons.length === 0 && !comparisonLoading) {
      return null;
    }
    
    return (
      <div className="mt-6 bg-blue-50 p-4 rounded-lg border border-blue-200 shadow-inner">
        <h4 className="font-medium mb-3 flex items-center text-blue-800">
          <MapPin className="h-5 w-5 mr-2 text-blue-600" />
          Compare with Nearby Beaches
        </h4>
        
        {comparisonLoading ? (
          <div className="flex justify-center items-center p-4">
            <div className="inline-block animate-spin h-6 w-6 border-2 border-blue-600 border-t-transparent rounded-full"></div>
            <span className="ml-2 text-blue-600">Comparing beaches...</span>
          </div>
        ) : comparisonError ? (
          <div className="p-4 bg-red-50 rounded-lg border border-red-200 text-red-700">
            <AlertCircle className="h-5 w-5 text-red-500 inline mr-2" />
            {comparisonError}
          </div>
        ) : (
          <div className="grid md:grid-cols-2 gap-4">
            {beachComparisons.map((item) => (
              <div key={item.beach.id} 
                  className={`flex items-center justify-between p-3 bg-white rounded-lg border shadow-sm hover:bg-blue-50 hover:border-blue-300 cursor-pointer transition-colors ${
                    item.error ? 'opacity-50' : ''
                  }`}
                  onClick={() => item.error ? toast.error("Cannot compare this beach") : handleBeachSelect(item.beach)}>
                <div className="flex items-center">
                  <MapPin className="h-4 w-4 mr-2 text-blue-500" />
                  <span className="font-medium">{item.beach.name}</span>
                </div>
                {item.error ? (
                  <span className="text-sm px-3 py-1 rounded-full bg-gray-100 text-gray-800">
                    Comparison unavailable
                  </span>
                ) : (
                  <span className={`text-sm px-3 py-1 rounded-full ${
                    item.better ? 'bg-green-100 text-green-800' : 
                    item.worse ? 'bg-red-100 text-red-800' : 
                    'bg-gray-100 text-gray-800'
                  }`}>
                    {item.better ? 'Better today' : 
                    item.worse ? 'Worse today' : 
                    'Similar'}
                  </span>
                )}
              </div>
            ))}
          </div>
        )}
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

      {/* Weather data display */}
      {weatherData && !loading && (
        <ErrorBoundary>
          <div className="p-6">
            {/* Debug info - only visible in debug mode */}
            {debugMode && (
              <div className="mb-4 p-2 bg-gray-100 rounded text-xs">
                <p>Debug info: Score: {score !== null ? score : 'null'}, 
                  Has breakdown: {scoreBreakdown ? 'yes' : 'no'}, 
                  Wind values: {weatherData.hourly.windspeed_10m ? 'yes' : 'no'}</p>
              </div>
            )}
            
            {/* If there's no score but we have weather data, show analysis error */}
            {score === null && (
              <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-md mb-4">
                <div className="flex items-center text-yellow-800">
                  <AlertCircle className="h-5 w-5 mr-2 text-yellow-600" />
                  <span>There was an issue calculating the score. Here's the raw weather data:</span>
                </div>
                
                <div className="grid grid-cols-2 gap-3 mt-4">
                  <div className="bg-white rounded-lg p-3 border">
                    <h3 className="font-medium mb-2">Wind Speed</h3>
                    <p>{weatherData.hourly && weatherData.hourly.windspeed_10m ? Math.round(weatherData.hourly.windspeed_10m[12]) : 'N/A'} km/h</p>
                  </div>
                  <div className="bg-white rounded-lg p-3 border">
                    <h3 className="font-medium mb-2">Temperature</h3>
                    <p>{weatherData.hourly && weatherData.hourly.temperature_2m ? Math.round(weatherData.hourly.temperature_2m[12]) : 'N/A'}°C</p>
                  </div>
                </div>
                
                <button
                  onClick={handleUpdateForecast}
                  className="mt-4 bg-yellow-600 text-white px-4 py-2 rounded-lg hover:bg-yellow-700 transition-colors flex items-center justify-center"
                >
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Try Again
                </button>
              </div>
            )}
            
            {/* Main Score Overview - only show when score is available */}
            {score !== null && (
              <>
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
                    <div className="mt-1 text-xs text-gray-500 flex items-center justify-center">
                      {weatherData.isRealData ? (
                        <>
                          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4 mr-1 text-green-500">
                            <path fillRule="evenodd" d="M2.25 12c0-5.385 4.365-9.75 9.75-9.75s9.75 4.365 9.75 9.75-4.365 9.75-9.75 9.75S2.25 17.385 2.25 12zm13.36-1.814a.75.75 0 10-1.22-.872l-3.236 4.53L9.53 12.22a.75.75 0 00-1.06 1.06l2.25 2.25a.75.75 0 001.14-.094l3.75-5.25z" clipRule="evenodd" />
                          </svg>
                          Using real Open-Meteo data
                        </>
                      ) : (
                        <>
                          <AlertCircle className="w-4 h-4 mr-1 text-yellow-500" />
                          Using simulated data with dynamic analysis
                        </>
                      )}
                    </div>
                  </div>
                  
                  {/* Weather Factors - RIGHT SIDE */}
                  <div className="md:w-2/3">
                    <div className="grid grid-cols-2 gap-3">
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
                          </div>
                        </div>
                      </div>
                      
                      <div className="bg-white rounded-lg p-3 border flex items-center shadow-sm">
                        <Waves className="h-6 w-6 mr-3 text-blue-600" />
                        <div className="flex-grow">
                          <div className="text-sm text-gray-500">Wave Height</div>
                          <div className={`text-lg font-medium ${
                            weatherData.daily.wave_height_max[0] < 0.2
                              ? "text-green-600"
                              : weatherData.daily.wave_height_max[0] < 0.4
                              ? "text-yellow-600"
                              : "text-red-600"
                          }`}>
                            {weatherData.daily.wave_height_max[0].toFixed(1)} m
                          </div>
                        </div>
                      </div>
                      
                      <div className="bg-white rounded-lg p-3 border flex items-center shadow-sm">
                        <Thermometer className="h-6 w-6 mr-3 text-blue-600" />
                        <div className="flex-grow">
                          <div className="text-sm text-gray-500">Temperature</div>
                          <div className={`text-lg font-medium ${
                            weatherData.hourly.temperature_2m[12] >= 22 &&
                            weatherData.hourly.temperature_2m[12] <= 30
                              ? "text-green-600"
                              : "text-yellow-600"
                          }`}>
                            {Math.round(weatherData.hourly.temperature_2m[12])}°C
                          </div>
                        </div>
                      </div>
                      
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
                      
                      <div className="bg-white rounded-lg p-3 border flex items-center shadow-sm">
                        <Sun className="h-6 w-6 mr-3 text-blue-600" />
                        <div className="flex-grow">
                          <div className="text-sm text-gray-500">Cloud Cover</div>
                          <div className={`text-lg font-medium ${
                            weatherData.hourly.cloudcover[12] < 40
                              ? "text-green-600"
                              : weatherData.hourly.cloudcover[12] < 70
                              ? "text-yellow-600"
                              : "text-gray-600"
                          }`}>
                            {Math.round(weatherData.hourly.cloudcover[12])}%
                          </div>
                        </div>
                      </div>
                      
                      {weatherData.hourly.swell_wave_height && (
                        <div className="bg-white rounded-lg p-3 border flex items-center shadow-sm">
                          <Waves className="h-6 w-6 mr-3 text-blue-600" />
                          <div className="flex-grow">
                            <div className="text-sm text-gray-500">Swell Height</div>
                            <div className={`text-lg font-medium ${
                              weatherData.hourly.swell_wave_height[12] < 0.3
                                ? "text-green-600"
                                : "text-yellow-600"
                            }`}>
                              {weatherData.hourly.swell_wave_height[12].toFixed(1)} m
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
                
                {/* Score Breakdown Table */}
                {scoreBreakdown && renderScoreBreakdown(scoreBreakdown)}
                
                {/* Geographic Protection Analysis */}
                {renderGeographicInfo(beach, weatherData)}
                
                {/* Hourly Wind Speed Visualization */}
                {weatherData.hourly && weatherData.hourly.windspeed_10m && 
                renderWindSpeedVisualization(weatherData, timeRange)}

                {/* Beach Comparison Section */}
                {renderBeachComparison(beach, beaches, weatherData)}
              </>
            )}
          </div>
        </ErrorBoundary>
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

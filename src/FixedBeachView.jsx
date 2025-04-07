// FixedBeachView.jsx - Extremely simplified but functional
import React, { useState, useEffect } from "react";
import { Home, ChevronLeft, RefreshCw, AlertCircle, MapPin, Map, Wind, Thermometer, Droplets, Waves, Sun } from "lucide-react";

const FixedBeachView = ({ beach, homeBeach, onSetHomeBeach, setView, onDataUpdate }) => {
  const [apiData, setApiData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  
  useEffect(() => {
    if (beach) {
      fetchWeatherData();
    }
  }, [beach?.id]);

  const fetchWeatherData = async () => {
    if (!beach) return;
    
    setLoading(true);
    setError(null);
    
    try {
      // Get today's date
      const today = new Date().toISOString().split('T')[0];
      
      // Calculate tomorrow
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      const tomorrowStr = tomorrow.toISOString().split('T')[0];
      
      // Create URLs
      const weatherUrl = `https://api.open-meteo.com/v1/forecast?latitude=${beach.latitude}&longitude=${beach.longitude}&hourly=temperature_2m,precipitation,cloudcover,windspeed_10m,winddirection_10m&daily=precipitation_sum,windspeed_10m_max&start_date=${today}&end_date=${tomorrowStr}&timezone=auto`;
      const marineUrl = `https://marine-api.open-meteo.com/v1/marine?latitude=${beach.latitude}&longitude=${beach.longitude}&hourly=wave_height,swell_wave_height,wave_direction&daily=wave_height_max,wave_direction_dominant&start_date=${today}&end_date=${tomorrowStr}&timezone=auto`;
      
      // Fetch data in parallel
      const [weatherRes, marineRes] = await Promise.all([
        fetch(weatherUrl),
        fetch(marineUrl)
      ]);
      
      // Check for errors
      if (!weatherRes.ok) throw new Error(`Weather API error: ${weatherRes.status}`);
      if (!marineRes.ok) throw new Error(`Marine API error: ${marineRes.status}`);
      
      // Parse data
      const weatherData = await weatherRes.json();
      const marineData = await marineRes.json();
      
      // Store data
      setApiData({ weather: weatherData, marine: marineData });
      
      // Update last updated timestamp
      if (typeof onDataUpdate === 'function') {
        onDataUpdate();
      }
    } catch (err) {
      console.error("Error fetching data:", err);
      setError(err.message || "Failed to fetch weather data");
    } finally {
      setLoading(false);
    }
  };
  
  // Extract current data
  const getCurrentData = () => {
    if (!apiData) return null;
    
    const currentHour = new Date().getHours();
    
    // Find index for current hour or use noon as fallback
    const hourIndex = apiData.weather.hourly.time.findIndex(time => {
      const date = new Date(time);
      return date.getHours() === currentHour;
    });
    
    const index = hourIndex >= 0 ? hourIndex : 12; // Use noon if current hour not found
    
    return {
      temperature: apiData.weather.hourly.temperature_2m[index],
      windSpeed: apiData.weather.hourly.windspeed_10m[index],
      precipitation: apiData.weather.hourly.precipitation[index],
      cloudCover: apiData.weather.hourly.cloudcover[index],
      windDirection: apiData.weather.hourly.winddirection_10m[index],
      waveHeight: apiData.marine.daily.wave_height_max[0],
      swellHeight: apiData.marine.hourly.swell_wave_height ? apiData.marine.hourly.swell_wave_height[index] : 0
    };
  };
  
  const currentData = apiData ? getCurrentData() : null;
  
  // Safety rating
  const getSafetyRating = () => {
    if (!currentData) return { safe: true, message: "" };
    
    if (currentData.windSpeed > 30) {
      return {
        safe: false,
        message: "HIGH WIND ALERT: Wind speeds above 30 km/h can be unsafe for paddleboarding. Please exercise extreme caution."
      };
    }
    
    if (currentData.waveHeight > 0.6) {
      return {
        safe: false,
        message: "HIGH WAVES ALERT: Wave height above 0.6m can be challenging for paddleboarding."
      };
    }
    
    if (currentData.precipitation > 1) {
      return {
        safe: false,
        message: "RAIN ALERT: Moderate precipitation expected. Visibility may be reduced."
      };
    }
    
    return {
      safe: true,
      message: "Conditions appear suitable for paddleboarding. Always check local conditions before heading out."
    };
  };
  
  const safetyRating = currentData ? getSafetyRating() : null;

  return (
    <div className="bg-white rounded-lg shadow-lg overflow-hidden">
      {/* Header */}
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
      
      {/* Loading state */}
      {loading && (
        <div className="p-8 text-center">
          <div className="inline-block animate-spin h-10 w-10 border-4 border-blue-500 border-t-transparent rounded-full mb-4"></div>
          <p className="text-gray-600">Loading real-time weather data...</p>
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
            onClick={fetchWeatherData}
            className="mt-4 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 w-full flex items-center justify-center"
          >
            <RefreshCw className="h-5 w-5 mr-2" />
            Try Again
          </button>
        </div>
      )}
      
      {/* Weather data */}
      {apiData && currentData && !loading && !error && (
        <div className="p-6">
          <h3 className="text-xl font-bold text-gray-800 mb-4">Current Weather at {beach?.name}</h3>
          
          {/* Main data cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <div className="bg-white rounded-lg p-4 border flex flex-col items-center shadow-sm">
              <Wind className="h-8 w-8 mb-2 text-blue-600" />
              <div className="text-sm text-gray-500 mb-1">Wind Speed</div>
              <div className="text-xl font-bold">{Math.round(currentData.windSpeed)} km/h</div>
            </div>
            
            <div className="bg-white rounded-lg p-4 border flex flex-col items-center shadow-sm">
              <Thermometer className="h-8 w-8 mb-2 text-blue-600" />
              <div className="text-sm text-gray-500 mb-1">Temperature</div>
              <div className="text-xl font-bold">{Math.round(currentData.temperature)}°C</div>
            </div>
            
            <div className="bg-white rounded-lg p-4 border flex flex-col items-center shadow-sm">
              <Droplets className="h-8 w-8 mb-2 text-blue-600" />
              <div className="text-sm text-gray-500 mb-1">Precipitation</div>
              <div className="text-xl font-bold">{currentData.precipitation.toFixed(1)} mm</div>
            </div>
            
            <div className="bg-white rounded-lg p-4 border flex flex-col items-center shadow-sm">
              <Waves className="h-8 w-8 mb-2 text-blue-600" />
              <div className="text-sm text-gray-500 mb-1">Wave Height</div>
              <div className="text-xl font-bold">{currentData.waveHeight.toFixed(1)} m</div>
            </div>
          </div>
          
          {/* Safety Rating */}
          {safetyRating && (
            <div className="bg-white p-4 rounded-lg border shadow-sm mb-6">
              <h4 className="font-semibold mb-2">Safety Rating</h4>
              <p className={safetyRating.safe ? "text-green-600" : "text-red-600"}>
                {safetyRating.message}
              </p>
            </div>
          )}
          
          <button 
            onClick={fetchWeatherData}
            className="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 w-full flex items-center justify-center"
          >
            <RefreshCw className="h-5 w-5 mr-2" />
            Refresh Real-Time Weather Data
          </button>
          
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

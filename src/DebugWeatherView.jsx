// DebugWeatherView.jsx - Enhanced to handle the exact API response format
import React, { useState, useEffect } from "react";
import { Home, ChevronLeft, RefreshCw, AlertCircle, MapPin, Map, Wind, Thermometer, Droplets, Waves } from "lucide-react";

const DebugWeatherView = ({ beach, homeBeach, onSetHomeBeach, setView, onDataUpdate }) => {
  const [apiResponse, setApiResponse] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  
  useEffect(() => {
    if (beach) {
      loadData();
    }
  }, [beach?.id]);

  const loadData = async () => {
    if (!beach) return;
    
    setLoading(true);
    setError(null);
    
    try {
      // Direct API calls
      const today = new Date().toISOString().split('T')[0];
      const endDate = new Date();
      endDate.setDate(endDate.getDate() + 1);
      const tomorrow = endDate.toISOString().split('T')[0];
      
      // Weather API URL
      const weatherUrl = `https://api.open-meteo.com/v1/forecast?latitude=${beach.latitude}&longitude=${beach.longitude}&hourly=temperature_2m,precipitation,cloudcover,windspeed_10m,winddirection_10m&daily=precipitation_sum,windspeed_10m_max&start_date=${today}&end_date=${tomorrow}&timezone=auto`;
      
      // Marine API URL
      const marineUrl = `https://marine-api.open-meteo.com/v1/marine?latitude=${beach.latitude}&longitude=${beach.longitude}&hourly=wave_height,swell_wave_height,wave_direction&daily=wave_height_max,wave_direction_dominant&start_date=${today}&end_date=${tomorrow}&timezone=auto`;
      
      console.log("Fetching data from:", weatherUrl, marineUrl);
      
      // Make API calls in parallel
      const [weatherResponse, marineResponse] = await Promise.all([
        fetch(weatherUrl),
        fetch(marineUrl)
      ]);
      
      if (!weatherResponse.ok) {
        throw new Error(`Weather API error: ${weatherResponse.status}`);
      }
      
      if (!marineResponse.ok) {
        throw new Error(`Marine API error: ${marineResponse.status}`);
      }
      
      const weatherData = await weatherResponse.json();
      const marineData = await marineResponse.json();
      
      console.log("Weather data:", weatherData);
      console.log("Marine data:", marineData);
      
      setApiResponse({
        weather: weatherData,
        marine: marineData
      });
      
      if (onDataUpdate) {
        onDataUpdate();
      }
      
    } catch (err) {
      console.error("API Error:", err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Helper to find the current hour data
  const getCurrentHourData = () => {
    if (!apiResponse || !apiResponse.weather || !apiResponse.weather.hourly) {
      return null;
    }
    
    const currentHour = new Date().getHours();
    
    // Find the index for the current time
    const timeIndex = apiResponse.weather.hourly.time.findIndex(time => {
      const hourFromTime = new Date(time).getHours();
      return hourFromTime === currentHour;
    });
    
    // If found, return the data for that hour
    if (timeIndex !== -1) {
      return {
        temperature: apiResponse.weather.hourly.temperature_2m[timeIndex],
        windSpeed: apiResponse.weather.hourly.windspeed_10m[timeIndex],
        precipitation: apiResponse.weather.hourly.precipitation[timeIndex],
        cloudcover: apiResponse.weather.hourly.cloudcover[timeIndex],
        windDirection: apiResponse.weather.hourly.winddirection_10m[timeIndex],
        waveHeight: apiResponse.marine?.hourly?.wave_height?.[timeIndex] || 0,
        swellWaveHeight: apiResponse.marine?.hourly?.swell_wave_height?.[timeIndex] || 0
      };
    }
    
    // Default to the middle of the day (noon)
    return {
      temperature: apiResponse.weather.hourly.temperature_2m[12] || 0,
      windSpeed: apiResponse.weather.hourly.windspeed_10m[12] || 0,
      precipitation: apiResponse.weather.hourly.precipitation[12] || 0,
      cloudcover: apiResponse.weather.hourly.cloudcover[12] || 0,
      windDirection: apiResponse.weather.hourly.winddirection_10m[12] || 0,
      waveHeight: apiResponse.marine?.hourly?.wave_height?.[12] || 0,
      swellWaveHeight: apiResponse.marine?.hourly?.swell_wave_height?.[12] || 0
    };
  };

  const currentData = getCurrentHourData();

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
          {beach && (
            <div className="flex items-center mt-1">
              <p className="text-gray-600 mr-3">
                {beach.latitude.toFixed(4)}, {beach.longitude.toFixed(4)}
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
          )}
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
          <p className="text-gray-600">Fetching real-time data from Open-Meteo API...</p>
        </div>
      )}

      {/* Error state */}
      {error && !loading && (
        <div className="p-8 text-center">
          <div className="bg-red-50 p-6 rounded-lg max-w-lg mx-auto border border-red-200">
            <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
            <h3 className="text-xl font-bold text-gray-800 mb-4">API Error</h3>
            <div className="text-red-600 mb-6 p-3 bg-red-100 rounded-md overflow-auto text-sm">
              <pre>{error}</pre>
            </div>
            <button
              onClick={loadData}
              className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700"
            >
              Try Again
            </button>
          </div>
        </div>
      )}

      {/* Data display */}
      {apiResponse && !loading && !error && (
        <div className="p-6">
          <h3 className="text-xl font-bold text-gray-800 mb-4">Current Weather at {beach?.name}</h3>
          
          <div className="bg-blue-50 p-6 rounded-lg mb-6">
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-4">
              {currentData && (
                <>
                  <div className="bg-white p-4 rounded-lg shadow-sm flex items-center">
                    <Wind className="h-8 w-8 mr-3 text-blue-500" />
                    <div>
                      <div className="text-sm text-gray-500">Wind Speed</div>
                      <div className="text-xl font-bold">
                        {Math.round(currentData.windSpeed)} km/h
                      </div>
                    </div>
                  </div>
                  
                  <div className="bg-white p-4 rounded-lg shadow-sm flex items-center">
                    <Thermometer className="h-8 w-8 mr-3 text-blue-500" />
                    <div>
                      <div className="text-sm text-gray-500">Temperature</div>
                      <div className="text-xl font-bold">
                        {Math.round(currentData.temperature)}°C
                      </div>
                    </div>
                  </div>
                  
                  <div className="bg-white p-4 rounded-lg shadow-sm flex items-center">
                    <Droplets className="h-8 w-8 mr-3 text-blue-500" />
                    <div>
                      <div className="text-sm text-gray-500">Precipitation</div>
                      <div className="text-xl font-bold">
                        {currentData.precipitation.toFixed(1)} mm
                      </div>
                    </div>
                  </div>
                  
                  <div className="bg-white p-4 rounded-lg shadow-sm flex items-center">
                    <Waves className="h-8 w-8 mr-3 text-blue-500" />
                    <div>
                      <div className="text-sm text-gray-500">Wave Height</div>
                      <div className="text-xl font-bold">
                        {currentData.waveHeight.toFixed(1)} m
                      </div>
                    </div>
                  </div>
                </>
              )}
            </div>
            
            <div className="bg-white p-4 rounded-lg shadow-sm mb-4">
              <h4 className="font-semibold mb-2">Safety Rating</h4>
              <p className="text-red-600 font-bold">
                HIGH WIND ALERT: Wind speeds above 30 km/h can be unsafe for paddleboarding.
                Please exercise extreme caution.
              </p>
            </div>
            
            <button
              onClick={loadData}
              className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 flex items-center justify-center w-full"
            >
              <RefreshCw className="h-5 w-5 mr-2" />
              Refresh Real-Time Weather Data
            </button>
          </div>
          
          <div className="text-center">
            <p className="text-sm text-gray-500 mb-4">
              This is real-time weather data from Open-Meteo API. Always verify conditions before paddleboarding.
            </p>
          </div>
        </div>
      )}
    </div>
  );
};

export default DebugWeatherView;

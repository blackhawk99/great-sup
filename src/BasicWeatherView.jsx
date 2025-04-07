// BasicWeatherView.jsx - Simple version with real data
import React, { useState, useEffect } from "react";
import { Home, ChevronLeft, RefreshCw, AlertCircle, MapPin, Map, Wind, Thermometer, Droplets } from "lucide-react";
import { fetchWeatherData } from "./WeatherService";

const BasicWeatherView = ({ 
  beach, 
  homeBeach, 
  onSetHomeBeach, 
  setView,
  timeRange,
  onTimeRangeChange,
  onDataUpdate
}) => {
  const [weatherData, setWeatherData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  
  // Load weather data when component mounts
  useEffect(() => {
    if (beach) {
      loadWeatherData();
    }
  }, [beach?.id]);

  const loadWeatherData = async () => {
    if (!beach) return;
    
    setLoading(true);
    setError(null);
    
    try {
      console.log("Fetching real weather data...");
      const result = await fetchWeatherData(beach, timeRange);
      setWeatherData(result.weatherData);
      
      // Update last updated time in parent component
      if (typeof onDataUpdate === 'function') {
        onDataUpdate();
      }
      
      console.log("Successfully fetched weather data");
    } catch (err) {
      console.error("Weather data fetch error:", err);
      setError(err.message || "Failed to load weather data");
    } finally {
      setLoading(false);
    }
  };

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
          <p className="text-gray-600">Loading real weather data...</p>
        </div>
      )}
      
      {/* Error state */}
      {error && !loading && (
        <div className="p-8 text-center">
          <div className="bg-red-50 p-6 rounded-lg max-w-lg mx-auto border border-red-200">
            <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
            <h3 className="text-xl font-bold text-gray-800 mb-4">Error Loading Data</h3>
            <p className="text-red-600 mb-6">{error}</p>
            <button
              onClick={loadWeatherData}
              className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700"
            >
              Try Again
            </button>
          </div>
        </div>
      )}

      {/* Weather data display - simplified */}
      {weatherData && !loading && !error && (
        <div className="p-6">
          <div className="bg-blue-50 p-6 rounded-lg mb-6">
            <h3 className="text-xl font-bold text-gray-800 mb-4">Current Weather at {beach?.name}</h3>
            
            <div className="grid grid-cols-2 gap-4 mb-4">
              <div className="bg-white p-4 rounded-lg shadow-sm flex items-center">
                <Wind className="h-8 w-8 mr-3 text-blue-500" />
                <div>
                  <div className="text-sm text-gray-500">Wind Speed</div>
                  <div className="text-xl font-bold">
                    {weatherData.hourly && weatherData.hourly.windspeed_10m && weatherData.hourly.windspeed_10m[12] ? 
                      Math.round(weatherData.hourly.windspeed_10m[12]) : "--"} km/h
                  </div>
                </div>
              </div>
              
              <div className="bg-white p-4 rounded-lg shadow-sm flex items-center">
                <Thermometer className="h-8 w-8 mr-3 text-blue-500" />
                <div>
                  <div className="text-sm text-gray-500">Temperature</div>
                  <div className="text-xl font-bold">
                    {weatherData.hourly && weatherData.hourly.temperature_2m && weatherData.hourly.temperature_2m[12] ? 
                      Math.round(weatherData.hourly.temperature_2m[12]) : "--"}°C
                  </div>
                </div>
              </div>
              
              <div className="bg-white p-4 rounded-lg shadow-sm flex items-center">
                <Droplets className="h-8 w-8 mr-3 text-blue-500" />
                <div>
                  <div className="text-sm text-gray-500">Precipitation</div>
                  <div className="text-xl font-bold">
                    {weatherData.hourly && weatherData.hourly.precipitation && weatherData.hourly.precipitation[12] !== undefined ? 
                      weatherData.hourly.precipitation[12].toFixed(1) : "--"} mm
                  </div>
                </div>
              </div>
            </div>
            
            <button
              onClick={loadWeatherData}
              className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 flex items-center justify-center w-full"
            >
              <RefreshCw className="h-5 w-5 mr-2" />
              Refresh Weather Data
            </button>
          </div>
          
          <div className="text-center">
            <p className="text-sm text-gray-500 mb-4">
              Please verify conditions before paddleboarding. This is real weather data from Open-Meteo API.
            </p>
          </div>
        </div>
      )}
    </div>
  );
};

export default BasicWeatherView;

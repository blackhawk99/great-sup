// DebugWeatherView.jsx - Ultra robust with full debugging
import React, { useState, useEffect } from "react";
import { Home, ChevronLeft, RefreshCw, AlertCircle, MapPin, Map, Wind, Thermometer, Droplets } from "lucide-react";

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
      // Direct API calls without any intermediate processing
      console.log("Fetching data for:", beach.name, beach.latitude, beach.longitude);

      // Date formatting
      const today = new Date().toISOString().split('T')[0];
      const endDate = new Date();
      endDate.setDate(endDate.getDate() + 1);
      const tomorrow = endDate.toISOString().split('T')[0];
      
      // Log the dates
      console.log("Fetching for dates:", today, "to", tomorrow);
      
      // Weather API URL - fully expanded for clarity
      const weatherUrl = `https://api.open-meteo.com/v1/forecast?latitude=${beach.latitude}&longitude=${beach.longitude}&hourly=temperature_2m,precipitation,cloudcover,windspeed_10m,winddirection_10m&daily=precipitation_sum,windspeed_10m_max&start_date=${today}&end_date=${tomorrow}&timezone=auto`;
      
      // Marine API URL - fully expanded for clarity
      const marineUrl = `https://marine-api.open-meteo.com/v1/marine?latitude=${beach.latitude}&longitude=${beach.longitude}&hourly=wave_height,swell_wave_height,wave_direction&daily=wave_height_max,wave_direction_dominant&start_date=${today}&end_date=${tomorrow}&timezone=auto`;
      
      console.log("Weather API URL:", weatherUrl);
      console.log("Marine API URL:", marineUrl);
      
      // Make the API calls
      const weatherResponse = await fetch(weatherUrl);
      const marineResponse = await fetch(marineUrl);
      
      // Check for HTTP errors
      if (!weatherResponse.ok) {
        throw new Error(`Weather API error: ${weatherResponse.status}`);
      }
      if (!marineResponse.ok) {
        throw new Error(`Marine API error: ${marineResponse.status}`);
      }
      
      // Parse the JSON responses
      const weatherData = await weatherResponse.json();
      const marineData = await marineResponse.json();
      
      // Log the raw API responses
      console.log("Weather API response:", weatherData);
      console.log("Marine API response:", marineData);
      
      // Store the combined response
      setApiResponse({
        weather: weatherData,
        marine: marineData
      });
      
      // Update timestamp
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

      {/* Data display with detailed debugger */}
      {apiResponse && !loading && !error && (
        <div className="p-6">
          <div className="bg-blue-50 p-6 rounded-lg mb-6">
            <h3 className="text-xl font-bold text-gray-800 mb-4">Current Weather at {beach?.name}</h3>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
              {/* First try to extract data from API */}
              {apiResponse.weather?.hourly?.windspeed_10m && (
                <div className="bg-white p-4 rounded-lg shadow-sm flex items-center">
                  <Wind className="h-8 w-8 mr-3 text-blue-500" />
                  <div>
                    <div className="text-sm text-gray-500">Wind Speed</div>
                    <div className="text-xl font-bold">
                      {Math.round(apiResponse.weather.hourly.windspeed_10m[12] || 0)} km/h
                    </div>
                  </div>
                </div>
              )}
              
              {apiResponse.weather?.hourly?.temperature_2m && (
                <div className="bg-white p-4 rounded-lg shadow-sm flex items-center">
                  <Thermometer className="h-8 w-8 mr-3 text-blue-500" />
                  <div>
                    <div className="text-sm text-gray-500">Temperature</div>
                    <div className="text-xl font-bold">
                      {Math.round(apiResponse.weather.hourly.temperature_2m[12] || 0)}°C
                    </div>
                  </div>
                </div>
              )}
              
              {apiResponse.weather?.hourly?.precipitation && (
                <div className="bg-white p-4 rounded-lg shadow-sm flex items-center">
                  <Droplets className="h-8 w-8 mr-3 text-blue-500" />
                  <div>
                    <div className="text-sm text-gray-500">Precipitation</div>
                    <div className="text-xl font-bold">
                      {(apiResponse.weather.hourly.precipitation[12] || 0).toFixed(1)} mm
                    </div>
                  </div>
                </div>
              )}
            </div>
            
            <button
              onClick={loadData}
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
          
          {/* Debug output - raw API response */}
          <div className="mt-4 border-t pt-4">
            <h4 className="text-lg font-medium mb-2">API Response Debug Info</h4>
            <div className="bg-gray-100 p-3 rounded-md text-xs overflow-auto max-h-64">
              <pre>{JSON.stringify(apiResponse, null, 2)}</pre>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DebugWeatherView;

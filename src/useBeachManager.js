// components/BeachDetailView.jsx - Detail view for a selected beach
import React, { useState, useEffect } from "react";
import { Home, ChevronLeft, Calendar, RefreshCw, AlertCircle } from "lucide-react";
import { ErrorBoundary } from "./ErrorBoundary";
import DatePickerModal from "./DatePickerModal";
import { fetchWeatherData, getCondition } from "../services/WeatherService";
import GeographicInfo from "./GeographicInfo";
import ScoreBreakdown from "./ScoreBreakdown";
import WindSpeedVisualization from "./WindSpeedVisualization";
import BeachComparison from "./BeachComparison";

const BeachDetailView = ({
  beach,
  homeBeach,
  onSetHomeBeach,
  timeRange,
  onTimeRangeChange,
  setView,
  beaches,
  toast,
  mockDataRef,
  debugMode
}) => {
  const [weatherData, setWeatherData] = useState(null);
  const [score, setScore] = useState(null);
  const [scoreBreakdown, setScoreBreakdown] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [showDatePicker, setShowDatePicker] = useState(false);

  // Load weather data when beach is selected
  useEffect(() => {
    if (beach) {
      handleUpdateForecast();
    }
  }, [beach]);

  // Handle update forecast button
  const handleUpdateForecast = () => {
    if (beach) {
      fetchWeatherData(beach, timeRange, mockDataRef, {
        setLoading,
        setError,
        setWeatherData,
        setScore,
        setScoreBreakdown
      });
    }
  };

  return (
    <div className="bg-white rounded-lg shadow-lg overflow-hidden">
      {/* Beach header with name, coordinates and back button */}
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

      {/* Time Range Selector */}
      <div className="p-4 border-b bg-gray-50">
        <h3 className="text-lg font-medium mb-4">Choose Date & Time Window</h3>
        
        {/* Date selector */}
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
        
        {/* Today/Tomorrow buttons */}
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
        
        {/* Time selector */}
        <div className="grid grid-cols-2 gap-4 mb-4">
          {/* Time selectors omitted for brevity */}
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

      {/* Weather data display - IMPROVED with error checking */}
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
            
            {/* Dynamic content based on score availability */}
            {score === null ? (
              <ScoreLoadingError weatherData={weatherData} onRetry={handleUpdateForecast} />
            ) : (
              <WeatherContent 
                score={score}
                scoreBreakdown={scoreBreakdown}
                weatherData={weatherData}
                beach={beach}
                beaches={beaches}
                timeRange={timeRange}
              />
            )}
          </div>
        </ErrorBoundary>
      )}
      
      {/* Date Picker Modal */}
      {showDatePicker && (
        <DatePickerModal
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

// Helper component to show when score calculation fails
const ScoreLoadingError = ({ weatherData, onRetry }) => (
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
      onClick={onRetry}
      className="mt-4 bg-yellow-600 text-white px-4 py-2 rounded-lg hover:bg-yellow-700 transition-colors flex items-center justify-center"
    >
      <RefreshCw className="h-4 w-4 mr-2" />
      Try Again
    </button>
  </div>
);

// Helper component for main weather content
const WeatherContent = ({ score, scoreBreakdown, weatherData, beach, beaches, timeRange }) => (
  <>
    <div className="flex flex-col md:flex-row gap-6 mb-6">
      {/* Score card - LEFT SIDE */}
      <ScoreCard score={score} weatherData={weatherData} />
      
      {/* Weather Factors - RIGHT SIDE */}
      <WeatherFactors weatherData={weatherData} />
    </div>
    
    {/* Score Breakdown Table */}
    {scoreBreakdown && <ScoreBreakdown breakdown={scoreBreakdown} />}
    
    {/* Geographic Protection Analysis */}
    <GeographicInfo beach={beach} weatherData={weatherData} />
    
    {/* Hourly Wind Speed Visualization */}
    {weatherData.hourly && weatherData.hourly.windspeed_10m && 
     <WindSpeedVisualization weatherData={weatherData} timeRange={timeRange} />}

    {/* Beach Comparison Section */}
    <BeachComparison selectedBeach={beach} allBeaches={beaches} weatherData={weatherData} />
  </>
);

export default BeachDetailView;

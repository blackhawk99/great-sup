className="bg-blue-600 text-white px-4 py-2 rounded-r hover:bg-blue-700 transition-colors"
                      disabled={loading}
                    >
                      {loading ? 'Analyzing...' : 'Extract'}
                    </button>
                  </div>
                  {loading && (
                    <p className="text-xs text-blue-600 mt-2">
                      Analyzing coastline and geographic protection...
                    </p>
                  )}
                </div>
              </div>

              <div className="mb-6">
                <h3 className="text-lg font-medium mb-3">
                  <span className="flex items-center">
                    <Plus className="h-5 w-5 mr-2 text-blue-500" />
                    Beach Details
                  </span>
                </h3>
                <div className="bg-white p-4 rounded-lg border shadow-sm">
                  <div className="grid gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Beach Name
                      </label>
                      <input
                        type="text"
                        value={newBeach.name}
                        onChange={(e) =>
                          setNewBeach({ ...newBeach, name: e.target.value })
                        }
                        placeholder="e.g., Kavouri Beach"
                        className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Latitude
                        </label>
                        <input
                          type="number"
                          step="0.0001"
                          value={newBeach.latitude}
                          onChange={(e) =>
                            setNewBeach({ ...newBeach, latitude: e.target.value })
                          }
                          placeholder="e.g., 37.8235"
                          className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Longitude
                        </label>
                        <input
                          type="number"
                          step="0.0001"
                          value={newBeach.longitude}
                          onChange={(e) =>
                            setNewBeach({
                              ...newBeach,
                              longitude: e.target.value,
                            })
                          }
                          placeholder="e.g., 23.7761"
                          className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        />
                      </div>
                    </div>
                  </div>
                  <div className="flex justify-end mt-4">
                    <button
                      onClick={handleAddBeach}
                      disabled={
                        !newBeach.name ||
                        !newBeach.latitude ||
                        !newBeach.longitude
                      }
                      className={`px-4 py-2 rounded-lg ${
                        !newBeach.name ||
                        !newBeach.latitude ||
                        !newBeach.longitude
                          ? "bg-gray-300 text-gray-500 cursor-not-allowed"
                          : "bg-blue-600 text-white hover:bg-blue-700 transition-colors"
                      }`}
                    >
                      Add Beach
                    </button>
                  </div>
                </div>
              </div>

              <div className="border-t pt-6">
                <h3 className="text-lg font-medium mb-3">
                  Popular Greek Beaches
                </h3>
                <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
                  {suggestedLocations.map((location, index) => (
                    <div
                      key={index}
                      className="bg-white border rounded-lg p-4 hover:bg-blue-50 hover:border-blue-300 cursor-pointer transition shadow-sm"
                      onClick={() => handleAddSuggested(location)}
                    >
                      <h4 className="font-medium text-blue-700">{location.name}</h4>
                      <p className="text-sm text-gray-500 mb-2">
                        {location.latitude.toFixed(4)}, {location.longitude.toFixed(4)}
                      </p>
                      <a 
                        href={location.googleMapsUrl || `https://www.google.com/maps?q=${location.latitude},${location.longitude}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-blue-600 hover:underline flex items-center"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <Map className="h-3 w-3 mr-1" />
                        View on Google Maps
                      </a>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {view === "detail" && selectedBeach && (
          <div className="bg-white rounded-lg shadow-lg overflow-hidden">
            <div className="p-4 border-b flex justify-between items-center">
              <div>
                <h2 className="text-2xl font-semibold flex items-center">
                  {selectedBeach.id === homeBeach?.id && (
                    <Home className="h-5 w-5 text-orange-500 mr-2" />
                  )}
                  {selectedBeach.name}
                </h2>
                <div className="flex items-center mt-1">
                  <p className="text-gray-600 mr-3">
                    {selectedBeach.latitude.toFixed(4)},{" "}
                    {selectedBeach.longitude.toFixed(4)}
                  </p>
                  <a 
                    href={selectedBeach.googleMapsUrl || `https://www.google.com/maps?q=${selectedBeach.latitude},${selectedBeach.longitude}`}
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
                {selectedBeach.id !== homeBeach?.id && (
                  <button
                    onClick={() => handleSetHomeBeach(selectedBeach)}
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
                    handleTimeRangeChange('date', today);
                  }}
                  className="flex-1 bg-blue-500 text-white py-3 px-4 rounded-lg text-lg font-medium hover:bg-blue-600"
                >
                  Today
                </button>
                <button 
                onClick={() => {
                    const tomorrow = new Date();
                    tomorrow.setDate(tomorrow.getDate() + 1);
                    handleTimeRangeChange('date', tomorrow.toISOString().split('T')[0]);
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
                    onChange={(e) => handleTimeRangeChange('startTime', e.target.value)}
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
                    onChange={(e) => handleTimeRangeChange('endTime', e.target.value)}
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
              <div className="p-4 bg-red-50 border border-red-200 rounded-md text-red-800 mx-4 my-2">
                <p className="flex items-center font-medium">
                  <AlertCircle className="w-5 h-5 mr-2 text-red-600" />
                  {error}
                </p>
              </div>
            )}

            {/* Weather data display - with error boundaries */}
            {weatherData && score !== null && !loading && (
              <ErrorBoundary>
                <div className="p-6">
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
                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4 mr-1 text-yellow-500">
                              <path fillRule="evenodd" d="M9.401 3.003c1.155-2 4.043-2 5.197 0l7.355 12.748c1.154 2-.29 4.5-2.599 4.5H4.645c-2.309 0-3.752-2.5-2.598-4.5L9.4 3.003zM12 8.25a.75.75 0 01.75.75v3.75a.75.75 0 01-1.5 0V9a.75.75 0 01.75-.75zm0 8.25a.75.75 0 100-1.5.75.75 0 000 1.5z" clipRule="evenodd" />
                            </svg>
                            Using simulated data with dynamic analysis
                          </>
                        )}
                      </div>
                    </div>
                    
                    {/* Weather Factors - RIGHT SIDE */}
                    <div className="md:w-2/3">
                      <div className="grid grid-cols-2 gap-3">
                        {/* Only render if we have valid data */}
                        {weatherData.hourly && weatherData.hourly.windspeed_10m && (
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
                        )}
                        
                        {weatherData.daily && weatherData.daily.wave_height_max && (
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
                        )}
                        
                        {weatherData.hourly && weatherData.hourly.temperature_2m && (
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
                        )}
                        
                        {weatherData.hourly && weatherData.hourly.precipitation && (
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
                        )}
                        
                        {weatherData.hourly && weatherData.hourly.cloudcover && (
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
                        )}
                        
                        {weatherData.hourly && weatherData.hourly.swell_wave_height && (
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
                  
                  {/* Score Breakdown Table - Wrap in error boundary */}
                  <ErrorBoundary>
                    {scoreBreakdown && renderScoreBreakdown(scoreBreakdown)}
                  </ErrorBoundary>
                  
                  {/* Geographic Protection Analysis - Wrap in error boundary */}
                  <ErrorBoundary>
                    {renderGeographicInfo(selectedBeach, weatherData)}
                  </ErrorBoundary>
                  
                  {/* Hourly Wind Speed Visualization - Wrap in error boundary */}
                  <ErrorBoundary>
                    {renderWindSpeedVisualization(weatherData, timeRange)}
                  </ErrorBoundary>

                  {/* Beach Comparison Section - Wrap in error boundary */}
                  <ErrorBoundary>
                    {renderBeachComparison(selectedBeach, beaches, weatherData)}
                  </ErrorBoundary>
                </div>
              </ErrorBoundary>
            )}
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="bg-blue-800 text-white p-4 mt-auto shadow-inner">
        <div className="container mx-auto text-center text-sm">
          <p>© 2025 Paddleboard Weather Advisor | Ladi Thalassa</p>
        </div>
      </footer>
    </div>
  );
};

export default App;

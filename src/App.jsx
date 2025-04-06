// Handle update forecast button
const handleUpdateForecast = async () => {
  if (!beach) return;
  
  setLoading(true);
  setError(null);
  
  try {
    // Fetch real weather data using the API
    const { weatherData, score, scoreBreakdown } = await fetchWeatherData(beach, timeRange);
    
    setWeatherData(weatherData);
    setScore(score);
    setScoreBreakdown(scoreBreakdown);
    
    // Update last updated time in parent component if callback provided
    if (onDataUpdate) {
      onDataUpdate();
    }
  } catch (err) {
    console.error("Failed to update forecast:", err);
    setError(err.message || "Failed to update forecast. Please try again.");
    
    // Set default fallback data
    setWeatherData({
      hourly: {
        time: Array.from({ length: 24 }, (_, i) => `${timeRange.date}T${String(i).padStart(2, "0")}:00`),
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
  } finally {
    setLoading(false);
  }
};

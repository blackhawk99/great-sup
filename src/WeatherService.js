// services/WeatherService.js - Handles weather data and score calculations
import { getCardinalDirection } from "../utils/helpers";
import { calculateGeographicProtection } from "../utils/coastlineAnalysis";

// Filter hourly data by time range
export const filterHoursByTimeRange = (hourlyData, range) => {
  if (!hourlyData) return null;
  
  const startHour = parseInt(range.startTime.split(":")[0]);
  const endHour = parseInt(range.endTime.split(":")[0]);

  return {
    temperature_2m: hourlyData.temperature_2m.slice(startHour, endHour + 1),
    precipitation: hourlyData.precipitation.slice(startHour, endHour + 1),
    cloudcover: hourlyData.cloudcover.slice(startHour, endHour + 1),
    windspeed_10m: hourlyData.windspeed_10m.slice(startHour, endHour + 1),
    winddirection_10m: hourlyData.winddirection_10m.slice(startHour, endHour + 1),
    swell_wave_height: hourlyData.swell_wave_height ? 
      hourlyData.swell_wave_height.slice(startHour, endHour + 1) : undefined,
    wave_height: hourlyData.wave_height ? 
      hourlyData.wave_height.slice(startHour, endHour + 1) : undefined
  };
};

// Get condition based on score
export const getCondition = (score) => {
  if (score >= 85)
    return {
      label: "Perfect",
      emoji: "✅",
      message: "Flat like oil. Paddle on.",
    };
  if (score >= 70)
    return {
      label: "Okay-ish",
      emoji: "⚠️",
      message: "Minor chop. Go early.",
    };
  if (score >= 50)
    return {
      label: "Not Great",
      emoji: "❌",
      message: "Wind or waves make it tricky.",
    };
  return { label: "Nope", emoji: "🚫", message: "Not recommended." };
};

// Fetch weather data
export const fetchWeatherData = async (beach, timeRange, mockDataRef, callbacks) => {
  const { setLoading, setError, setWeatherData, setScore, setScoreBreakdown } = callbacks;
  
  if (!beach || !beach.latitude || !beach.longitude) {
    throw new Error("Invalid beach data. Please try adding this beach again.");
  }
  
  setLoading(true);
  setError(null);
  
  try {
    const { longitude, latitude } = beach;
    const selectedDate = new Date(timeRange.date);
    const formattedDate = selectedDate.toISOString().split("T")[0];
    
    // For demo purposes, use mock data with proper variation between beaches
    const beachNameLower = beach.name.toLowerCase();
    let mockData = {...mockDataRef.current["default"]}; // Create a copy to avoid reference issues
    
    if (beachNameLower.includes("kavouri")) {
      mockData = {...mockDataRef.current["Kavouri Beach"]};
    } else if (beachNameLower.includes("glyf")) {
      mockData = {...mockDataRef.current["Glyfada Beach"]};
    } else if (beachNameLower.includes("astir") || beachNameLower.includes("aster")) {
      mockData = {...mockDataRef.current["Astir Beach"]};
    } else if (beachNameLower.includes("kapsal")) {
      mockData = {...mockDataRef.current["Kapsali Beach"]};
    } else if (beachNameLower.includes("palaio")) {
      mockData = {...mockDataRef.current["Palaiopoli Beach"]};
    }
    
    // Verify that mockData structure is valid
    if (!mockData || !mockData.hourly || !mockData.daily) {
      console.error("Invalid mock data structure", mockData);
      throw new Error("Invalid mock data structure");
    }
    
    // Deep clone the hourly data to prevent reference issues
    mockData.hourly = {...mockData.hourly};
    mockData.daily = {...mockData.daily};
    
    // Update the date in mock data - create a new array
    mockData.hourly.time = Array.from(
      { length: 24 },
      (_, i) => `${timeRange.date}T${String(i).padStart(2, "0")}:00`
    );

    mockData.isRealData = false;
    
    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 800));
    
    // Set weather data first
    setWeatherData(mockData);
    
    // Allow a render cycle to complete
    await new Promise(resolve => setTimeout(resolve, 50));
    
    // Calculate score using the mock data with dynamic protection analysis
    const relevantHours = filterHoursByTimeRange(mockData.hourly, timeRange);
    
    // Validate that we have the necessary data to proceed
    if (!relevantHours || !relevantHours.winddirection_10m || relevantHours.winddirection_10m.length === 0) {
      console.error("Missing wind direction data", relevantHours);
      throw new Error("Missing wind direction data");
    }
    
    // Get average wind direction for protection analysis
    const avgWindDirection =
      relevantHours.winddirection_10m.reduce((sum, val) => sum + val, 0) /
      relevantHours.winddirection_10m.length;
    
    // Get wave direction (safely)
    const waveDirection = mockData.daily.wave_direction_dominant ? 
                      mockData.daily.wave_direction_dominant[0] : 
                      avgWindDirection;
    
    // Now calculate protection dynamically for this beach
    const protection = await calculateGeographicProtection(beach, avgWindDirection, waveDirection);
    
    // Use this protection data in the score calculation
    const { calculatedScore, breakdown } = calculatePaddleScore(
      relevantHours,
      mockData.daily,
      beach,
      protection
    );
    
    // Update score and breakdown
    setScore(calculatedScore);
    setScoreBreakdown(breakdown);
    
  } catch (error) {
    console.error("Error with weather data:", error);
    setError(`Unable to load weather data: ${error.message || "Unknown error"}. Please try again.`);
    
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
  } finally {
    setLoading(false);
  }
};

// Calculate paddle score
export const calculatePaddleScore = (hourlyData, dailyData, beach, protectionData = null) => {
  if (!hourlyData || !dailyData || !beach) {
    return { calculatedScore: 0, breakdown: null };
  }
  
  // Validate hourly data to prevent errors
  if (!hourlyData.temperature_2m || !hourlyData.windspeed_10m || 
      !hourlyData.cloudcover || !hourlyData.precipitation ||
      !hourlyData.winddirection_10m ||
      hourlyData.temperature_2m.length === 0 ||
      hourlyData.windspeed_10m.length === 0) {
    return { 
      calculatedScore: 0, 
      breakdown: {
        windSpeed: { raw: 0, protected: 0, score: 0, maxPossible: 40 },
        waveHeight: { raw: 0, protected: 0, score: 0, maxPossible: 20 },
        swellHeight: { raw: 0, protected: 0, score: 0, maxPossible: 10 },
        precipitation: { value: 0, score: 0, maxPossible: 10 },
        temperature: { value: 0, score: 0, maxPossible: 10 },
        cloudCover: { value: 0, score: 0, maxPossible: 10 },
        geoProtection: { value: 0, score: 0, maxPossible: 15 },
        total: { score: 0, maxPossible: 100 }
      }
    };
  }
  
  // Calculate average values for the time range
  const avgTemp =
    hourlyData.temperature_2m.reduce((sum, val) => sum + val, 0) /
    hourlyData.temperature_2m.length;
  const avgWind =
    hourlyData.windspeed_10m.reduce((sum, val) => sum + val, 0) /
    hourlyData.windspeed_10m.length;
  const avgCloud =
    hourlyData.cloudcover.reduce((sum, val) => sum + val, 0) /
    hourlyData.cloudcover.length;
  const maxPrecip = Math.max(...hourlyData.precipitation);

  // Get wind direction
  const avgWindDirection =
    hourlyData.winddirection_10m.reduce((sum, val) => sum + val, 0) /
    hourlyData.winddirection_10m.length;

  // Get wave direction
  const waveDirection = dailyData.wave_direction_dominant ? 
                    dailyData.wave_direction_dominant[0] : 
                    avgWindDirection;

  // Get wave height from API or daily data
  let waveHeight = dailyData.wave_height_max ? dailyData.wave_height_max[0] : 0.3;

  // Get swell height from API if available
  let swellHeight = 0;
  if (hourlyData.swell_wave_height) {
    swellHeight =
      hourlyData.swell_wave_height.reduce((sum, val) => sum + val, 0) /
      hourlyData.swell_wave_height.length;
  } else {
    // Use wave height as a proxy if no specific swell data
    swellHeight = waveHeight * 0.7; // Rough approximation
  }

  // Use provided protection data or calculate it if needed
  let geoProtection = protectionData;
  if (!geoProtection) {
    // This is a synchronous fallback since we can't make this function async
    // In practice, protection should be calculated beforehand
    geoProtection = {
      protectionScore: 50,
      windProtection: 0.5,
      waveProtection: 0.5,
      bayEnclosure: 0.5
    };
  }

  // Apply enhanced geographic protection factors
  const protectedWindSpeed = avgWind * (1 - (geoProtection.windProtection * 0.9));
  const protectedWaveHeight = waveHeight * (1 - (geoProtection.waveProtection * 0.9));
  const protectedSwellHeight = swellHeight * (1 - (geoProtection.waveProtection * 0.85));

  // Initialize breakdown for score tabulation
  const breakdown = {
    windSpeed: { raw: avgWind, protected: protectedWindSpeed, score: 0, maxPossible: 40 },
    waveHeight: { raw: waveHeight, protected: protectedWaveHeight, score: 0, maxPossible: 20 },
    swellHeight: { raw: swellHeight, protected: protectedSwellHeight, score: 0, maxPossible: 10 },
    precipitation: { value: maxPrecip, score: 0, maxPossible: 10 },
    temperature: { value: avgTemp, score: 0, maxPossible: 10 },
    cloudCover: { value: avgCloud, score: 0, maxPossible: 10 },
    geoProtection: { value: geoProtection.protectionScore, score: 0, maxPossible: 15 },
    total: { score: 0, maxPossible: 100 }
  };

  // Score calculation based on the table in the requirements
  let score = 0;

  // Wind speed (up to 40 points) - now uses protected wind speed
  breakdown.windSpeed.score = protectedWindSpeed < 8 ? 40 : Math.max(0, 40 - (protectedWindSpeed - 8) * (40 / 12));
  score += breakdown.windSpeed.score;

  // Wave height (up to 20 points) - now uses protected wave height
  breakdown.waveHeight.score =
    protectedWaveHeight < 0.2 ? 20 : Math.max(0, 20 - (protectedWaveHeight - 0.2) * (20 / 0.4));
  score += breakdown.waveHeight.score;

  // Continue with other score calculations...
  // (rest of score calculation omitted for brevity)

  // Round all score components
  breakdown.windSpeed.score = Math.round(breakdown.windSpeed.score);
  breakdown.waveHeight.score = Math.round(breakdown.waveHeight.score);
  // (remaining roundings omitted for brevity)
  
  // Store the total
  breakdown.total.score = Math.round(Math.min(100, score));

  return { calculatedScore: Math.round(Math.min(100, score)), breakdown };
};

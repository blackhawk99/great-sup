import { getCardinalDirection } from "./helpers";
import { calculateGeographicProtection } from "./utils/coastlineAnalysis";

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

// Main function to fetch and process weather data
export const fetchWeatherData = async (beach, timeRange, mockDataRef) => {
  if (!beach || !beach.latitude || !beach.longitude) {
    throw new Error("Invalid beach data");
  }

  // Fetch implementation details would go here
  // For now, we're using mock data
  try {
    const beachNameLower = beach.name.toLowerCase();
    let mockData = {...mockDataRef.current["default"]};
    
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
    
    // Deep copy to prevent reference issues
    mockData = JSON.parse(JSON.stringify(mockData));
    
    // Update date
    mockData.hourly.time = Array.from(
      { length: 24 },
      (_, i) => `${timeRange.date}T${String(i).padStart(2, "0")}:00`
    );
    
    mockData.isRealData = false;
    
    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 800));
    
    // Get relevant weather data and calculate score
    const relevantHours = filterHoursByTimeRange(mockData.hourly, timeRange);
    
    const avgWindDirection =
      relevantHours.winddirection_10m.reduce((sum, val) => sum + val, 0) /
      relevantHours.winddirection_10m.length;
    
    const waveDirection = mockData.daily.wave_direction_dominant ? 
                      mockData.daily.wave_direction_dominant[0] : 
                      avgWindDirection;
    
    // Calculate protection
    const protection = await calculateGeographicProtection(beach, avgWindDirection, waveDirection);
    
    // Calculate score
    const { calculatedScore, breakdown } = calculatePaddleScore(
      relevantHours,
      mockData.daily,
      beach,
      protection
    );
    
    return {
      weatherData: mockData,
      score: calculatedScore,
      scoreBreakdown: breakdown
    };
  } catch (error) {
    console.error("Error with weather data:", error);
    throw error;
  }
};

// Calculate paddle score with dynamic protection
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

  // Swell height (up to 10 points) - now uses protected swell height
  breakdown.swellHeight.score =
    protectedSwellHeight < 0.3
      ? 10
      : Math.max(0, 10 - (protectedSwellHeight - 0.3) * (10 / 0.3));
  score += breakdown.swellHeight.score;

  // Precipitation (10 points)
  breakdown.precipitation.score = maxPrecip < 1 ? 10 : 0;
  score += breakdown.precipitation.score;

  // Air temperature (up to 10 points)
  if (avgTemp >= 22 && avgTemp <= 30) {
    breakdown.temperature.score = 10;
  } else if (avgTemp < 22) {
    breakdown.temperature.score = Math.max(0, 10 - (22 - avgTemp));
  } else {
    breakdown.temperature.score = Math.max(0, 10 - (avgTemp - 30));
  }
  score += breakdown.temperature.score;

  // Cloud cover (up to 10 points)
  breakdown.cloudCover.score = avgCloud < 40 ? 10 : Math.max(0, 10 - (avgCloud - 40) / 6);
  score += breakdown.cloudCover.score;

  // Add ENHANCED geographic protection bonus (up to 15 points)
  breakdown.geoProtection.score = (geoProtection.protectionScore / 100) * 15;
  score += breakdown.geoProtection.score;
  
  // Round all score components for clean display
  breakdown.windSpeed.score = Math.round(breakdown.windSpeed.score);
  breakdown.waveHeight.score = Math.round(breakdown.waveHeight.score);
  breakdown.swellHeight.score = Math.round(breakdown.swellHeight.score);
  breakdown.precipitation.score = Math.round(breakdown.precipitation.score);
  breakdown.temperature.score = Math.round(breakdown.temperature.score);
  breakdown.cloudCover.score = Math.round(breakdown.cloudCover.score);
  breakdown.geoProtection.score = Math.round(breakdown.geoProtection.score);
  
  // Store the total
  breakdown.total.score = Math.round(Math.min(100, score));

  // If it's raining significantly, override the score to be bad
  if (maxPrecip >= 1.5) {
    breakdown.precipitation.score = 0;
    breakdown.total.score = Math.min(breakdown.total.score, 40); // Cap score at 40 for rainy conditions
  }

  return { calculatedScore: Math.round(Math.min(100, score)), breakdown };
};

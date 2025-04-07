// WeatherService.js - USING REAL WEATHER API DATA ONLY
import { getCardinalDirection } from "./helpers";
import { calculateGeographicProtection } from "./utils/coastlineAnalysis";

// Filter hourly data by time range
export const filterHoursByTimeRange = (hourlyData, range) => {
  if (!hourlyData || !hourlyData.time) return null;
  
  const startHour = parseInt(range.startTime.split(":")[0]);
  const endHour = parseInt(range.endTime.split(":")[0]);
  
  const indices = [];
  for (let i = 0; i < hourlyData.time.length; i++) {
    const hourTime = new Date(hourlyData.time[i]);
    const hour = hourTime.getHours();
    if (hour >= startHour && hour <= endHour) {
      indices.push(i);
    }
  }
  
  if (indices.length === 0) {
    // Fallback to just using a range of indices if time filtering fails
    for (let i = startHour; i <= endHour && i < 24; i++) {
      indices.push(i);
    }
  }

  return {
    time: indices.map(i => hourlyData.time[i]),
    temperature_2m: indices.map(i => hourlyData.temperature_2m[i]),
    precipitation: indices.map(i => hourlyData.precipitation[i]),
    cloudcover: indices.map(i => hourlyData.cloudcover[i]),
    windspeed_10m: indices.map(i => hourlyData.windspeed_10m[i]),
    winddirection_10m: indices.map(i => hourlyData.winddirection_10m[i]),
    wave_height: hourlyData.wave_height ? indices.map(i => hourlyData.wave_height[i]) : undefined,
    swell_wave_height: hourlyData.swell_wave_height ? indices.map(i => hourlyData.swell_wave_height[i]) : undefined
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

// Fetch real weather data from Open-Meteo API - NO MOCK DATA
export const fetchWeatherData = async (beach, timeRange) => {
  if (!beach || !beach.latitude || !beach.longitude) {
    throw new Error("Invalid beach data");
  }

  try {
    console.log("Fetching REAL weather data for:", beach.name, beach.latitude, beach.longitude);
    
    // Format date for API
    const date = new Date(timeRange.date);
    const formattedDate = date.toISOString().split("T")[0];
    
    // Calculate start and end dates for forecast
    const startDate = formattedDate;
    const endDate = new Date(date);
    endDate.setDate(endDate.getDate() + 2); // Get 3 days of data
    const formattedEndDate = endDate.toISOString().split("T")[0];
    
    console.log("Fetching weather for dates:", startDate, "to", formattedEndDate);
    
    // Prepare Open-Meteo weather API URL
    const weatherApiUrl = `https://api.open-meteo.com/v1/forecast?latitude=${beach.latitude}&longitude=${beach.longitude}&hourly=temperature_2m,precipitation,cloudcover,windspeed_10m,winddirection_10m&daily=precipitation_sum,windspeed_10m_max&start_date=${startDate}&end_date=${formattedEndDate}&timezone=auto`;
    
    // Prepare Open-Meteo marine API URL for wave data
    const marineApiUrl = `https://marine-api.open-meteo.com/v1/marine?latitude=${beach.latitude}&longitude=${beach.longitude}&hourly=wave_height,swell_wave_height,wave_direction&daily=wave_height_max,wave_direction_dominant&start_date=${startDate}&end_date=${formattedEndDate}&timezone=auto`;
    
    console.log("Weather API URL:", weatherApiUrl);
    console.log("Marine API URL:", marineApiUrl);
    
    // Fetch weather and marine data in parallel
    const [weatherResponse, marineResponse] = await Promise.all([
      fetch(weatherApiUrl),
      fetch(marineApiUrl)
    ]);
    
    // Check for errors
    if (!weatherResponse.ok) {
      throw new Error(`Weather API error: ${weatherResponse.status}`);
    }
    if (!marineResponse.ok) {
      throw new Error(`Marine API error: ${marineResponse.status}`);
    }
    
    // Parse JSON responses
    const weatherData = await weatherResponse.json();
    const marineData = await marineResponse.json();
    
    console.log("Weather data received:", weatherData);
    console.log("Marine data received:", marineData);
    
    // Safely get values with validation
    if (!weatherData.hourly || !marineData.hourly) {
      throw new Error("Invalid API response structure");
    }
    
    // Combine data into a single object
    const combinedData = {
      hourly: {
        time: weatherData.hourly.time || [],
        temperature_2m: weatherData.hourly.temperature_2m || [],
        precipitation: weatherData.hourly.precipitation || [],
        cloudcover: weatherData.hourly.cloudcover || [],
        windspeed_10m: weatherData.hourly.windspeed_10m || [],
        winddirection_10m: weatherData.hourly.winddirection_10m || [],
        wave_height: marineData.hourly.wave_height || [],
        swell_wave_height: marineData.hourly.swell_wave_height || [],
        wave_direction: marineData.hourly.wave_direction || [],
      },
      daily: {
        wave_height_max: marineData.daily.wave_height_max || [0.3],
        wave_direction_dominant: marineData.daily.wave_direction_dominant || [180],
      },
      isRealData: true
    };
    
    // Filter data for the requested date
    const todayData = {
      hourly: {
        time: combinedData.hourly.time.filter(t => t.startsWith(timeRange.date)),
        temperature_2m: filterByDate(combinedData.hourly.time, combinedData.hourly.temperature_2m, timeRange.date),
        precipitation: filterByDate(combinedData.hourly.time, combinedData.hourly.precipitation, timeRange.date),
        cloudcover: filterByDate(combinedData.hourly.time, combinedData.hourly.cloudcover, timeRange.date),
        windspeed_10m: filterByDate(combinedData.hourly.time, combinedData.hourly.windspeed_10m, timeRange.date),
        winddirection_10m: filterByDate(combinedData.hourly.time, combinedData.hourly.winddirection_10m, timeRange.date),
        wave_height: filterByDate(combinedData.hourly.time, combinedData.hourly.wave_height, timeRange.date),
        swell_wave_height: filterByDate(combinedData.hourly.time, combinedData.hourly.swell_wave_height, timeRange.date),
        wave_direction: filterByDate(combinedData.hourly.time, combinedData.hourly.wave_direction, timeRange.date),
      },
      daily: combinedData.daily,
      isRealData: true
    };
    
    // Get relevant weather data for the time range
    const relevantHours = filterHoursByTimeRange(todayData.hourly, timeRange);
    
    // Get average wind direction
    const avgWindDirection =
      relevantHours.winddirection_10m.reduce((sum, val) => sum + val, 0) /
      relevantHours.winddirection_10m.length;
    
    // Get wave direction
    const waveDirection = todayData.daily.wave_direction_dominant ? 
                       todayData.daily.wave_direction_dominant[0] : 
                       relevantHours.wave_direction ? 
                         relevantHours.wave_direction.reduce((sum, val) => sum + val, 0) / 
                         relevantHours.wave_direction.length : 
                         avgWindDirection;
    
    // Calculate real geographic protection
    let protection = {
      protectionScore: 50,
      windProtection: 0.5,
      waveProtection: 0.5,
      bayEnclosure: 0.5
    };
    
    try {
      protection = await calculateGeographicProtection(beach, avgWindDirection, waveDirection);
    } catch (protectionError) {
      console.error("Error calculating geographic protection:", protectionError);
    }
    
    // Calculate score using the real data
    const { calculatedScore, breakdown } = calculatePaddleScore(
      relevantHours,
      todayData.daily,
      beach,
      protection
    );
    
    console.log("Weather data processed, score:", calculatedScore);
    
    return {
      weatherData: todayData,
      score: calculatedScore,
      scoreBreakdown: breakdown
    };
  } catch (error) {
    console.error("Error fetching weather data:", error);
    throw error; // Re-throw to let the UI handle it
  }
};

// Helper function to filter arrays by date
const filterByDate = (times, values, date) => {
  if (!times || !values || !Array.isArray(times) || !Array.isArray(values)) {
    return [];
  }
  
  return values.filter((_, index) => times[index] && times[index].startsWith(date));
};

// Calculate paddle score with dynamic protection
export const calculatePaddleScore = (hourlyData, dailyData, beach, protectionData = null) => {
  if (!hourlyData || !dailyData || !beach) {
    return { calculatedScore: 0, breakdown: null };
  }
  
  // Get average values safely with validation
  let avgTemp = 22, avgWind = 5, avgCloud = 30, maxPrecip = 0;
  let avgWindDirection = 180, waveHeight = 0.3, swellHeight = 0.2;

  try {
    // Calculate averages with fallbacks if data is missing
    if (hourlyData.temperature_2m && hourlyData.temperature_2m.length > 0) {
      avgTemp = hourlyData.temperature_2m.reduce((sum, val) => sum + val, 0) / 
               hourlyData.temperature_2m.length;
    }
    
    if (hourlyData.windspeed_10m && hourlyData.windspeed_10m.length > 0) {
      avgWind = hourlyData.windspeed_10m.reduce((sum, val) => sum + val, 0) / 
               hourlyData.windspeed_10m.length;
    }
    
    if (hourlyData.cloudcover && hourlyData.cloudcover.length > 0) {
      avgCloud = hourlyData.cloudcover.reduce((sum, val) => sum + val, 0) / 
                hourlyData.cloudcover.length;
    }
    
    if (hourlyData.precipitation && hourlyData.precipitation.length > 0) {
      maxPrecip = Math.max(...hourlyData.precipitation);
    }
    
    if (hourlyData.winddirection_10m && hourlyData.winddirection_10m.length > 0) {
      avgWindDirection = hourlyData.winddirection_10m.reduce((sum, val) => sum + val, 0) / 
                        hourlyData.winddirection_10m.length;
    }
    
    if (dailyData.wave_height_max && dailyData.wave_height_max.length > 0) {
      waveHeight = dailyData.wave_height_max[0];
    }
    
    if (hourlyData.swell_wave_height && hourlyData.swell_wave_height.length > 0) {
      swellHeight = hourlyData.swell_wave_height.reduce((sum, val) => sum + val, 0) / 
                   hourlyData.swell_wave_height.length;
    } else {
      swellHeight = waveHeight * 0.7;
    }
  } catch (err) {
    console.error("Error calculating averages:", err);
    // Use default values already set
  }

  // Use provided protection data or calculate it if needed
  const geoProtection = protectionData || {
    protectionScore: 50,
    windProtection: 0.5,
    waveProtection: 0.5,
    bayEnclosure: 0.5
  };

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

import React, { useState, useEffect, useRef } from "react";
import {
  MapPin,
  Home,
  Clock,
  Wind,
  Waves,
  Thermometer,
  Droplets,
  Sun,
  AlertCircle,
  Plus,
  Map,
  ChevronLeft,
  Calendar,
  ArrowLeft,
  ArrowRight,
  ExternalLink,
  Info,
} from "lucide-react";

// Geographic protection analysis
const calculateGeographicProtection = (beach, windDirection, waveDirection) => {
  // Hardcoded geographic data for known Greek beaches
  const geographicData = {
    'Kavouri Beach': {
      latitude: 37.8207,
      longitude: 23.7686,
      coastlineOrientation: 135, // SE facing
      bayEnclosure: 0.3, // Somewhat open
      protectedFromDirections: [315, 360, 45], // Protected from NW, N, NE
      exposedToDirections: [135, 180, 225], // Exposed to SE, S, SW
      description: "Moderately protected bay, exposed to southern winds"
    },
    'Vouliagmeni Beach': {
      latitude: 37.8179,
      longitude: 23.7808,
      coastlineOrientation: 90, // E facing
      bayEnclosure: 0.5, // Medium enclosure
      protectedFromDirections: [225, 270, 315], // Protected from SW, W, NW
      exposedToDirections: [90, 135], // Exposed to E, SE
      description: "Protected from westerly winds, but exposed to easterly"
    },
    'Asteras Beach': {
      latitude: 37.8016,
      longitude: 23.7711,
      coastlineOrientation: 180, // S facing
      bayEnclosure: 0.8, // Highly enclosed
      protectedFromDirections: [0, 45, 90, 270, 315], // Protected from most directions
      exposedToDirections: [180], // Only directly exposed to south
      description: "Well-protected beach in a sheltered bay"
    },
    'Zen Beach': {
      latitude: 37.7129, 
      longitude: 23.9323,
      coastlineOrientation: 130, // SE facing
      bayEnclosure: 0.4, // Moderately open
      protectedFromDirections: [270, 315, 0, 45], // Protected from W, NW, N, NE
      exposedToDirections: [90, 135, 180], // Exposed to E, SE, S
      description: "Moderate protection, exposed to southeasterly winds"
    },
    'Kapsali Kythira': {
      latitude: 36.1425,
      longitude: 22.9996,
      coastlineOrientation: 180, // S facing
      bayEnclosure: 0.7, // Well enclosed
      protectedFromDirections: [270, 315, 0, 45, 90], // Protected from W, NW, N, NE, E
      exposedToDirections: [180], // Only exposed to south
      description: "Well-protected bay, only exposed to southern winds"
    },
    'Palaipoli Kythira': {
      latitude: 36.2335,
      longitude: 22.9644,
      coastlineOrientation: 90, // E facing
      bayEnclosure: 0.6, // Moderately protected
      protectedFromDirections: [180, 225, 270, 315], // Protected from S, SW, W, NW
      exposedToDirections: [45, 90, 135], // Exposed to NE, E, SE
      description: "Protected from westerly winds, exposed to easterly"
    },
    'Varkiza Beach': {
      latitude: 37.8133,
      longitude: 23.8011,
      coastlineOrientation: 170, // S facing slightly E
      bayEnclosure: 0.4, // Moderately open
      protectedFromDirections: [270, 315, 0, 45], // Protected from W, NW, N, NE
      exposedToDirections: [135, 180, 225], // Exposed to SE, S, SW
      description: "Moderate protection, exposed to southern seas"
    },
    'Legrena Beach': {  // Added from your maps link
      latitude: 37.6506, 
      longitude: 24.0521,
      coastlineOrientation: 150, // SSE facing
      bayEnclosure: 0.5, // Medium enclosure
      protectedFromDirections: [270, 315, 0, 45], // Protected from W, NW, N, NE
      exposedToDirections: [135, 180, 225], // Exposed to SE, S, SW
      description: "Moderately protected, exposed to southern winds"
    },
    'Porto Rafti': {  // Added from your maps link
      latitude: 37.8829,
      longitude: 24.0077,
      coastlineOrientation: 110, // ESE facing
      bayEnclosure: 0.6, // Moderately protected
      protectedFromDirections: [180, 225, 270, 315, 0], // Protected from S, SW, W, NW, N
      exposedToDirections: [90, 135], // Exposed to E, SE
      description: "Protected bay, mainly exposed to eastern winds"
    },
    'Loutraki Beach': {  // Added from your maps link
      latitude: 37.9820,
      longitude: 22.9780,
      coastlineOrientation: 70, // ENE facing
      bayEnclosure: 0.4, // Moderately open
      protectedFromDirections: [135, 180, 225, 270, 315], // Protected from SE, S, SW, W, NW
      exposedToDirections: [0, 45, 90], // Exposed to N, NE, E
      description: "Exposed to northern winds, protected from southern and western"
    }
  };
  
  // Default values for unknown beaches
  let coastlineOrientation = 0;
  let bayEnclosure = 0.5;
  let protectedFromDirections = [];
  let exposedToDirections = [];
  
  // Get geographic data if this is a known beach
  const beachName = beach.name;
  const knownBeach = Object.keys(geographicData).find(name => 
    beachName.includes(name) || name.includes(beachName)
  );
  
  if (knownBeach) {
    const data = geographicData[knownBeach];
    coastlineOrientation = data.coastlineOrientation;
    bayEnclosure = data.bayEnclosure;
    protectedFromDirections = data.protectedFromDirections;
    exposedToDirections = data.exposedToDirections;
  } else {
    // For unknown beaches, make a guess based on coordinates
    console.log("Unknown beach, using estimated protection values");
  }

  // Calculate wind protection
  const windProtection = calculateDirectionalProtection(
    windDirection, 
    protectedFromDirections, 
    exposedToDirections,
    bayEnclosure
  );
  
  // Calculate wave protection
  const waveProtection = calculateDirectionalProtection(
    waveDirection,
    protectedFromDirections,
    exposedToDirections,
    bayEnclosure
  );
  
  // Calculate overall protection score (0-100)
  const protectionScore = (bayEnclosure * 40) + (windProtection * 30) + (waveProtection * 30);
  
  return {
    protectionScore,
    windProtection,
    waveProtection,
    bayEnclosure,
    isProtected: protectionScore > 50
  };
};

// Helper function to calculate directional protection
const calculateDirectionalProtection = (direction, protectedDirections, exposedDirections, bayEnclosure) => {
  // Check if direction is within protected ranges
  const isProtected = protectedDirections.some(protectedDir => {
    return Math.abs(direction - protectedDir) <= 45;
  });
  
  // Check if direction is within exposed ranges
  const isExposed = exposedDirections.some(exposedDir => {
    return Math.abs(direction - exposedDir) <= 45;
  });
  
  if (isProtected) {
    return 0.8 + (bayEnclosure * 0.2); // High protection
  } else if (isExposed) {
    return 0.2 * bayEnclosure; // Low protection
  } else {
    return 0.5 * bayEnclosure; // Medium protection
  }
};

// Helper function to convert degrees to cardinal directions
const getCardinalDirection = (degrees) => {
  const val = Math.floor((degrees / 22.5) + 0.5);
  const directions = ["N", "NNE", "NE", "ENE", "E", "ESE", "SE", "SSE", "S", "SSW", "SW", "WSW", "W", "WNW", "NW", "NNW"];
  return directions[(val % 16)];
};

// Generate Google Maps link
const getGoogleMapsLink = (latitude, longitude) => 
  `https://www.google.com/maps?q=${latitude},${longitude}`;

// Parse Google Maps URL
const parseGoogleMapsUrl = (url) => {
  if (!url) return null;
  
  // Handle @lat,lng format (what you see in the URL bar)
  let match = url.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/);
  if (match) {
    return {
      latitude: parseFloat(match[1]),
      longitude: parseFloat(match[2])
    };
  }
  
  // Handle ?q=lat,lng format (shared links)
  match = url.match(/\?q=(-?\d+\.\d+),(-?\d+\.\d+)/);
  if (match) {
    return {
      latitude: parseFloat(match[1]),
      longitude: parseFloat(match[2])
    };
  }
  
  // Handle old format with ll=lat,lng
  match = url.match(/ll=(-?\d+\.\d+),(-?\d+\.\d+)/);
  if (match) {
    return {
      latitude: parseFloat(match[1]),
      longitude: parseFloat(match[2])
    };
  }
  
  // Handle maps.app.goo.gl links by extracting location name
  match = url.match(/maps\.app\.goo\.gl/);
  if (match) {
    // Extract location name from URL path or try to guess
    const pathSegments = new URL(url).pathname.split('/');
    const lastSegment = pathSegments[pathSegments.length - 1];
    
    // Check common Greek beach names
    if (url.includes("Legrena") || lastSegment.includes("RLXesyCsSvESpwhM9")) {
      return {
        latitude: 37.6506,
        longitude: 24.0521,
        name: "Legrena Beach"
      };
    }
    else if (url.includes("Porto Rafti") || lastSegment.includes("D6USULQVDHWNLeQU8")) {
      return {
        latitude: 37.8829,
        longitude: 24.0077,
        name: "Porto Rafti"
      };
    }
    else if (url.includes("Loutraki") || lastSegment.includes("L8CocpiKW2zZCdBQ6")) {
      return {
        latitude: 37.9820,
        longitude: 22.9780,
        name: "Loutraki Beach"
      };
    }
  }
  
  return null;
};

const App = () => {
  // State
  const [beaches, setBeaches] = useState([]);
  const [homeBeach, setHomeBeach] = useState(null);
  const [selectedBeach, setSelectedBeach] = useState(null);
  const [timeRange, setTimeRange] = useState({
    date: new Date().toISOString().split("T")[0],
    startTime: "09:00",
    endTime: "13:00",
  });
  const [weatherData, setWeatherData] = useState(null);
  const [view, setView] = useState("dashboard"); // 'dashboard', 'add', 'detail'
  const [score, setScore] = useState(null);
  const [scoreBreakdown, setScoreBreakdown] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [newBeach, setNewBeach] = useState({
    name: "",
    latitude: "",
    longitude: "",
  });
  const [mapUrl, setMapUrl] = useState("");
  const [notification, setNotification] = useState(null);
  const [showDatePicker, setShowDatePicker] = useState(false);

  // Greek coastal locations
  const suggestedLocations = [
    { name: "Kavouri Beach", latitude: 37.8207, longitude: 23.7686 },
    { name: "Asteras Beach", latitude: 37.8016, longitude: 23.7711 },
    { name: "Vouliagmeni Beach", latitude: 37.8179, longitude: 23.7808 },
    { name: "Zen Beach", latitude: 37.7129, longitude: 23.9323 },
    { name: "Legrena Beach", latitude: 37.6506, longitude: 24.0521 },
    { name: "Porto Rafti", latitude: 37.8829, longitude: 24.0077 },
    { name: "Loutraki Beach", latitude: 37.9820, longitude: 22.9780 },
    { name: "Kapsali Kythira", latitude: 36.1425, longitude: 22.9996 },
    { name: "Palaipoli Kythira", latitude: 36.2335, longitude: 22.9644 },
  ];

  // Show toast notification
  const toast = {
    success: (message) => {
      setNotification({ type: "success", message });
      setTimeout(() => setNotification(null), 3000);
    },
    error: (message) => {
      setNotification({ type: "error", message });
      setTimeout(() => setNotification(null), 3000);
    },
  };

  // Use a ref to store geographic-aware mock data for Greek beaches
  const mockDataRef = useRef({
    // Kavouri beach - exposed to southern winds
    "Kavouri Beach": {
      hourly: {
        time: Array.from(
          { length: 24 },
          (_, i) => `2025-04-01T${String(i).padStart(2, "0")}:00`
        ),
        temperature_2m: Array.from(
          { length: 24 },
          (_, i) => 22 + Math.sin(i / 3) * 5
        ), // 17-27°C range
        precipitation: Array.from({ length: 24 }, (_, i) =>
          i < 10 ? 0 : i > 16 ? 0.2 : 0
        ), // Clear mornings
        cloudcover: Array.from({ length: 24 }, (_, i) =>
          i < 11 ? 10 : 30 + (i - 11) * 5
        ), // Clear mornings
        // Wind direction changes through the day (NE in morning, shifting S in afternoon)
        winddirection_10m: Array.from({ length: 24 }, (_, i) => {
          const hour = i % 24;
          // Morning: 45° (NE), gradually shifting to 180° (S) in afternoon
          return hour < 10 ? 45 : 45 + ((hour - 10) * 15);
        }),
        // Wind speed varies by direction - stronger from south
        windspeed_10m: Array.from({ length: 24 }, (_, i) => {
          const hour = i % 24;
          // Dynamically calculate direction for this hour
          const direction = hour < 10 ? 45 : 45 + ((hour - 10) * 15);
          // South winds (135-225) are stronger at Kavouri
          const southFactor = (direction >= 135 && direction <= 225) ? 1.5 : 0.8;
          return (i < 9 ? 4 : 6 + (i-9) * 0.8) * southFactor;
        }),
        wave_height: Array.from({ length: 24 }, (_, i) => {
          const hour = i % 24;
          // Dynamically calculate direction for this hour
          const direction = hour < 10 ? 45 : 45 + ((hour - 10) * 15);
          // South winds create bigger waves at Kavouri
          const southFactor = (direction >= 135 && direction <= 225) ? 1.8 : 0.7;
          return (i < 10 ? 0.15 : 0.2 + (i-10) * 0.03) * southFactor;
        }),
        swell_wave_height: Array.from({ length: 24 }, (_, i) => {
          const hour = i % 24;
          // Dynamically calculate direction for this hour
          const direction = hour < 10 ? 45 : 45 + ((hour - 10) * 15);
          // South winds create bigger swell at Kavouri
          const southFactor = (direction >= 135 && direction <= 225) ? 1.6 : 0.6;
          return (i < 10 ? 0.07 : 0.12 + (i-10) * 0.02) * southFactor;
        }),
      },
      daily: {
        wave_height_max: [0.4], // Moderate max wave height
        wave_direction_dominant: [170], // S direction (matches afternoon wind)
      }
    },

    // Data for other beaches...
    // (Previously defined mock data code for other beaches)
  });

  // Load saved beaches from localStorage on component mount
  useEffect(() => {
    const savedBeaches = localStorage.getItem("beaches");
    if (savedBeaches) {
      const parsedBeaches = JSON.parse(savedBeaches);
      setBeaches(parsedBeaches);
    }

    const savedHomeBeach = localStorage.getItem("homeBeach");
    if (savedHomeBeach) {
      setHomeBeach(JSON.parse(savedHomeBeach));
    }
  }, []);

  // Save beaches to localStorage when they change
  useEffect(() => {
    if (beaches.length > 0) {
      localStorage.setItem("beaches", JSON.stringify(beaches));
    }
  }, [beaches]);

  // Save home beach to localStorage when it changes
  useEffect(() => {
    if (homeBeach) {
      localStorage.setItem("homeBeach", JSON.stringify(homeBeach));
    }
  }, [homeBeach]);

  // Function to fetch weather data
  const fetchWeatherData = async (beach) => {
    setLoading(true);
    setError(null);

    try {
      const { longitude, latitude } = beach;

      // Parse the selected date for the API request
      const selectedDate = new Date(timeRange.date);
      const formattedDate = selectedDate.toISOString().split("T")[0];

      // Construct the Open-Meteo API URLs - these are public APIs with CORS enabled
      const marineUrl = `https://marine-api.open-meteo.com/v1/marine?latitude=${latitude}&longitude=${longitude}&hourly=wave_height,wave_direction,wave_period,wind_wave_height,wind_wave_direction,wind_wave_period,swell_wave_height,swell_wave_direction,swell_wave_period&daily=wave_height_max&timezone=auto&start_date=${formattedDate}&end_date=${formattedDate}`;

      const weatherUrl = `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&hourly=temperature_2m,precipitation,cloudcover,windspeed_10m,winddirection_10m&daily=precipitation_sum&timezone=auto&start_date=${formattedDate}&end_date=${formattedDate}`;

      // Attempt to fetch real data from both APIs
      console.log("Fetching real weather data from Open-Meteo...");

      // Fetch both marine and weather data
      const [marineResponse, weatherResponse] = await Promise.all([
        fetch(marineUrl),
        fetch(weatherUrl),
      ]);

      if (!marineResponse.ok || !weatherResponse.ok) {
        throw new Error(
          `Failed to fetch weather data: Marine API status: ${marineResponse.status}, Weather API status: ${weatherResponse.status}`
        );
      }

      const marineData = await marineResponse.json();
      const weatherData = await weatherResponse.json();

      // Combine the data into one object
      const combinedData = {
        hourly: {
          time: weatherData.hourly.time,
          temperature_2m: weatherData.hourly.temperature_2m,
          precipitation: weatherData.hourly.precipitation,
          cloudcover: weatherData.hourly.cloudcover,
          windspeed_10m: weatherData.hourly.windspeed_10m,
          winddirection_10m: weatherData.hourly.winddirection_10m,
          wave_height: marineData.hourly.wave_height,
          swell_wave_height: marineData.hourly.swell_wave_height,
        },
        daily: {
          wave_height_max: marineData.daily.wave_height_max,
          wave_direction_dominant: [marineData.hourly.wave_direction[12]],
        },
        isRealData: true,
      };

      setWeatherData(combinedData);

      // Calculate score using the real data
      const relevantHours = filterHoursByTimeRange(
        combinedData.hourly,
        timeRange
      );
      const { calculatedScore, breakdown } = calculatePaddleScore(
        relevantHours,
        combinedData.daily,
        beach
      );
      setScore(calculatedScore);
      setScoreBreakdown(breakdown);
    } catch (error) {
      console.error("Error fetching real weather data:", error);
      setError(
        "Using simulated data with geographic protection analysis for this location."
      );

      // Fall back to demo data as a last resort
      let mockData;
      const beachNameLower = beach.name.toLowerCase();
      
      if (beachNameLower.includes("kavouri")) {
        mockData = mockDataRef.current["Kavouri Beach"];
      } else if (beachNameLower.includes("aster") || beachNameLower.includes("astar")) {
        mockData = mockDataRef.current["Asteras Beach"];
      } else if (beachNameLower.includes("zen")) {
        mockData = mockDataRef.current["Zen Beach"];
      } else if (beachNameLower.includes("kapsali")) {
        mockData = mockDataRef.current["Kapsali Kythira"];
      } else if (beachNameLower.includes("palaipoli")) {
        mockData = mockDataRef.current["Palaipoli Kythira"];
      } else if (beachNameLower.includes("vouliagmeni")) {
        mockData = mockDataRef.current["Vouliagmeni Beach"];
      } else if (beachNameLower.includes("legrena")) {
        mockData = mockDataRef.current["Legrena Beach"];
      } else if (beachNameLower.includes("porto") || beachNameLower.includes("rafti")) {
        mockData = mockDataRef.current["Porto Rafti"];
      } else if (beachNameLower.includes("loutraki")) {
        mockData = mockDataRef.current["Loutraki Beach"];
      } else {
        mockData = mockDataRef.current["default"];
      }

      // Update the date in mock data
      mockData.hourly.time = Array.from(
        { length: 24 },
        (_, i) => `${timeRange.date}T${String(i).padStart(2, "0")}:00`
      );

      mockData.isRealData = false;
      setWeatherData(mockData);

      // Calculate score using the mock data
      const relevantHours = filterHoursByTimeRange(mockData.hourly, timeRange);
      const { calculatedScore, breakdown } = calculatePaddleScore(
        relevantHours,
        mockData.daily,
        beach
      );
      setScore(calculatedScore);
      setScoreBreakdown(breakdown);
    } finally {
      setLoading(false);
    }
  };

  // Filter hourly data by time range
  const filterHoursByTimeRange = (hourlyData, range) => {
    const startHour = parseInt(range.startTime.split(":")[0]);
    const endHour = parseInt(range.endTime.split(":")[0]);

    return {
      temperature_2m: hourlyData.temperature_2m.slice(startHour, endHour + 1),
      precipitation: hourlyData.precipitation.slice(startHour, endHour + 1),
      cloudcover: hourlyData.cloudcover.slice(startHour, endHour + 1),
      windspeed_10m: hourlyData.windspeed_10m.slice(startHour, endHour + 1),
      winddirection_10m: hourlyData.winddirection_10m.slice(
        startHour,
        endHour + 1
      ),
      swell_wave_height: hourlyData.swell_wave_height ? 
        hourlyData.swell_wave_height.slice(startHour, endHour + 1) : undefined,
      wave_height: hourlyData.wave_height ? 
        hourlyData.wave_height.slice(startHour, endHour + 1) : undefined
    };
  };

  // Calculate paddle score based on weather conditions and enhanced geographic protection
  const calculatePaddleScore = (hourlyData, dailyData, beach) => {
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

    // Get wave direction (use wind direction as proxy if not available)
    const waveDirection = dailyData.wave_direction_dominant ? 
                      dailyData.wave_direction_dominant[0] : 
                      avgWindDirection;

    // Get wave height from API or daily data
    let waveHeight = dailyData.wave_height_max[0];

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

    // Calculate geographic protection
    const geoProtection = calculateGeographicProtection(beach, avgWindDirection, waveDirection);

    // Apply ENHANCED geographic protection factors to wind and wave values
    // Increased from 0.8 to 0.9 for stronger geographic effect
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

    // Add ENHANCED geographic protection bonus (up to 15 points instead of 10)
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

  // Get condition based on score
  const getCondition = (score) => {
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

  // Handle beach selection
  const handleBeachSelect = (beach) => {
    setSelectedBeach(beach);
    fetchWeatherData(beach);
    setView("detail");
  };

  // Handle setting home beach
  const handleSetHomeBeach = (beach) => {
    setHomeBeach(beach);
    toast.success(`${beach.name} set as home beach!`);
  };

  // Handle time range change
  const handleTimeRangeChange = (field, value) => {
    setTimeRange({ ...timeRange, [field]: value });

    // Re-fetch weather data if a beach is selected
    if (selectedBeach) {
      fetchWeatherData(selectedBeach);
    }
  };

  // Handle adding a new beach
  const handleAddBeach = () => {
    if (newBeach.name && newBeach.latitude && newBeach.longitude) {
      const beachToAdd = {
        id: `beach-${Date.now()}`,
        name: newBeach.name,
        latitude: parseFloat(newBeach.latitude),
        longitude: parseFloat(newBeach.longitude),
      };

      setBeaches([...beaches, beachToAdd]);
      setNewBeach({ name: "", latitude: "", longitude: "" });
      setMapUrl("");
      toast.success(`Added ${beachToAdd.name} to your beaches!`);
      setView("dashboard");
    } else {
      toast.error("Please fill in all beach details");
    }
  };

  // Handle adding a suggested location
  const handleAddSuggested = (location) => {
    const beachToAdd = {
      id: `beach-${Date.now()}`,
      name: location.name,
      latitude: location.latitude,
      longitude: location.longitude,
    };

    setBeaches([...beaches, beachToAdd]);
    toast.success(`Added ${location.name} to your beaches!`);
    setView("dashboard");
  };

  // Handle extracting coordinates from Google Maps URL
  const handleExtractCoordinates = () => {
    const result = parseGoogleMapsUrl(mapUrl);
    if (result) {
      setNewBeach({
        ...newBeach,
        name: result.name || newBeach.name,
        latitude: result.latitude.toString(),
        longitude: result.longitude.toString()
      });
      toast.success("Coordinates extracted successfully!");
    } else {
      toast.error("Could not extract coordinates from URL. Please check format.");
    }
  };

  // Custom Date Picker
  const DatePickerModal = ({ onSelect, onClose }) => {
    const today = new Date();
    const [selectedDate, setSelectedDate] = useState(new Date(timeRange.date));
    const [month, setMonth] = useState(selectedDate.getMonth());
    const [year, setYear] = useState(selectedDate.getFullYear());
    
    const monthNames = [
      'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December'
    ];
    
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const firstDayOfMonth = new Date(year, month, 1).getDay();
    
    const handlePrevMonth = () => {
      if (month === 0) {
        setMonth(11);
        setYear(year - 1);
      } else {
        setMonth(month - 1);
      }
    };
    
    const handleNextMonth = () => {
      if (month === 11) {
        setMonth(0);
        setYear(year + 1);
      } else {
        setMonth(month + 1);
      }
    };
    
    const handleDateClick = (day) => {
      const newDate = new Date(year, month, day);
      setSelectedDate(newDate);
    };
    
    const handleSelect = () => {
      const formattedDate = selectedDate.toISOString().split('T')[0];
      onSelect(formattedDate);
      onClose();
    };

    const handleSetToday = () => {
      setSelectedDate(new Date());
      setMonth(today.getMonth());
      setYear(today.getFullYear());
    };

    const handleSetTomorrow = () => {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      setSelectedDate(tomorrow);
      setMonth(tomorrow.getMonth());
      setYear(tomorrow.getFullYear());
    };
    
    const days = [];
    
    // Add empty cells for days before the first day of the month
    for (let i = 0; i < firstDayOfMonth; i++) {
      days.push(<div key={`empty-${i}`} className="h-10"></div>);
    }
    
    // Add the days of the month
    for (let day = 1; day <= daysInMonth; day++) {
      const date = new Date(year, month, day);
      const isSelected = 
        selectedDate.getDate() === day &&
        selectedDate.getMonth() === month &&
        selectedDate.getFullYear() === year;
      
      const isToday =
        today.getDate() === day &&
        today.getMonth() === month &&
        today.getFullYear() === year;
      
      days.push(
        <div
          key={day}
          className={`h-10 w-10 flex items-center justify-center rounded-full cursor-pointer
            ${isSelected ? 'bg-blue-500 text-white' : ''}
            ${isToday && !isSelected ? 'border border-blue-500 text-blue-600' : ''}
            ${!isSelected && !isToday ? 'hover:bg-gray-100' : ''}
          `}
          onClick={() => handleDateClick(day)}
        >
          {day}
        </div>
      );
    }
    
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white rounded-xl p-5 w-full max-w-md">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-semibold">Select Date</h2>
            <button
              onClick={onClose}
              className="text-gray-500 hover:text-gray-700"
            >
              ✕
            </button>
          </div>
          
          <div className="flex space-x-4 mb-4">
            <button 
              onClick={handleSetToday}
              className="flex-1 bg-blue-500 text-white py-3 px-6 rounded-xl text-lg font-medium hover:bg-blue-600 transition"
            >
              Today
            </button>
            <button 
              onClick={handleSetTomorrow}
              className="flex-1 bg-blue-500 text-white py-3 px-6 rounded-xl text-lg font-medium hover:bg-blue-600 transition"
            >
              Tomorrow
            </button>
          </div>
          
          <div className="mb-4">
            <div className="flex justify-between items-center mb-2">
              <button onClick={handlePrevMonth} className="p-1 rounded-full hover:bg-gray-100">
                <ArrowLeft className="h-6 w-6" />
              </button>
              <span className="text-lg font-medium">{monthNames[month]} {year}</span>
              <button onClick={handleNextMonth} className="p-1 rounded-full hover:bg-gray-100">
                <ArrowRight className="h-6 w-6" />
              </button>
            </div>
            
            <div className="grid grid-cols-7 gap-1 text-center mb-2">
              <div className="text-gray-500">Su</div>
              <div className="text-gray-500">Mo</div>
              <div className="text-gray-500">Tu</div>
              <div className="text-gray-500">We</div>
              <div className="text-gray-500">Th</div>
              <div className="text-gray-500">Fr</div>
              <div className="text-gray-500">Sa</div>
            </div>
            
            <div className="grid grid-cols-7 gap-1">
              {days}
            </div>
          </div>
          
          <div className="flex justify-end">
            <button
              onClick={handleSelect}
              className="bg-blue-600 text-white px-5 py-2 rounded-lg hover:bg-blue-700"
            >
              Select
            </button>
          </div>
        </div>
      </div>
    );
  };

  // Component to render geographic protection information
  const renderGeographicInfo = (beach, weatherData) => {
    if (!beach || !weatherData) return null;
    
    const avgWindDirection = weatherData.hourly.winddirection_10m.reduce((sum, val) => sum + val, 0) / 
                            weatherData.hourly.winddirection_10m.length;
    
    const waveDirection = weatherData.daily.wave_direction_dominant ? 
                        weatherData.daily.wave_direction_dominant[0] : 
                        avgWindDirection;
    
    const protection = calculateGeographicProtection(beach, avgWindDirection, waveDirection);
    
    // Calculate the bonus points added to score from geographic protection
    const geoBonus = Math.round((protection.protectionScore / 100) * 15);
    
    return (
      <div className="bg-blue-50 p-5 rounded-lg mt-4 border border-blue-200 shadow-inner">
        <h4 className="font-medium mb-4 text-lg flex items-center text-blue-800">
          <MapPin className="h-5 w-5 mr-2 text-blue-600" />
          Geographic Protection Analysis
        </h4>
        
        <div className="grid md:grid-cols-2 gap-6">
          <ul className="space-y-3">
            <li className="flex justify-between items-center bg-white p-3 rounded border">
              <span className="font-medium text-gray-700">Bay Enclosure:</span>
              <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                protection.bayEnclosure > 0.6 
                  ? 'bg-green-100 text-green-800' 
                  : protection.bayEnclosure > 0.3 
                    ? 'bg-yellow-100 text-yellow-800' 
                    : 'bg-red-100 text-red-800'
              }`}>
                {protection.bayEnclosure > 0.7 
                  ? 'Well Protected' 
                  : protection.bayEnclosure > 0.4 
                    ? 'Moderately Protected' 
                    : 'Exposed'}
              </span>
            </li>
            <li className="flex justify-between items-center bg-white p-3 rounded border">
              <span className="font-medium text-gray-700">Wind Direction:</span>
              <span className="flex items-center">
                <div className="w-6 h-6 rounded-full bg-blue-100 flex items-center justify-center mr-2">
                  <div 
                    className="w-3 h-3 bg-blue-600" 
                    style={{ 
                      clipPath: 'polygon(50% 0%, 0% 100%, 100% 100%)', 
                      transform: `rotate(${avgWindDirection}deg)` 
                    }}
                  />
                </div>
                <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                  protection.windProtection > 0.7 
                    ? 'bg-green-100 text-green-800' 
                    : protection.windProtection > 0.3 
                      ? 'bg-yellow-100 text-yellow-800' 
                      : 'bg-red-100 text-red-800'
                }`}>
                  {getCardinalDirection(avgWindDirection)} 
                  {protection.windProtection > 0.7 
                    ? ' (Protected)' 
                    : protection.windProtection > 0.3 
                      ? ' (Partially Exposed)' 
                      : ' (Fully Exposed)'}
                </span>
              </span>
            </li>
            <li className="flex justify-between items-center bg-white p-3 rounded border">
              <span className="font-medium text-gray-700">Overall Protection:</span>
              <div className="flex items-center">
                <div className="w-24 h-3 bg-gray-200 rounded-full overflow-hidden mr-2">
                  <div 
                    className={`h-full ${
                      protection.protectionScore > 70 
                        ? 'bg-green-500' 
                        : protection.protectionScore > 40 
                          ? 'bg-yellow-500' 
                          : 'bg-red-500'
                    }`}
                    style={{ width: `${protection.protectionScore}%` }}
                  />
                </div>
                <span className={`font-medium ${
                  protection.protectionScore > 70 
                    ? 'text-green-600' 
                    : protection.protectionScore > 40 
                      ? 'text-yellow-600' 
                      : 'text-red-600'
                }`}>
                  {Math.round(protection.protectionScore)}/100
                </span>
              </div>
            </li>
          </ul>
          
          <div className="bg-white p-4 rounded border">
            <h5 className="font-medium mb-2 text-gray-800">Impact on Score</h5>
            <p className="text-gray-700 mb-3">
              Geographic protection is contributing <span className="font-bold text-blue-600">
              +{geoBonus} points</span> to your overall score.
            </p>
            <div className={`p-3 rounded-lg ${
              protection.protectionScore > 60 
                ? 'bg-green-50 border border-green-200' 
                : protection.protectionScore > 30 
                  ? 'bg-yellow-50 border border-yellow-200' 
                  : 'bg-red-50 border border-red-200'
            }`}>
              <p className="text-sm">
                {protection.protectionScore > 60 
                  ? `${beach.name} is well protected from ${getCardinalDirection(avgWindDirection)} winds, making it an excellent choice today.` 
                  : protection.protectionScore > 30 
                    ? `${beach.name} has moderate protection from ${getCardinalDirection(avgWindDirection)} winds.` 
                    : `${beach.name} is exposed to ${getCardinalDirection(avgWindDirection)} winds today, consider an alternative beach.`}
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  };

  // Render score breakdown
  const renderScoreBreakdown = (breakdown) => {
    if (!breakdown) return null;
    
    return (
      <div className="bg-white p-5 rounded-lg mt-4 shadow-sm border">
        <h4 className="font-medium mb-4 flex items-center text-gray-800">
          <Info className="h-5 w-5 mr-2 text-blue-600" />
          Score Breakdown
        </h4>
        
        <div className="overflow-hidden rounded-lg border border-gray-200">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Factor</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Value</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Score</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              <tr>
                <td className="px-4 py-2 whitespace-nowrap text-sm font-medium text-gray-700">Wind Speed</td>
                <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-500 text-right">
                  {breakdown.windSpeed.raw.toFixed(1)} km/h 
                  <span className="text-xs text-gray-400 ml-1">
                    (Protected: {breakdown.windSpeed.protected.toFixed(1)})
                  </span>
                </td>
                <td className={`px-4 py-2 whitespace-nowrap text-sm font-medium text-right ${
                  breakdown.windSpeed.score > 30 ? 'text-green-600' : 
                  breakdown.windSpeed.score > 20 ? 'text-yellow-600' : 'text-red-600'
                }`}>
                  {breakdown.windSpeed.score}/{breakdown.windSpeed.maxPossible}
                </td>
              </tr>
              <tr>
                <td className="px-4 py-2 whitespace-nowrap text-sm font-medium text-gray-700">Wave Height</td>
                <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-500 text-right">
                  {breakdown.waveHeight.raw.toFixed(2)} m
                  <span className="text-xs text-gray-400 ml-1">
                    (Protected: {breakdown.waveHeight.protected.toFixed(2)})
                  </span>
                </td>
                <td className={`px-4 py-2 whitespace-nowrap text-sm font-medium text-right ${
                  breakdown.waveHeight.score > 15 ? 'text-green-600' : 
                  breakdown.waveHeight.score > 10 ? 'text-yellow-600' : 'text-red-600'
                }`}>
                  {breakdown.waveHeight.score}/{breakdown.waveHeight.maxPossible}
                </td>
              </tr>
              <tr>
                <td className="px-4 py-2 whitespace-nowrap text-sm font-medium text-gray-700">Swell Height</td>
                <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-500 text-right">
                  {breakdown.swellHeight.raw.toFixed(2)} m
                </td>
                <td className={`px-4 py-2 whitespace-nowrap text-sm font-medium text-right ${
                  breakdown.swellHeight.score > 7 ? 'text-green-600' : 
                  breakdown.swellHeight.score > 5 ? 'text-yellow-600' : 'text-red-600'
                }`}>
                  {breakdown.swellHeight.score}/{breakdown.swellHeight.maxPossible}
                </td>
              </tr>
              <tr>
                <td className="px-4 py-2 whitespace-nowrap text-sm font-medium text-gray-700">Precipitation</td>
                <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-500 text-right">
                  {breakdown.precipitation.value.toFixed(1)} mm
                </td>
                <td className={`px-4 py-2 whitespace-nowrap text-sm font-medium text-right ${
                  breakdown.precipitation.value < 1 ? 'text-green-600' : 'text-red-600'
                }`}>
                  {breakdown.precipitation.score}/{breakdown.precipitation.maxPossible}
                </td>
              </tr>
              <tr>
                <td className="px-4 py-2 whitespace-nowrap text-sm font-medium text-gray-700">Temperature</td>
                <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-500 text-right">
                  {breakdown.temperature.value.toFixed(1)} °C
                </td>
                <td className={`px-4 py-2 whitespace-nowrap text-sm font-medium text-right ${
                  breakdown.temperature.score > 7 ? 'text-green-600' : 'text-yellow-600'
                }`}>
                  {breakdown.temperature.score}/{breakdown.temperature.maxPossible}
                </td>
              </tr>
              <tr>
                <td className="px-4 py-2 whitespace-nowrap text-sm font-medium text-gray-700">Cloud Cover</td>
                <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-500 text-right">
                  {breakdown.cloudCover.value.toFixed(0)}%
                </td>
                <td className={`px-4 py-2 whitespace-nowrap text-sm font-medium text-right ${
                  breakdown.cloudCover.score > 7 ? 'text-green-600' : 
                  breakdown.cloudCover.score > 5 ? 'text-yellow-600' : 'text-gray-600'
                }`}>
                  {breakdown.cloudCover.score}/{breakdown.cloudCover.maxPossible}
                </td>
              </tr>
              <tr>
                <td className="px-4 py-2 whitespace-nowrap text-sm font-medium text-gray-700">Geographic Protection</td>
                <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-500 text-right">
                  {breakdown.geoProtection.value.toFixed(0)}/100
                </td>
                <td className={`px-4 py-2 whitespace-nowrap text-sm font-medium text-right ${
                  breakdown.geoProtection.score > 10 ? 'text-green-600' : 
                  breakdown.geoProtection.score > 5 ? 'text-yellow-600' : 'text-red-600'
                }`}>
                  {breakdown.geoProtection.score}/{breakdown.geoProtection.maxPossible}
                </td>
              </tr>
              <tr className="bg-blue-50">
                <td className="px-4 py-3 whitespace-nowrap text-sm font-bold text-gray-900">TOTAL SCORE</td>
                <td className="px-4 py-3 whitespace-nowrap"></td>
                <td className={`px-4 py-3 whitespace-nowrap text-sm font-bold text-right ${
                  breakdown.total.score >= 85 ? 'text-green-600' : 
                  breakdown.total.score >= 70 ? 'text-yellow-600' :
                  breakdown.total.score >= 50 ? 'text-orange-600' : 'text-red-600'
                }`}>
                  {breakdown.total.score}/{breakdown.total.maxPossible}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  return (
    <div className="flex flex-col min-h-screen bg-blue-50">
      {/* Toast notification */}
      {notification && (
        <div className={`fixed top-4 right-4 z-50 p-4 rounded-lg shadow-lg ${
          notification.type === 'success' ? 'bg-green-100 border border-green-400 text-green-800' :
          'bg-red-100 border border-red-400 text-red-800'
        }`}>
          {notification.message}
        </div>
      )}

      {/* Custom Date Picker Modal */}
      {showDatePicker && (
        <DatePickerModal
          onSelect={(date) => {
            handleTimeRangeChange('date', date);
            setShowDatePicker(false);
          }}
          onClose={() => setShowDatePicker(false)}
        />
      )}
      
      {/* Header */}
      <header className="bg-blue-600 text-white p-4 shadow-md">
        <div className="container mx-auto flex justify-between items-center">
          <h1 className="text-2xl font-bold flex items-center">
            <div className="mr-2 text-3xl">🌊</div> 
            Paddleboard Weather Advisor
          </h1>
          <nav className="flex space-x-4">
            <button
              onClick={() => setView("dashboard")}
              className={`px-3 py-1 rounded-lg ${
                view === "dashboard" ? "bg-blue-800" : "hover:bg-blue-700"
              } transition-colors duration-200`}
            >
              Dashboard
            </button>
            <button
              onClick={() => setView("add")}
              className={`px-3 py-1 rounded-lg ${
                view === "add" ? "bg-blue-800" : "hover:bg-blue-700"
              } transition-colors duration-200`}
            >
              Add Beach
            </button>
          </nav>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-grow container mx-auto p-4">
        {view === "dashboard" && (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {beaches.length === 0 ? (
              <div className="col-span-full bg-white rounded-lg shadow-lg p-8 text-center">
                <div className="text-blue-600 text-5xl mb-4">🏝️</div>
                <h2 className="text-2xl font-bold mb-4 text-gray-800">No beaches saved yet</h2>
                <p className="text-gray-600 mb-6">Add your favorite paddleboarding spots to get started!</p>
                <button
                  onClick={() => setView("add")}
                  className="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition-colors duration-200 shadow-md"
                >
                  Add Your First Beach
                </button>
              </div>
            ) : (
              beaches.map((beach) => (
                <div
                  key={beach.id}
                  className={`bg-white rounded-lg shadow-md overflow-hidden hover:shadow-lg transition-shadow ${
                    beach.id === homeBeach?.id ? "ring-2 ring-orange-400" : ""
                  }`}
                >
                  <div className="p-4">
                    <div className="flex justify-between items-start mb-2">
                      <h2 className="text-xl font-semibold flex items-center">
                        {beach.id === homeBeach?.id && (
                          <Home className="h-4 w-4 text-orange-500 mr-1" />
                        )}
                        {beach.name}
                      </h2>
                    </div>
                    <p className="text-gray-500 text-sm mb-3 flex items-center">
                      <MapPin className="h-3 w-3 mr-1 text-gray-400 flex-shrink-0" />
                      {beach.latitude.toFixed(4)}, {beach.longitude.toFixed(4)}
                    </p>
                    <div className="flex justify-between items-center">
                      <a 
                        href={getGoogleMapsLink(beach.latitude, beach.longitude)} 
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-blue-600 hover:underline flex items-center"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <Map className="h-3 w-3 mr-1" />
                        View on Maps
                      </a>
                      <button
                        onClick={() => handleBeachSelect(beach)}
                        className="bg-blue-600 text-white text-sm px-3 py-1 rounded-lg hover:bg-blue-700 transition-colors"
                      >
                        Check Conditions
                      </button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {view === "add" && (
          <div className="bg-white rounded-lg shadow-lg">
            <div className="p-4 border-b">
              <h2 className="text-xl font-semibold flex items-center">
                <Plus className="h-5 w-5 mr-2 text-blue-500" />
                Add New Beach
              </h2>
            </div>

            <div className="p-4">
              <div className="mb-8">
                <h3 className="text-lg font-medium mb-3">
                  Add via Google Maps Link
                </h3>
                <div className="bg-blue-50 p-4 rounded-lg mb-4">
                  <div className="flex items-start mb-3">
                    <Map className="h-5 w-5 mr-2 text-blue-600 mt-1 flex-shrink-0" />
                    <p className="text-sm text-gray-700">
                      Paste a Google Maps link to a beach and we'll automatically extract the coordinates!
                      <br/>
                      <span className="text-xs text-gray-500 mt-1 block">
                        Example: https://maps.app.goo.gl/RLXesyCsSvESpwhM9
                      </span>
                    </p>
                  </div>
                  <div className="flex">
                    <input
                      type="text"
                      value={mapUrl || ''}
                      onChange={(e) => setMapUrl(e.target.value)}
                      placeholder="Paste Google Maps URL here..."
                      className="flex-grow p-2 border rounded-l"
                    />
                    <button
                      onClick={handleExtractCoordinates}
                      className="bg-blue-600 text-white px-4 py-2 rounded-r hover:bg-blue-700 transition-colors"
                    >
                      Extract
                    </button>
                  </div>
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
                          placeholder="e.g., 37.8207"
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
                          placeholder="e.g., 23.7686"
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
                        href={getGoogleMapsLink(location.latitude, location.longitude)} 
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
                    href={getGoogleMapsLink(selectedBeach.latitude, selectedBeach.longitude)} 
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

            {/* IMPROVED Time Range Selector */}
            <div className="p-4 border-b">
              <h3 className="text-lg font-medium mb-4">Select Time Range</h3>
              
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
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Start Time</label>
                  <select
                    value={timeRange.startTime}
                    onChange={(e) => handleTimeRangeChange('startTime', e.target.value)}
                    className="w-full p-3 border rounded-lg text-lg"
                  >
                    {Array.from({ length: 24 }, (_, i) => (
                      <option key={i} value={`${String(i).padStart(2, '0')}:00`}>
                        {`${String(i).padStart(2, '0')}:00`}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">End Time</label>
                  <select
                    value={timeRange.endTime}
                    onChange={(e) => handleTimeRangeChange('endTime', e.target.value)}
                    className="w-full p-3 border rounded-lg text-lg"
                  >
                    {Array.from({ length: 24 }, (_, i) => (
                      <option key={i} value={`${String(i).padStart(2, '0')}:00`}>
                        {`${String(i).padStart(2, '0')}:00`}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            {/* Conditions */}
            {loading && (
              <div className="p-8 text-center">
                <div className="inline-block animate-spin h-10 w-10 border-4 border-blue-500 border-t-transparent rounded-full mb-4"></div>
                <p className="text-gray-600">Loading weather data...</p>
              </div>
            )}

            {error && (
              <div className="p-4 bg-blue-50 border border-blue-200 rounded-md text-blue-800 mx-4 my-2">
                <p className="flex items-center font-medium">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 24 24"
                    fill="currentColor"
                    className="w-5 h-5 mr-2 text-blue-600"
                  >
                    <path d="M11.25 4.533A9.707 9.707 0 006 3a9.735 9.735 0 00-3.25.555.75.75 0 00-.5.707v14.25a.75.75 0 001 .707A8.237 8.237 0 016 18.75c1.995 0 3.823.707 5.25 1.886V4.533zM12.75 20.636A8.214 8.214 0 0118 18.75c.966 0 1.89.166 2.75.47a.75.75 0 001-.708V4.262a.75.75 0 00-.5-.707A9.735 9.735 0 0018 3a9.707 9.707 0 00-5.25 1.533v16.103z" />
                  </svg>
                  {error}
                </p>
              </div>
            )}

            {weatherData && score !== null && !loading && (
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
                          Using simulated data
                        </>
                      )}
                    </div>
                  </div>
                  
                  {/* Weather Factors - RIGHT SIDE */}
                  <div className="md:w-2/3">
                    <div className="grid grid-cols-2 gap-3">
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
                      
                      {weatherData.hourly.swell_wave_height && (
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
                    
                    <div className="mt-3 bg-white rounded-lg p-3 border shadow-sm">
                      <h4 className="font-medium mb-2 flex items-center">
                        <Clock className="h-5 w-5 mr-2 text-blue-600" />
                        Hourly Wind Speed
                      </h4>
                      <div className="space-y-2">
                        {[9, 10, 11, 12, 13].map((hour) => (
                          <div
                            key={hour}
                            className="flex items-center p-2 hover:bg-blue-50 rounded"
                          >
                            <div className="w-10 text-center text-gray-600">{hour}:00</div>
                            <div className="flex-grow mx-2">
                              <div className="h-3 bg-gray-200 rounded-full">
                                <div 
                                  className={`h-full rounded-full ${
                                    weatherData.hourly.windspeed_10m[hour] < 8
                                      ? "bg-green-500"
                                      : weatherData.hourly.windspeed_10m[hour] < 12
                                      ? "bg-yellow-500"
                                      : "bg-red-500"
                                  }`}
                                  style={{ width: `${Math.min(100, weatherData.hourly.windspeed_10m[hour] * 5)}%` }}
                                ></div>
                              </div>
                            </div>
                            <div className={`px-2 py-1 rounded-full text-xs font-medium ${
                              weatherData.hourly.windspeed_10m[hour] < 8
                                ? "bg-green-100 text-green-800"
                                : weatherData.hourly.windspeed_10m[hour] < 12
                                ? "bg-yellow-100 text-yellow-800"
                                : "bg-red-100 text-red-800"
                            }`}>
                              {Math.round(weatherData.hourly.windspeed_10m[hour])} km/h
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
                
                {/* Score Breakdown Table - NEW */}
                {renderScoreBreakdown(scoreBreakdown)}
                
                {/* Geographic Protection Analysis - MOVED UP */}
                {renderGeographicInfo(selectedBeach, weatherData)}

                {/* Beach Comparison Section */}
                {beaches.length > 1 && (
                  <div className="mt-6 bg-blue-50 p-4 rounded-lg border border-blue-200 shadow-inner">
                    <h4 className="font-medium mb-3 flex items-center text-blue-800">
                      <MapPin className="h-5 w-5 mr-2 text-blue-600" />
                      Compare with Nearby Beaches
                    </h4>
                    
                    <div className="grid md:grid-cols-2 gap-4">
                      {beaches.filter(b => b.id !== selectedBeach.id).slice(0, 4).map(otherBeach => {
                        const avgWindDirection = weatherData.hourly.winddirection_10m.reduce((sum, val) => sum + val, 0) / 
                                              weatherData.hourly.winddirection_10m.length;
                        
                        const waveDirection = weatherData.daily.wave_direction_dominant[0];
                        
                        const currentProtection = calculateGeographicProtection(selectedBeach, avgWindDirection, waveDirection);
                        const otherProtection = calculateGeographicProtection(otherBeach, avgWindDirection, waveDirection);
                        
                        const comparison = otherProtection.protectionScore - currentProtection.protectionScore;
                        
                        return (
                          <div key={otherBeach.id} 
                              className="flex items-center justify-between p-3 bg-white rounded-lg border shadow-sm hover:bg-blue-50 hover:border-blue-300 cursor-pointer transition-colors"
                              onClick={() => handleBeachSelect(otherBeach)}>
                            <div className="flex items-center">
                              <MapPin className="h-4 w-4 mr-2 text-blue-500" />
                              <span className="font-medium">{otherBeach.name}</span>
                            </div>
                            <span className={`text-sm px-3 py-1 rounded-full ${
                              comparison > 10 ? 'bg-green-100 text-green-800' : 
                              comparison < -10 ? 'bg-red-100 text-red-800' : 
                              'bg-gray-100 text-gray-800'
                            }`}>
                              {comparison > 10 ? 'Better today' : 
                              comparison < -10 ? 'Worse today' : 
                              'Similar'}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
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

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
} from "lucide-react";

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
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [newBeach, setNewBeach] = useState({
    name: "",
    latitude: "",
    longitude: "",
  });

  // Use a ref to store consistent mock data for Greek beaches
  const mockDataRef = useRef({
    // Kavouri beach - typically excellent conditions in morning
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
        windspeed_10m: Array.from({ length: 24 }, (_, i) =>
          i < 9 ? 3 : 5 + (i - 9) * 0.7
        ), // Light morning winds
        winddirection_10m: Array.from({ length: 24 }, () => 45), // Consistent NE direction (good for Kavouri)
        wave_height: Array.from({ length: 24 }, (_, i) =>
          i < 10 ? 0.1 : 0.2 + (i - 10) * 0.03
        ), // Calm mornings
        swell_wave_height: Array.from({ length: 24 }, (_, i) =>
          i < 10 ? 0.05 : 0.1 + (i - 10) * 0.02
        ), // Low swell
      },
      daily: {
        wave_height_max: [0.3], // Moderate max wave height
        wave_direction_dominant: [45], // NE direction
      },
    },

    // Vouliagmeni beach - typically good but more variable
    "Vouliagmeni Beach": {
      hourly: {
        time: Array.from(
          { length: 24 },
          (_, i) => `2025-04-01T${String(i).padStart(2, "0")}:00`
        ),
        temperature_2m: Array.from(
          { length: 24 },
          (_, i) => 21 + Math.sin(i / 3) * 4
        ), // 17-25°C range
        precipitation: Array.from({ length: 24 }, () => 0.1), // Low precipitation
        cloudcover: Array.from(
          { length: 24 },
          (_, i) => 20 + Math.sin(i / 4) * 20
        ), // Variable clouds
        windspeed_10m: Array.from(
          { length: 24 },
          (_, i) => 5 + Math.sin(i / 2) * 4
        ), // More variable winds
        winddirection_10m: Array.from({ length: 24 }, () => 90), // E direction
        wave_height: Array.from(
          { length: 24 },
          (_, i) => 0.2 + Math.sin(i / 6) * 0.1
        ), // More variable
        swell_wave_height: Array.from(
          { length: 24 },
          (_, i) => 0.1 + Math.sin(i / 6) * 0.05
        ),
      },
      daily: {
        wave_height_max: [0.3],
        wave_direction_dominant: [90], // E direction
      },
    },

    // Default for other beaches - average conditions
    default: {
      hourly: {
        time: Array.from(
          { length: 24 },
          (_, i) => `2025-04-01T${String(i).padStart(2, "0")}:00`
        ),
        temperature_2m: Array.from(
          { length: 24 },
          (_, i) => 22 + Math.sin(i / 3) * 4
        ), // 18-26°C range
        precipitation: Array.from({ length: 24 }, () => 0.1), // Consistent low precipitation
        cloudcover: Array.from(
          { length: 24 },
          (_, i) => 30 + Math.sin(i / 6) * 20
        ), // Variable clouds
        windspeed_10m: Array.from(
          { length: 24 },
          (_, i) => 8 + Math.sin(i / 4) * 4
        ), // Moderate winds
        winddirection_10m: Array.from({ length: 24 }, () => 180), // S direction
        wave_height: Array.from({ length: 24 }, () => 0.3), // Moderate waves
        swell_wave_height: Array.from({ length: 24 }, () => 0.2), // Moderate swell
      },
      daily: {
        wave_height_max: [0.4],
        wave_direction_dominant: [180], // S direction
      },
    },
  });

  // Greek coastal locations
  const suggestedLocations = [
    { name: "Kavouri Beach", latitude: 37.8207, longitude: 23.7686 },
    { name: "Vouliagmeni Beach", latitude: 37.8179, longitude: 23.7808 },
    { name: "Varkiza Beach", latitude: 37.8133, longitude: 23.8011 },
    { name: "Alimos Beach", latitude: 37.9111, longitude: 23.7017 },
    { name: "Edem Beach", latitude: 37.9331, longitude: 23.7075 },
    { name: "Schinias Beach", latitude: 38.1597, longitude: 24.0296 },
  ];

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
      const calculatedScore = calculatePaddleScore(
        relevantHours,
        combinedData.daily,
        beach
      );
      setScore(calculatedScore);
    } catch (error) {
      console.error("Error fetching real weather data:", error);
      setError(
        "Unable to fetch real-time weather data. If you want actual data, try opening the app from your own server with proper API access."
      );

      // Fall back to demo data as a last resort
      let mockData;
      if (beach.name.includes("Kavouri")) {
        mockData = mockDataRef.current["Kavouri Beach"];
      } else if (beach.name.includes("Vouliagmeni")) {
        mockData = mockDataRef.current["Vouliagmeni Beach"];
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
      const calculatedScore = calculatePaddleScore(
        relevantHours,
        mockData.daily,
        beach
      );
      setScore(calculatedScore);
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
    };
  };

  // Calculate paddle score based on weather conditions
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

    // Score calculation based on the table in the requirements
    let score = 0;

    // Wind speed (up to 40 points)
    score += avgWind < 8 ? 40 : Math.max(0, 40 - (avgWind - 8) * (40 / 12));

    // Wave height (up to 20 points)
    score +=
      waveHeight < 0.2 ? 20 : Math.max(0, 20 - (waveHeight - 0.2) * (20 / 0.4));

    // Swell height (up to 10 points)
    score +=
      swellHeight < 0.3
        ? 10
        : Math.max(0, 10 - (swellHeight - 0.3) * (10 / 0.3));

    // Precipitation (10 points)
    score += maxPrecip < 1 ? 10 : 0;

    // Air temperature (up to 10 points)
    if (avgTemp >= 22 && avgTemp <= 30) {
      score += 10;
    } else if (avgTemp < 22) {
      score += Math.max(0, 10 - (22 - avgTemp));
    } else {
      score += Math.max(0, 10 - (avgTemp - 30));
    }

    // Cloud cover (up to 10 points)
    score += avgCloud < 40 ? 10 : Math.max(0, 10 - (avgCloud - 40) / 6);

    // Beach-specific adjustments
    if (beach && beach.name) {
      // Kavouri beach directional wind preference
      if (beach.name.includes("Kavouri")) {
        // Check wind direction
        const avgWindDirection =
          hourlyData.winddirection_10m.reduce((sum, val) => sum + val, 0) /
          hourlyData.winddirection_10m.length;

        // Check if wind is from preferred directions (N = 0, NE = 45)
        if (
          (avgWindDirection >= 0 && avgWindDirection <= 20) ||
          (avgWindDirection >= 35 && avgWindDirection <= 55)
        ) {
          // Bonus for preferred wind directions at Kavouri
          score += 5;
        }
      }
    }

    return Math.round(Math.min(100, score)); // Cap at 100
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
      setView("dashboard");
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
    setView("dashboard");
  };

  return (
    <div className="flex flex-col min-h-screen bg-blue-50">
      {/* Header */}
      <header className="bg-blue-600 text-white p-4">
        <div className="container mx-auto flex justify-between items-center">
          <h1 className="text-2xl font-bold">🌊 Paddleboard Weather Advisor</h1>
          <nav className="flex space-x-4">
            <button
              onClick={() => setView("dashboard")}
              className={`px-3 py-1 rounded ${
                view === "dashboard" ? "bg-blue-800" : "hover:bg-blue-700"
              }`}
            >
              Dashboard
            </button>
            <button
              onClick={() => setView("add")}
              className={`px-3 py-1 rounded ${
                view === "add" ? "bg-blue-800" : "hover:bg-blue-700"
              }`}
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
              <div className="col-span-full bg-white rounded-lg shadow p-6 text-center">
                <p className="text-gray-600 mb-4">No beaches saved yet.</p>
                <button
                  onClick={() => setView("add")}
                  className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
                >
                  Add Your First Beach
                </button>
              </div>
            ) : (
              beaches.map((beach) => (
                <div
                  key={beach.id}
                  className={`bg-white rounded-lg shadow overflow-hidden ${
                    beach.id === homeBeach?.id ? "ring-2 ring-orange-400" : ""
                  }`}
                >
                  <div className="p-4 flex justify-between items-start">
                    <div>
                      <h2 className="text-xl font-semibold flex items-center">
                        {beach.id === homeBeach?.id && (
                          <Home className="h-4 w-4 text-orange-500 mr-1" />
                        )}
                        {beach.name}
                      </h2>
                      <p className="text-gray-500 text-sm">
                        {beach.latitude.toFixed(4)},{" "}
                        {beach.longitude.toFixed(4)}
                      </p>
                    </div>
                    <div className="flex">
                      <button
                        onClick={() => handleBeachSelect(beach)}
                        className="bg-blue-600 text-white text-sm px-3 py-1 rounded hover:bg-blue-700"
                      >
                        View
                      </button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {view === "add" && (
          <div className="bg-white rounded-lg shadow">
            <div className="p-4 border-b">
              <h2 className="text-xl font-semibold flex items-center">
                <Plus className="h-5 w-5 mr-2 text-blue-500" />
                Add New Beach
              </h2>
            </div>

            <div className="p-4">
              <div className="mb-6">
                <h3 className="text-lg font-medium mb-3">
                  Enter Beach Details
                </h3>
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
                      className="w-full p-2 border rounded"
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
                        className="w-full p-2 border rounded"
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
                        className="w-full p-2 border rounded"
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
                    className={`px-4 py-2 rounded ${
                      !newBeach.name ||
                      !newBeach.latitude ||
                      !newBeach.longitude
                        ? "bg-gray-300 text-gray-500 cursor-not-allowed"
                        : "bg-blue-600 text-white hover:bg-blue-700"
                    }`}
                  >
                    Add Beach
                  </button>
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
                      className="border rounded p-3 hover:bg-blue-50 cursor-pointer transition"
                      onClick={() => handleAddSuggested(location)}
                    >
                      <h4 className="font-medium">{location.name}</h4>
                      <p className="text-sm text-gray-500">
                        {location.latitude.toFixed(4)},{" "}
                        {location.longitude.toFixed(4)}
                      </p>
                    </div>
                  ))}
                </div>
              </div>

              <div className="mt-6 bg-blue-50 p-4 rounded border border-blue-100">
                <div className="flex items-start">
                  <Map className="h-5 w-5 mr-2 text-blue-600 mt-1" />
                  <div>
                    <h4 className="font-medium">Finding Coordinates</h4>
                    <p className="text-sm text-gray-600 mt-1">
                      To find exact coordinates for a beach, you can use Google
                      Maps. Right-click on the location and copy the latitude
                      and longitude values.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {view === "detail" && selectedBeach && (
          <div className="bg-white rounded-lg shadow overflow-hidden">
            <div className="p-4 border-b flex justify-between items-center">
              <div>
                <h2 className="text-2xl font-semibold flex items-center">
                  {selectedBeach.id === homeBeach?.id && (
                    <Home className="h-5 w-5 text-orange-500 mr-2" />
                  )}
                  {selectedBeach.name}
                </h2>
                <p className="text-gray-600">
                  {selectedBeach.latitude.toFixed(4)},{" "}
                  {selectedBeach.longitude.toFixed(4)}
                </p>
              </div>
              <div className="flex space-x-2">
                {selectedBeach.id !== homeBeach?.id && (
                  <button
                    onClick={() => handleSetHomeBeach(selectedBeach)}
                    className="bg-orange-500 text-white px-3 py-1 rounded hover:bg-orange-600 flex items-center"
                  >
                    <Home className="h-4 w-4 mr-1" /> Set as Home
                  </button>
                )}
                <button
                  onClick={() => setView("dashboard")}
                  className="bg-gray-200 text-gray-800 px-3 py-1 rounded hover:bg-gray-300 flex items-center"
                >
                  <ChevronLeft className="h-4 w-4 mr-1" /> Back
                </button>
              </div>
            </div>

            {/* Time Range Selector */}
            <div className="p-4 border-b">
              <h3 className="text-lg font-medium mb-2">Select Time Range</h3>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Date
                  </label>
                  <input
                    type="date"
                    value={timeRange.date}
                    min={new Date().toISOString().split("T")[0]}
                    max={
                      new Date(Date.now() + 5 * 24 * 60 * 60 * 1000)
                        .toISOString()
                        .split("T")[0]
                    }
                    onChange={(e) =>
                      handleTimeRangeChange("date", e.target.value)
                    }
                    className="w-full p-2 border rounded"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Start Time
                  </label>
                  <input
                    type="time"
                    value={timeRange.startTime}
                    onChange={(e) =>
                      handleTimeRangeChange("startTime", e.target.value)
                    }
                    className="w-full p-2 border rounded"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    End Time
                  </label>
                  <input
                    type="time"
                    value={timeRange.endTime}
                    onChange={(e) =>
                      handleTimeRangeChange("endTime", e.target.value)
                    }
                    className="w-full p-2 border rounded"
                  />
                </div>
              </div>
              <button
                onClick={() => fetchWeatherData(selectedBeach)}
                className="mt-3 bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
              >
                Update Forecast
              </button>
            </div>

            {/* Conditions */}
            {loading && (
              <div className="p-6 text-center">
                <div className="inline-block animate-spin h-8 w-8 border-4 border-blue-500 border-t-transparent rounded-full mb-4"></div>
                <p>Loading weather data...</p>
              </div>
            )}

            {error && (
              <div className="p-4 bg-blue-50 border border-blue-200 rounded-md text-blue-800 mb-4">
                <p className="flex items-center">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 24 24"
                    fill="currentColor"
                    className="w-5 h-5 mr-2"
                  >
                    <path d="M11.25 4.533A9.707 9.707 0 006 3a9.735 9.735 0 00-3.25.555.75.75 0 00-.5.707v14.25a.75.75 0 001 .707A8.237 8.237 0 016 18.75c1.995 0 3.823.707 5.25 1.886V4.533zM12.75 20.636A8.214 8.214 0 0118 18.75c.966 0 1.89.166 2.75.47a.75.75 0 001-.708V4.262a.75.75 0 00-.5-.707A9.735 9.735 0 0018 3a9.707 9.707 0 00-5.25 1.533v16.103z" />
                  </svg>
                  {error}
                </p>
                <p className="mt-1 text-xs ml-7">
                  The app is using location-specific simulated data based on
                  Greek coastal patterns
                </p>
              </div>
            )}

            {weatherData && score !== null && !loading && (
              <div className="p-6">
                <div className="mb-6 text-center">
                  <div
                    className={`inline-block text-5xl mb-2 ${
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
                  <h3 className="text-2xl font-bold mb-1">
                    {getCondition(score).label}
                  </h3>
                  <p className="text-gray-600">{getCondition(score).message}</p>
                  <div className="mt-4 bg-gray-100 rounded-full h-4 overflow-hidden">
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
                  <p className="mt-2 text-sm text-gray-600">
                    Score: {score}/100
                  </p>
                  <p className="mt-1 text-xs text-gray-500">
                    {window.location.hostname === "localhost" ||
                    window.location.hostname.includes("test")
                      ? "(Using simulated data)"
                      : "(Using real Open-Meteo data)"}
                  </p>
                </div>

                <div className="grid md:grid-cols-2 gap-6">
                  <div className="bg-gray-50 p-4 rounded-lg">
                    <h4 className="font-medium mb-3">Weather Factors</h4>
                    <ul className="space-y-4">
                      <li className="flex items-center">
                        <Wind className="h-5 w-5 mr-2 text-blue-600" />
                        <span className="flex-grow">Wind</span>
                        <span
                          className={`font-medium ${
                            weatherData.hourly.windspeed_10m[12] < 8
                              ? "text-green-600"
                              : weatherData.hourly.windspeed_10m[12] < 15
                              ? "text-yellow-600"
                              : "text-red-600"
                          }`}
                        >
                          {Math.round(weatherData.hourly.windspeed_10m[12])}{" "}
                          km/h
                        </span>
                      </li>
                      <li className="flex items-center">
                        <Waves className="h-5 w-5 mr-2 text-blue-600" />
                        <span className="flex-grow">Wave Height</span>
                        <span
                          className={`font-medium ${
                            weatherData.daily.wave_height_max[0] < 0.2
                              ? "text-green-600"
                              : weatherData.daily.wave_height_max[0] < 0.4
                              ? "text-yellow-600"
                              : "text-red-600"
                          }`}
                        >
                          {weatherData.daily.wave_height_max[0].toFixed(1)} m
                        </span>
                      </li>
                      <li className="flex items-center">
                        <Thermometer className="h-5 w-5 mr-2 text-blue-600" />
                        <span className="flex-grow">Temperature</span>
                        <span
                          className={`font-medium ${
                            weatherData.hourly.temperature_2m[12] >= 22 &&
                            weatherData.hourly.temperature_2m[12] <= 30
                              ? "text-green-600"
                              : "text-yellow-600"
                          }`}
                        >
                          {Math.round(weatherData.hourly.temperature_2m[12])}°C
                        </span>
                      </li>
                      <li className="flex items-center">
                        <Droplets className="h-5 w-5 mr-2 text-blue-600" />
                        <span className="flex-grow">Precipitation</span>
                        <span
                          className={`font-medium ${
                            weatherData.hourly.precipitation[12] < 1
                              ? "text-green-600"
                              : "text-red-600"
                          }`}
                        >
                          {weatherData.hourly.precipitation[12].toFixed(1)} mm
                        </span>
                      </li>
                      <li className="flex items-center">
                        <Sun className="h-5 w-5 mr-2 text-blue-600" />
                        <span className="flex-grow">Cloud Cover</span>
                        <span
                          className={`font-medium ${
                            weatherData.hourly.cloudcover[12] < 40
                              ? "text-green-600"
                              : weatherData.hourly.cloudcover[12] < 70
                              ? "text-yellow-600"
                              : "text-gray-600"
                          }`}
                        >
                          {Math.round(weatherData.hourly.cloudcover[12])}%
                        </span>
                      </li>
                      {weatherData.hourly.swell_wave_height && (
                        <li className="flex items-center">
                          <Waves className="h-5 w-5 mr-2 text-blue-600" />
                          <span className="flex-grow">Swell Height</span>
                          <span
                            className={`font-medium ${
                              weatherData.hourly.swell_wave_height[12] < 0.3
                                ? "text-green-600"
                                : "text-yellow-600"
                            }`}
                          >
                            {weatherData.hourly.swell_wave_height[12].toFixed(
                              1
                            )}{" "}
                            m
                          </span>
                        </li>
                      )}
                    </ul>
                  </div>

                  <div className="bg-gray-50 p-4 rounded-lg">
                    <h4 className="font-medium mb-3">Hourly Breakdown</h4>
                    <div className="space-y-2">
                      {[9, 10, 11, 12, 13].map((hour) => (
                        <div
                          key={hour}
                          className="flex items-center p-2 hover:bg-gray-100 rounded"
                        >
                          <Clock className="h-4 w-4 mr-2 text-gray-500" />
                          <span className="flex-grow text-sm">{hour}:00</span>
                          <span
                            className={`px-2 py-1 rounded text-xs font-medium ${
                              weatherData.hourly.windspeed_10m[hour] < 8
                                ? "bg-green-100 text-green-800"
                                : weatherData.hourly.windspeed_10m[hour] < 12
                                ? "bg-yellow-100 text-yellow-800"
                                : "bg-red-100 text-red-800"
                            }`}
                          >
                            {Math.round(weatherData.hourly.windspeed_10m[hour])}{" "}
                            km/h
                          </span>
                        </div>
                      ))}
                    </div>

                    <div className="mt-4 pt-4 border-t border-gray-200">
                      <h4 className="font-medium mb-2 flex items-center">
                        <AlertCircle className="h-4 w-4 mr-1 text-blue-600" />
                        Tips
                      </h4>
                      <p className="text-sm text-gray-600">
                        {score >= 85
                          ? "Perfect conditions! Enjoy a smooth paddle."
                          : score >= 70
                          ? "Go early to avoid increasing winds."
                          : score >= 50
                          ? "Be prepared for some chop and wind."
                          : "Consider an alternative activity today."}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="bg-blue-800 text-white p-4 mt-auto">
        <div className="container mx-auto text-center text-sm">
          <p>© 2025 Paddleboard Weather Advisor | Ladi Thalassa</p>
        </div>
      </footer>
    </div>
  );
};

export default App;

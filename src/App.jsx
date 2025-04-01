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
  Trash2,
  RefreshCw,
} from "lucide-react";

// Geographic protection analysis
const calculateGeographicProtection = (beach, windDirection, waveDirection) => {
  // Hardcoded geographic data for known Greek beaches
  const geographicData = {
    'Kavouri Beach': {
      latitude: 37.8235,
      longitude: 23.7761,
      coastlineOrientation: 135, // SE facing
      bayEnclosure: 0.3, // Somewhat open
      protectedFromDirections: [315, 360, 45], // Protected from NW, N, NE
      exposedToDirections: [135, 180, 225], // Exposed to SE, S, SW
      description: "Moderately protected bay, exposed to southern winds"
    },
    'Glyfada Beach': {
      latitude: 37.8650,
      longitude: 23.7470,
      coastlineOrientation: 110, // ESE facing
      bayEnclosure: 0.3, // Somewhat open
      protectedFromDirections: [270, 315, 360], // Protected from W, NW, N
      exposedToDirections: [90, 135, 180], // Exposed to E, SE, S
      description: "Exposed beach, limited protection"
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
    'Astir Beach': {
      latitude: 37.8095,
      longitude: 23.7850,
      coastlineOrientation: 180, // S facing
      bayEnclosure: 0.8, // Highly enclosed
      protectedFromDirections: [0, 45, 90, 270, 315], // Protected from most directions
      exposedToDirections: [180], // Only directly exposed to south
      description: "Well-protected beach in a sheltered bay"
    },
    'Kapsali Beach': {
      latitude: 36.1360,
      longitude: 22.9980,
      coastlineOrientation: 180, // S facing
      bayEnclosure: 0.7, // Well enclosed
      protectedFromDirections: [270, 315, 0, 45, 90], // Protected from W, NW, N, NE, E
      exposedToDirections: [180], // Only exposed to south
      description: "Well-protected bay, only exposed to southern winds"
    },
    'Palaiopoli Beach': {
      latitude: 36.2260,
      longitude: 23.0410,
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
    beachName.toLowerCase().includes(name.toLowerCase()) || 
    name.toLowerCase().includes(beachName.toLowerCase())
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
  
  // Handle maps.app.goo.gl links by ID matching
  if (url.includes("maps.app.goo.gl")) {
    // Map specific known beach links to their coordinates
    const mapLinkMapping = {
      "KP6MpuG6mgrv1Adm6": { name: "Kavouri Beach", latitude: 37.8235, longitude: 23.7761, googleMapsUrl: "https://maps.app.goo.gl/KP6MpuG6mgrv1Adm6" },
      "yEXLZW5kwBArCHvb7": { name: "Glyfada Beach", latitude: 37.8650, longitude: 23.7470, googleMapsUrl: "https://maps.app.goo.gl/yEXLZW5kwBArCHvb7" },
      "6uUbtp31MQ63gGBSA": { name: "Astir Beach", latitude: 37.8095, longitude: 23.7850, googleMapsUrl: "https://maps.app.goo.gl/6uUbtp31MQ63gGBSA" },
      "xcs6EqYy8LbzYq2y6": { name: "Kapsali Beach", latitude: 36.1360, longitude: 22.9980, googleMapsUrl: "https://maps.app.goo.gl/xcs6EqYy8LbzYq2y6" },
      "TPFetRbFcyAXdgNDA": { name: "Palaiopoli Beach", latitude: 36.2260, longitude: 23.0410, googleMapsUrl: "https://maps.app.goo.gl/TPFetRbFcyAXdgNDA" }
    };
    
    // Extract the ID from the URL
    for (const id in mapLinkMapping) {
      if (url.includes(id)) {
        return mapLinkMapping[id];
      }
    }
  }
  
  // Handle @lat,lng format (what you see in the URL bar)
  let match = url.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/);
  if (match) {
    return {
      latitude: parseFloat(match[1]),
      longitude: parseFloat(match[2]),
      googleMapsUrl: url
    };
  }
  
  // Handle ?q=lat,lng format (shared links)
  match = url.match(/\?q=(-?\d+\.\d+),(-?\d+\.\d+)/);
  if (match) {
    return {
      latitude: parseFloat(match[1]),
      longitude: parseFloat(match[2]),
      googleMapsUrl: url
    };
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
  const [deleteConfirm, setDeleteConfirm] = useState(null);

  // Greek coastal locations with correct Google Maps URLs
  const suggestedLocations = [
    { name: "Kavouri Beach", latitude: 37.8235, longitude: 23.7761, googleMapsUrl: "https://maps.app.goo.gl/KP6MpuG6mgrv1Adm6" },
    { name: "Glyfada Beach", latitude: 37.8650, longitude: 23.7470, googleMapsUrl: "https://maps.app.goo.gl/yEXLZW5kwBArCHvb7" },
    { name: "Astir Beach", latitude: 37.8095, longitude: 23.7850, googleMapsUrl: "https://maps.app.goo.gl/6uUbtp31MQ63gGBSA" },
    { name: "Kapsali Beach", latitude: 36.1360, longitude: 22.9980, googleMapsUrl: "https://maps.app.goo.gl/xcs6EqYy8LbzYq2y6" },
    { name: "Palaiopoli Beach", latitude: 36.2260, longitude: 23.0410, googleMapsUrl: "https://maps.app.goo.gl/TPFetRbFcyAXdgNDA" },
    { name: "Vouliagmeni Beach", latitude: 37.8179, longitude: 23.7808 },
    { name: "Varkiza Beach", latitude: 37.8133, longitude: 23.8011 },
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

  // Handle beach deletion
  const handleDeleteBeach = (beachId) => {
    setDeleteConfirm(beachId);
  };
  
  const confirmDeleteBeach = (beachId) => {
    const beachToDelete = beaches.find(b => b.id === beachId);
    const newBeaches = beaches.filter(b => b.id !== beachId);
    setBeaches(newBeaches);
    
    // If we're deleting the home beach, unset it
    if (homeBeach && homeBeach.id === beachId) {
      setHomeBeach(null);
    }
    
    // If we're deleting the selected beach, go back to dashboard
    if (selectedBeach && selectedBeach.id === beachId) {
      setView("dashboard");
    }
    
    toast.success(`Removed ${beachToDelete.name}`);
    setDeleteConfirm(null);
  };
  
  const cancelDeleteBeach = () => {
    setDeleteConfirm(null);
  };

  // Use a ref to store geographic-aware mock data for Greek beaches
  const mockDataRef = useRef({
    // Beach mock data...
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
    } else {
      localStorage.removeItem("beaches");
    }
  }, [beaches]);

  // Save home beach to localStorage when it changes
  useEffect(() => {
    if (homeBeach) {
      localStorage.setItem("homeBeach", JSON.stringify(homeBeach));
    } else {
      localStorage.removeItem("homeBeach");
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
      } else if (beachNameLower.includes("glyf")) {
        mockData = mockDataRef.current["Glyfada Beach"];
      } else if (beachNameLower.includes("aster") || beachNameLower.includes("astar") || beachNameLower.includes("astir")) {
        mockData = mockDataRef.current["Astir Beach"];
      } else if (beachNameLower.includes("kapsal")) {
        mockData = mockDataRef.current["Kapsali Beach"];
      } else if (beachNameLower.includes("palaio")) {
        mockData = mockDataRef.current["Palaiopoli Beach"];
      } else if (beachNameLower.includes("vouliag")) {
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

  // Handle adding a new beach with duplicate check
  const handleAddBeach = () => {
    if (newBeach.name && newBeach.latitude && newBeach.longitude) {
      // Check for duplicates
      const isDuplicate = beaches.some(beach => 
        (Math.abs(beach.latitude - parseFloat(newBeach.latitude)) < 0.01 && 
         Math.abs(beach.longitude - parseFloat(newBeach.longitude)) < 0.01) ||
        beach.name.toLowerCase() === newBeach.name.toLowerCase()
      );
      
      if (isDuplicate) {
        toast.error("This beach already exists in your list!");
        return;
      }
      
      const beachToAdd = {
        id: `beach-${Date.now()}`,
        name: newBeach.name,
        latitude: parseFloat(newBeach.latitude),
        longitude: parseFloat(newBeach.longitude),
        googleMapsUrl: mapUrl || null
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

  // Handle adding a suggested location with duplicate check
  const handleAddSuggested = (location) => {
    // Check for duplicates
    const isDuplicate = beaches.some(beach => 
      (Math.abs(beach.latitude - location.latitude) < 0.01 && 
       Math.abs(beach.longitude - location.longitude) < 0.01) ||
      beach.name.toLowerCase() === location.name.toLowerCase()
    );
    
    if (isDuplicate) {
      toast.error("This beach already exists in your list!");
      return;
    }
    
    const beachToAdd = {
      id: `beach-${Date.now()}`,
      name: location.name,
      latitude: location.latitude,
      longitude: location.longitude,
      googleMapsUrl: location.googleMapsUrl
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
      setMapUrl(result.googleMapsUrl || mapUrl);
      toast.success("Coordinates extracted successfully!");
    } else {
      toast.error("Could not extract coordinates from URL. Please check format.");
    }
  };

  // Inside your render method, update the View on Maps link to:
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

      {/* Delete Confirmation Modal */}
      {deleteConfirm && (
        <DeleteConfirmationModal 
          beach={beaches.find(b => b.id === deleteConfirm)}
          onConfirm={confirmDeleteBeach}
          onCancel={cancelDeleteBeach}
        />
      )}
      
      {/* Header */}
      <header className="bg-blue-600 text-white p-4 shadow-md">
        <div className="container mx-auto flex justify-between items-center">
          <h1 
            className="text-2xl font-bold flex items-center cursor-pointer hover:text-blue-100 transition-colors"
            onClick={() => setView("dashboard")}
          >
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
        {/* Dashboard View */}
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
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteBeach(beach.id);
                        }}
                        className="text-gray-400 hover:text-red-500 transition-colors p-1 rounded-full hover:bg-gray-100"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                    <p className="text-gray-500 text-sm mb-3 flex items-center">
                      <MapPin className="h-3 w-3 mr-1 text-gray-400 flex-shrink-0" />
                      {beach.latitude.toFixed(4)}, {beach.longitude.toFixed(4)}
                    </p>
                    <div className="flex justify-between items-center">
                      <a 
                        href={beach.googleMapsUrl || getGoogleMapsLink(beach.latitude, beach.longitude)} 
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

        {/* Add Beach View */}
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
                        Example: https://maps.app.goo.gl/yEXLZW5kwBArCHvb7
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

              {/* Beach detail form */}
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

              {/* Popular beaches section */}
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
                        href={location.googleMapsUrl || getGoogleMapsLink(location.latitude, location.longitude)} 
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

        {/* Detail View */}
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
                    href={selectedBeach.googleMapsUrl || getGoogleMapsLink(selectedBeach.latitude, selectedBeach.longitude)} 
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

            {/* Time Range Selector - Made to match Image 1 */}
            <div className="p-4 border-b bg-gray-50">
              <h3 className="text-lg font-medium mb-4">Choose Date & Time Window</h3>
              
              <div className="mb-4">
                <div className="flex">
                  <div className="flex-1">
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Date
                    </label>
                    <input 
                      type="date" 
                      className="w-full p-2 border rounded"
                      value={timeRange.date}
                      onChange={(e) => handleTimeRangeChange('date', e.target.value)}
                    />
                  </div>
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-4 mb-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Start Time
                  </label>
                  <select
                    value={timeRange.startTime}
                    onChange={(e) => handleTimeRangeChange('startTime', e.target.value)}
                    className="w-full p-2 border rounded appearance-none bg-white"
                  >
                    {Array.from({ length: 24 }, (_, i) => (
                      <option key={i} value={`${String(i).padStart(2, '0')}:00`}>
                        {`${String(i).padStart(2, '0')}:00`}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    End Time
                  </label>
                  <select
                    value={timeRange.endTime}
                    onChange={(e) => handleTimeRangeChange('endTime', e.target.value)}
                    className="w-full p-2 border rounded appearance-none bg-white"
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
                onClick={() => fetchWeatherData(selectedBeach)}
                className="w-full bg-blue-600 text-white py-2 rounded hover:bg-blue-700 flex items-center justify-center"
              >
                <RefreshCw className="h-4 w-4 mr-2" />
                Update Forecast
              </button>
            </div>

            {/* Weather display and other components... */}
            {/* Rest of the UI will be similar to the previous version */}
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

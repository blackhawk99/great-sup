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
  const beachName = beach?.name || '';
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
const calculateDirectionalProtection = (direction, protectedDirections, exposedToDirections, bayEnclosure) => {
  // Check if direction is within protected ranges
  const isProtected = protectedDirections.some(protectedDir => {
    return Math.abs(direction - protectedDir) <= 45;
  });
  
  // Check if direction is within exposed ranges
  const isExposed = exposedToDirections.some(exposedDir => {
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
  
  // Handle @lat,lng format
  let match = url.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/);
  if (match) {
    return {
      latitude: parseFloat(match[1]),
      longitude: parseFloat(match[2]),
      googleMapsUrl: url
    };
  }
  
  // Handle ?q=lat,lng format
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
  const [view, setView] = useState("dashboard");
  const [score, setScore] = useState(null);
  const [scoreBreakdown, setScoreBreakdown] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [newBeach, setNewBeach] = useState({
    name: "",
    latitude: "",
    longitude: "",
    googleMapsUrl: "",
  });
  const [mapUrl, setMapUrl] = useState("");
  const [notification, setNotification] = useState(null);
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [showDatePicker, setShowDatePicker] = useState(false);

  // Greek coastal locations with correct Google Maps URLs
  const suggestedLocations = [
    { name: "Kavouri Beach", latitude: 37.8235, longitude: 23.7761, googleMapsUrl: "https://maps.app.goo.gl/KP6MpuG6mgrv1Adm6" },
    { name: "Glyfada Beach", latitude: 37.8650, longitude: 23.7470, googleMapsUrl: "https://maps.app.goo.gl/yEXLZW5kwBArCHvb7" },
    { name: "Astir Beach", latitude: 37.8095, longitude: 23.7850, googleMapsUrl: "https://maps.app.goo.gl/6uUbtp31MQ63gGBSA" },
    { name: "Kapsali Beach", latitude: 36.1360, longitude: 22.9980, googleMapsUrl: "https://maps.app.goo.gl/xcs6EqYy8LbzYq2y6" },
    { name: "Palaiopoli Beach", latitude: 36.2260, longitude: 23.0410, googleMapsUrl: "https://maps.app.goo.gl/TPFetRbFcyAXdgNDA" },
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

  // Use a ref to store mock data for beaches
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
        ),
        precipitation: Array.from({ length: 24 }, (_, i) =>
          i < 10 ? 0 : i > 16 ? 0.2 : 0
        ),
        cloudcover: Array.from({ length: 24 }, (_, i) =>
          i < 11 ? 10 : 30 + (i - 11) * 5
        ),
        winddirection_10m: Array.from({ length: 24 }, (_, i) => {
          const hour = i % 24;
          return hour < 10 ? 45 : 45 + ((hour - 10) * 15);
        }),
        windspeed_10m: Array.from({ length: 24 }, (_, i) => {
          const hour = i % 24;
          const direction = hour < 10 ? 45 : 45 + ((hour - 10) * 15);
          const southFactor = (direction >= 135 && direction <= 225) ? 1.5 : 0.8;
          return (i < 9 ? 4 : 6 + (i-9) * 0.8) * southFactor;
        }),
        wave_height: Array.from({ length: 24 }, (_, i) => {
          const hour = i % 24;
          const direction = hour < 10 ? 45 : 45 + ((hour - 10) * 15);
          const southFactor = (direction >= 135 && direction <= 225) ? 1.8 : 0.7;
          return (i < 10 ? 0.15 : 0.2 + (i-10) * 0.03) * southFactor;
        }),
        swell_wave_height: Array.from({ length: 24 }, (_, i) => {
          const hour = i % 24;
          const direction = hour < 10 ? 45 : 45 + ((hour - 10) * 15);
          const southFactor = (direction >= 135 && direction <= 225) ? 1.6 : 0.6;
          return (i < 10 ? 0.07 : 0.12 + (i-10) * 0.02) * southFactor;
        }),
      },
      daily: {
        wave_height_max: [0.4],
        wave_direction_dominant: [170],
      }
    },
    
    // Glyfada Beach
    "Glyfada Beach": {
      hourly: {
        time: Array.from(
          { length: 24 },
          (_, i) => `2025-04-01T${String(i).padStart(2, "0")}:00`
        ),
        temperature_2m: Array.from(
          { length: 24 },
          (_, i) => 22 + Math.sin(i / 3) * 5
        ),
        precipitation: Array.from({ length: 24 }, (_, i) =>
          i < 10 ? 0 : i > 16 ? 0.3 : 0
        ),
        cloudcover: Array.from({ length: 24 }, (_, i) =>
          i < 11 ? 15 : 35 + (i - 11) * 5
        ),
        winddirection_10m: Array.from({ length: 24 }, (_, i) => {
          const hour = i % 24;
          return hour < 10 ? 45 : 45 + ((hour - 10) * 15);
        }),
        windspeed_10m: Array.from({ length: 24 }, (_, i) => {
          const hour = i % 24;
          const direction = hour < 10 ? 45 : 45 + ((hour - 10) * 15);
          const exposedFactor = (direction >= 90 && direction <= 180) ? 1.6 : 0.8;
          return (i < 9 ? 5 : 7 + (i-9) * 0.9) * exposedFactor;
        }),
        wave_height: Array.from({ length: 24 }, (_, i) => {
          const hour = i % 24;
          const direction = hour < 10 ? 45 : 45 + ((hour - 10) * 15);
          const exposedFactor = (direction >= 90 && direction <= 180) ? 1.7 : 0.8;
          return (i < 10 ? 0.2 : 0.25 + (i-10) * 0.04) * exposedFactor;
        }),
        swell_wave_height: Array.from({ length: 24 }, (_, i) => {
          const hour = i % 24;
          const direction = hour < 10 ? 45 : 45 + ((hour - 10) * 15);
          const exposedFactor = (direction >= 90 && direction <= 180) ? 1.5 : 0.7;
          return (i < 10 ? 0.1 : 0.15 + (i-10) * 0.03) * exposedFactor;
        }),
      },
      daily: {
        wave_height_max: [0.5],
        wave_direction_dominant: [160],
      }
    },

    // Astir Beach - protected from most directions
    "Astir Beach": {
      hourly: {
        time: Array.from(
          { length: 24 },
          (_, i) => `2025-04-01T${String(i).padStart(2, "0")}:00`
        ),
        temperature_2m: Array.from(
          { length: 24 },
          (_, i) => 22 + Math.sin(i / 3) * 5
        ),
        precipitation: Array.from({ length: 24 }, (_, i) =>
          i < 10 ? 0 : i > 16 ? 0.2 : 0
        ),
        cloudcover: Array.from({ length: 24 }, (_, i) =>
          i < 11 ? 10 : 30 + (i - 11) * 5
        ),
        winddirection_10m: Array.from({ length: 24 }, (_, i) => {
          const hour = i % 24;
          return hour < 10 ? 45 : 45 + ((hour - 10) * 15);
        }),
        windspeed_10m: Array.from({ length: 24 }, (_, i) => {
          const hour = i % 24;
          const direction = hour < 10 ? 45 : 45 + ((hour - 10) * 15);
          const protectionFactor = (direction >= 160 && direction <= 200) ? 1.0 : 0.4;
          return (i < 9 ? 4 : 6 + (i-9) * 0.8) * protectionFactor;
        }),
        wave_height: Array.from({ length: 24 }, (_, i) => {
          const hour = i % 24;
          const direction = hour < 10 ? 45 : 45 + ((hour - 10) * 15);
          const protectionFactor = (direction >= 160 && direction <= 200) ? 0.9 : 0.3;
          return (i < 10 ? 0.15 : 0.2 + (i-10) * 0.03) * protectionFactor;
        }),
        swell_wave_height: Array.from({ length: 24 }, (_, i) => {
          const hour = i % 24;
          const direction = hour < 10 ? 45 : 45 + ((hour - 10) * 15);
          const protectionFactor = (direction >= 160 && direction <= 200) ? 0.8 : 0.2;
          return (i < 10 ? 0.07 : 0.12 + (i-10) * 0.02) * protectionFactor;
        }),
      },
      daily: {
        wave_height_max: [0.2],
        wave_direction_dominant: [170],
      }
    },

    // Other beaches...
    "default": {
      hourly: {
        time: Array.from({ length: 24 }, (_, i) => `2025-04-01T${String(i).padStart(2, "0")}:00`),
        temperature_2m: Array.from({ length: 24 }, (_, i) => 22 + Math.sin(i / 3) * 4),
        precipitation: Array.from({ length: 24 }, () => 0.1),
        cloudcover: Array.from({ length: 24 }, (_, i) => 30 + Math.sin(i / 6) * 20),
        windspeed_10m: Array.from({ length: 24 }, (_, i) => 8 + Math.sin(i / 4) * 4),
        winddirection_10m: Array.from({ length: 24 }, () => 180),
        wave_height: Array.from({ length: 24 }, () => 0.3),
        swell_wave_height: Array.from({ length: 24 }, () => 0.2),
      },
      daily: {
        wave_height_max: [0.4],
        wave_direction_dominant: [180],
      }
    }
  });

  // Load saved beaches from localStorage on component mount
  useEffect(() => {
    try {
      const savedBeaches = localStorage.getItem("beaches");
      if (savedBeaches) {
        const parsedBeaches = JSON.parse(savedBeaches);
        setBeaches(parsedBeaches);
      }

      const savedHomeBeach = localStorage.getItem("homeBeach");
      if (savedHomeBeach) {
        setHomeBeach(JSON.parse(savedHomeBeach));
      }
    } catch (error) {
      console.error("Error loading saved data:", error);
      localStorage.removeItem("beaches");
      localStorage.removeItem("homeBeach");
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

  // Handle beach selection - FIXED
  const handleBeachSelect = (beach) => {
    if (!beach || !beach.latitude || !beach.longitude) {
      toast.error("Invalid beach data");
      return;
    }
    
    setSelectedBeach(beach);
    setView("detail");
    fetchWeatherData(beach);
  };

  // Handle setting home beach
  const handleSetHomeBeach = (beach) => {
    setHomeBeach(beach);
    toast.success(`${beach.name} set as home beach!`);
  };

  // Handle time range change
  const handleTimeRangeChange = (field, value) => {
    setTimeRange({ ...timeRange, [field]: value });
  };
  
  // Handle update forecast button
  const handleUpdateForecast = () => {
    if (selectedBeach) {
      fetchWeatherData(selectedBeach);
    }
  };

  // Handle beach deletion
  const handleDeleteBeach = (beachId) => {
    const beach = beaches.find(b => b.id === beachId);
    if (!beach) {
      toast.error("Beach not found");
      return;
    }
    setDeleteConfirm(beachId);
  };
  
  const confirmDeleteBeach = (beachId) => {
    const beachToDelete = beaches.find(b => b.id === beachId);
    if (!beachToDelete) {
      toast.error("Beach not found");
      setDeleteConfirm(null);
      return;
    }
    
    const newBeaches = beaches.filter(b => b.id !== beachId);
    setBeaches(newBeaches);
    
    // If we're deleting the home beach, unset it
    if (homeBeach && homeBeach.id === beachId) {
      setHomeBeach(null);
    }
    
    // If we're deleting the selected beach, go back to dashboard
    if (selectedBeach && selectedBeach.id === beachId) {
      setView("dashboard");
      setSelectedBeach(null);
    }
    
    toast.success(`Removed ${beachToDelete.name}`);
    setDeleteConfirm(null);
  };
  
  const cancelDeleteBeach = () => {
    setDeleteConfirm(null);
  };

  // FIXED: Extract coordinates from Google Maps URL
  const handleExtractCoordinates = () => {
    try {
      const result = parseGoogleMapsUrl(mapUrl);
      if (result) {
        setNewBeach({
          ...newBeach,
          name: result.name || newBeach.name,
          latitude: result.latitude.toString(),
          longitude: result.longitude.toString(),
          googleMapsUrl: result.googleMapsUrl,
        });
        toast.success("Coordinates extracted successfully!");
      } else {
        toast.error("Could not extract coordinates from URL. Please check format.");
      }
    } catch (error) {
      console.error("Error extracting coordinates:", error);
      toast.error("Error extracting coordinates. Please try a different URL format.");
    }
  };

  // FIXED: Add new beach
  const handleAddBeach = () => {
    try {
      if (!newBeach.name || !newBeach.latitude || !newBeach.longitude) {
        toast.error("Please fill in all beach details");
        return;
      }
      
      const lat = parseFloat(newBeach.latitude);
      const lng = parseFloat(newBeach.longitude);
      
      if (isNaN(lat) || isNaN(lng)) {
        toast.error("Invalid coordinates");
        return;
      }
      
      // Check for duplicates
      const isDuplicate = beaches.some(beach => 
        (Math.abs(beach.latitude - lat) < 0.01 && 
         Math.abs(beach.longitude - lng) < 0.01) ||
        beach.name.toLowerCase() === newBeach.name.toLowerCase()
      );
      
      if (isDuplicate) {
        toast.error("This beach already exists in your list!");
        return;
      }
      
      const beachToAdd = {
        id: `beach-${Date.now()}`,
        name: newBeach.name,
        latitude: lat,
        longitude: lng,
        googleMapsUrl: newBeach.googleMapsUrl || mapUrl,
      };

      setBeaches([...beaches, beachToAdd]);
      setNewBeach({ name: "", latitude: "", longitude: "", googleMapsUrl: "" });
      setMapUrl("");
      toast.success(`Added ${beachToAdd.name} to your beaches!`);
      setView("dashboard");
    } catch (error) {
      console.error("Error adding beach:", error);
      toast.error("Error adding beach. Please try again.");
    }
  };

  // FIXED: Add suggested location
  const handleAddSuggested = (location) => {
    try {
      if (!location || !location.name || !location.latitude || !location.longitude) {
        toast.error("Invalid location data");
        return;
      }
      
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
        googleMapsUrl: location.googleMapsUrl,
      };

      setBeaches([...beaches, beachToAdd]);
      toast.success(`Added ${location.name} to your beaches!`);
      setView("dashboard");
    } catch (error) {
      console.error("Error adding suggested beach:", error);
      toast.error("Error adding beach. Please try again.");
    }
  };

  // Function to fetch weather data - FIXED
  const fetchWeatherData = async (beach) => {
    if (!beach || !beach.latitude || !beach.longitude) {
      toast.error("Invalid beach data. Please try adding this beach again.");
      return;
    }
    
    setLoading(true);
    setError(null);

    try {
      const { longitude, latitude } = beach;

      // Parse the selected date for the API request
      const selectedDate = new Date(timeRange.date);
      const formattedDate = selectedDate.toISOString().split("T")[0];

      // Construct the Open-Meteo API URLs
      const marineUrl = `https://marine-api.open-meteo.com/v1/marine?latitude=${latitude}&longitude=${longitude}&hourly=wave_height,wave_direction,wave_period,wind_wave_height,wind_wave_direction,wind_wave_period,swell_wave_height,swell_wave_direction,swell_wave_period&daily=wave_height_max&timezone=auto&start_date=${formattedDate}&end_date=${formattedDate}`;

      const weatherUrl = `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&hourly=temperature_2m,precipitation,cloudcover,windspeed_10m,winddirection_10m&daily=precipitation_sum&timezone=auto&start_date=${formattedDate}&end_date=${formattedDate}`;

      // For demo purposes, always use mock data for now
      const beachNameLower = beach.name.toLowerCase();
      let mockData = mockDataRef.current["default"];
      
      if (beachNameLower.includes("kavouri")) {
        mockData = mockDataRef.current["Kavouri Beach"];
      } else if (beachNameLower.includes("glyf")) {
        mockData = mockDataRef.current["Glyfada Beach"];
      } else if (beachNameLower.includes("astir") || beachNameLower.includes("aster")) {
        mockData = mockDataRef.current["Astir Beach"];
      } else if (beachNameLower.includes("kapsal")) {
        mockData = mockDataRef.current["Kapsali Beach"];
      } else if (beachNameLower.includes("palaio")) {
        mockData = mockDataRef.current["Palaiopoli Beach"];
      }
      
      // Update the date in mock data
      mockData.hourly.time = Array.from(
        { length: 24 },
        (_, i) => `${timeRange.date}T${String(i).padStart(2, "0")}:00`
      );

      mockData.isRealData = false;
      
      // Simulate API delay
      await new Promise(resolve => setTimeout(resolve, 800));
      
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
      
    } catch (error) {
      console.error("Error with weather data:", error);
      setError("Unable to load weather data. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  // Filter hourly data by time range
  const filterHoursByTimeRange = (hourlyData, range) => {
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

  // Calculate paddle score based on weather conditions and enhanced geographic protection
  const calculatePaddleScore = (hourlyData, dailyData, beach) => {
    if (!hourlyData || !dailyData || !beach) {
      return { calculatedScore: 0, breakdown: null };
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

  // Delete Confirmation Modal with error handling
  const DeleteConfirmationModal = ({ beach, onConfirm, onCancel }) => {
    if (!beach || !beach.id || !beach.name) {
      setTimeout(onCancel, 0);
      return null;
    }
    
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white rounded-lg p-6 w-full max-w-md">
          <h3 className="text-lg font-medium mb-4">Confirm Deletion</h3>
          <p className="text-gray-700 mb-4">
            Are you sure you want to remove <span className="font-semibold">{beach.name}</span>?
          </p>
          <div className="flex justify-end space-x-3">
            <button
              onClick={onCancel}
              className="px-4 py-2 border rounded-lg text-gray-700 hover:bg-gray-100"
            >
              Cancel
            </button>
            <button
              onClick={() => onConfirm(beach.id)}
              className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
            >
              Delete
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

  // Render wind speed hourly visualization
  const renderWindSpeedVisualization = (weatherData, timeRange) => {
    if (!weatherData || !weatherData.hourly) return null;
    
    const startHour = parseInt(timeRange.startTime.split(":")[0]);
    const endHour = parseInt(timeRange.endTime.split(":")[0]);
    
    // Get all hours in the range
    const hours = [];
    for (let i = startHour; i <= endHour; i++) {
      hours.push(i);
    }
    
    return (
      <div className="bg-white rounded-lg p-5 border shadow-sm mt-4">
        <h4 className="font-medium mb-4 flex items-center text-gray-800">
          <Clock className="h-5 w-5 mr-2 text-blue-600" /> 
          Hourly Wind Speed
        </h4>
        
        <div className="space-y-3">
          {hours.map(hour => {
            const windSpeed = Math.round(weatherData.hourly.windspeed_10m[hour]);
            const barWidth = Math.min(80, windSpeed * 6); // Cap at 80% width
            
            let barColor = "bg-green-500";
            let textColor = "text-green-800";
            let bgColor = "bg-green-100";
            
            if (windSpeed >= 12) {
              barColor = "bg-red-500";
              textColor = "text-red-800";
              bgColor = "bg-red-100";
            } else if (windSpeed >= 8) {
              barColor = "bg-yellow-500";
              textColor = "text-yellow-800";
              bgColor = "bg-yellow-100";
            }
            
            return (
              <div key={hour} className="flex items-center">
                <div className="w-12 text-gray-600 font-medium">
                  {hour}:00
                </div>
                <div className="flex-grow mx-3 bg-gray-200 h-6 rounded-full overflow-hidden">
                  <div 
                    className={`h-full ${barColor} rounded-l-full`} 
                    style={{ width: `${barWidth}%` }} 
                  ></div>
                </div>
                <div className={`px-2 py-1 rounded-md ${bgColor} ${textColor} font-medium text-sm min-w-[70px] text-center`}>
                  {windSpeed} km/h
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  // Beach comparison section
  const renderBeachComparison = (selectedBeach, allBeaches, weatherData) => {
    if (allBeaches.length <= 1 || !weatherData || !selectedBeach) return null;
    
    const avgWindDirection = weatherData.hourly.winddirection_10m.reduce((sum, val) => sum + val, 0) / 
                          weatherData.hourly.winddirection_10m.length;
    
    const waveDirection = weatherData.daily.wave_direction_dominant ? 
                        weatherData.daily.wave_direction_dominant[0] : 
                        avgWindDirection;
    
    const currentProtection = calculateGeographicProtection(selectedBeach, avgWindDirection, waveDirection);
    
    const otherBeaches = allBeaches.filter(b => b.id !== selectedBeach.id);
    
    return (
      <div className="mt-6 bg-blue-50 p-4 rounded-lg border border-blue-200 shadow-inner">
        <h4 className="font-medium mb-3 flex items-center text-blue-800">
          <MapPin className="h-5 w-5 mr-2 text-blue-600" />
          Compare with Nearby Beaches
        </h4>
        
        <div className="grid md:grid-cols-2 gap-4">
          {otherBeaches.slice(0, 4).map(otherBeach => {
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
                        href={beach.googleMapsUrl || `https://www.google.com/maps?q=${beach.latitude},${beach.longitude}`}
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
                        Example: https://maps.app.goo.gl/yEXLZW5kwBArCHvb7
                      </span>
                    </p>
                  </div>
                  <div className="flex">
                    <input
                      type="text"
                      value={mapUrl}
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

            {/* IMPROVED Time Range Selector - Made to match Image 1 */}
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
                onClick={handleUpdateForecast}
                className="w-full bg-blue-600 text-white py-2 rounded hover:bg-blue-700 flex items-center justify-center"
              >
                <RefreshCw className="h-4 w-4 mr-2" />
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

            {/* Weather data display */}
            {weatherData && score !== null && !loading && (
              <div className="p-6">
                {/* Main Score */}
                <div className="flex flex-col md:flex-row gap-6 mb-6">
                  <div className="md:w-1/3 bg-white rounded-lg shadow-md p-6 text-center">
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
                  </div>
                  
                  {/* Weather Factors */}
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
                  </div>
                </div>
                
                {/* Score Breakdown Table */}
                {renderScoreBreakdown(scoreBreakdown)}
                
                {/* Geographic Protection Analysis */}
                {renderGeographicInfo(selectedBeach, weatherData)}
                
                {/* Hourly Wind Speed Visualization */}
                {renderWindSpeedVisualization(weatherData, timeRange)}

                {/* Beach Comparison Section */}
                {renderBeachComparison(selectedBeach, beaches, weatherData)}
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

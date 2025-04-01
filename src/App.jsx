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
  ChevronRight,
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
    'Astir Beach': {
      latitude: 37.8016,
      longitude: 23.7711,
      coastlineOrientation: 180, // S facing
      bayEnclosure: 0.8, // Highly enclosed
      protectedFromDirections: [0, 45, 90, 270, 315], // Protected from most directions
      exposedToDirections: [180], // Only directly exposed to south
      description: "Well-protected beach in a sheltered bay"
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
    // This would be replaced with actual coastline analysis in a production app
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

// Modern Date Range Picker Component
const DateRangePicker = ({ initialValue, onChange }) => {
  const [showPicker, setShowPicker] = useState(false);
  const [selectedDate, setSelectedDate] = useState(new Date(initialValue.date));
  const [startTime, setStartTime] = useState(initialValue.startTime);
  const [endTime, setEndTime] = useState(initialValue.endTime);
  
  // State for calendar display
  const [displayMonth, setDisplayMonth] = useState(selectedDate.getMonth());
  const [displayYear, setDisplayYear] = useState(selectedDate.getFullYear());
  
  // Generate calendar days for current month
  const generateCalendarDays = () => {
    const daysInMonth = new Date(displayYear, displayMonth + 1, 0).getDate();
    const firstDayOfMonth = new Date(displayYear, displayMonth, 1).getDay();
    
    const days = [];
    
    // Previous month days
    const prevMonthDays = firstDayOfMonth === 0 ? 6 : firstDayOfMonth - 1;
    const prevMonth = displayMonth === 0 ? 11 : displayMonth - 1;
    const prevMonthYear = displayMonth === 0 ? displayYear - 1 : displayYear;
    const daysInPrevMonth = new Date(prevMonthYear, prevMonth + 1, 0).getDate();
    
    for (let i = daysInPrevMonth - prevMonthDays + 1; i <= daysInPrevMonth; i++) {
      days.push({ day: i, month: prevMonth, year: prevMonthYear, isCurrentMonth: false });
    }
    
    // Current month days
    for (let i = 1; i <= daysInMonth; i++) {
      days.push({ day: i, month: displayMonth, year: displayYear, isCurrentMonth: true });
    }
    
    // Next month days
    const remainingDays = 42 - days.length; // 6 rows x 7 days
    const nextMonth = displayMonth === 11 ? 0 : displayMonth + 1;
    const nextMonthYear = displayMonth === 11 ? displayYear + 1 : displayYear;
    
    for (let i = 1; i <= remainingDays; i++) {
      days.push({ day: i, month: nextMonth, year: nextMonthYear, isCurrentMonth: false });
    }
    
    return days;
  };
  
  const handleSetToday = () => {
    const today = new Date();
    setSelectedDate(today);
    handleDateSelection(today);
    setShowPicker(false);
  };
  
  const handleSetTomorrow = () => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    setSelectedDate(tomorrow);
    handleDateSelection(tomorrow);
    setShowPicker(false);
  };
  
  const handleDateSelection = (date) => {
    const formattedDate = date.toISOString().split('T')[0];
    onChange({
      date: formattedDate,
      startTime,
      endTime
    });
  };
  
  const handlePrevMonth = () => {
    if (displayMonth === 0) {
      setDisplayMonth(11);
      setDisplayYear(displayYear - 1);
    } else {
      setDisplayMonth(displayMonth - 1);
    }
  };
  
  const handleNextMonth = () => {
    if (displayMonth === 11) {
      setDisplayMonth(0);
      setDisplayYear(displayYear + 1);
    } else {
      setDisplayMonth(displayMonth + 1);
    }
  };
  
  const formatDateRange = () => {
    const dateFormatter = new Intl.DateTimeFormat('en-US', { 
      month: '2-digit', 
      day: '2-digit', 
      year: 'numeric' 
    });
    
    return `${dateFormatter.format(selectedDate)} ${startTime} — ${dateFormatter.format(selectedDate)} ${endTime}`;
  };
  
  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];
  
  const isCurrentDay = (day) => {
    return day.day === selectedDate.getDate() && 
           day.month === selectedDate.getMonth() && 
           day.year === selectedDate.getFullYear();
  };
  
  const isToday = (day) => {
    const today = new Date();
    return day.day === today.getDate() && 
           day.month === today.getMonth() && 
           day.year === today.getFullYear();
  };
  
  const handleDayClick = (day) => {
    const newDate = new Date(day.year, day.month, day.day);
    setSelectedDate(newDate);
    
    // If it's a different month, update the display month
    if (day.month !== displayMonth) {
      setDisplayMonth(day.month);
      setDisplayYear(day.year);
    }
  };
  
  const handleTimeChange = (type, value) => {
    if (type === 'start') {
      setStartTime(value);
    } else {
      setEndTime(value);
    }
  };
  
  const applySelection = () => {
    handleDateSelection(selectedDate);
    setShowPicker(false);
  };
  
  return (
    <div className="w-full">
      <div className="flex space-x-4 mb-4">
        <button 
          onClick={handleSetToday}
          className="flex-1 bg-blue-500 text-white py-3 px-6 rounded-lg text-lg font-medium hover:bg-blue-600"
        >
          Today
        </button>
        <button 
          onClick={handleSetTomorrow}
          className="flex-1 bg-blue-500 text-white py-3 px-6 rounded-lg text-lg font-medium hover:bg-blue-600"
        >
          Tomorrow
        </button>
      </div>
      
      <div className="mb-4">
        <label className="block text-sm font-medium text-gray-700 mb-1">
          dateTimeRange
        </label>
        <input
          type="text"
          value={formatDateRange()}
          onClick={() => setShowPicker(true)}
          readOnly
          className="w-full p-4 border border-gray-300 rounded-lg text-lg cursor-pointer"
        />
      </div>
      
      {showPicker && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-4 max-w-md w-full">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-medium">Select Date and Time</h3>
              <button 
                onClick={() => setShowPicker(false)}
                className="text-gray-500 hover:text-gray-700"
              >
                ✕
              </button>
            </div>
            
            {/* Calendar Header */}
            <div className="flex justify-between items-center mb-4">
              <div className="flex items-center">
                <button onClick={handlePrevMonth} className="p-1">
                  <ArrowLeft className="h-5 w-5" />
                </button>
                <span className="mx-2">{monthNames[displayMonth]} {displayYear}</span>
                <button onClick={handleNextMonth} className="p-1">
                  <ArrowRight className="h-5 w-5" />
                </button>
              </div>
            </div>
            
            {/* Calendar Grid */}
            <div className="mb-4">
              <div className="grid grid-cols-7 gap-1 text-center mb-2">
                <div className="text-gray-500 text-sm">Su</div>
                <div className="text-gray-500 text-sm">Mo</div>
                <div className="text-gray-500 text-sm">Tu</div>
                <div className="text-gray-500 text-sm">We</div>
                <div className="text-gray-500 text-sm">Th</div>
                <div className="text-gray-500 text-sm">Fr</div>
                <div className="text-gray-500 text-sm">Sa</div>
              </div>
              
              <div className="grid grid-cols-7 gap-1">
                {generateCalendarDays().map((day, index) => (
                  <button
                    key={index}
                    onClick={() => handleDayClick(day)}
                    className={`p-2 rounded-full text-center ${
                      isCurrentDay(day) 
                        ? 'bg-blue-500 text-white' 
                        : isToday(day) 
                          ? 'border border-blue-500 text-blue-500' 
                          : day.isCurrentMonth 
                            ? 'hover:bg-gray-100' 
                            : 'text-gray-400 hover:bg-gray-100'
                    }`}
                  >
                    {day.day}
                  </button>
                ))}
              </div>
            </div>
            
            {/* Time Picker */}
            <div className="grid grid-cols-3 gap-4 mb-4">
              <div>
                <label className="block text-sm text-gray-500 mb-1">
                  Hour
                </label>
                <div className="grid grid-cols-3 gap-2 text-center">
                  <select 
                    value={startTime.split(':')[0]} 
                    onChange={(e) => handleTimeChange('start', `${e.target.value}:${startTime.split(':')[1]}`)}
                    className="p-2 border rounded"
                  >
                    {Array.from({ length: 24 }, (_, i) => i).map(hour => (
                      <option key={hour} value={hour.toString().padStart(2, '0')}>
                        {hour.toString().padStart(2, '0')}
                      </option>
                    ))}
                  </select>
                  <span className="flex items-center justify-center">:</span>
                  <select 
                    value={startTime.split(':')[1]} 
                    onChange={(e) => handleTimeChange('start', `${startTime.split(':')[0]}:${e.target.value}`)}
                    className="p-2 border rounded"
                  >
                    {Array.from({ length: 4 }, (_, i) => i * 15).map(minute => (
                      <option key={minute} value={minute.toString().padStart(2, '0')}>
                        {minute.toString().padStart(2, '0')}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              
              <div className="flex items-center justify-center">
                —
              </div>
              
              <div>
                <label className="block text-sm text-gray-500 mb-1">
                  Hour
                </label>
                <div className="grid grid-cols-3 gap-2 text-center">
                  <select 
                    value={endTime.split(':')[0]} 
                    onChange={(e) => handleTimeChange('end', `${e.target.value}:${endTime.split(':')[1]}`)}
                    className="p-2 border rounded"
                  >
                    {Array.from({ length: 24 }, (_, i) => i).map(hour => (
                      <option key={hour} value={hour.toString().padStart(2, '0')}>
                        {hour.toString().padStart(2, '0')}
                      </option>
                    ))}
                  </select>
                  <span className="flex items-center justify-center">:</span>
                  <select 
                    value={endTime.split(':')[1]} 
                    onChange={(e) => handleTimeChange('end', `${endTime.split(':')[0]}:${e.target.value}`)}
                    className="p-2 border rounded"
                  >
                    {Array.from({ length: 4 }, (_, i) => i * 15).map(minute => (
                      <option key={minute} value={minute.toString().padStart(2, '0')}>
                        {minute.toString().padStart(2, '0')}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
            
            <div className="flex justify-end">
              <button 
                onClick={() => setShowPicker(false)}
                className="px-4 py-2 border rounded mr-2 hover:bg-gray-100"
              >
                Cancel
              </button>
              <button 
                onClick={applySelection}
                className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
              >
                OK
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
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
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [newBeach, setNewBeach] = useState({
    name: "",
    latitude: "",
    longitude: "",
  });

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
        ), // Same temperature
        precipitation: Array.from({ length: 24 }, (_, i) =>
          i < 10 ? 0 : i > 16 ? 0.2 : 0
        ), // Same precipitation
        cloudcover: Array.from({ length: 24 }, (_, i) =>
          i < 11 ? 10 : 30 + (i - 11) * 5
        ), // Same cloud cover
        // Same wind direction pattern
        winddirection_10m: Array.from({ length: 24 }, (_, i) => {
          const hour = i % 24;
          // Morning: 45° (NE), gradually shifting to 180° (S) in afternoon
          return hour < 10 ? 45 : 45 + ((hour - 10) * 15);
        }),
        // Wind speed is same but Astir is protected from most directions
        windspeed_10m: Array.from({ length: 24 }, (_, i) => {
          const hour = i % 24;
          // Dynamically calculate direction for this hour
          const direction = hour < 10 ? 45 : 45 + ((hour - 10) * 15);
          // Only south winds (160-200) fully affect Astir
          const protectionFactor = (direction >= 160 && direction <= 200) ? 1.0 : 0.4;
          return (i < 9 ? 4 : 6 + (i-9) * 0.8) * protectionFactor;
        }),
        // Wave height is much lower due to protection
        wave_height: Array.from({ length: 24 }, (_, i) => {
          const hour = i % 24;
          // Dynamically calculate direction for this hour
          const direction = hour < 10 ? 45 : 45 + ((hour - 10) * 15);
          // Only south winds (160-200) create significant waves at Astir
          const protectionFactor = (direction >= 160 && direction <= 200) ? 0.9 : 0.3;
          return (i < 10 ? 0.15 : 0.2 + (i-10) * 0.03) * protectionFactor;
        }),
        // Swell is much lower due to protection
        swell_wave_height: Array.from({ length: 24 }, (_, i) => {
          const hour = i % 24;
          // Dynamically calculate direction for this hour
          const direction = hour < 10 ? 45 : 45 + ((hour - 10) * 15);
          // Only south winds (160-200) create significant swell at Astir
          const protectionFactor = (direction >= 160 && direction <= 200) ? 0.8 : 0.2;
          return (i < 10 ? 0.07 : 0.12 + (i-10) * 0.02) * protectionFactor;
        }),
      },
      daily: {
        wave_height_max: [0.2], // Lower max wave height due to protection
        wave_direction_dominant: [170], // S direction (matches afternoon wind)
      }
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
        // Morning: 45° (NE), gradually shifting to 135° (SE) in afternoon
        winddirection_10m: Array.from({ length: 24 }, (_, i) => {
          const hour = i % 24;
          return hour < 10 ? 45 : 45 + ((hour - 10) * 10);
        }),
        // Wind speed varies by direction - stronger from SE
        windspeed_10m: Array.from({ length: 24 }, (_, i) => {
          const hour = i % 24;
          // Dynamically calculate direction for this hour
          const direction = hour < 10 ? 45 : 45 + ((hour - 10) * 10);
          // SE winds (90-135) are stronger at Vouliagmeni
          const exposureFactor = (direction >= 90 && direction <= 135) ? 1.3 : 0.7;
          return (5 + Math.sin(i/2) * 4) * exposureFactor; 
        }),
        wave_height: Array.from({ length: 24 }, (_, i) => {
          const hour = i % 24;
          // Dynamically calculate direction for this hour
          const direction = hour < 10 ? 45 : 45 + ((hour - 10) * 10);
          // SE winds (90-135) create bigger waves at Vouliagmeni
          const exposureFactor = (direction >= 90 && direction <= 135) ? 1.3 : 0.6;
          return (0.2 + Math.sin(i/6) * 0.1) * exposureFactor;
        }),
        swell_wave_height: Array.from({ length: 24 }, (_, i) => {
          const hour = i % 24;
          // Dynamically calculate direction for this hour
          const direction = hour < 10 ? 45 : 45 + ((hour - 10) * 10);
          // SE winds (90-135) create bigger swell at Vouliagmeni
          const exposureFactor = (direction >= 90 && direction <= 135) ? 1.2 : 0.5;
          return (0.1 + Math.sin(i/6) * 0.05) * exposureFactor;
        }),
      },
      daily: {
        wave_height_max: [0.3],
        wave_direction_dominant: [115], // ESE direction (matches afternoon wind)
      }
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
        winddirection_10m: Array.from({ length: 24 }, (_, i) => {
          // Gradually shifting wind direction through the day
          return 45 + (i * 5) % 360;  // Full rotation through the day
        }),
        wave_height: Array.from({ length: 24 }, (_, i) => 0.3 + Math.sin(i/12) * 0.1),
        swell_wave_height: Array.from({ length: 24 }, (_, i) => 0.2 + Math.sin(i/12) * 0.07),
      },
      daily: {
        wave_height_max: [0.4],
        wave_direction_dominant: [180], // S direction
      }
    }
  });

  // Greek coastal locations
  const suggestedLocations = [
    { name: "Kavouri Beach", latitude: 37.8207, longitude: 23.7686 },
    { name: "Vouliagmeni Beach", latitude: 37.8179, longitude: 23.7808 },
    { name: "Astir Beach", latitude: 37.8016, longitude: 23.7711 },
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
        "Unable to fetch real-time weather data. Using geographic-aware simulated data for this location."
      );

      // Fall back to demo data as a last resort
      let mockData;
      if (beach.name.includes("Kavouri")) {
        mockData = mockDataRef.current["Kavouri Beach"];
      } else if (beach.name.includes("Vouliagmeni")) {
        mockData = mockDataRef.current["Vouliagmeni Beach"];
      } else if (beach.name.includes("Astir")) {
        mockData = mockDataRef.current["Astir Beach"];
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

    // Score calculation based on the table in the requirements
    let score = 0;

    // Wind speed (up to 40 points) - now uses protected wind speed
    score += protectedWindSpeed < 8 ? 40 : Math.max(0, 40 - (protectedWindSpeed - 8) * (40 / 12));

    // Wave height (up to 20 points) - now uses protected wave height
    score +=
      protectedWaveHeight < 0.2 ? 20 : Math.max(0, 20 - (protectedWaveHeight - 0.2) * (20 / 0.4));

    // Swell height (up to 10 points) - now uses protected swell height
    score +=
      protectedSwellHeight < 0.3
        ? 10
        : Math.max(0, 10 - (protectedSwellHeight - 0.3) * (10 / 0.3));

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

    // Add ENHANCED geographic protection bonus (up to 15 points instead of 10)
    score += (geoProtection.protectionScore / 100) * 15;

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

  // Handle time range change via the modern date picker
  const handleTimeRangeChange = (newTimeRange) => {
    setTimeRange(newTimeRange);

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

  // Component to render geographic protection information
  const renderGeographicInfo = (beach, weatherData) => {
    if (!beach || !weatherData) return null;
    
    const avgWindDirection = weatherData.hourly.winddirection_10m.reduce((sum, val) => sum + val, 0) / 
                            weatherData.hourly.winddirection_10m.length;
    
    const waveDirection = weatherData.daily.wave_direction_dominant ? 
                        weatherData.daily.wave_direction_dominant[0] : 
                        avgWindDirection;
    
    const protection = calculateGeographicProtection(beach, avgWindDirection, waveDirection);
    
    return (
      <div className="bg-gray-50 p-4 rounded-lg mt-4">
        <h4 className="font-medium mb-3 flex items-center">
          <MapPin className="h-5 w-5 mr-2 text-blue-600" />
          Geographic Protection Analysis
        </h4>
        
        <ul className="space-y-2 text-sm">
          <li className="flex justify-between">
            <span>Bay Enclosure:</span>
            <span className={`font-medium ${protection.bayEnclosure > 0.6 ? 'text-green-600' : protection.bayEnclosure > 0.3 ? 'text-yellow-600' : 'text-red-600'}`}>
              {protection.bayEnclosure > 0.7 ? 'Well Protected' : protection.bayEnclosure > 0.4 ? 'Moderately Protected' : 'Exposed'}
            </span>
          </li>
          <li className="flex justify-between">
            <span>Wind Direction:</span>
            <span className="font-medium">
              {getCardinalDirection(avgWindDirection)} ({Math.round(avgWindDirection)}°)
              {protection.windProtection > 0.7 ? ' - Protected' : protection.windProtection > 0.3 ? ' - Partially Exposed' : ' - Fully Exposed'}
            </span>
          </li>
          <li className="flex justify-between">
            <span>Wave Direction:</span>
            <span className="font-medium">
              {getCardinalDirection(waveDirection)} ({Math.round(waveDirection)}°)
              {protection.waveProtection > 0.7 ? ' - Protected' : protection.waveProtection > 0.3 ? ' - Partially Exposed' : ' - Fully Exposed'}
            </span>
          </li>
          <li className="flex justify-between">
            <span>Overall Protection:</span>
            <span className={`font-medium ${protection.protectionScore > 70 ? 'text-green-600' : protection.protectionScore > 40 ? 'text-yellow-600' : 'text-red-600'}`}>
              {Math.round(protection.protectionScore)}/100
            </span>
          </li>
        </ul>
      </div>
    );
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

            {/* Modern Date Range Picker */}
            <div className="p-4 border-b">
              <DateRangePicker 
                initialValue={timeRange} 
                onChange={handleTimeRangeChange} 
              />
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
                  The app now considers geographic features like bay enclosure and coastal orientation
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
                        Using simulated data with geographic protection analysis
                      </>
                    )}
                  </div>
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

                {/* Geographic Protection Analysis */}
                {renderGeographicInfo(selectedBeach, weatherData)}

                {/* Beach Comparison Section */}
                {beaches.length > 1 && (
                  <div className="mt-6 bg-blue-50 p-4 rounded-lg border border-blue-100">
                    <h4 className="font-medium mb-3 flex items-center">
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
                              className="flex items-center justify-between p-2 bg-white rounded border cursor-pointer hover:bg-blue-50"
                              onClick={() => handleBeachSelect(otherBeach)}>
                            <span className="font-medium">{otherBeach.name}</span>
                            <span className={`text-sm px-2 py-1 rounded ${
                              comparison > 10 ? 'bg-green-100 text-green-800' : 
                              comparison < -10 ? 'bg-red-100 text-red-800' : 
                              'bg-gray-100 text-gray-800'
                            }`}>
                              {comparison > 10 ? 'May be better today' : 
                              comparison < -10 ? 'Likely worse today' : 
                              'Similar conditions'}
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
      <footer className="bg-blue-800 text-white p-4 mt-auto">
        <div className="container mx-auto text-center text-sm">
          <p>© 2025 Paddleboard Weather Advisor | Ladi Thalassa</p>
        </div>
      </footer>
    </div>
  );
};

export default App;

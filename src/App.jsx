import React, { useEffect, useMemo, useState } from "react";
import {
  Home,
  Map,
  MapPin,
  Smartphone,
  Plus,
  HelpCircle,
  Image as ImageIcon,
  LifeBuoy,
  ListChecks,
  Waves,
  Sparkles,
  Sunrise,
  Sun,
  Moon
} from "lucide-react";
import { useBeachManager } from "./BeachManager";
import FixedBeachView from "./FixedBeachView";
import { ErrorBoundary, DeleteConfirmationModal } from "./helpers.jsx";
import FAQ from "./FAQ"; // Import the new FAQ component
import { useTheme } from "./utils/themeContext.jsx";
import { useRankedDay } from "./useRankedDay.js";
import BestSpotCard from "./components/BestSpotCard.jsx";
import SpotRow from "./components/SpotRow.jsx";

const RECENT_SEARCH_KEY = "sup-recent-searches";

const App = () => {
  // State
  const [view, setView] = useState("dashboard");
  const [selectedBeach, setSelectedBeach] = useState(null);
  const [notification, setNotification] = useState(null);
  const [recentSearches, setRecentSearches] = useState([]);
  const [showSearchSuggestions, setShowSearchSuggestions] = useState(false);
  const [timeRange, setTimeRange] = useState(() => {
    const now = new Date();
    const startHour = now.getHours();
    const endHour = Math.min(startHour + 6, 23);
    return {
      date: now.toISOString().split("T")[0],
      startTime: `${String(startHour).padStart(2, "0")}:00`,
      endTime: `${String(endHour).padStart(2, "0")}:00`,
    };
  });
  const [lastUpdated, setLastUpdated] = useState(null);
  const [showFAQ, setShowFAQ] = useState(false); // New state for FAQ visibility
  const [locating, setLocating] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [sortOption, setSortOption] = useState("score");
  const [dayOffset, setDayOffset] = useState(0);
  const [highlightedBeachId, setHighlightedBeachId] = useState(null);
  const { theme, resolvedTheme, setTheme } = useTheme();
  const greekBounds = {
    latMin: 34.6,
    latMax: 41.9,
    lonMin: 19.0,
    lonMax: 29.8
  };
  
  
  // Format last updated time strings
  const formattedUpdateTime = lastUpdated ? 
    lastUpdated.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 
    "-";
  
  const formattedUpdateDate = lastUpdated ?
    lastUpdated.toLocaleDateString([], { year: 'numeric', month: 'long', day: 'numeric' }) :
    "-";
  
  // Use beach manager
  const { 
    beaches, 
    homeBeach, 
    setHomeBeach, 
    addBeach,
    addSuggestedBeach,
    deleteBeach,
    confirmDelete,
    cancelDelete,
    deleteConfirm,
    newBeach,
    setNewBeach,
    mapUrl,
    setMapUrl,
    handleExtractCoordinates,
    loading: beachLoading
  } = useBeachManager();
  
  // Toast notification
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

  const rememberSearchTerm = (term) => {
    const value = term.trim();
    if (!value) return;
    setRecentSearches((prev) => {
      const updated = [value, ...prev.filter((item) => item.toLowerCase() !== value.toLowerCase())];
      return updated.slice(0, 6);
    });
  };

  const handleSearchChange = (value) => {
    setSearchTerm(value);
    setShowSearchSuggestions(true);
  };

  // The day we are planning for. Everything on the dashboard is scored
  // against this date, so switching it re-ranks the whole list.
  const dayISO = useMemo(() => {
    const date = new Date();
    date.setDate(date.getDate() + dayOffset);
    return date.toISOString().split("T")[0];
  }, [dayOffset]);

  const {
    entries: rankedEntries,
    loading: rankingLoading,
    lastUpdated: rankedUpdatedAt
  } = useRankedDay(beaches, dayISO);

  const visibleEntries = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();
    const matches = query
      ? rankedEntries.filter(({ beach }) =>
          beach.name.toLowerCase().includes(query) ||
          `${beach.latitude.toFixed(2)},${beach.longitude.toFixed(2)}`.includes(query))
      : rankedEntries;

    switch (sortOption) {
      case "alpha":
        return [...matches].sort((a, b) => a.beach.name.localeCompare(b.beach.name));
      case "recent":
        return [...matches].sort((a, b) => (b.beach.createdAt || 0) - (a.beach.createdAt || 0));
      case "score":
      default:
        return matches;
    }
  }, [rankedEntries, searchTerm, sortOption]);

  // The card at the top follows your selection, defaulting to the day's best.
  const heroEntry = useMemo(() => {
    if (!rankedEntries.length) return null;
    return rankedEntries.find(({ beach }) => beach.id === highlightedBeachId) ?? rankedEntries[0];
  }, [rankedEntries, highlightedBeachId]);

  const searchSuggestions = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();
    const nameSuggestions = beaches
      .filter((beach) => beach.name.toLowerCase().includes(query))
      .map((beach) => beach.name);
    const recents = recentSearches.filter((item) => item.toLowerCase().includes(query));

    return Array.from(new Set([...recents, ...nameSuggestions])).slice(0, 7);
  }, [beaches, recentSearches, searchTerm]);

  const handleSearchSubmit = () => rememberSearchTerm(searchTerm);

  const handleSearchSuggestionClick = (value) => {
    handleSearchChange(value);
    rememberSearchTerm(value);
    setShowSearchSuggestions(false);
  };

  const clearRecentSearches = () => setRecentSearches([]);

  const handleSearchKeyDown = (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      handleSearchSubmit();
      setShowSearchSuggestions(false);
    }
    if (event.key === "Escape") {
      setShowSearchSuggestions(false);
    }
  };

  const hasBeaches = beaches.length > 0;

  const headerSubtitle = useMemo(() => {
    const dayName = new Date(`${dayISO}T12:00:00`).toLocaleDateString(undefined, {
      weekday: "long", day: "numeric", month: "long"
    });
    const spots = beaches.length === 1 ? "1 spot" : `${beaches.length} spots`;
    return `${dayName} · ${spots}`;
  }, [dayISO, beaches.length]);

  const knowledgeCards = [
    {
      title: "Pre-paddle checks",
      icon: ListChecks,
      bullets: [
        "Check leash, fin and paddle length before leaving the shore.",
        "Confirm your forecast window matches your planned route.",
        "Share launch and return times with a paddle buddy."
      ]
    },
    {
      title: "On-the-water focus",
      icon: Waves,
      bullets: [
        "Face the wind on the way out so you finish with a tail breeze.",
        "Use sheltered coves or moored boats as wind breaks when it picks up.",
        "Keep 360° awareness for boat traffic and swimmers."
      ]
    },
    {
      title: "Safety essentials",
      icon: LifeBuoy,
      bullets: [
        "Wear a PFD and leash every session—no exceptions.",
        "Carry a waterproof phone or VHF in a dry bag.",
        "Pack hydration, snacks and sun protection for longer paddles."
      ]
    }
  ];

  useEffect(() => {
    try {
      const stored = localStorage.getItem(RECENT_SEARCH_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) {
          setRecentSearches(parsed);
        }
      }
    } catch (error) {
      console.error("Failed to load recent searches", error);
    }
  }, []);

  useEffect(() => {
    try {
      if (recentSearches.length) {
        localStorage.setItem(RECENT_SEARCH_KEY, JSON.stringify(recentSearches));
      } else {
        localStorage.removeItem(RECENT_SEARCH_KEY);
      }
    } catch (error) {
      console.error("Failed to persist recent searches", error);
    }
  }, [recentSearches]);
  
  useEffect(() => {
    if (rankedUpdatedAt) setLastUpdated(rankedUpdatedAt);
  }, [rankedUpdatedAt]);

  // Function to update the last updated timestamp
  const handleDataUpdate = () => {
    setLastUpdated(new Date());
  };
  
  
  // Function to toggle FAQ visibility
  const toggleFAQ = () => {
    setShowFAQ(!showFAQ);
  };
  
  // Handle beach selection
  const handleBeachSelect = (beach) => {
    if (!beach || !beach.latitude || !beach.longitude) {
      toast.error("Invalid beach data. Please try adding this beach again.");
      return;
    }
    
    setSelectedBeach(beach);
    setView("detail");
  };
  
  // Handle setting home beach
  const handleSetHomeBeach = (beach) => {
    setHomeBeach(beach);
    toast.success(`${beach.name} set as home beach!`);
    handleDataUpdate();
  };
  
  // Handle time range change with basic validation
  const handleTimeRangeChange = (field, value) => {
    const updated = { ...timeRange, [field]: value };
    const start = parseInt(updated.startTime.split(':')[0], 10);
    const end = parseInt(updated.endTime.split(':')[0], 10);

    // Prevent selecting a start time after the end time or vice versa
    if (start > end) {
      if (field === 'startTime') {
        updated.endTime = value;
      } else if (field === 'endTime') {
        updated.startTime = value;
      }
    }

    setTimeRange(updated);
  };
  
  // Handle add beach
  const handleAddBeach = async () => {
    try {
      const beach = await addBeach(newBeach);
      toast.success(`Added ${beach.name} to your beaches!`);
      handleDataUpdate();
      setView("dashboard");
    } catch (error) {
      toast.error(error.message);
    }
  };
  
  // Handle add suggested beach
  const handleAddSuggested = async (location) => {
    try {
      const beach = await addSuggestedBeach(location);
      toast.success(`Added ${beach.name} to your beaches!`);
      handleDataUpdate();
      setView("dashboard");
    } catch (error) {
      toast.error(error.message);
    }
  };

  const describeGreekRegion = (latitude, longitude) => {
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return "";

    if (longitude < 21) return "Ionian Sea";
    if (latitude > 40.5) return "North Aegean";
    if (latitude < 37 && longitude > 25) return "Cyclades / Dodecanese";
    if (latitude < 36.6 && longitude < 25) return "Crete & Libyan Sea";
    return "Central Aegean";
  };

  const greekReadiness = useMemo(() => {
    const lat = parseFloat(newBeach.latitude);
    const lon = parseFloat(newBeach.longitude);

    if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
      return {
        state: "idle",
        message: "Paste a Google Maps link or drop coordinates to check the spot.",
        region: null,
        previewUrl: null
      };
    }

    const inGreece =
      lat >= greekBounds.latMin &&
      lat <= greekBounds.latMax &&
      lon >= greekBounds.lonMin &&
      lon <= greekBounds.lonMax;

    const region = describeGreekRegion(lat, lon);
    const bboxPadding = 0.08;
    const previewUrl = `https://www.openstreetmap.org/export/embed.html?bbox=${lon - bboxPadding}%2C${lat - bboxPadding}%2C${lon + bboxPadding}%2C${lat + bboxPadding}&layer=mapnik&marker=${lat}%2C${lon}`;

    return {
      state: inGreece ? "ready" : "warn",
      message: inGreece
        ? "Looks like a Greek shoreline—forecast + coastline analysis will run correctly."
        : "Coordinates sit outside the usual Greek bounds. Double‑check before saving.",
      region,
      previewUrl
    };
  }, [newBeach.latitude, newBeach.longitude, greekBounds.latMax, greekBounds.latMin, greekBounds.lonMax, greekBounds.lonMin]);

  // Find and add the nearest recommended spot using browser geolocation
  const handleFindNearest = () => {
    if (!navigator.geolocation) {
      toast.error("Geolocation not supported by your browser");
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude, longitude } = pos.coords;
        const toRad = (deg) => deg * Math.PI / 180;
        const distance = (lat1, lon1, lat2, lon2) => {
          const R = 6371;
          const dLat = toRad(lat2 - lat1);
          const dLon = toRad(lon2 - lon1);
          const a = Math.sin(dLat / 2) ** 2 +
            Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
            Math.sin(dLon / 2) ** 2;
          return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        };

        let nearest = suggestedLocations[0];
        let minDist = distance(latitude, longitude, nearest.latitude, nearest.longitude);
        for (const loc of suggestedLocations.slice(1)) {
          const d = distance(latitude, longitude, loc.latitude, loc.longitude);
          if (d < minDist) {
            minDist = d;
            nearest = loc;
          }
        }
        setLocating(false);
        if (window.confirm(`Add ${nearest.name} to your locations?`)) {
          handleAddSuggested(nearest);
        }
      },
      (err) => {
        console.error('Geolocation error', err);
        toast.error('Unable to retrieve your location');
        setLocating(false);
      }
    );
  };
  
  // Handle delete beach
  const handleDeleteBeach = (beachId) => {
    deleteBeach(beachId);
  };
  
  // Confirm delete beach
  const handleConfirmDelete = (beachId) => {
    const name = confirmDelete(beachId);
    
    // If selected beach is deleted, go back to dashboard
    if (selectedBeach && selectedBeach.id === beachId) {
      setSelectedBeach(null);
      setView("dashboard");
    }
    
    handleDataUpdate();
    toast.success(`Removed ${name}`);
  };

  // Greek coastal locations with correct Google Maps URLs
  const suggestedLocations = [
    { name: "Kavouri Beach", latitude: 37.8235, longitude: 23.7761, googleMapsUrl: "https://maps.app.goo.gl/KP6MpuG6mgrv1Adm6" },
    { name: "Glyfada Beach", latitude: 37.8650, longitude: 23.7470, googleMapsUrl: "https://maps.app.goo.gl/yEXLZW5kwBArCHvb7" },
    { name: "Astir Beach", latitude: 37.8095, longitude: 23.7850, googleMapsUrl: "https://maps.app.goo.gl/6uUbtp31MQ63gGBSA" },
    { name: "Kapsali Beach", latitude: 36.1360, longitude: 22.9980, googleMapsUrl: "https://maps.app.goo.gl/xcs6EqYy8LbzYq2y6" },
    { name: "Palaiopoli Beach", latitude: 36.2260, longitude: 23.0410, googleMapsUrl: "https://maps.app.goo.gl/TPFetRbFcyAXdgNDA" },
    // CORRECTED Vathy Bay coordinates pointing to the inner harbor
    { name: "Vathy Bay (Sifnos)", latitude: 36.9386, longitude: 24.6750, googleMapsUrl: "https://www.google.com/maps/place/Vathy+Bay/@36.9386,24.6750,15z" },
    // Additional highly protected bays
    { name: "Naoussa Bay (Paros)", latitude: 37.1232, longitude: 25.2355, googleMapsUrl: "https://www.google.com/maps/place/Naoussa+Bay/@37.1232,25.2355,15z" },
    { name: "Vlikhos Bay (Hydra)", latitude: 37.3255, longitude: 23.4486, googleMapsUrl: "https://www.google.com/maps/place/Vlikhos+Bay/@37.3255,23.4486,15z" },
    { name: "Portello Beach", latitude: 36.6870, longitude: 23.0563, googleMapsUrl: "https://www.google.com/maps/place/Portello+Beach/@36.6869999,23.0562731,17z/data=!3m1!4b1!4m6!3m5!1s0x149e41849bab6a23:0xaa5fecae3027dece!8m2!3d36.6869999!4d23.0562731!16s%2Fg%2F11j_6hrp8k" },
  ];

  return (
    <div
      className={`flex flex-col min-h-screen transition-colors ${
        resolvedTheme === "dark"
          ? "bg-slate-950 text-slate-100"
          : "bg-blue-50 text-gray-900"
      }`}
    >
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
          onConfirm={handleConfirmDelete}
          onCancel={cancelDelete}
        />
      )}
      
      {/* FAQ Modal */}
      <FAQ isOpen={showFAQ} onClose={() => setShowFAQ(false)} />
      
      {/* Header */}
      <header className="bg-blue-600 text-white shadow-md dark:bg-slate-900">
        <div className="container mx-auto flex items-center gap-3 px-4 py-2.5">
          <button
            type="button"
            onClick={() => setView("dashboard")}
            className="flex min-w-0 flex-grow items-center gap-2.5 text-left"
            aria-label="Go to dashboard"
          >
            <Waves className="h-6 w-6 flex-shrink-0" aria-hidden />
            <span className="flex min-w-0 flex-col">
              <span className="truncate text-[15px] font-bold leading-tight sm:text-lg">
                <span className="sm:hidden">Paddleboard</span>
                <span className="hidden sm:inline">Paddleboard Weather Advisor</span>
              </span>
              <span className="truncate text-[11px] leading-tight text-blue-100">
                {headerSubtitle}
              </span>
            </span>
          </button>
          <nav className="flex flex-shrink-0 items-center gap-2">
            <button
              onClick={toggleFAQ}
              className="p-2 rounded-full hover:bg-blue-700 transition"
              title="Help & FAQ"
            >
              <HelpCircle className="h-5 w-5" />
            </button>
            <div className="flex items-center gap-1 rounded-full bg-white/10 px-2 py-1 text-xs font-semibold uppercase tracking-wide">
              <span className="sr-only">Theme selection</span>
              <button
                type="button"
                aria-label="Use light theme"
                aria-pressed={theme === "light"}
                onClick={() => setTheme("light")}
                className={`flex items-center gap-1 rounded-full px-2 py-1 transition ${
                  theme === "light"
                    ? "bg-white/80 text-blue-700"
                    : "text-white hover:bg-white/20"
                }`}
              >
                <Sun className="h-4 w-4" />
                <span className="hidden sm:inline">Light</span>
              </button>
              <button
                type="button"
                aria-label="Use system theme"
                aria-pressed={theme === "system"}
                onClick={() => setTheme("system")}
                className={`flex items-center gap-1 rounded-full px-2 py-1 transition ${
                  theme === "system"
                    ? "bg-white/80 text-blue-700"
                    : "text-white hover:bg-white/20"
                }`}
              >
                <Sparkles className="h-4 w-4" />
                <span className="hidden sm:inline">Auto</span>
              </button>
              <button
                type="button"
                aria-label="Use dark theme"
                aria-pressed={theme === "dark"}
                onClick={() => setTheme("dark")}
                className={`flex items-center gap-1 rounded-full px-2 py-1 transition ${
                  theme === "dark"
                    ? "bg-white/80 text-blue-700"
                    : "text-white hover:bg-white/20"
                }`}
              >
                <Moon className="h-4 w-4" />
                <span className="hidden sm:inline">Dark</span>
              </button>
            </div>
            <button
              onClick={() => setView("dashboard")}
              className={`hidden rounded-lg px-3 py-1.5 text-sm transition-colors duration-200 md:block ${
                view === "dashboard" ? "bg-blue-800" : "hover:bg-blue-700"
              }`}
            >
              Dashboard
            </button>
            <button
              onClick={() => setView("add")}
              className={`hidden rounded-lg px-3 py-1.5 text-sm transition-colors duration-200 md:block ${
                view === "add" ? "bg-blue-800" : "hover:bg-blue-700"
              }`}
            >
              Add Beach
            </button>
          </nav>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-grow container mx-auto p-4 pb-28 md:pb-4">
        {view === "dashboard" && (
          <div className="space-y-6">
            <div className="flex gap-1 rounded-[10px] bg-blue-100 p-[3px] dark:bg-slate-800" role="tablist" aria-label="Forecast day">
              {[
                { offset: 0, label: "Today" },
                { offset: 1, label: "Tomorrow" }
              ].map((option) => (
                <button
                  key={option.offset}
                  type="button"
                  role="tab"
                  aria-selected={dayOffset === option.offset}
                  onClick={() => {
                    setDayOffset(option.offset);
                    setHighlightedBeachId(null);
                  }}
                  className={`h-9 flex-1 rounded-lg text-[13px] font-semibold transition ${
                    dayOffset === option.offset
                      ? "bg-white text-blue-700 shadow-sm dark:bg-slate-700 dark:text-blue-200"
                      : "text-blue-700/70 hover:text-blue-700 dark:text-slate-300 dark:hover:text-slate-100"
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>

            {hasBeaches && heroEntry && (
              <BestSpotCard
                beach={heroEntry.beach}
                summary={heroEntry.summary}
                isTopRanked={heroEntry.beach.id === rankedEntries[0]?.beach.id}
                dayLabel={dayOffset === 0 ? "today" : "tomorrow"}
                loading={rankingLoading}
                onOpen={handleBeachSelect}
              />
            )}

            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="relative flex-1">
                <label htmlFor="beach-search" className="sr-only">Search beaches</label>
                <input
                  id="beach-search"
                  type="search"
                  value={searchTerm}
                  onChange={(event) => handleSearchChange(event.target.value)}
                  onKeyDown={handleSearchKeyDown}
                  onFocus={() => setShowSearchSuggestions(true)}
                  onBlur={() => setTimeout(() => setShowSearchSuggestions(false), 120)}
                  placeholder={hasBeaches ? "Search saved spots" : "Search by name or coordinates"}
                  aria-autocomplete="list"
                  aria-expanded={showSearchSuggestions && searchSuggestions.length > 0}
                  aria-owns="beach-search-suggestions"
                  className="w-full rounded-lg border border-blue-100 bg-white px-3 py-2 text-sm shadow-sm focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-200 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:placeholder:text-slate-400 dark:focus:border-blue-500"
                />
                <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-xs text-blue-400 dark:text-blue-200">
                  {hasBeaches
                    ? `${visibleEntries.length}/${beaches.length}`
                    : 'No spots yet'}
                </span>
                {showSearchSuggestions && searchSuggestions.length > 0 && (
                  <div
                    id="beach-search-suggestions"
                    className="absolute left-0 right-0 z-20 mt-2 rounded-lg border border-blue-100 bg-white shadow-lg dark:border-slate-700 dark:bg-slate-800"
                  >
                    <div className="flex items-center justify-between px-3 py-2 text-xs font-semibold uppercase tracking-wide text-blue-800 dark:text-slate-200">
                      <span>Recent & suggestions</span>
                      {recentSearches.length > 0 && (
                        <button
                          type="button"
                          onMouseDown={(event) => event.preventDefault()}
                          onClick={clearRecentSearches}
                          className="text-blue-600 hover:underline dark:text-blue-200"
                        >
                          Clear
                        </button>
                      )}
                    </div>
                    <ul className="divide-y divide-blue-50 dark:divide-slate-700">
                      {searchSuggestions.map((suggestion) => (
                        <li key={suggestion}>
                          <button
                            type="button"
                            onMouseDown={(event) => event.preventDefault()}
                            onClick={() => handleSearchSuggestionClick(suggestion)}
                            className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-gray-700 transition hover:bg-blue-50 dark:text-slate-100 dark:hover:bg-slate-700"
                          >
                            <MapPin className="h-4 w-4 text-blue-500" aria-hidden="true" />
                            <span>{suggestion}</span>
                          </button>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
              <div className="flex items-center gap-2">
                <label htmlFor="beach-sort" className="text-xs font-semibold uppercase tracking-wide text-blue-900 dark:text-slate-200">
                  Sort by
                </label>
                <select
                  id="beach-sort"
                  value={sortOption}
                  onChange={(event) => setSortOption(event.target.value)}
                  className="rounded-lg border border-blue-100 bg-white px-3 py-2 text-sm shadow-sm focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-200 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:focus:border-blue-500"
                >
                  <option value="score">Today's score</option>
                  <option value="alpha">Alphabetical</option>
                  <option value="recent">Recently added</option>
                </select>
              </div>
            </div>

            {hasBeaches ? (
              visibleEntries.length === 0 ? (
                <div className="rounded-2xl border bg-white p-8 text-center shadow-sm dark:border-slate-700 dark:bg-slate-800">
                  <h3 className="text-xl font-semibold text-gray-800 dark:text-slate-100">No matches found</h3>
                  <p className="mt-2 text-sm text-gray-600 dark:text-slate-300">
                    Try a different beach name, adjust your spelling, or clear the search to see all saved launches.
                  </p>
                  <button
                    onClick={() => setSearchTerm("")}
                    className="mt-4 inline-flex items-center rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700"
                  >
                    Clear search
                  </button>
                </div>
              ) : (
                <div className="flex flex-col gap-2">
                  {visibleEntries.map((entry, index) => (
                    <SpotRow
                      key={entry.beach.id}
                      rank={index + 1}
                      beach={entry.beach}
                      summary={entry.summary}
                      status={entry.status}
                      isHome={entry.beach.id === homeBeach?.id}
                      isSelected={entry.beach.id === heroEntry?.beach.id}
                      isDark={resolvedTheme === "dark"}
                      onSelect={(beach) => setHighlightedBeachId(beach.id)}
                      onOpen={handleBeachSelect}
                      onDelete={handleDeleteBeach}
                    />
                  ))}
                </div>
              )
            ) : (
              <div className="rounded-2xl border bg-white p-8 text-center shadow-sm dark:border-slate-700 dark:bg-slate-800">
                <h2 className="text-2xl font-bold text-gray-800 dark:text-slate-100">No beaches saved yet</h2>
                <p className="mt-2 text-gray-600 dark:text-slate-300">
                  Add your favourite paddleboarding launches and they will be scored and ranked here every day.
                </p>
                <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-center">
                  <button
                    onClick={() => setView("add")}
                    className="rounded-lg bg-blue-600 px-6 py-3 text-white shadow hover:bg-blue-700"
                  >
                    Add manually
                  </button>
                  <button
                    onClick={handleFindNearest}
                    disabled={locating}
                    className={`rounded-lg border px-6 py-3 ${
                      locating
                        ? 'border-blue-100 text-blue-300 dark:border-slate-600 dark:text-slate-500'
                        : 'border-blue-200 text-blue-600 hover:bg-blue-50 dark:border-slate-600 dark:text-blue-300 dark:hover:bg-slate-700'
                    }`}
                  >
                    {locating ? 'Locating…' : 'Use my location'}
                  </button>
                </div>
                <p className="mt-4 text-sm text-gray-500 dark:text-slate-400">
                  Or open <span className="font-medium">Add Beach</span> to browse curated Greek bays ready to import.
                </p>
              </div>
            )}

            <div className="grid gap-4 md:grid-cols-3">
              {knowledgeCards.map((card) => {
                const Icon = card.icon;
                return (
                  <div
                    key={card.title}
                    className="rounded-2xl border border-blue-100 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-800"
                  >
                    <h3 className="flex items-center text-lg font-semibold text-gray-800 dark:text-slate-100">
                      <Icon className="mr-2 h-5 w-5 text-blue-500" /> {card.title}
                    </h3>
                    <ul className="mt-3 space-y-2 text-sm text-gray-600 dark:text-slate-300">
                      {card.bullets.map((bullet) => (
                        <li key={bullet} className="leading-relaxed">{bullet}</li>
                      ))}
                    </ul>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {view === "add" && (
          <div className="bg-white rounded-2xl shadow-lg border border-blue-50 dark:bg-slate-800 dark:border-slate-700">
            <div className="p-4 border-b flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between dark:border-slate-700">
              <div>
                <h2 className="text-xl font-semibold flex items-center dark:text-slate-100">
                  <Plus className="h-5 w-5 mr-2 text-blue-500" />
                  Add New Beach
                </h2>
                <p className="text-sm text-gray-600 dark:text-slate-300">Optimised for Greek coastlines. Works with any bay—from Epirus to Rhodes.</p>
              </div>
              <div className="flex items-center gap-2 text-xs text-blue-700 dark:text-blue-300">
                <Smartphone className="h-4 w-4" /> Mobile-friendly form
              </div>
            </div>

            <div className="p-4 space-y-6">
              <div className="grid gap-6 lg:grid-cols-2">
                <div className="rounded-2xl bg-white shadow-sm border border-blue-100 p-6 dark:bg-slate-800 dark:border-slate-700">
                  <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                    <div>
                      <h3 className="text-xl font-semibold text-gray-800 dark:text-slate-100">Add a Greek beach</h3>
                      <p className="text-sm text-gray-600 dark:text-slate-300">Paste a Google Maps link or enter coordinates. Works for every shoreline in Greece—ionian coves, windy Cyclades and calm mainland bays.</p>
                    </div>
                    <div className="flex items-center gap-2 text-sm text-blue-700 dark:text-blue-300">
                      <MapPin className="h-4 w-4" />
                      <span>Aegean & Ionian ready</span>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div className="flex flex-col gap-2 rounded-xl border border-blue-100 bg-blue-50/60 p-4 text-sm text-blue-800 dark:border-slate-600 dark:bg-blue-900/30 dark:text-blue-200">
                      <div className="flex items-center gap-2 font-semibold text-blue-900 dark:text-blue-100">
                        <Sparkles className="h-4 w-4" /> Fast lane
                      </div>
                      <p>Drop a Maps link and we auto-fill the name and coordinates. Anything inside Greece works—the checker below flags out-of-bounds spots.</p>
                    </div>

                    <div className="flex flex-col gap-2 sm:flex-row">
                      <input
                        type="url"
                        value={mapUrl}
                        onChange={(e) => setMapUrl(e.target.value)}
                        placeholder="Paste Google Maps URL here..."
                        className="flex-grow rounded-lg border px-3 py-3 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200 dark:bg-slate-700 dark:border-slate-600 dark:text-slate-100 dark:placeholder:text-slate-400"
                      />
                      <button
                        onClick={handleExtractCoordinates}
                        className="rounded-lg bg-blue-600 px-4 py-3 text-sm font-semibold text-white hover:bg-blue-700 transition-colors"
                        disabled={beachLoading}
                      >
                        {beachLoading ? 'Analyzing...' : 'Extract'}
                      </button>
                    </div>
                    {beachLoading && (
                      <p className="text-xs text-blue-600 mt-2 dark:text-blue-300">
                        Analyzing coastline and geographic protection...
                      </p>
                    )}
                  </div>
                </div>

                <div className="flex items-center justify-center rounded-2xl border border-dashed border-blue-200 bg-gradient-to-br from-blue-50 to-white p-6 text-center dark:border-slate-600 dark:from-slate-800 dark:to-slate-900">
                  <div className="space-y-3 max-w-md">
                    <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-white shadow-sm text-blue-600 dark:bg-slate-700">
                      <Map className="h-5 w-5" />
                    </div>
                    <p className="text-base font-semibold text-blue-900 dark:text-slate-100">Tap to add from your phone</p>
                    <p className="text-sm text-gray-600 dark:text-slate-300">Works on iPhone: paste a Maps link, confirm the preview, and save. The layout stays thumb-friendly.</p>
                    <button
                      onClick={handleFindNearest}
                      className="w-full rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow hover:bg-blue-700"
                      disabled={locating}
                    >
                      {locating ? 'Finding nearest location...' : 'Use my current location'}
                    </button>
                  </div>
                </div>
              </div>

              <div className="grid gap-4 lg:grid-cols-3">
                <div className="lg:col-span-2 bg-white p-4 rounded-lg border shadow-sm dark:bg-slate-800 dark:border-slate-700">
                  <div className="grid gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1 dark:text-slate-200">
                        Beach Name
                      </label>
                      <input
                        type="text"
                        value={newBeach.name}
                        onChange={(e) =>
                          setNewBeach({ ...newBeach, name: e.target.value })
                        }
                        placeholder="e.g., Kavouri Beach"
                        className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-slate-700 dark:border-slate-600 dark:text-slate-100 dark:placeholder:text-slate-400"
                      />
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1 dark:text-slate-200">
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
                          className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-slate-700 dark:border-slate-600 dark:text-slate-100 dark:placeholder:text-slate-400"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1 dark:text-slate-200">
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
                          className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-slate-700 dark:border-slate-600 dark:text-slate-100 dark:placeholder:text-slate-400"
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
                          ? "bg-gray-300 text-gray-500 cursor-not-allowed dark:bg-slate-600 dark:text-slate-400"
                          : "bg-blue-600 text-white hover:bg-blue-700 transition-colors"
                      }`}
                    >
                      Add Beach
                    </button>
                  </div>
                </div>

                <div className="space-y-3 rounded-lg border border-blue-100 bg-gradient-to-b from-blue-50 to-white p-4 shadow-sm dark:border-slate-700 dark:from-slate-800 dark:to-slate-900">
                  <div className="flex items-center gap-2 text-blue-900 dark:text-blue-200">
                    <Sunrise className="h-5 w-5" />
                    <p className="font-semibold">Greek beach checker</p>
                  </div>
                  <p className="text-sm text-gray-700 dark:text-slate-300">We sanity-check your coordinates. Anything within {greekBounds.latMin}°–{greekBounds.latMax}° N and {greekBounds.lonMin}°–{greekBounds.lonMax}° E is Greek territory.</p>
                  <div
                    className={`rounded-lg border p-3 text-sm ${
                      greekReadiness.state === "ready"
                        ? "border-green-200 bg-green-50 text-green-800"
                        : greekReadiness.state === "warn"
                          ? "border-amber-200 bg-amber-50 text-amber-800"
                          : "border-blue-100 bg-white text-blue-800"
                    }`}
                  >
                    <p className="font-semibold">{greekReadiness.region || "Waiting for coordinates"}</p>
                    <p className="text-xs leading-5">{greekReadiness.message}</p>
                    {greekReadiness.previewUrl && (
                      <div className="mt-3 overflow-hidden rounded-lg border">
                        <iframe
                          title="Greek beach preview"
                          src={greekReadiness.previewUrl}
                          className="h-48 w-full"
                          loading="lazy"
                        />
                      </div>
                    )}
                  </div>
                  <div className="flex items-start gap-2 text-xs text-gray-600 dark:text-slate-400">
                    <ImageIcon className="mt-0.5 h-4 w-4 text-blue-500" />
                    <p>Preview uses OpenStreetMap tiles so you can visually verify coves before saving.</p>
                  </div>
                </div>
              </div>

              <div className="border-t pt-6 dark:border-slate-700">
                <h3 className="text-lg font-medium mb-3 dark:text-slate-100">
                  Popular Greek Beaches
                </h3>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {suggestedLocations.map((location, index) => (
                    <div
                      key={index}
                      className="bg-white border rounded-lg p-4 hover:bg-blue-50 hover:border-blue-300 cursor-pointer transition shadow-sm dark:bg-slate-800 dark:border-slate-700 dark:hover:bg-slate-700 dark:hover:border-slate-600"
                      onClick={() => handleAddSuggested(location)}
                    >
                      <h4 className="font-medium text-blue-700 dark:text-blue-300">{location.name}</h4>
                      <p className="text-sm text-gray-500 mb-2 dark:text-slate-400">
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
          <ErrorBoundary>
            <FixedBeachView 
              beach={selectedBeach}
              homeBeach={homeBeach}
              onSetHomeBeach={handleSetHomeBeach}
              setView={setView}
              timeRange={timeRange}
              onTimeRangeChange={handleTimeRangeChange}
              onDataUpdate={handleDataUpdate}
            />
          </ErrorBoundary>
        )}
      </main>

      {/* Mobile quick actions */}
      <div className="fixed inset-x-4 bottom-4 z-40 md:hidden">
        <div className="flex items-center justify-between rounded-2xl border border-blue-100 bg-white p-3 shadow-xl backdrop-blur dark:border-slate-700 dark:bg-slate-800">
          <button
            onClick={() => setView("dashboard")}
            className={`flex flex-1 items-center justify-center gap-1 rounded-xl px-3 py-2 text-sm font-semibold ${
              view === "dashboard" ? "bg-blue-50 text-blue-700 dark:bg-blue-900/40 dark:text-blue-200" : "text-blue-800 hover:bg-blue-50 dark:text-slate-200 dark:hover:bg-slate-700"
            }`}
          >
            <Home className="h-4 w-4" />
            Home
          </button>
          <button
            onClick={() => setView("add")}
            className={`flex flex-1 items-center justify-center gap-1 rounded-xl px-3 py-2 text-sm font-semibold ${
              view === "add" ? "bg-blue-50 text-blue-700 dark:bg-blue-900/40 dark:text-blue-200" : "text-blue-800 hover:bg-blue-50 dark:text-slate-200 dark:hover:bg-slate-700"
            }`}
          >
            <Plus className="h-4 w-4" />
            Add
          </button>
          <button
            onClick={handleFindNearest}
            className="flex flex-1 items-center justify-center gap-1 rounded-xl px-3 py-2 text-sm font-semibold text-blue-800 hover:bg-blue-50 dark:text-slate-200 dark:hover:bg-slate-700"
            disabled={locating}
          >
            <MapPin className="h-4 w-4" />
            {locating ? "Locating" : "Nearby"}
          </button>
          <button
            onClick={toggleFAQ}
            className="flex flex-1 items-center justify-center gap-1 rounded-xl px-3 py-2 text-sm font-semibold text-blue-800 hover:bg-blue-50 dark:text-slate-200 dark:hover:bg-slate-700"
          >
            <HelpCircle className="h-4 w-4" />
            Help
          </button>
        </div>
      </div>

      {/* Footer with Last Updated Time */}
      <footer className="bg-blue-800 text-white p-4 mt-auto shadow-inner">
        <div className="container mx-auto flex flex-col sm:flex-row justify-between items-center">
          <p className="text-sm">
            © 2025 Paddleboard Weather Advisor | Ladi Thalassa
          </p>
          <div className="flex items-center mt-2 sm:mt-0 text-xs">
            <span className="text-blue-400 border-r border-blue-600 pr-3 mr-3" title="Scoring algorithm version">
              v1.4 · Jan 15, 2026
            </span>
            <span className="text-blue-300 border-r border-blue-600 pr-3 mr-3">
              {lastUpdated ? (
                <>Data: {formattedUpdateDate} {formattedUpdateTime} </>
              ) : (
                <>No updates yet</>
              )}
            </span>
            <button
              onClick={toggleFAQ}
              className="text-blue-300 hover:text-white px-3 py-1 rounded-lg hover:bg-blue-700 ml-3"
            >
              FAQ
            </button>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default App;

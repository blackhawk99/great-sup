import React, { useMemo, useState } from "react";
import {
  Home,
  Map,
  MapPin,
  Plus,
  Trash2,
  HelpCircle,
  Compass,
  LifeBuoy,
  ListChecks,
  Waves
} from "lucide-react";
import { useBeachManager } from "./BeachManager";
import FixedBeachView from "./FixedBeachView";
import { ErrorBoundary, DeleteConfirmationModal } from "./helpers.jsx";
import FAQ from "./FAQ"; // Import the new FAQ component

const App = () => {
  // State
  const [view, setView] = useState("dashboard");
  const [selectedBeach, setSelectedBeach] = useState(null);
  const [notification, setNotification] = useState(null);
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
  const [sortOption, setSortOption] = useState("shelter");
  
  
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

  const getShelterScore = (beach) => {
    if (typeof beach.protectionScore === "number") {
      return beach.protectionScore;
    }
    if (typeof beach.bayEnclosure === "number") {
      return Math.round(beach.bayEnclosure * 100);
    }
    return null;
  };

  const shelteredCount = beaches.filter((beach) => {
    const score = getShelterScore(beach);
    return typeof score === "number" && score >= 60;
  }).length;

  const sortedBeaches = useMemo(() => {
    const beachesCopy = [...beaches];

    switch (sortOption) {
      case "alpha":
        return beachesCopy.sort((a, b) => a.name.localeCompare(b.name));
      case "recent":
        return beachesCopy.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
      case "shelter":
      default:
        return beachesCopy.sort((a, b) => {
          const shelterA = getShelterScore(a);
          const shelterB = getShelterScore(b);

          if (typeof shelterA === "number" && typeof shelterB === "number") {
            return shelterB - shelterA;
          }

          if (typeof shelterA === "number") return -1;
          if (typeof shelterB === "number") return 1;
          return a.name.localeCompare(b.name);
        });
    }
  }, [beaches, sortOption]);

  const filteredBeaches = useMemo(() => {
    if (!searchTerm.trim()) {
      return sortedBeaches;
    }

    const query = searchTerm.toLowerCase();
    return sortedBeaches.filter((beach) =>
      beach.name.toLowerCase().includes(query) ||
      `${beach.latitude.toFixed(2)},${beach.longitude.toFixed(2)}`.includes(query)
    );
  }, [sortedBeaches, searchTerm]);

  const hasBeaches = beaches.length > 0;

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
          onConfirm={handleConfirmDelete}
          onCancel={cancelDelete}
        />
      )}
      
      {/* FAQ Modal */}
      <FAQ isOpen={showFAQ} onClose={() => setShowFAQ(false)} />
      
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
          <nav className="flex flex-col sm:flex-row items-center space-y-2 sm:space-y-0 sm:space-x-4">
            <button
              onClick={toggleFAQ}
              className="p-2 rounded-full hover:bg-blue-700 transition"
              title="Help & FAQ"
            >
              <HelpCircle className="h-5 w-5" />
            </button>
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
          <div className="space-y-6">
            <div className="grid gap-6 lg:grid-cols-3">
              <div className="lg:col-span-2 rounded-2xl bg-gradient-to-r from-blue-600 via-sky-500 to-cyan-500 p-6 text-white shadow-xl">
                <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                  <div>
                    <div className="flex items-center text-sm uppercase tracking-widest text-blue-100">
                      <Compass className="mr-2 h-4 w-4" /> Paddleboard planner
                    </div>
                    <h2 className="mt-2 text-3xl font-bold">Plan your next paddle</h2>
                    <p className="mt-2 max-w-xl text-blue-100">
                      Review real-time wind, swell and shelter analysis to pick the calmest launch window and keep a log of your favourite SUP spots.
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-3">
                    {homeBeach && (
                      <button
                        onClick={() => handleBeachSelect(homeBeach)}
                        className="rounded-lg bg-white/20 px-4 py-2 text-sm font-semibold text-white backdrop-blur transition hover:bg-white/30"
                      >
                        Check {homeBeach.name}
                      </button>
                    )}
                    <button
                      onClick={() => setView("add")}
                      className="rounded-lg bg-white px-4 py-2 text-sm font-semibold text-blue-600 shadow hover:bg-blue-50"
                    >
                      <Plus className="mr-1 inline h-4 w-4" /> Add new spot
                    </button>
                    <button
                      onClick={handleFindNearest}
                      disabled={locating}
                      className={`rounded-lg border border-white/40 px-4 py-2 text-sm font-semibold transition ${
                        locating
                          ? 'cursor-not-allowed bg-white/10 text-blue-100'
                          : 'text-white hover:bg-white/20'
                      }`}
                    >
                      {locating ? 'Locating…' : 'Find calm bay nearby'}
                    </button>
                  </div>
                </div>
                <div className="mt-6 grid gap-3 sm:grid-cols-3">
                  <div className="rounded-xl bg-white/15 px-4 py-3 text-sm">
                    <p className="text-blue-100">Saved spots</p>
                    <p className="text-2xl font-semibold">{beaches.length}</p>
                  </div>
                  <div className="rounded-xl bg-white/15 px-4 py-3 text-sm">
                    <p className="text-blue-100">Sheltered bays</p>
                    <p className="text-2xl font-semibold">{shelteredCount}</p>
                  </div>
                  <div className="rounded-xl bg-white/15 px-4 py-3 text-sm">
                    <p className="text-blue-100">Last forecast</p>
                    <p className="text-2xl font-semibold">{lastUpdated ? formattedUpdateTime : "–"}</p>
                    {lastUpdated && (
                      <p className="text-xs text-blue-100">{formattedUpdateDate}</p>
                    )}
                  </div>
                </div>
              </div>

              <div className="rounded-2xl border border-blue-100 bg-white p-6 shadow-sm">
                <h3 className="flex items-center text-lg font-semibold text-gray-800">
                  <LifeBuoy className="mr-2 h-5 w-5 text-blue-500" /> Session snapshot
                </h3>
                <dl className="mt-4 space-y-3 text-sm text-gray-600">
                  <div className="flex items-center justify-between">
                    <dt className="font-medium text-gray-500">Home launch</dt>
                    <dd className="font-semibold text-gray-900">
                      {homeBeach ? homeBeach.name : "Not set"}
                    </dd>
                  </div>
                  <div className="flex items-center justify-between">
                    <dt className="font-medium text-gray-500">Gear checklist</dt>
                    <dd className="font-semibold text-gray-900">Tap inside a forecast</dd>
                  </div>
                  <div className="flex items-center justify-between">
                    <dt className="font-medium text-gray-500">Forecast window</dt>
                    <dd className="font-semibold text-gray-900">
                      {timeRange.startTime} – {timeRange.endTime}
                    </dd>
                  </div>
                </dl>
                {homeBeach ? (
                  <div className="mt-4 rounded-xl bg-blue-50 p-4 text-sm text-blue-700">
                    <p className="font-semibold">Ready for {homeBeach.name}?</p>
                    <p className="text-xs text-blue-600">
                      {homeBeach.latitude.toFixed(2)}, {homeBeach.longitude.toFixed(2)}
                    </p>
                    <button
                      onClick={() => handleBeachSelect(homeBeach)}
                      className="mt-3 inline-flex items-center rounded-lg bg-blue-600 px-3 py-1 text-xs font-semibold text-white hover:bg-blue-700"
                    >
                      Open latest forecast
                    </button>
                  </div>
                ) : (
                  <div className="mt-4 rounded-xl bg-gray-50 p-4 text-sm text-gray-600">
                    Set any beach as "home" from its forecast page to pin it here for quick access.
                  </div>
                )}
              </div>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="relative flex-1">
                <input
                  type="search"
                  value={searchTerm}
                  onChange={(event) => setSearchTerm(event.target.value)}
                  placeholder={hasBeaches ? "Search saved spots" : "Search by name or coordinates"}
                  className="w-full rounded-lg border border-blue-100 bg-white px-3 py-2 text-sm shadow-sm focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-200"
                />
                <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-xs text-blue-400">
                  {hasBeaches
                    ? `${filteredBeaches.length}/${beaches.length}`
                    : 'No spots yet'}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <label htmlFor="beach-sort" className="text-xs font-semibold uppercase tracking-wide text-blue-900">
                  Sort by
                </label>
                <select
                  id="beach-sort"
                  value={sortOption}
                  onChange={(event) => setSortOption(event.target.value)}
                  className="rounded-lg border border-blue-100 bg-white px-3 py-2 text-sm shadow-sm focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-200"
                >
                  <option value="shelter">Shelter strength</option>
                  <option value="alpha">Alphabetical</option>
                  <option value="recent">Recently added</option>
                </select>
              </div>
            </div>

            {hasBeaches ? (
              filteredBeaches.length === 0 ? (
                <div className="rounded-2xl border bg-white p-8 text-center shadow-sm">
                  <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-blue-50 text-3xl text-blue-600">🔍</div>
                  <h3 className="mt-4 text-xl font-semibold text-gray-800">No matches found</h3>
                  <p className="mt-2 text-sm text-gray-600">
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
                <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                  {filteredBeaches.map((beach) => (
                    <div
                      key={beach.id}
                      className={`flex h-full flex-col overflow-hidden rounded-xl border bg-white shadow-sm transition hover:-translate-y-1 hover:shadow-lg ${
                        beach.id === homeBeach?.id ? "border-orange-200 ring-2 ring-orange-300" : "border-gray-100"
                      }`}
                    >
                      <div className="flex flex-1 flex-col p-4">
                        <div className="mb-3 flex items-start justify-between">
                          <div>
                            <h2 className="flex items-center text-lg font-semibold text-gray-800">
                              {beach.id === homeBeach?.id && (
                                <Home className="mr-1 h-4 w-4 text-orange-500" />
                              )}
                              {beach.name}
                            </h2>
                            {(() => {
                              const shelter = getShelterScore(beach);
                              if (typeof shelter !== "number") return null;
                              const comfortLevel = shelter >= 75 ? "bg-green-50 text-green-600" : shelter >= 60 ? "bg-yellow-50 text-yellow-600" : "bg-red-50 text-red-600";
                              return (
                                <span className={`mt-1 inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${comfortLevel}`}>
                                  Shelter {Math.round(shelter)}%
                                </span>
                              );
                            })()}
                          </div>
                          <button
                            onClick={(event) => {
                              event.stopPropagation();
                              handleDeleteBeach(beach.id);
                            }}
                            className="rounded-full p-1 text-gray-400 transition hover:bg-gray-100 hover:text-red-500"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                        <p className="flex items-center text-sm text-gray-500">
                          <MapPin className="mr-1 h-3 w-3 text-gray-400" />
                          {beach.latitude.toFixed(4)}, {beach.longitude.toFixed(4)}
                        </p>
                        <div className="mt-auto flex items-center justify-between pt-4">
                          <a
                            href={beach.googleMapsUrl || `https://www.google.com/maps?q=${beach.latitude},${beach.longitude}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs font-medium text-blue-600 hover:underline"
                            onClick={(event) => event.stopPropagation()}
                          >
                            <Map className="mr-1 inline h-3 w-3" /> View on Maps
                          </a>
                          <button
                            onClick={() => handleBeachSelect(beach)}
                            className="rounded-lg bg-blue-600 px-3 py-1 text-sm font-semibold text-white transition hover:bg-blue-700"
                          >
                            Check conditions
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )
            ) : (
              <div className="rounded-2xl border bg-white p-8 text-center shadow-sm">
                <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-blue-50 text-3xl text-blue-600">🏝️</div>
                <h2 className="mt-4 text-2xl font-bold text-gray-800">No beaches saved yet</h2>
                <p className="mt-2 text-gray-600">
                  Add your favourite paddleboarding launches to unlock personalised forecasts and checklists.
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
                        ? 'border-blue-100 text-blue-300'
                        : 'border-blue-200 text-blue-600 hover:bg-blue-50'
                    }`}
                  >
                    {locating ? 'Locating…' : 'Use my location'}
                  </button>
                </div>
                <p className="mt-4 text-sm text-gray-500">
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
                    className="rounded-2xl border border-blue-100 bg-white p-5 shadow-sm"
                  >
                    <h3 className="flex items-center text-lg font-semibold text-gray-800">
                      <Icon className="mr-2 h-5 w-5 text-blue-500" /> {card.title}
                    </h3>
                    <ul className="mt-3 space-y-2 text-sm text-gray-600">
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
                      disabled={beachLoading}
                    >
                      {beachLoading ? 'Analyzing...' : 'Extract'}
                    </button>
                  </div>
                  {beachLoading && (
                    <p className="text-xs text-blue-600 mt-2">
                      Analyzing coastline and geographic protection...
                    </p>
                  )}
                </div>
              </div>
              <div className="mb-8">
                <button
                  onClick={handleFindNearest}
                  className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
                  disabled={locating}
                >
                  {locating ? 'Finding nearest location...' : 'Find Nearest Recommended Spot'}
                </button>
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
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
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

      {/* Footer with Last Updated Time */}
      <footer className="bg-blue-800 text-white p-4 mt-auto shadow-inner">
        <div className="container mx-auto flex flex-col sm:flex-row justify-between items-center">
          <p className="text-sm">
            © 2025 Paddleboard Weather Advisor | Ladi Thalassa
          </p>
          <div className="flex items-center mt-2 sm:mt-0 text-xs">
            <span className="text-blue-300 border-r border-blue-600 pr-3 mr-3">
              {lastUpdated ? (
                <>Last updated: {formattedUpdateDate} {formattedUpdateTime} </>
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

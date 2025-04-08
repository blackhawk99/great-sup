import React, { useState, useEffect } from "react";
import { AlertCircle, Home, Map, MapPin, Plus, Trash2, ChevronLeft } from "lucide-react";
import { useBeachManager } from "./BeachManager";
import BeachDetailView from "./BeachDetailView";
import FixedBeachView from "./FixedBeachView";
import { ErrorBoundary, DeleteConfirmationModal } from "./helpers";

const App = () => {
  // State
  const [view, setView] = useState("dashboard");
  const [selectedBeach, setSelectedBeach] = useState(null);
  const [notification, setNotification] = useState(null);
  const [debugMode, setDebugMode] = useState(false);
  const [timeRange, setTimeRange] = useState({
    date: new Date().toISOString().split("T")[0],
    startTime: "09:00",
    endTime: "13:00",
  });
  const [lastUpdated, setLastUpdated] = useState(null);
  const [dataUpdateCount, setDataUpdateCount] = useState(0);
  
  // App version information
  const APP_VERSION = "1.0.3";
  
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
  
  // Function to update the last updated timestamp
  const handleDataUpdate = () => {
    setLastUpdated(new Date());
    setDataUpdateCount(prev => prev + 1); // Track number of updates
  };
  
  // Toggle debug mode with actual effects
  const toggleDebugMode = () => {
    const newMode = !debugMode;
    setDebugMode(newMode);
    
    // Store in localStorage to persist between page reloads
    localStorage.setItem('weatherAdvisorDebugMode', newMode ? 'true' : 'false');
    
    // Show notification when toggled
    toast.success(`Debug mode ${newMode ? 'enabled' : 'disabled'}`);
    
    // Apply debug-specific CSS class to body for global styling
    if (newMode) {
      document.body.classList.add('debug-mode');
    } else {
      document.body.classList.remove('debug-mode');
    }
  };
  
  // Load debug mode from localStorage on initial load
  useEffect(() => {
    const savedDebugMode = localStorage.getItem('weatherAdvisorDebugMode');
    if (savedDebugMode === 'true') {
      setDebugMode(true);
      document.body.classList.add('debug-mode');
    }
  }, []);
  
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
  
  // Handle time range change
  const handleTimeRangeChange = (field, value) => {
    setTimeRange({ ...timeRange, [field]: value });
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
          <ErrorBoundary>
            <FixedBeachView 
              beach={selectedBeach}
              homeBeach={homeBeach}
              onSetHomeBeach={handleSetHomeBeach}
              setView={setView}
              timeRange={timeRange}
              onTimeRangeChange={handleTimeRangeChange}
              onDataUpdate={handleDataUpdate}
              debugMode={debugMode}
            />
          </ErrorBoundary>
        )}
      </main>

      {/* Footer with Version Information and Last Updated Time */}
      <footer className="bg-blue-800 text-white p-4 mt-auto shadow-inner">
        <div className="container mx-auto flex flex-col sm:flex-row justify-between items-center">
          <p className="text-sm">
            © 2025 Paddleboard Weather Advisor | Ladi Thalassa
          </p>
          <div className="flex items-center mt-2 sm:mt-0 text-xs">
            <span className="text-blue-300 border-r border-blue-600 pr-3 mr-3">
              Version {APP_VERSION}
            </span>
            <span className="text-blue-300 border-r border-blue-600 pr-3 mr-3">
              {lastUpdated ? (
                <>Last updated: {formattedUpdateDate} {formattedUpdateTime} </>
              ) : (
                <>No updates yet</>
              )}
              {debugMode && <span className="ml-1">({dataUpdateCount} updates)</span>}
            </span>
            <button 
              onClick={toggleDebugMode} 
              className="text-blue-300 hover:text-white px-3 py-1 rounded-lg hover:bg-blue-700"
            >
              {debugMode ? "Debug Mode On" : "Enable Debug"}
            </button>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default App;

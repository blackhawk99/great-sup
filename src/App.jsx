import React, { useState, useEffect, useCallback } from "react"; // Added useCallback
import { AlertCircle, Home, Map, MapPin, Plus, Trash2, ChevronLeft } from "lucide-react";
import { useBeachManager } from "./BeachManager";
// import BeachDetailView from "./BeachDetailView"; // Assuming FixedBeachView is the intended component, removed this import. If needed, uncomment.
import FixedBeachView from "./FixedBeachView";
import { ErrorBoundary, DeleteConfirmationModal } from "./helpers";

// --- Constants ---
const APP_VERSION = "1.0.3"; // App version information
const DEBUG_MODE_STORAGE_KEY = 'weatherAdvisorDebugMode'; // LocalStorage key for debug mode

const App = () => {
  // --- State ---
  const [view, setView] = useState("dashboard"); // 'dashboard', 'add', 'detail'
  const [selectedBeach, setSelectedBeach] = useState(null);
  const [notification, setNotification] = useState(null); // { type: 'success' | 'error', message: string } | null
  const [debugMode, setDebugMode] = useState(false);
  const [timeRange, setTimeRange] = useState({
    date: new Date().toISOString().split("T")[0], // Default to today
    startTime: "09:00", // Default start time
    endTime: "13:00",   // Default end time
  });
  const [lastUpdated, setLastUpdated] = useState(null); // Date object or null
  const [dataUpdateCount, setDataUpdateCount] = useState(0); // Counter for updates

  // --- Custom Hook: Beach Management ---
  const {
    beaches,
    homeBeach,
    setHomeBeach,
    addBeach,
    addSuggestedBeach,
    deleteBeach,
    confirmDelete, // ID of beach pending deletion confirmation
    cancelDelete, // Function to cancel deletion
    deleteConfirm, // ID of beach pending deletion confirmation (seems redundant with confirmDelete, check useBeachManager)
    newBeach,
    setNewBeach,
    mapUrl,
    setMapUrl,
    handleExtractCoordinates,
    loading: beachLoading // Loading state from beach manager (e.g., for coordinate extraction)
  } = useBeachManager();

  // --- Derived State & Formatting ---
  const formattedUpdateTime = lastUpdated
    ? lastUpdated.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    : "-";

  const formattedUpdateDate = lastUpdated
    ? lastUpdated.toLocaleDateString([], { year: 'numeric', month: 'long', day: 'numeric' })
    : "-";

  // --- Effects ---

  // Load debug mode from localStorage on initial load
  useEffect(() => {
    const savedDebugMode = localStorage.getItem(DEBUG_MODE_STORAGE_KEY);
    const initialDebugMode = savedDebugMode === 'true';
    setDebugMode(initialDebugMode);
    if (initialDebugMode) {
      document.body.classList.add('debug-mode');
    }
  }, []); // Empty dependency array ensures this runs only once on mount

  // Update body class when debugMode changes
  useEffect(() => {
    if (debugMode) {
      document.body.classList.add('debug-mode');
    } else {
      document.body.classList.remove('debug-mode');
    }
    // Optional: Cleanup function to remove class if component unmounts
    return () => document.body.classList.remove('debug-mode');
  }, [debugMode]); // Run when debugMode changes

  // --- Helper Functions ---

  // Toast notification handler
  const showToast = useCallback((type, message) => {
    setNotification({ type, message });
    const timerId = setTimeout(() => setNotification(null), 3000);
    // Optional: Cleanup timer if a new toast appears before the old one hides
    return () => clearTimeout(timerId);
  }, []); // No dependencies, function identity is stable

  // Function to update the last updated timestamp and count
  const handleDataUpdate = useCallback(() => {
    setLastUpdated(new Date());
    setDataUpdateCount(prev => prev + 1);
  }, []); // No dependencies, function identity is stable

  // --- Event Handlers ---

  // Toggle debug mode
  const toggleDebugMode = () => {
    setDebugMode(prevMode => {
      const newMode = !prevMode;
      localStorage.setItem(DEBUG_MODE_STORAGE_KEY, newMode ? 'true' : 'false');
      showToast('success', `Debug mode ${newMode ? 'enabled' : 'disabled'}`);
      return newMode;
    });
  };

  // Handle selecting a beach to view details
  const handleBeachSelect = useCallback((beach) => {
    if (!beach || typeof beach.latitude !== 'number' || typeof beach.longitude !== 'number') {
      showToast("error", "Invalid beach data. Cannot display details.");
      console.error("Invalid beach data:", beach);
      return;
    }
    setSelectedBeach(beach);
    setView("detail");
  }, [showToast]); // Depends on showToast

  // Handle setting a beach as the home beach
  const handleSetHomeBeach = useCallback((beach) => {
    setHomeBeach(beach); // Assume this persists the change via useBeachManager
    showToast('success', `${beach.name} set as home beach!`);
    handleDataUpdate(); // Mark data as updated (conceptually, preference changed)
  }, [setHomeBeach, showToast, handleDataUpdate]); // Depends on setHomeBeach, showToast, handleDataUpdate

  // Handle changes in the time range inputs
  const handleTimeRangeChange = useCallback((field, value) => {
    setTimeRange(prevRange => ({ ...prevRange, [field]: value }));
  }, []); // No dependencies, function identity is stable

  // Handle adding a new beach from the form
  const handleAddBeachSubmit = useCallback(async (event) => {
    event.preventDefault(); // Prevent default form submission if wrapped in <form>
    if (!newBeach.name || !newBeach.latitude || !newBeach.longitude) {
        showToast('error', 'Please provide name, latitude, and longitude.');
        return;
    }
    try {
      const added = await addBeach(newBeach); // addBeach should return the added beach or throw
      showToast('success', `Added ${added.name} to your beaches!`);
      handleDataUpdate();
      setView("dashboard"); // Go back to dashboard after adding
      setNewBeach({ name: "", latitude: "", longitude: "" }); // Clear the form
      setMapUrl(""); // Clear the map URL input
    } catch (error) {
      console.error("Error adding beach:", error);
      showToast('error', `Failed to add beach: ${error.message}`);
    }
  }, [newBeach, addBeach, showToast, handleDataUpdate, setNewBeach, setMapUrl]); // Dependencies

  // Handle adding a suggested beach
  const handleAddSuggested = useCallback(async (location) => {
    try {
      // Ensure location has necessary data
      if (!location || !location.name || typeof location.latitude !== 'number' || typeof location.longitude !== 'number') {
        throw new Error("Invalid suggested location data.");
      }
      const added = await addSuggestedBeach(location); // Expects location object { name, latitude, longitude, googleMapsUrl? }
      showToast('success', `Added ${added.name} to your beaches!`);
      handleDataUpdate();
      setView("dashboard"); // Optionally switch view, or stay on 'add' page
    } catch (error) {
      console.error("Error adding suggested beach:", error);
      showToast('error', `Failed to add suggested beach: ${error.message}`);
    }
  }, [addSuggestedBeach, showToast, handleDataUpdate]); // Dependencies

  // Initiate beach deletion (shows confirmation modal via hook)
  const handleDeleteBeachClick = useCallback((beachId) => {
    deleteBeach(beachId); // This likely sets the `deleteConfirm` state in the hook
  }, [deleteBeach]);

  // Confirm deletion after modal confirmation
  const handleConfirmDelete = useCallback((beachId) => {
    const deletedBeachName = confirmDelete(beachId); // This performs deletion and returns name via hook

    if (deletedBeachName) {
        // If the currently selected beach is deleted, navigate back to the dashboard
        if (selectedBeach && selectedBeach.id === beachId) {
        setSelectedBeach(null);
        setView("dashboard");
        }
        handleDataUpdate();
        showToast('success', `Removed ${deletedBeachName}`);
    } else {
        // Handle case where deletion failed or beach wasn't found (optional)
        showToast('error', 'Failed to remove beach.');
    }
  }, [confirmDelete, selectedBeach, handleDataUpdate, showToast]); // Dependencies

  // Cancel deletion from modal
  const handleCancelDelete = useCallback(() => {
    cancelDelete(); // This likely resets the `deleteConfirm` state in the hook
  }, [cancelDelete]);


  // --- Suggested Locations Data ---
  // (Keep suggestedLocations as defined in the original code)
    const suggestedLocations = [
      { name: "Kavouri Beach", latitude: 37.8235, longitude: 23.7761, googleMapsUrl: "https://maps.app.goo.gl/KP6MpuG6mgrv1Adm6" },
      { name: "Glyfada Beach", latitude: 37.8650, longitude: 23.7470, googleMapsUrl: "https://maps.app.goo.gl/yEXLZW5kwBArCHvb7" },
      { name: "Astir Beach", latitude: 37.8095, longitude: 23.7850, googleMapsUrl: "https://maps.app.goo.gl/6uUbtp31MQ63gGBSA" },
      { name: "Kapsali Beach (Kythira)", latitude: 36.1360, longitude: 22.9980, googleMapsUrl: "https://maps.app.goo.gl/xcs6EqYy8LbzYq2y6" }, // Added island context
      { name: "Palaiopoli Beach (Kythira)", latitude: 36.2260, longitude: 23.0410, googleMapsUrl: "https://maps.app.goo.gl/TPFetRbFcyAXdgNDA" }, // Added island context
      { name: "Vathy Bay (Sifnos)", latitude: 36.9386, longitude: 24.6750, googleMapsUrl: "https://www.google.com/maps/place/Vathy+Bay/@36.9386,24.6750,15z" },
      { name: "Naoussa Bay (Paros)", latitude: 37.1232, longitude: 25.2355, googleMapsUrl: "https://www.google.com/maps/place/Naoussa+Bay/@37.1232,25.2355,15z" },
      { name: "Vlikhos Bay (Hydra)", latitude: 37.3255, longitude: 23.4486, googleMapsUrl: "https://www.google.com/maps/place/Vlikhos+Bay/@37.3255,23.4486,15z" },
    ];

  // --- Render ---
  return (
    <div className="flex flex-col min-h-screen bg-gradient-to-b from-blue-50 to-blue-100">
      {/* Toast Notification Area */}
      {notification && (
        <div
          role="alert" // Added role for accessibility
          aria-live="assertive" // Announce changes immediately
          className={`fixed top-4 right-4 z-50 p-4 rounded-lg shadow-lg transition-all duration-300 ${
            notification.type === 'success'
              ? 'bg-green-100 border border-green-400 text-green-800'
              : 'bg-red-100 border border-red-400 text-red-800'
          }`}
        >
          {notification.message}
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {/* Use deleteConfirm from the hook to control modal visibility */}
      {deleteConfirm && (
        <DeleteConfirmationModal
          beach={beaches.find(b => b.id === deleteConfirm)}
          onConfirm={() => handleConfirmDelete(deleteConfirm)} // Pass the ID to confirm
          onCancel={handleCancelDelete} // Use the cancel handler
        />
      )}

      {/* Header */}
      <header className="bg-blue-600 text-white p-4 shadow-md sticky top-0 z-40">
        <div className="container mx-auto flex justify-between items-center">
          <button // Make the title clickable to go home
            className="text-2xl font-bold flex items-center cursor-pointer hover:text-blue-100 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-300 rounded"
            onClick={() => setView("dashboard")}
            aria-label="Paddleboard Weather Advisor - Go to Dashboard"
          >
            <div className="mr-2 text-3xl" aria-hidden="true">🌊</div>
            Paddleboard Weather Advisor
          </button>
          <nav aria-label="Main navigation">
            <ul className="flex space-x-2 sm:space-x-4">
              <li>
                <button
                  onClick={() => setView("dashboard")}
                  className={`px-3 py-1.5 rounded-lg text-sm sm:text-base ${
                    view === "dashboard" ? "bg-blue-800 ring-2 ring-blue-300" : "hover:bg-blue-700"
                  } transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-blue-300`}
                  aria-current={view === 'dashboard' ? 'page' : undefined} // Accessibility
                >
                  Dashboard
                </button>
              </li>
              <li>
                <button
                  onClick={() => setView("add")}
                  className={`px-3 py-1.5 rounded-lg text-sm sm:text-base ${
                    view === "add" ? "bg-blue-800 ring-2 ring-blue-300" : "hover:bg-blue-700"
                  } transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-blue-300`}
                  aria-current={view === 'add' ? 'page' : undefined} // Accessibility
                >
                  Add Beach
                </button>
              </li>
            </ul>
          </nav>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-grow container mx-auto p-4 sm:p-6 lg:p-8">
        {/* --- Dashboard View --- */}
        {view === "dashboard" && (
          <div className="grid gap-4 md:gap-6 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {beaches.length === 0 && !beachLoading ? ( // Show only if not loading and no beaches
              <div className="col-span-full bg-white rounded-lg shadow-lg p-8 text-center border border-blue-200">
                <div className="text-blue-600 text-5xl mb-4 animate-pulse" aria-hidden="true">🏝️</div>
                <h2 className="text-2xl font-bold mb-4 text-gray-800">No beaches saved yet</h2>
                <p className="text-gray-600 mb-6">Add your favorite paddleboarding spots to get weather insights!</p>
                <button
                  onClick={() => setView("add")}
                  className="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition-colors duration-200 shadow-md focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 flex items-center justify-center mx-auto"
                >
                  <Plus className="h-5 w-5 mr-2"/> Add Your First Beach
                </button>
              </div>
            ) : (
              // Render beach cards
              beaches.map((beach) => (
                <div
                  key={beach.id}
                  className={`bg-white rounded-lg shadow-md overflow-hidden transition-all duration-200 border ${
                    beach.id === homeBeach?.id
                     ? "border-orange-400 ring-2 ring-orange-300 ring-offset-1"
                     : "border-gray-200 hover:shadow-lg hover:border-blue-300"
                  }`}
                >
                  <div className="p-4">
                    <div className="flex justify-between items-start mb-2">
                      <h2 className="text-lg sm:text-xl font-semibold flex items-center text-gray-800 pr-2">
                        {beach.id === homeBeach?.id && (
                          <Home className="h-4 w-4 text-orange-500 mr-1.5 flex-shrink-0" aria-label="Home beach" />
                        )}
                        {beach.name}
                      </h2>
                      <button
                        onClick={(e) => {
                          e.stopPropagation(); // Prevent card click when deleting
                          handleDeleteBeachClick(beach.id);
                        }}
                        className="text-gray-400 hover:text-red-600 transition-colors p-1 rounded-full hover:bg-red-50 focus:outline-none focus:ring-2 focus:ring-red-400 flex-shrink-0"
                        aria-label={`Delete ${beach.name}`}
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                    <p className="text-gray-500 text-sm mb-3 flex items-center">
                      <MapPin className="h-3.5 w-3.5 mr-1.5 text-gray-400 flex-shrink-0" aria-hidden="true" />
                      <span className="truncate" title={`${beach.latitude}, ${beach.longitude}`}>
                         {/* Use toFixed only if they are numbers */}
                        {typeof beach.latitude === 'number' ? beach.latitude.toFixed(4) : 'N/A'},{' '}
                        {typeof beach.longitude === 'number' ? beach.longitude.toFixed(4) : 'N/A'}
                      </span>
                    </p>
                    <div className="flex justify-between items-center mt-3 pt-3 border-t border-gray-100">
                      <a
                        href={beach.googleMapsUrl || `https://www.google.com/maps?q=${beach.latitude},${beach.longitude}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-blue-600 hover:underline flex items-center focus:outline-none focus:ring-1 focus:ring-blue-400 rounded px-1 py-0.5"
                        onClick={(e) => e.stopPropagation()} // Prevent card click
                        aria-label={`View ${beach.name} on Google Maps`}
                      >
                        <Map className="h-3.5 w-3.5 mr-1" aria-hidden="true"/>
                        View on Maps
                      </a>
                      <button
                        onClick={() => handleBeachSelect(beach)}
                        className="bg-blue-600 text-white text-sm px-3 py-1.5 rounded-lg hover:bg-blue-700 transition-colors focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-blue-500"
                      >
                        Check Conditions
                      </button>
                    </div>
                  </div>
                </div>
              ))
            )}
            {/* Placeholder for Add Beach button on dashboard if preferred */}
            {beaches.length > 0 && (
                 <button
                    onClick={() => setView("add")}
                    className="flex flex-col items-center justify-center bg-white rounded-lg shadow-md border-2 border-dashed border-blue-300 text-blue-600 hover:border-blue-500 hover:bg-blue-50 transition-all duration-200 p-6 focus:outline-none focus:ring-2 focus:ring-blue-400"
                    aria-label="Add a new beach"
                >
                    <Plus className="h-8 w-8 mb-2" />
                    <span className="font-semibold">Add New Beach</span>
                </button>
            )}
          </div>
        )}

        {/* --- Add Beach View --- */}
        {view === "add" && (
          <div className="bg-white rounded-lg shadow-lg max-w-3xl mx-auto border border-gray-200">
            <div className="p-4 sm:p-6 border-b border-gray-200">
              <h2 className="text-xl sm:text-2xl font-semibold flex items-center text-gray-800">
                <Plus className="h-5 w-5 sm:h-6 sm:w-6 mr-2 text-blue-500" />
                Add New Beach
              </h2>
            </div>

            <div className="p-4 sm:p-6 space-y-8">
              {/* Add via Google Maps Link Section */}
              <div>
                <h3 className="text-lg font-medium mb-3 text-gray-700">
                  Option 1: Add via Google Maps Link
                </h3>
                <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
                  <div className="flex items-start mb-3">
                    <Map className="h-5 w-5 mr-2 text-blue-600 mt-1 flex-shrink-0" aria-hidden="true"/>
                    <p className="text-sm text-gray-700">
                      Paste a Google Maps link (e.g., from "Share" > "Copy link") and we'll try to extract the coordinates.
                      <br/>
                      <span className="text-xs text-gray-500 mt-1 block">
                        Example: https://maps.app.goo.gl/yEXLZW5kwBArCHvb7
                      </span>
                    </p>
                  </div>
                  <div className="flex">
                    <label htmlFor="mapUrlInput" className="sr-only">Google Maps URL</label>
                    <input
                      id="mapUrlInput"
                      type="url" // Use type="url" for better semantics/validation
                      value={mapUrl}
                      onChange={(e) => setMapUrl(e.target.value)}
                      placeholder="Paste Google Maps URL here..."
                      className="flex-grow p-2 border border-gray-300 rounded-l focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      aria-describedby="extract-button" // Link input to button
                    />
                    <button
                      id="extract-button"
                      onClick={handleExtractCoordinates}
                      className="bg-blue-600 text-white px-4 py-2 rounded-r hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-blue-500"
                      disabled={beachLoading || !mapUrl}
                    >
                      {beachLoading ? 'Analyzing...' : 'Extract'}
                    </button>
                  </div>
                  {beachLoading && (
                    <p className="text-xs text-blue-600 mt-2 animate-pulse">
                      Analyzing coordinates...
                    </p>
                  )}
                   {/* Feedback if extraction populates fields */}
                   {newBeach.latitude && newBeach.longitude && mapUrl && (
                     <p className="text-xs text-green-600 mt-2">
                       Coordinates extracted! You can now name the beach below and add it.
                     </p>
                   )}
                </div>
              </div>

              {/* Manual Add Section (using a form) */}
               {/* Wrap in form for better semantics and submission handling */}
              <form onSubmit={handleAddBeachSubmit} className="space-y-6">
                <h3 className="text-lg font-medium text-gray-700">
                  Option 2: Enter Details Manually
                </h3>
                 {/* Link heading and form section */}
                 <fieldset className="bg-white p-4 rounded-lg border border-gray-200 shadow-sm space-y-4" aria-labelledby="manual-add-heading">
                     <legend id="manual-add-heading" className="sr-only">Beach Details</legend>
                     <div>
                         <label htmlFor="beachNameInput" className="block text-sm font-medium text-gray-700 mb-1">
                         Beach Name <span className="text-red-500">*</span>
                         </label>
                         <input
                            id="beachNameInput"
                            type="text"
                            value={newBeach.name}
                            onChange={(e) => setNewBeach({ ...newBeach, name: e.target.value })}
                            placeholder="e.g., Kavouri Beach"
                            className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                            required // HTML5 validation
                         />
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                        <label htmlFor="latitudeInput" className="block text-sm font-medium text-gray-700 mb-1">
                            Latitude <span className="text-red-500">*</span>
                        </label>
                        <input
                            id="latitudeInput"
                            type="number"
                            step="any" // Allow decimals
                            value={newBeach.latitude}
                            onChange={(e) => setNewBeach({ ...newBeach, latitude: e.target.value ? parseFloat(e.target.value) : '' })}
                            placeholder="e.g., 37.8235"
                            className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                            required // HTML5 validation
                            min="-90" max="90" // Basic range validation
                        />
                        </div>
                        <div>
                        <label htmlFor="longitudeInput" className="block text-sm font-medium text-gray-700 mb-1">
                            Longitude <span className="text-red-500">*</span>
                        </label>
                        <input
                            id="longitudeInput"
                            type="number"
                            step="any" // Allow decimals
                            value={newBeach.longitude}
                            onChange={(e) => setNewBeach({ ...newBeach, longitude: e.target.value ? parseFloat(e.target.value) : '' })}
                            placeholder="e.g., 23.7761"
                            className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                            required // HTML5 validation
                            min="-180" max="180" // Basic range validation
                        />
                        </div>
                    </div>
                 </fieldset>
                 <div className="flex justify-end pt-2">
                    <button
                      type="submit" // Make this the form submission trigger
                      disabled={!newBeach.name || typeof newBeach.latitude !== 'number' || typeof newBeach.longitude !== 'number'}
                      className={`px-5 py-2.5 rounded-lg font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 ${
                        !newBeach.name || typeof newBeach.latitude !== 'number' || typeof newBeach.longitude !== 'number'
                          ? "bg-gray-300 text-gray-500 cursor-not-allowed"
                          : "bg-blue-600 text-white hover:bg-blue-700"
                      }`}
                    >
                      Add This Beach
                    </button>
                  </div>
              </form>

              {/* Suggested Beaches Section */}
              <div className="border-t border-gray-200 pt-8">
                <h3 className="text-lg font-medium mb-4 text-gray-700">
                  Or Add a Popular Greek Beach
                </h3>
                <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
                  {suggestedLocations.map((location) => (
                    <button // Use button for click action
                      key={location.name} // Use name as key if unique, otherwise add an id
                      className="bg-white border border-gray-200 rounded-lg p-4 text-left hover:bg-blue-50 hover:border-blue-300 cursor-pointer transition shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                      onClick={() => handleAddSuggested(location)}
                      aria-label={`Add suggested beach: ${location.name}`}
                    >
                      <h4 className="font-medium text-blue-700">{location.name}</h4>
                      <p className="text-sm text-gray-500 mb-2">
                        {location.latitude.toFixed(4)}, {location.longitude.toFixed(4)}
                      </p>
                      {/* Make map link accessible but not part of the main button action */}
                      <span className="inline-block mt-1">
                          <a
                            href={location.googleMapsUrl || `https://www.google.com/maps?q=${location.latitude},${location.longitude}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs text-blue-600 hover:underline flex items-center focus:outline-none focus:ring-1 focus:ring-blue-400 rounded px-1 py-0.5"
                            onClick={(e) => e.stopPropagation()} // Prevent button click when link is clicked
                            aria-label={`View ${location.name} on Google Maps`}
                          >
                            <Map className="h-3 w-3 mr-1" aria-hidden="true"/>
                            View on Maps
                          </a>
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* --- Detail View --- */}
        {view === "detail" && selectedBeach && (
          <ErrorBoundary>
             {/* Button to go back to Dashboard */}
            <button
                onClick={() => setView('dashboard')}
                className="mb-4 inline-flex items-center text-sm text-blue-600 hover:text-blue-800 focus:outline-none focus:ring-2 focus:ring-blue-400 rounded px-2 py-1"
                aria-label="Back to dashboard"
            >
                <ChevronLeft className="h-4 w-4 mr-1" />
                Back to Dashboard
            </button>

            {/* Render the FixedBeachView which presumably shows the details */}
            <FixedBeachView
              beach={selectedBeach}
              homeBeach={homeBeach}
              onSetHomeBeach={handleSetHomeBeach} // Pass handler to set home beach from detail view
              setView={setView} // Allow detail view to potentially navigate away
              timeRange={timeRange}
              onTimeRangeChange={handleTimeRangeChange} // Pass handler for time range changes
              onDataUpdate={handleDataUpdate} // Pass handler to signal data updates
              debugMode={debugMode} // Pass debug mode state
            />
          </ErrorBoundary>
        )}
        {view === "detail" && !selectedBeach && ( // Handle case where detail view is active but no beach selected (e.g., after deletion)
             <div className="text-center p-8 bg-white rounded-lg shadow">
                <AlertCircle className="h-12 w-12 text-yellow-500 mx-auto mb-4" />
                <p className="text-gray-600">No beach selected or beach data is unavailable.</p>
                <button
                    onClick={() => setView('dashboard')}
                    className="mt-4 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
                >
                    Return to Dashboard
                </button>
            </div>
        )}

      </main>

      {/* Footer */}
      <footer className="bg-blue-800 text-white p-4 mt-auto shadow-inner">
        <div className="container mx-auto flex flex-col sm:flex-row justify-between items-center text-center sm:text-left">
          <p className="text-sm mb-2 sm:mb-0">
            © {new Date().getFullYear()} Paddleboard Weather Advisor | Ladi Thalassa
          </p>
          <div className="flex flex-col sm:flex-row items-center text-xs space-y-1 sm:space-y-0 sm:space-x-3">
            <span className="text-blue-300 sm:border-r sm:border-blue-600 sm:pr-3">
              Version {APP_VERSION}
            </span>
            <span className="text-blue-300 sm:border-r sm:border-blue-600 sm:pr-3">
              {lastUpdated ? (
                <>Last data update: {formattedUpdateDate} {formattedUpdateTime} </>
              ) : (
                <>No data updates yet</>
              )}
              {debugMode && <span className="ml-1 opacity-75">({dataUpdateCount} updates)</span>}
            </span>
            <button
              onClick={toggleDebugMode}
              className="text-blue-300 hover:text-white px-3 py-1 rounded-lg hover:bg-blue-700 transition-colors focus:outline-none focus:ring-1 focus:ring-blue-400"
            >
              {debugMode ? "Debug Mode: ON" : "Enable Debug"}
            </button>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default App;

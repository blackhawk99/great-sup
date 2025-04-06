// App.jsx - Main component and routing
import React, { useState, useEffect } from "react";
import { ErrorBoundary } from "./components/ErrorBoundary";
import Dashboard from "./components/Dashboard";
import AddBeachView from "./components/AddBeachView";
import BeachDetailView from "./components/BeachDetailView";
import Header from "./components/Header";
import Footer from "./components/Footer";
import { useMockData } from "./hooks/useMockData";
import { useBeachManager } from "./hooks/useBeachManager";
import Toast from "./components/Toast";

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
  
  // Custom hooks
  const { mockDataRef } = useMockData();
  const { 
    beaches, 
    homeBeach, 
    setHomeBeach, 
    handleAddBeach, 
    handleAddSuggested, 
    handleDeleteBeach,
    confirmDeleteBeach,
    cancelDeleteBeach,
    deleteConfirm,
    setDeleteConfirm 
  } = useBeachManager();
  
  // Toast notification system
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
  
  // Handle beach selection
  const handleBeachSelect = (beach) => {
    if (!beach || !beach.latitude || !beach.longitude) {
      toast.error("Invalid beach data. Please try adding this beach again.");
      return;
    }
    
    setSelectedBeach(beach);
    setView("detail");
  };
  
  // Handle home beach setting
  const handleSetHomeBeach = (beach) => {
    setHomeBeach(beach);
    toast.success(`${beach.name} set as home beach!`);
  };
  
  // Handle time range change
  const handleTimeRangeChange = (field, value) => {
    setTimeRange({ ...timeRange, [field]: value });
  };

  return (
    <div className="flex flex-col min-h-screen bg-blue-50">
      {/* Toast notification */}
      {notification && (
        <Toast notification={notification} />
      )}
      
      {/* Header */}
      <Header view={view} setView={setView} />

      {/* Main Content */}
      <main className="flex-grow container mx-auto p-4">
        {view === "dashboard" && (
          <Dashboard 
            beaches={beaches} 
            homeBeach={homeBeach} 
            onBeachSelect={handleBeachSelect} 
            onSetHomeBeach={handleSetHomeBeach}
            onDeleteBeach={handleDeleteBeach}
            setView={setView}
          />
        )}

        {view === "add" && (
          <AddBeachView 
            onAddBeach={handleAddBeach} 
            onAddSuggested={handleAddSuggested}
            setView={setView}
            toast={toast}
          />
        )}

        {view === "detail" && selectedBeach && (
          <ErrorBoundary>
            <BeachDetailView 
              beach={selectedBeach}
              homeBeach={homeBeach}
              onSetHomeBeach={handleSetHomeBeach}
              timeRange={timeRange}
              onTimeRangeChange={handleTimeRangeChange}
              setView={setView}
              beaches={beaches}
              toast={toast}
              mockDataRef={mockDataRef}
              debugMode={debugMode}
            />
          </ErrorBoundary>
        )}
      </main>

      {/* Footer */}
      <Footer debugMode={debugMode} setDebugMode={setDebugMode} />
      
      {/* Delete Confirmation Modal */}
      {deleteConfirm && (
        <DeleteConfirmationModal 
          beach={beaches.find(b => b.id === deleteConfirm)}
          onConfirm={confirmDeleteBeach}
          onCancel={cancelDeleteBeach}
        />
      )}
    </div>
  );
};

export default App;

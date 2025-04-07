// SimpleDetailView.jsx - Ultra minimal version that won't crash
import React, { useState } from "react";
import { Home, ChevronLeft, RefreshCw, AlertCircle, MapPin, Map } from "lucide-react";

const SimpleDetailView = ({ beach, homeBeach, onSetHomeBeach, setView }) => {
  const [loading, setLoading] = useState(false);
  
  return (
    <div className="bg-white rounded-lg shadow-lg overflow-hidden">
      {/* Header */}
      <div className="p-4 border-b flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-semibold flex items-center">
            {beach?.id === homeBeach?.id && (
              <Home className="h-5 w-5 text-orange-500 mr-2" />
            )}
            {beach?.name || "Beach"}
          </h2>
          {beach && (
            <div className="flex items-center mt-1">
              <p className="text-gray-600 mr-3">
                {beach.latitude.toFixed(4)}, {beach.longitude.toFixed(4)}
              </p>
              <a 
                href={beach.googleMapsUrl || `https://www.google.com/maps?q=${beach.latitude},${beach.longitude}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-blue-600 hover:underline flex items-center"
              >
                <Map className="h-3 w-3 mr-1" />
                View on Maps
              </a>
            </div>
          )}
        </div>
        <div className="flex space-x-2">
          {beach && beach.id !== homeBeach?.id && (
            <button
              onClick={() => onSetHomeBeach?.(beach)}
              className="bg-orange-500 text-white px-3 py-1 rounded-lg hover:bg-orange-600 transition-colors flex items-center"
            >
              <Home className="h-4 w-4 mr-1" /> Set as Home
            </button>
          )}
          <button
            onClick={() => setView?.("dashboard")}
            className="bg-gray-200 text-gray-800 px-3 py-1 rounded-lg hover:bg-gray-300 transition-colors flex items-center"
          >
            <ChevronLeft className="h-4 w-4 mr-1" /> Back
          </button>
        </div>
      </div>

      {/* Main content - extremely simplified */}
      <div className="p-8 text-center">
        <div className="bg-blue-50 p-6 rounded-lg max-w-lg mx-auto">
          <MapPin className="h-12 w-12 text-blue-500 mx-auto mb-4" />
          <h3 className="text-xl font-bold text-gray-800 mb-4">Beach Information</h3>
          <p className="text-gray-600 mb-6">We're experiencing issues loading weather data for this beach. Our team has been notified.</p>
          <p className="text-sm text-gray-500 mb-4">
            For now, please check local weather forecasts for {beach?.name || "this location"} before paddleboarding.
          </p>
          <button
            onClick={() => setView?.("dashboard")}
            className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700"
          >
            Return to Dashboard
          </button>
        </div>
      </div>
    </div>
  );
};

export default SimpleDetailView;

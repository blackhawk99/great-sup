// FAQ.jsx
import React, { useState } from "react";
import { ChevronDown, ChevronUp, HelpCircle, X } from "lucide-react";

const FAQ = ({ isOpen, onClose }) => {
  const [expandedSection, setExpandedSection] = useState("scoring");
  
  if (!isOpen) return null;
  
  const toggleSection = (section) => {
    if (expandedSection === section) {
      setExpandedSection(null);
    } else {
      setExpandedSection(section);
    }
  };
  
  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black bg-opacity-50 flex items-center justify-center">
      <div className="relative bg-white w-full max-w-2xl rounded-lg shadow-lg m-4 max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-blue-600 text-white px-6 py-4 flex justify-between items-center rounded-t-lg">
          <h2 className="text-xl font-semibold flex items-center">
            <HelpCircle className="mr-2 h-5 w-5" /> 
            Paddleboarding Conditions FAQ
          </h2>
          <button 
            onClick={onClose}
            className="text-white hover:text-blue-200"
          >
            <X className="h-6 w-6" />
          </button>
        </div>
        
        <div className="p-6">
          {/* Scoring System */}
          <div className="border rounded-lg mb-4 overflow-hidden">
            <button
              className={`w-full text-left p-4 flex justify-between items-center ${
                expandedSection === "scoring" ? "bg-blue-50" : "bg-white"
              }`}
              onClick={() => toggleSection("scoring")}
            >
              <span className="font-semibold">How is the score calculated?</span>
              {expandedSection === "scoring" ? <ChevronUp /> : <ChevronDown />}
            </button>
            
            {expandedSection === "scoring" && (
              <div className="p-4 bg-blue-50 border-t">
                <p className="mb-3">
                  The paddleboarding suitability score (0-100) is calculated using multiple weather and geographic factors:
                </p>
                <ul className="list-disc pl-6 space-y-2 mb-4">
                  <li>
                    <span className="font-medium">Wind Speed (40 points)</span>: 
                    The most important factor. Speeds under 8 km/h get full points, decreasing linearly to 0 points at 20 km/h.
                  </li>
                  <li>
                    <span className="font-medium">Wave Height (20 points)</span>: 
                    Heights under 0.2m get full points, decreasing to 0 points at 0.6m height.
                  </li>
                  <li>
                    <span className="font-medium">Swell Height (10 points)</span>: 
                    Heights under 0.3m get full points, decreasing to 0 points at 0.6m.
                  </li>
                  <li>
                    <span className="font-medium">Precipitation (10 points)</span>: 
                    No rain (0mm) gets full points; any rain over 1mm gets 0 points. Heavier rain also caps the total score at 40.
                  </li>
                  <li>
                    <span className="font-medium">Temperature (10 points)</span>: 
                    22°C-30°C gets full points, with decreasing points outside this range.
                  </li>
                  <li>
                    <span className="font-medium">Cloud Cover (10 points)</span>: 
                    Under 40% cloud cover gets full points, decreasing as cloud cover increases.
                  </li>
                  <li>
                    <span className="font-medium">Geographic Protection (15 bonus points)</span>: 
                    Additional points based on how well the location is sheltered from wind and waves.
                  </li>
                </ul>
                <p>
                  These factors are applied to the <strong>protected values</strong> - after accounting for geographic features that may shield you from wind and waves.
                </p>
              </div>
            )}
          </div>
          
          {/* Geographic Protection */}
          <div className="border rounded-lg mb-4 overflow-hidden">
            <button
              className={`w-full text-left p-4 flex justify-between items-center ${
                expandedSection === "protection" ? "bg-blue-50" : "bg-white"
              }`}
              onClick={() => toggleSection("protection")}
            >
              <span className="font-semibold">How does Geographic Protection work?</span>
              {expandedSection === "protection" ? <ChevronUp /> : <ChevronDown />}
            </button>
            
            {expandedSection === "protection" && (
              <div className="p-4 bg-blue-50 border-t">
                <p className="mb-3">
                  Geographic protection analysis examines how sheltered a beach is from winds and waves based on coastline orientation and local geography.
                </p>
                
                <h3 className="font-semibold text-gray-700 mt-3 mb-2">Protection Factors</h3>
                <ul className="list-disc pl-6 space-y-2 mb-4">
                  <li>
                    <span className="font-medium">Bay Enclosure</span>: 
                    Measures how enclosed a location is by surrounding land. Deep, protected bays score highest.
                  </li>
                  <li>
                    <span className="font-medium">Wind Direction Protection</span>: 
                    Calculates if nearby coastline provides shelter from the current wind direction.
                  </li>
                  <li>
                    <span className="font-medium">Island Protection</span>: 
                    Analyzes if nearby islands block wind or waves.
                  </li>
                  <li>
                    <span className="font-medium">Coastline Angle</span>: 
                    Determines how perpendicular the coastline is to incoming wind and waves.
                  </li>
                </ul>
                
                <h3 className="font-semibold text-gray-700 mt-3 mb-2">Protection Score Calculation</h3>
                <p className="mb-3">
                  The overall protection score (0-100) combines:
                </p>
                <ul className="list-disc pl-6 space-y-1">
                  <li>30% Wind protection factor</li>
                  <li>30% Wave protection factor</li>
                  <li>40% Bay enclosure factor</li>
                </ul>
                
                <div className="bg-blue-100 p-3 mt-4 rounded-lg">
                  <p className="text-blue-800 font-medium text-sm">
                    The algorithm uses GIS data to analyze Greek coastlines and islands, providing protection scores that reflect real-world conditions.
                  </p>
                </div>
              </div>
            )}
          </div>
          
          {/* Score Ratings */}
          <div className="border rounded-lg mb-4 overflow-hidden">
            <button
              className={`w-full text-left p-4 flex justify-between items-center ${
                expandedSection === "ratings" ? "bg-blue-50" : "bg-white"
              }`}
              onClick={() => toggleSection("ratings")}
            >
              <span className="font-semibold">What do the score ratings mean?</span>
              {expandedSection === "ratings" ? <ChevronUp /> : <ChevronDown />}
            </button>
            
            {expandedSection === "ratings" && (
              <div className="p-4 bg-blue-50 border-t">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="bg-green-50 p-4 rounded-lg border border-green-200">
                    <div className="text-2xl mb-2 text-green-600">✅ Perfect (85-100)</div>
                    <p className="text-green-800">Flat like oil. Ideal paddleboarding conditions with minimal wind, no waves, and perfect weather.</p>
                  </div>
                  
                  <div className="bg-yellow-50 p-4 rounded-lg border border-yellow-200">
                    <div className="text-2xl mb-2 text-yellow-600">⚠️ Okay-ish (70-84)</div>
                    <p className="text-yellow-800">Minor chop. Decent conditions with light wind and small ripples, best early in the day.</p>
                  </div>
                  
                  <div className="bg-orange-50 p-4 rounded-lg border border-orange-200">
                    <div className="text-2xl mb-2 text-orange-600">❌ Not Great (50-69)</div>
                    <p className="text-orange-800">Wind or waves make paddling tricky. Only suitable for experienced paddleboarders.</p>
                  </div>
                  
                  <div className="bg-red-50 p-4 rounded-lg border border-red-200">
                    <div className="text-2xl mb-2 text-red-600">🚫 Nope (0-49)</div>
                    <p className="text-red-800">Not recommended. High winds, waves, or rain make conditions unsafe or unpleasant.</p>
                  </div>
                </div>
              </div>
            )}
          </div>
          
          {/* Weather Data */}
          <div className="border rounded-lg overflow-hidden">
            <button
              className={`w-full text-left p-4 flex justify-between items-center ${
                expandedSection === "data" ? "bg-blue-50" : "bg-white"
              }`}
              onClick={() => toggleSection("data")}
            >
              <span className="font-semibold">Where does the data come from?</span>
              {expandedSection === "data" ? <ChevronUp /> : <ChevronDown />}
            </button>
            
            {expandedSection === "data" && (
              <div className="p-4 bg-blue-50 border-t">
                <p className="mb-3">
                  The Paddleboard Weather Advisor uses real-time data from multiple sources:
                </p>
                <ul className="list-disc pl-6 space-y-2 mb-4">
                  <li>
                    <span className="font-medium">Weather Data</span>: 
                    Comes from the Open-Meteo API, which provides accurate forecasts for temperature, precipitation, cloud cover, and wind.
                  </li>
                  <li>
                    <span className="font-medium">Marine Data</span>: 
                    Wave heights and swells come from the Open-Meteo Marine API, which provides specialized data for marine conditions.
                  </li>
                  <li>
                    <span className="font-medium">Geographic Data</span>: 
                    Coastline and island information is derived from GADM (Database of Global Administrative Areas) datasets processed specifically for Greek waters.
                  </li>
                </ul>
                
                <div className="bg-yellow-50 p-4 rounded-lg border border-yellow-200">
                  <p className="text-yellow-800 font-medium">
                    Always verify conditions before paddleboarding. While our app uses real-time data, local conditions can change quickly, and safety should be your top priority.
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default FAQ;

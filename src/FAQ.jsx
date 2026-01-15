// FAQ.jsx
import React, { useState } from "react";
import { ChevronDown, ChevronUp, HelpCircle, X } from "lucide-react";

const FAQ = ({ isOpen, onClose }) => {
  const [expandedSection, setExpandedSection] = useState("usage");

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
        <div className="sticky top-0 bg-gradient-to-r from-slate-900 via-blue-900 to-cyan-900 text-white px-6 py-4 flex justify-between items-center rounded-t-lg">
          <h2 className="text-xl font-semibold flex items-center">
            <HelpCircle className="mr-2 h-5 w-5" />
            SUP Weather FAQ
          </h2>
          <button
            onClick={onClose}
            className="text-white hover:text-blue-200"
          >
            <X className="h-6 w-6" />
          </button>
        </div>

        <div className="p-6">
          {/* Using the App */}
          <div className="border rounded-lg mb-4 overflow-hidden">
            <button
              className={`w-full text-left p-4 flex justify-between items-center ${
                expandedSection === "usage" ? "bg-blue-50" : "bg-white"
              }`}
              onClick={() => toggleSection("usage")}
            >
              <span className="font-semibold">How do I use this app?</span>
              {expandedSection === "usage" ? <ChevronUp /> : <ChevronDown />}
            </button>

            {expandedSection === "usage" && (
              <div className="p-4 bg-blue-50 border-t space-y-3">
                <p>
                  <strong>Adding beaches:</strong> Go to <em>Add Beach</em> and either paste a Google Maps URL, search by name, or enter coordinates manually. The app automatically snaps coordinates to the nearest coastline.
                </p>
                <p>
                  <strong>Checking conditions:</strong> Click on any beach from the dashboard, then tap <em>View Conditions</em>. Select your date and time window to see the forecast.
                </p>
                <p>
                  <strong>What you'll see:</strong> Real-time weather data, wave conditions, UV index, sunrise/sunset times, wind direction, and an interactive map. The score breakdown shows exactly how each factor contributes.
                </p>
                <p>
                  <strong>Storage:</strong> Your beaches and home beach are saved in your browser's local storage.
                </p>
              </div>
            )}
          </div>

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
                  The paddle score (0-100) is calculated from 10 factors, weighted for SUP conditions:
                </p>
                <div className="grid grid-cols-2 gap-2 mb-4 text-sm">
                  <div className="bg-white p-2 rounded border">
                    <span className="font-medium text-blue-700">Wind Speed</span>
                    <span className="float-right">20 pts</span>
                  </div>
                  <div className="bg-white p-2 rounded border">
                    <span className="font-medium text-blue-700">Wave Height</span>
                    <span className="float-right">20 pts</span>
                  </div>
                  <div className="bg-white p-2 rounded border">
                    <span className="font-medium text-blue-700">Water Temp</span>
                    <span className="float-right">12 pts</span>
                  </div>
                  <div className="bg-white p-2 rounded border">
                    <span className="font-medium text-blue-700">Geo Protection</span>
                    <span className="float-right">12 pts</span>
                  </div>
                  <div className="bg-white p-2 rounded border">
                    <span className="font-medium text-blue-700">Currents</span>
                    <span className="float-right">10 pts</span>
                  </div>
                  <div className="bg-white p-2 rounded border">
                    <span className="font-medium text-blue-700">Swell Height</span>
                    <span className="float-right">8 pts</span>
                  </div>
                  <div className="bg-white p-2 rounded border">
                    <span className="font-medium text-blue-700">Gusts</span>
                    <span className="float-right">5 pts</span>
                  </div>
                  <div className="bg-white p-2 rounded border">
                    <span className="font-medium text-blue-700">Precipitation</span>
                    <span className="float-right">5 pts</span>
                  </div>
                  <div className="bg-white p-2 rounded border">
                    <span className="font-medium text-blue-700">Air Temp</span>
                    <span className="float-right">4 pts</span>
                  </div>
                  <div className="bg-white p-2 rounded border">
                    <span className="font-medium text-blue-700">Cloud Cover</span>
                    <span className="float-right">4 pts</span>
                  </div>
                </div>
                <p className="text-sm text-gray-600">
                  Wind and wave values show "protected" estimates that account for geographic shelter.
                  Ideal conditions: wind &lt;10 km/h, waves &lt;0.3m, water temp 18-24°C.
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
              <div className="p-4 bg-blue-50 border-t space-y-3">
                <p>
                  The app uses ray-casting analysis to detect how enclosed a beach is. It shoots 36 rays from the beach location at different distances (0.7km, 1.5km, 3km) and counts how many hit land.
                </p>

                <h3 className="font-semibold text-gray-700 mt-3">Bay Types Detected:</h3>
                <ul className="list-disc pl-6 space-y-1 text-sm">
                  <li><strong>Deep Bay</strong> - High enclosure at all distances (best protection)</li>
                  <li><strong>Medium Bay</strong> - Good short/mid-range enclosure (800m-1.5km wide bays)</li>
                  <li><strong>Peninsula</strong> - Inverted pattern where long-range has more land (regional shelter)</li>
                  <li><strong>Wide Bay</strong> - Wide mouth but headlands at distance</li>
                  <li><strong>Shallow Bay</strong> - Small coves with close shelter</li>
                  <li><strong>Moderate Coast</strong> - Some protection but not a defined bay</li>
                  <li><strong>Exposed</strong> - Open coastline</li>
                </ul>

                <div className="bg-blue-100 p-3 mt-3 rounded-lg text-sm">
                  <strong>Wave diffraction:</strong> Waves bend around obstacles, so narrow headlands provide less wave protection than wind protection. The algorithm accounts for this physics.
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
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div className="bg-green-50 p-3 rounded-lg border border-green-200">
                    <div className="text-lg mb-1 text-green-600 font-semibold">85-100: Perfect</div>
                    <p className="text-green-800 text-sm">Glass-like conditions. Ideal for all skill levels.</p>
                  </div>

                  <div className="bg-yellow-50 p-3 rounded-lg border border-yellow-200">
                    <div className="text-lg mb-1 text-yellow-600 font-semibold">70-84: Good</div>
                    <p className="text-yellow-800 text-sm">Minor chop possible. Great for most paddlers.</p>
                  </div>

                  <div className="bg-orange-50 p-3 rounded-lg border border-orange-200">
                    <div className="text-lg mb-1 text-orange-600 font-semibold">50-69: Challenging</div>
                    <p className="text-orange-800 text-sm">Wind or waves present. Better for experienced paddlers.</p>
                  </div>

                  <div className="bg-red-50 p-3 rounded-lg border border-red-200">
                    <div className="text-lg mb-1 text-red-600 font-semibold">0-49: Not Recommended</div>
                    <p className="text-red-800 text-sm">Conditions too rough. Consider another day or spot.</p>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Safety Features */}
          <div className="border rounded-lg mb-4 overflow-hidden">
            <button
              className={`w-full text-left p-4 flex justify-between items-center ${
                expandedSection === "safety" ? "bg-blue-50" : "bg-white"
              }`}
              onClick={() => toggleSection("safety")}
            >
              <span className="font-semibold">What safety features are included?</span>
              {expandedSection === "safety" ? <ChevronUp /> : <ChevronDown />}
            </button>

            {expandedSection === "safety" && (
              <div className="p-4 bg-blue-50 border-t space-y-3">
                <ul className="space-y-2">
                  <li>
                    <strong>Daylight warnings:</strong> Alerts when your selected time window is before sunrise or after sunset.
                  </li>
                  <li>
                    <strong>High wind alerts:</strong> Warning when wind speeds exceed 30 km/h.
                  </li>
                  <li>
                    <strong>UV Index:</strong> Shows UV level with safety recommendations (Low/Moderate/High/Very High/Extreme).
                  </li>
                  <li>
                    <strong>Sunrise/Sunset times:</strong> Helps plan your session within daylight hours.
                  </li>
                  <li>
                    <strong>Wind direction arrow:</strong> Visual indicator showing where wind is coming from.
                  </li>
                </ul>
                <div className="bg-yellow-50 p-3 rounded-lg border border-yellow-200 text-sm">
                  <strong>Always verify conditions in person.</strong> Weather can change quickly. This app is a planning tool, not a substitute for local knowledge and judgment.
                </div>
              </div>
            )}
          </div>

          {/* Data Sources */}
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
              <div className="p-4 bg-blue-50 border-t space-y-2">
                <ul className="space-y-2 text-sm">
                  <li>
                    <strong>Weather:</strong> Open-Meteo API (temperature, wind, precipitation, UV, cloud cover)
                  </li>
                  <li>
                    <strong>Marine:</strong> Open-Meteo Marine API (waves, swell, water temp, currents)
                  </li>
                  <li>
                    <strong>Geographic:</strong> Greek coastlines and islands dataset with ray-casting analysis
                  </li>
                  <li>
                    <strong>Place search:</strong> OpenStreetMap Nominatim API for beach name lookups
                  </li>
                  <li>
                    <strong>Maps:</strong> Leaflet with OpenStreetMap tiles
                  </li>
                </ul>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default FAQ;


import React, { useState, useEffect, useRef } from "react";
import * as turf from '@turf/turf';
import { greeceCoastline } from './data/greece-coastline';
import { generateRays, intersectsCoastline } from './utils/coastlineAnalysis';
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

// The rest of your component logic goes here...
// This version assumes the geospatial logic is now in the utility file.

function App() {
  // Safe place to test logic
  useEffect(() => {
    const testPoint = turf.point([23.7, 37.9]); // Near Athens
    const rays = generateRays(testPoint, 36, 10);
    const result = intersectsCoastline(rays[0], greeceCoastline);
    console.log("Intersection test result:", result);
  }, []);

  return (
    <div>
      <h1>Great SUP</h1>
      {/* Add your actual UI here */}
    </div>
  );
}

export default App;

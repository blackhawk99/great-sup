// utils/helpers.js - Utility functions
import * as turf from '@turf/turf';

// Helper function to convert degrees to cardinal directions
export const getCardinalDirection = (degrees) => {
  const val = Math.floor((degrees / 22.5) + 0.5);
  const directions = ["N", "NNE", "NE", "ENE", "E", "ESE", "SE", "SSE", "S", "SSW", "SW", "WSW", "W", "WNW", "NW", "NNW"];
  return directions[(val % 16)];
};

// Parse Google Maps URL
export const parseGoogleMapsUrl = (url) => {
  if (!url) return null;
  
  // Handle maps.app.goo.gl links
  if (url.includes("maps.app.goo.gl")) {
    // Map specific known beach links to their coordinates
    const mapLinkMapping = {
      "KP6MpuG6mgrv1Adm6": { name: "Kavouri Beach", latitude: 37.8235, longitude: 23.7761, googleMapsUrl: "https://maps.app.goo.gl/KP6MpuG6mgrv1Adm6" },
      "yEXLZW5kwBArCHvb7": { name: "Glyfada Beach", latitude: 37.8650, longitude: 23.7470, googleMapsUrl: "https://maps.app.goo.gl/yEXLZW5kwBArCHvb7" },
      // Other beach mappings...
    };
    
    // Extract the ID from the URL
    const urlParts = url.split('/');
    const id = urlParts[urlParts.length - 1];
    
    // Check if we have this specific beach
    if (mapLinkMapping[id]) {
      return mapLinkMapping[id];
    }
    
    // Default for unrecognized URLs
    return {
      name: "Beach",
      latitude: 37.8, // Default to Athens area
      longitude: 23.7,
      googleMapsUrl: url
    };
  }
  
  // Handle @lat,lng format
  let match = url.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/);
  if (match) {
    return {
      latitude: parseFloat(match[1]),
      longitude: parseFloat(match[2]),
      googleMapsUrl: url
    };
  }
  
  // Handle ?q=lat,lng format
  match = url.match(/\?q=(-?\d+\.\d+),(-?\d+\.\d+)/);
  if (match) {
    return {
      latitude: parseFloat(match[1]),
      longitude: parseFloat(match[2]),
      googleMapsUrl: url
    };
  }
  
  return null;
};

// Mock data hook
export const useMockData = () => {
  const mockDataRef = useRef({
    // Kavouri beach - exposed to southern winds
    "Kavouri Beach": {
      hourly: {
        // Mock data for Kavouri Beach
      },
      daily: {
        wave_height_max: [0.4],
        wave_direction_dominant: [170],
      }
    },
    // Other beaches and default data...
  });
  
  // Validate mock data on mount
  useEffect(() => {
    // Validation logic for mock data
  }, []);
  
  return { mockDataRef };
};

// Components for shared UI elements
export const ErrorBoundary = ({ children }) => {
  // Error boundary implementation
};

export const DatePickerModal = ({ onSelect, onClose }) => {
  // Date picker implementation
};

export const Toast = ({ notification }) => {
  // Toast notification component
};

export const DeleteConfirmationModal = ({ beach, onConfirm, onCancel }) => {
  // Delete confirmation modal implementation
};

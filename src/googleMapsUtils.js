// Utilities for parsing Google Maps URLs without React

// Helper function to try extracting location name from URL parameters
const extractNameFromUrl = (url) => {
  try {
    // Try pattern: /place/Name/ in the URL
    let placeMatch = url.match(/\/place\/([^/]+)\//);
    if (placeMatch && placeMatch[1]) {
      const decoded = decodeURIComponent(placeMatch[1]);
      // Clean up the name (replace + and remove coordinates)
      return decoded
        .replace(/\+/g, ' ')
        .replace(/\d+\.\d+,\d+\.\d+/, '')
        .trim();
    }

    // Try pattern: ?q=Name in the URL
    let qMatch = url.match(/[?&]q=([^&@]+)/);
    if (qMatch && qMatch[1]) {
      const decoded = decodeURIComponent(qMatch[1]);
      // Remove coordinates if present
      return decoded
        .replace(/\+/g, ' ')
        .replace(/\d+\.\d+,\d+\.\d+/, '')
        .trim();
    }

    return null;
  } catch (e) {
    console.error("Error extracting name from URL:", e);
    return null;
  }
};

// Parse Google Maps URL - standard pattern only, short URLs now handled by proxy.js
export const parseGoogleMapsUrl = (url) => {
  if (!url) return null;

  // Extract name if it's in the URL
  const nameFromUrl = extractNameFromUrl(url);

  // Handle standard Google Maps URL with @lat,lng
  let match = url.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/);
  if (match) {
    return {
      name: nameFromUrl || "New Beach",
      latitude: parseFloat(match[1]),
      longitude: parseFloat(match[2]),
      googleMapsUrl: url
    };
  }

  // Handle ?q=lat,lng format
  match = url.match(/\?q=(-?\d+\.\d+),(-?\d+\.\d+)/);
  if (match) {
    return {
      name: nameFromUrl || "New Beach",
      latitude: parseFloat(match[1]),
      longitude: parseFloat(match[2]),
      googleMapsUrl: url
    };
  }

  // If it's a short URL, return null to let the proxy handler take over
  if (url.includes("goo.gl")) {
    return null;
  }

  return null;
};

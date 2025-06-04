import { useState, useEffect } from "react";
import { analyzeBayProtection } from "./utils/coastlineAnalysis";
import { parseGoogleMapsUrl } from "./helpers.jsx";
import { resolveGoogleMapsShortUrl } from "./proxy";
import { getCardinalDirection } from "./helpers.jsx";

export const useBeachManager = () => {
  const [beaches, setBeaches] = useState([]);
  const [homeBeach, setHomeBeach] = useState(null);
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [newBeach, setNewBeach] = useState({
    name: "",
    latitude: "",
    longitude: "",
    googleMapsUrl: "",
  });
  const [mapUrl, setMapUrl] = useState("");
  const [loading, setLoading] = useState(false);
  
  // Load saved beaches from localStorage on component mount
  useEffect(() => {
    try {
      const savedBeaches = localStorage.getItem("beaches");
      if (savedBeaches) {
        const parsedBeaches = JSON.parse(savedBeaches);
        setBeaches(parsedBeaches);
      }

      const savedHomeBeach = localStorage.getItem("homeBeach");
      if (savedHomeBeach) {
        setHomeBeach(JSON.parse(savedHomeBeach));
      }
    } catch (error) {
      console.error("Error loading saved data:", error);
      localStorage.removeItem("beaches");
      localStorage.removeItem("homeBeach");
    }
  }, []);

  // Save beaches to localStorage when they change
  useEffect(() => {
    if (beaches.length > 0) {
      localStorage.setItem("beaches", JSON.stringify(beaches));
    } else {
      localStorage.removeItem("beaches");
    }
  }, [beaches]);

  // Save home beach to localStorage when it changes
  useEffect(() => {
    if (homeBeach) {
      localStorage.setItem("homeBeach", JSON.stringify(homeBeach));
    } else {
      localStorage.removeItem("homeBeach");
    }
  }, [homeBeach]);
  
  // Extract coordinates from Google Maps URL with dynamic name extraction
  const handleExtractCoordinates = async () => {
    try {
      setLoading(true);
      console.log("Extracting coordinates from:", mapUrl);
      
      let beachData;
      
      // If it's a short URL (goo.gl), use the resolver
      if (mapUrl.includes("goo.gl")) {
        console.log("Short URL detected, using resolver");
        beachData = await resolveGoogleMapsShortUrl(mapUrl);
      } else {
        // Otherwise use the standard parser
        beachData = parseGoogleMapsUrl(mapUrl);
      }
      
      if (!beachData) {
        throw new Error("Could not extract coordinates from URL. Please check format.");
      }
      
      console.log("Extracted beach data:", beachData);
      
      setNewBeach({
        ...newBeach,
        name: beachData.name || "New Beach",
        latitude: beachData.latitude.toString(),
        longitude: beachData.longitude.toString(),
        googleMapsUrl: beachData.googleMapsUrl || mapUrl,
      });
      
      // Perform dynamic protection analysis with default wind/wave values
      try {
        const analysis = await analyzeBayProtection(
          beachData.latitude,
          beachData.longitude,
          180, // Default south wind
          180  // Default south waves
        );
        
        if (beachData.name === "New Beach" || !beachData.name) {
          // Try to generate a better name based on protection
          const directionName = getCardinalDirection((analysis.coastlineAngle + 180) % 360);
          let protectionName = "Beach";
          
          if (analysis.bayEnclosure > 0.7) {
            protectionName = "Protected Bay";
          } else if (analysis.bayEnclosure > 0.4) {
            protectionName = "Cove";
          } else {
            protectionName = "Beach";
          }
          
          setNewBeach(prev => ({
            ...prev,
            name: `${directionName} ${protectionName}`,
            protectionScore: analysis.protectionScore,
            bayEnclosure: analysis.bayEnclosure
          }));
        }
      } catch (analysisError) {
        console.error("Protection analysis failed:", analysisError);
        // Continue without the analysis
      }
      return true;
    } catch (error) {
      console.error("Error extracting coordinates:", error);
      throw error;
    } finally {
      setLoading(false);
    }
  };
  
  // Handle beach deletion
  const deleteBeach = (beachId) => {
    const beach = beaches.find(b => b.id === beachId);
    if (!beach) {
      console.error("Beach not found");
      return;
    }
    setDeleteConfirm(beachId);
  };
  
  const confirmDelete = (beachId) => {
    const beachToDelete = beaches.find(b => b.id === beachId);
    if (!beachToDelete) {
      console.error("Beach not found");
      setDeleteConfirm(null);
      return '';
    }
    
    const newBeaches = beaches.filter(b => b.id !== beachId);
    setBeaches(newBeaches);
    
    // If we're deleting the home beach, unset it
    if (homeBeach && homeBeach.id === beachId) {
      setHomeBeach(null);
    }
    
    setDeleteConfirm(null);
    return beachToDelete.name;
  };
  
  const cancelDelete = () => {
    setDeleteConfirm(null);
  };
  
  // Add new beach with protection analysis
  const addBeach = async () => {
    try {
      if (!newBeach.name || !newBeach.latitude || !newBeach.longitude) {
        throw new Error("Please fill in all beach details");
      }
      
      const lat = parseFloat(newBeach.latitude);
      const lng = parseFloat(newBeach.longitude);
      
      if (isNaN(lat) || isNaN(lng)) {
        throw new Error("Invalid coordinates");
      }
      
      // Check for duplicates
      const isDuplicate = beaches.some(beach => 
        (Math.abs(beach.latitude - lat) < 0.01 && 
         Math.abs(beach.longitude - lng) < 0.01) ||
        beach.name.toLowerCase() === newBeach.name.toLowerCase()
      );
      
      if (isDuplicate) {
        throw new Error("This beach already exists in your list!");
      }
      
      // Create the beach
      const beachToAdd = {
        id: `beach-${Date.now()}`,
        name: newBeach.name,
        latitude: lat,
        longitude: lng,
        googleMapsUrl: newBeach.googleMapsUrl || mapUrl,
      };
      
      // If we have pre-analyzed protection data, add it
      if (newBeach.protectionScore !== undefined) {
        beachToAdd.protectionScore = newBeach.protectionScore;
        beachToAdd.bayEnclosure = newBeach.bayEnclosure;
      }

      setBeaches([...beaches, beachToAdd]);
      setNewBeach({ name: "", latitude: "", longitude: "", googleMapsUrl: "" });
      setMapUrl("");
      return beachToAdd;
    } catch (error) {
      console.error("Error adding beach:", error);
      throw error;
    }
  };

  // Add suggested location with protection data
  const addSuggestedBeach = async (location) => {
    try {
      if (!location || !location.name || !location.latitude || !location.longitude) {
        throw new Error("Invalid location data");
      }
      
      // Check for duplicates
      const isDuplicate = beaches.some(beach => 
        (Math.abs(beach.latitude - location.latitude) < 0.01 && 
         Math.abs(beach.longitude - location.longitude) < 0.01) ||
        beach.name.toLowerCase() === location.name.toLowerCase()
      );
      
      if (isDuplicate) {
        throw new Error("This beach already exists in your list!");
      }
      
      const beachToAdd = {
        id: `beach-${Date.now()}`,
        name: location.name,
        latitude: location.latitude,
        longitude: location.longitude,
        googleMapsUrl: location.googleMapsUrl,
      };

      setBeaches([...beaches, beachToAdd]);
      return beachToAdd;
    } catch (error) {
      console.error("Error adding suggested beach:", error);
      throw error;
    }
  };
  
  return {
    beaches,
    homeBeach,
    setHomeBeach,
    addBeach,
    addSuggestedBeach,
    deleteBeach,
    confirmDelete,
    cancelDelete,
    deleteConfirm,
    handleExtractCoordinates,
    newBeach,
    setNewBeach,
    mapUrl,
    setMapUrl,
    loading
  };
};

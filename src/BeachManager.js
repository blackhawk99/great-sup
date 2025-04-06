// hooks/useBeachManager.js - Handles beach data and operations
import { useState, useEffect } from "react";

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
  
  // Handle beach deletion
  const handleDeleteBeach = (beachId) => {
    const beach = beaches.find(b => b.id === beachId);
    if (!beach) {
      console.error("Beach not found");
      return;
    }
    setDeleteConfirm(beachId);
  };
  
  const confirmDeleteBeach = (beachId) => {
    const beachToDelete = beaches.find(b => b.id === beachId);
    if (!beachToDelete) {
      console.error("Beach not found");
      setDeleteConfirm(null);
      return;
    }
    
    const newBeaches = beaches.filter(b => b.id !== beachId);
    setBeaches(newBeaches);
    
    // If we're deleting the home beach, unset it
    if (homeBeach && homeBeach.id === beachId) {
      setHomeBeach(null);
    }
    
    setDeleteConfirm(null);
    return beachToDelete.name; // Return name for toast message
  };
  
  const cancelDeleteBeach = () => {
    setDeleteConfirm(null);
  };
  
  // Add new beach
  const handleAddBeach = async (beachData) => {
    try {
      if (!beachData.name || !beachData.latitude || !beachData.longitude) {
        throw new Error("Please fill in all beach details");
      }
      
      const lat = parseFloat(beachData.latitude);
      const lng = parseFloat(beachData.longitude);
      
      if (isNaN(lat) || isNaN(lng)) {
        throw new Error("Invalid coordinates");
      }
      
      // Check for duplicates
      const isDuplicate = beaches.some(beach => 
        (Math.abs(beach.latitude - lat) < 0.01 && 
         Math.abs(beach.longitude - lng) < 0.01) ||
        beach.name.toLowerCase() === beachData.name.toLowerCase()
      );
      
      if (isDuplicate) {
        throw new Error("This beach already exists in your list!");
      }
      
      // Create the beach
      const beachToAdd = {
        id: `beach-${Date.now()}`,
        name: beachData.name,
        latitude: lat,
        longitude: lng,
        googleMapsUrl: beachData.googleMapsUrl || "",
      };
      
      // If we have pre-analyzed protection data, add it
      if (beachData.protectionScore !== undefined) {
        beachToAdd.protectionScore = beachData.protectionScore;
        beachToAdd.bayEnclosure = beachData.bayEnclosure;
      }

      setBeaches([...beaches, beachToAdd]);
      return beachToAdd;
    } catch (error) {
      console.error("Error adding beach:", error);
      throw error;
    }
  };
  
  // Add suggested location
  const handleAddSuggested = async (location) => {
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
    handleAddBeach,
    handleAddSuggested,
    handleDeleteBeach,
    confirmDeleteBeach,
    cancelDeleteBeach,
    deleteConfirm,
    setDeleteConfirm,
    newBeach,
    setNewBeach
  };
};

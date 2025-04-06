// utils/coastlineAnalysis.js
import * as turf from '@turf/turf';
import { greeceCoastline } from '../data/greece-coastline';

// Generate rays from a point in all directions
export function generateRays(center, numRays, distance) {
  const rays = [];
  const [lng, lat] = center.coordinates;
  
  for (let i = 0; i < numRays; i++) {
    const angle = (i * 360) / numRays;
    const destination = turf.destination(center, distance, angle, { units: 'kilometers' });
    rays.push(turf.lineString([center.coordinates, destination.coordinates]));
  }
  
  return rays;
}

// Check if a ray intersects with the coastline
export function intersectsCoastline(ray, coastline) {
  let minDistance = Infinity;
  let intersection = null;
  
  for (const feature of coastline.features) {
    if (feature.geometry.type === 'LineString') {
      const line = turf.lineString(feature.geometry.coordinates);
      const intersects = turf.lineIntersect(ray, line);
      
      if (intersects.features.length > 0) {
        // Find closest intersection
        for (const point of intersects.features) {
          const distance = turf.distance(
            turf.point(ray.geometry.coordinates[0]), 
            point, 
            { units: 'kilometers' }
          );
          
          if (distance < minDistance) {
            minDistance = distance;
            intersection = point;
          }
        }
      }
    }
  }
  
  return {
    intersects: intersection !== null,
    distance: minDistance === Infinity ? null : minDistance,
    point: intersection
  };
}

// Find the nearest coastline segment to a beach
export function findNearestCoastlineSegment(beachPoint, coastline) {
  let minDistance = Infinity;
  let nearestSegment = null;
  
  for (const feature of coastline.features) {
    if (feature.geometry.type === 'LineString') {
      const coords = feature.geometry.coordinates;
      
      for (let i = 0; i < coords.length - 1; i++) {
        const segment = turf.lineString([coords[i], coords[i+1]]);
        const nearest = turf.nearestPointOnLine(segment, beachPoint);
        
        if (nearest.properties.dist < minDistance) {
          minDistance = nearest.properties.dist;
          nearestSegment = [coords[i], coords[i+1]];
        }
      }
    }
  }
  
  return nearestSegment;
}

// Calculate directional exposure/protection
export function calculateDirectionalExposure(windDirection, coastlineAngle) {
  // Normalize angles to 0-360
  windDirection = (windDirection + 360) % 360;
  coastlineAngle = (coastlineAngle + 360) % 360;
  
  // Calculate the absolute angular difference
  const diff = Math.abs(windDirection - coastlineAngle);
  return Math.min(diff, 360 - diff);
}

// Generate a human-readable description of protection
export function generateProtectionDescription(enclosureScore, coastlineAngle, windProtection, waveProtection) {
  const direction = getCardinalDirection(coastlineAngle);
  let enclosureText = '';
  let protectionText = '';
  
  if (enclosureScore > 0.7) {
    enclosureText = 'well-protected bay';
  } else if (enclosureScore > 0.4) {
    enclosureText = 'moderately protected beach';
  } else {
    enclosureText = 'exposed beach';
  }
  
  const avgProtection = (windProtection + waveProtection) / 2;
  
  if (avgProtection > 0.7) {
    protectionText = 'excellent wind and wave protection';
  } else if (avgProtection > 0.4) {
    protectionText = 'moderate protection from prevailing conditions';
  } else {
    protectionText = 'limited protection from current conditions';
  }
  
  return `${enclosureText.charAt(0).toUpperCase() + enclosureText.slice(1)} facing ${direction} with ${protectionText}.`;
}

// Helper function for cardinal directions
export function getCardinalDirection(degrees) {
  const val = Math.floor((degrees / 22.5) + 0.5);
  const directions = ["N", "NNE", "NE", "ENE", "E", "ESE", "SE", "SSE", "S", "SSW", "SW", "WSW", "W", "WNW", "NW", "NNW"];
  return directions[(val % 16)];
}

// Main analysis function
export async function analyzeBayProtection(latitude, longitude, windDirection, waveDirection) {
  try {
    // Create a point from the coordinates
    const beachPoint = turf.point([longitude, latitude]);
    
    // Find the nearest coastline segment
    const nearestSegment = findNearestCoastlineSegment(beachPoint, greeceCoastline);
    
    if (!nearestSegment) {
      throw new Error('Could not find nearby coastline');
    }
    
    // Calculate coastline orientation
    const coastlineAngle = turf.bearing(
      turf.point(nearestSegment[0]),
      turf.point(nearestSegment[1])
    );
    
    // Calculate bay enclosure by casting rays
    const rays = generateRays(beachPoint, 36, 1.5); // 36 rays, every 10 degrees, 1.5km each
    const hits = rays.map(ray => intersectsCoastline(ray, greeceCoastline));
    const enclosureScore = hits.filter(hit => hit.intersects && hit.distance < 1).length / rays.length;
    
    // Calculate protection from wind and waves
    const windExposure = calculateDirectionalExposure(windDirection, coastlineAngle);
    const windProtection = 1 - Math.cos(windExposure * Math.PI / 180);
    const totalWindProtection = windProtection * (0.5 + 0.5 * enclosureScore);
    
    const waveExposure = calculateDirectionalExposure(waveDirection, coastlineAngle);
    const waveProtection = 1 - Math.cos(waveExposure * Math.PI / 180);
    const totalWaveProtection = waveProtection * (0.5 + 0.5 * enclosureScore);
    
    // Compute final protection score
    const protectionScore = (
      0.3 * totalWindProtection +
      0.3 * totalWaveProtection +
      0.4 * enclosureScore
    ) * 100;
    
    return {
      protectionScore,
      coastlineAngle,
      enclosureScore,
      windProtection: totalWindProtection,
      waveProtection: totalWaveProtection,
      bayEnclosure: enclosureScore,
      isProtected: protectionScore > 50,
      description: generateProtectionDescription(
        enclosureScore, 
        coastlineAngle, 
        totalWindProtection,
        totalWaveProtection
      )
    };
  } catch (error) {
    console.error("Error in coastline analysis:", error);
    // Return default values as fallback
    return {
      protectionScore: 50,
      coastlineAngle: 0,
      enclosureScore: 0.5,
      windProtection: 0.5,
      waveProtection: 0.5,
      bayEnclosure: 0.5,
      isProtected: true,
      description: "Could not analyze coastline protection. Using default values."
    };
  }
}

// ADD THIS FUNCTION to export calculateGeographicProtection
export const calculateGeographicProtection = async (beach, windDirection, waveDirection) => {
  if (!beach || !beach.latitude || !beach.longitude) {
    throw new Error('Invalid beach data for protection calculation');
  }
  
  try {
    // Always use dynamic analysis for any beach in Greece
    const dynamicAnalysis = await analyzeBayProtection(
      beach.latitude,
      beach.longitude,
      windDirection,
      waveDirection
    );
    
    return dynamicAnalysis;
  } catch (error) {
    console.error("Dynamic protection analysis failed:", error);
    
    // Fallback to simple estimation
    return {
      protectionScore: 50,
      coastlineAngle: 0,
      windProtection: 0.5,
      waveProtection: 0.5,
      bayEnclosure: 0.5,
      isProtected: true
    };
  }
};

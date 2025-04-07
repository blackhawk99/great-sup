// src/utils/coastlineAnalysis.js
import * as turf from '@turf/turf';
import { greeceCoastlines } from '../data/greece-coastlines';
import { greeceIslands } from '../data/greece-islands';

// Generate rays from a point in all directions
export function generateRays(center, numRays, distance) {
  const rays = [];
  const [lng, lat] = center.geometry.coordinates;
  
  for (let i = 0; i < numRays; i++) {
    const angle = (i * 360) / numRays;
    const destination = turf.destination(center, distance, angle, { units: 'kilometers' });
    rays.push(turf.lineString([center.geometry.coordinates, destination.geometry.coordinates]));
  }
  
  return rays;
}

// Check if a ray intersects with coastlines or islands
export function intersectsLandmass(ray, coastlines, islands) {
  let minDistance = Infinity;
  let intersection = null;
  
  // Check coastlines
  for (const feature of coastlines.features) {
    if (feature.geometry.type === 'LineString') {
      try {
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
      } catch (error) {
        console.error("Error checking coastline intersection:", error);
      }
    }
  }
  
  // Check islands - treat island boundaries as coastlines
  for (const feature of islands.features) {
    if (feature.geometry.type === 'Polygon') {
      try {
        // Convert polygon to line (its boundary)
        const polygon = turf.polygon(feature.geometry.coordinates);
        const boundary = turf.polygonToLine(polygon);
        
        const intersects = turf.lineIntersect(ray, boundary);
        
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
      } catch (error) {
        console.error(`Error checking island intersection:`, error);
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
export function findNearestCoastlineSegment(beachPoint, coastlines) {
  let minDistance = Infinity;
  let nearestSegment = null;
  
  for (const feature of coastlines.features) {
    if (feature.geometry.type === 'LineString') {
      const coords = feature.geometry.coordinates;
      
      for (let i = 0; i < coords.length - 1; i++) {
        try {
          const segment = turf.lineString([coords[i], coords[i+1]]);
          const nearest = turf.nearestPointOnLine(segment, beachPoint);
          
          if (nearest.properties.dist < minDistance) {
            minDistance = nearest.properties.dist;
            nearestSegment = [coords[i], coords[i+1]];
          }
        } catch (error) {
          console.error("Error finding nearest coastline segment:", error);
          // Continue to next segment
        }
      }
    }
  }
  
  return nearestSegment;
}

// Find multiple relevant coastline segments near a beach
export function findRelevantCoastlineSegments(beachPoint, coastlines, maxDistance = 3) {
  let relevantSegments = [];
  
  for (const feature of coastlines.features) {
    if (feature.geometry.type === 'LineString') {
      const coords = feature.geometry.coordinates;
      
      for (let i = 0; i < coords.length - 1; i++) {
        try {
          const segment = turf.lineString([coords[i], coords[i+1]]);
          const nearest = turf.nearestPointOnLine(segment, beachPoint);
          
          // If within maxDistance km, include this segment
          if (nearest.properties.dist <= maxDistance) {
            relevantSegments.push({
              segment: [coords[i], coords[i+1]],
              distance: nearest.properties.dist,
              angle: turf.bearing(turf.point(coords[i]), turf.point(coords[i+1])),
              name: feature.properties?.name || 'Unknown coastline'
            });
          }
        } catch (error) {
          console.error("Error finding relevant coastline segments:", error);
          // Continue to next segment
        }
      }
    }
  }
  
  // Sort by distance (closest first)
  return relevantSegments.sort((a, b) => a.distance - b.distance);
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

// Check for island protection
export function checkIslandProtection(beachPoint, windDirection, waveDirection) {
  // Calculate which directions are shielded by islands
  const shieldedDirections = [];
  
  for (const feature of greeceIslands.features) {
    // For each island
    if (feature.geometry.type === 'Polygon') {
      try {
        // Get island center
        const center = turf.centroid(feature);
        
        // Direction from beach to island center
        const bearing = turf.bearing(beachPoint, center);
        
        // Distance from beach to island
        const distance = turf.distance(beachPoint, center, { units: 'kilometers' });
        
        // Skip islands that are too far away (optimization)
        if (distance > 20) continue;
        
        // Approximate island's width perpendicular to the sight line
        const islandPolygon = feature;
        const islandArea = turf.area(islandPolygon);
        const islandSize = Math.sqrt(islandArea) / 1000; // Approximate width in km
        
        // Island "angular width" as seen from beach (simple approximation)
        const angularWidth = Math.atan2(islandSize, distance) * (180 / Math.PI) * 2;
        
        // Strength decreases with distance
        const strengthFactor = Math.min(1, 5 / distance);
        const sizeFactor = Math.min(1, islandSize / 3);
        const strength = strengthFactor * sizeFactor;
        
        shieldedDirections.push({
          name: feature.properties.name,
          direction: bearing,
          width: angularWidth,
          distance: distance,
          strength: strength,
          size: islandSize
        });
      } catch (error) {
        console.error(`Error processing island:`, error);
        // Continue with next island
      }
    }
  }
  
  // Calculate wind protection from islands
  let windIslandProtection = 0;
  let waveIslandProtection = 0;
  
  for (const shield of shieldedDirections) {
    // Wind protection
    const windShieldExposure = calculateDirectionalExposure(windDirection, shield.direction);
    if (windShieldExposure <= shield.width / 2) {
      const directionalFactor = 1 - (windShieldExposure / (shield.width / 2));
      windIslandProtection += shield.strength * directionalFactor;
    }
    
    // Wave protection
    const waveShieldExposure = calculateDirectionalExposure(waveDirection, shield.direction);
    if (waveShieldExposure <= shield.width / 2) {
      const directionalFactor = 1 - (waveShieldExposure / (shield.width / 2));
      waveIslandProtection += shield.strength * directionalFactor;
    }
  }
  
  // Cap at 0.8 (80% protection)
  windIslandProtection = Math.min(0.8, windIslandProtection);
  waveIslandProtection = Math.min(0.8, waveIslandProtection);
  
  return {
    windIslandProtection,
    waveIslandProtection,
    shieldedDirections
  };
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

// Enhanced main analysis function
export async function analyzeBayProtection(latitude, longitude, windDirection, waveDirection) {
  try {
    // Create a point from the coordinates
    const beachPoint = turf.point([longitude, latitude]);
    
    // Find the nearest coastline segment
    const nearestSegment = findNearestCoastlineSegment(beachPoint, greeceCoastlines);
    
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
    const hits = rays.map(ray => intersectsLandmass(ray, greeceCoastlines, greeceIslands));
    const enclosureScore = hits.filter(hit => hit.intersects && hit.distance < 1).length / rays.length;
    
    // Find multiple relevant coastline segments
    const relevantSegments = findRelevantCoastlineSegments(beachPoint, greeceCoastlines);
    
    // Calculate protection using multiple segments
    let bestWindProtection = 0;
    let bestWaveProtection = 0;
    
    // Consider up to 5 closest segments
    for (const segment of relevantSegments.slice(0, 5)) {
      const segmentAngle = segment.angle;
      
      // Calculate wind protection
      const windExposure = calculateDirectionalExposure(windDirection, segmentAngle);
      const windProtection = 1 - Math.cos(windExposure * Math.PI / 180);
      
      // Calculate wave protection
      const waveExposure = calculateDirectionalExposure(waveDirection, segmentAngle);
      const waveProtection = 1 - Math.cos(waveExposure * Math.PI / 180);
      
      // Keep the best protection values
      if (windProtection > bestWindProtection) bestWindProtection = windProtection;
      if (waveProtection > bestWaveProtection) bestWaveProtection = waveProtection;
    }
    
    // Check for island protection
    const islandProtection = checkIslandProtection(beachPoint, windDirection, waveDirection);
    
    // Calculate total protection (coastline + islands)
    const totalWindProtection = Math.min(1, bestWindProtection + islandProtection.windIslandProtection) * 
                               (0.5 + 0.5 * enclosureScore);
    
    const totalWaveProtection = Math.min(1, bestWaveProtection + islandProtection.waveIslandProtection) * 
                               (0.5 + 0.5 * enclosureScore);
    
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
      ),
      nearbyIslands: islandProtection.shieldedDirections.map(d => d.name).join(', '),
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

// Main geographic protection analysis function
export const calculateGeographicProtection = async (beach, windDirection, waveDirection) => {
  if (!beach || !beach.latitude || !beach.longitude) {
    throw new Error('Invalid beach data for protection calculation');
  }
  
  try {
    // Use dynamic analysis for all beaches
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
      windProtection: 0.5,
      waveProtection: 0.5,
      bayEnclosure: 0.5,
      isProtected: true
    };
  }
};

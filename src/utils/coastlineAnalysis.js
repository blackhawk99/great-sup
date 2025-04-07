// Enhanced coastlineAnalysis.js with improved geographic protection algorithm
import * as turf from '@turf/turf';
import { greeceCoastline } from '../data/greece-coastline';

// Include Makronisos and other islands data
// This would typically come from a data file, but we're adding a sample here
const greeceIslands = {
  "type": "FeatureCollection",
  "features": [
    {
      "type": "Feature",
      "properties": { "name": "Makronisos" },
      "geometry": {
        "type": "Polygon",
        "coordinates": [[
          [24.1251, 37.7001], // Approximate coordinates for Makronisos
          [24.1351, 37.7001],
          [24.1351, 37.7201],
          [24.1251, 37.7201],
          [24.1251, 37.7001]
        ]]
      }
    }
    // Other islands would be added here
  ]
};

// Generate rays from a point in multiple directions with multiple distances
export function generateMultiRangeRays(center, numRays, distances = [1, 2, 3]) {
  const rays = [];
  
  for (let i = 0; i < numRays; i++) {
    const angle = (i * 360) / numRays;
    
    // Create a ray for each distance
    for (const distance of distances) {
      const destination = turf.destination(center, distance, angle, { units: 'kilometers' });
      rays.push({
        ray: turf.lineString([center.geometry.coordinates, destination.geometry.coordinates]),
        distance: distance,
        angle: angle
      });
    }
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

// Find multiple relevant coastline segments near a beach
export function findRelevantCoastlineSegments(beachPoint, coastline, maxDistance = 3) {
  let relevantSegments = [];
  
  for (const feature of coastline.features) {
    if (feature.geometry.type === 'LineString') {
      const coords = feature.geometry.coordinates;
      
      for (let i = 0; i < coords.length - 1; i++) {
        const segment = turf.lineString([coords[i], coords[i+1]]);
        const nearest = turf.nearestPointOnLine(segment, beachPoint);
        
        // If within maxDistance km, include this segment
        if (nearest.properties.dist <= maxDistance) {
          relevantSegments.push({
            segment: [coords[i], coords[i+1]],
            distance: nearest.properties.dist,
            angle: turf.bearing(turf.point(coords[i]), turf.point(coords[i+1]))
          });
        }
      }
    }
  }
  
  // Sort by distance (closest first)
  return relevantSegments.sort((a, b) => a.distance - b.distance);
}

// Find the nearest single coastline segment to a beach (original method)
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

// Find nearby coastline points for bay analysis
function findNearbyCoastlinePoints(beachPoint, coastline, maxDistance = 5) {
  const nearbyPoints = [];
  
  for (const feature of coastline.features) {
    if (feature.geometry.type === 'LineString') {
      const coords = feature.geometry.coordinates;
      
      for (const coord of coords) {
        const distance = turf.distance(
          beachPoint,
          turf.point(coord),
          { units: 'kilometers' }
        );
        
        if (distance <= maxDistance) {
          nearbyPoints.push(coord);
        }
      }
    }
  }
  
  return nearbyPoints;
}

// Analyze bay geometry using convex hull
export function analyzeBayGeometry(beachPoint, coastline, maxDistance = 5) {
  // Find all coastline points within range
  const nearbyPoints = findNearbyCoastlinePoints(beachPoint, coastline, maxDistance);
  
  if (nearbyPoints.length < 3) {
    return {
      isInBay: false,
      convexity: 1,
      openingWidth: null,
      bayEnclosure: 0.1 // Very low enclosure score
    };
  }
  
  // Add beach point to create a complete shape
  const allPoints = [...nearbyPoints, beachPoint.geometry.coordinates];
  
  // Create convex hull
  const points = allPoints.map(coord => turf.point(coord));
  const pointCollection = turf.featureCollection(points);
  const hull = turf.convexHull(pointCollection);
  
  // Calculate how "bay-like" the formation is
  const hullArea = turf.area(hull);
  const coastlineLength = turf.length(turf.lineString(nearbyPoints), { units: 'kilometers' });
  
  // Convexity measure - lower is more enclosed/concave (bay-like)
  const convexity = hullArea / (coastlineLength * coastlineLength);
  
  // Determine if the beach is in a bay and estimate opening width
  const isInBay = convexity < 0.3; // Threshold determined empirically
  let openingWidth = null;
  
  if (isInBay) {
    // Estimate bay opening width using the two points furthest from each other
    let maxDistance = 0;
    let furthestPair = null;
    
    for (let i = 0; i < nearbyPoints.length; i++) {
      for (let j = i + 1; j < nearbyPoints.length; j++) {
        const dist = turf.distance(
          turf.point(nearbyPoints[i]),
          turf.point(nearbyPoints[j]),
          { units: 'kilometers' }
        );
        
        if (dist > maxDistance) {
          maxDistance = dist;
          furthestPair = [nearbyPoints[i], nearbyPoints[j]];
        }
      }
    }
    
    if (furthestPair) {
      openingWidth = maxDistance;
    }
  }
  
  // Convert convexity to bayEnclosure score (0-1)
  // Lower convexity = higher enclosure
  const bayEnclosure = isInBay ? Math.min(1, Math.max(0, 1 - convexity * 2)) : 0.2;
  
  return {
    isInBay,
    convexity,
    openingWidth,
    bayEnclosure
  };
}

// Analyze ray intersections with multiple distance rings
export function analyzeRayIntersections(center, coastline, numRays = 36, distances = [1, 2, 3]) {
  // Generate rays with multiple distances
  const rays = generateMultiRangeRays(center, numRays, distances);
  
  // Group rays by angle
  const raysByAngle = {};
  rays.forEach(rayObj => {
    if (!raysByAngle[rayObj.angle]) {
      raysByAngle[rayObj.angle] = [];
    }
    raysByAngle[rayObj.angle].push(rayObj);
  });
  
  // Analyze each angle with distance weighting
  const protectionByAngle = {};
  let totalProtectedAngles = 0;
  
  Object.keys(raysByAngle).forEach(angle => {
    const angleRays = raysByAngle[angle].sort((a, b) => a.distance - b.distance);
    
    // Check intersections with decreasing weight by distance
    let isProtected = false;
    let protectionValue = 0;
    
    for (let i = 0; i < angleRays.length; i++) {
      const intersection = intersectsCoastline(angleRays[i].ray, coastline);
      
      if (intersection.intersects) {
        // Closer intersections provide more protection
        const distanceFactor = 1 - (i / angleRays.length);
        protectionValue = Math.max(protectionValue, distanceFactor);
        isProtected = true;
        break;
      }
    }
    
    protectionByAngle[angle] = {
      isProtected,
      value: protectionValue
    };
    
    if (isProtected) {
      totalProtectedAngles++;
    }
  });
  
  // Calculate enclosure score (0-1)
  const enclosureScore = totalProtectedAngles / numRays;
  
  return {
    protectionByAngle,
    enclosureScore
  };
}

// Check for island protection
export function checkIslandProtection(beachPoint, islands, windDirection, waveDirection) {
  // Calculate which directions are shielded by islands
  const shieldedDirections = [];
  
  for (const feature of islands.features) {
    // For each island
    if (feature.geometry.type === 'Polygon') {
      // Get island center
      const center = turf.center(feature);
      
      // Direction from beach to island center
      const bearing = turf.bearing(beachPoint, center);
      
      // Distance from beach to island
      const distance = turf.distance(beachPoint, center, { units: 'kilometers' });
      
      // Island size approximation
      const islandSize = Math.sqrt(turf.area(feature)) / 1000; // km
      
      // Island "angular width" as seen from beach (approximation)
      const angularWidth = Math.atan2(islandSize, distance) * (180 / Math.PI) * 2;
      
      // Strength decreases with distance
      const strength = Math.min(1, 5 / distance) * (islandSize / 3);
      
      shieldedDirections.push({
        direction: bearing,
        width: angularWidth,
        distance: distance,
        strength: strength
      });
    }
  }
  
  // Calculate wind protection from islands
  let windIslandProtection = 0;
  let waveIslandProtection = 0;
  
  for (const shield of shieldedDirections) {
    // Wind protection
    const windShieldExposure = calculateDirectionalExposure(windDirection, shield.direction);
    if (windShieldExposure <= shield.width / 2) {
      windIslandProtection += shield.strength * (1 - windShieldExposure / (shield.width / 2));
    }
    
    // Wave protection
    const waveShieldExposure = calculateDirectionalExposure(waveDirection, shield.direction);
    if (waveShieldExposure <= shield.width / 2) {
      waveIslandProtection += shield.strength * (1 - waveShieldExposure / (shield.width / 2));
    }
  }
  
  // Cap at 1.0
  windIslandProtection = Math.min(1, windIslandProtection);
  waveIslandProtection = Math.min(1, waveIslandProtection);
  
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
    
    // Analyze coastline using multiple approaches
    
    // 1. Analyze bay geometry using convex hull
    const bayGeometry = analyzeBayGeometry(beachPoint, greeceCoastline);
    const convexityEnclosureScore = bayGeometry.bayEnclosure || 0.3;
    
    // 2. Analyze ray intersections with multiple distance rings
    const rayAnalysis = analyzeRayIntersections(beachPoint, greeceCoastline, 36, [1, 2, 3]);
    const rayEnclosureScore = rayAnalysis.enclosureScore;
    
    // Use the better of the two enclosure scores (be optimistic)
    const enclosureScore = Math.max(convexityEnclosureScore, rayEnclosureScore);
    
    // 3. Find the nearest coastline segment (traditional method)
    const nearestSegment = findNearestCoastlineSegment(beachPoint, greeceCoastline);
    
    if (!nearestSegment) {
      throw new Error('Could not find nearby coastline');
    }
    
    // Calculate coastline orientation
    const coastlineAngle = turf.bearing(
      turf.point(nearestSegment[0]),
      turf.point(nearestSegment[1])
    );
    
    // 4. Get all relevant coastline segments
    const relevantSegments = findRelevantCoastlineSegments(beachPoint, greeceCoastline);
    
    // Use multiple segments to find the best protection angle
    let bestWindProtection = 0;
    let bestWaveProtection = 0;
    
    for (const segment of relevantSegments) {
      const segmentAngle = segment.angle;
      
      // Calculate wind protection
      const windExposure = calculateDirectionalExposure(windDirection, segmentAngle);
      const tempWindProtection = 1 - Math.cos(windExposure * Math.PI / 180);
      
      // Calculate wave protection
      const waveExposure = calculateDirectionalExposure(waveDirection, segmentAngle);
      const tempWaveProtection = 1 - Math.cos(waveExposure * Math.PI / 180);
      
      // Update if better
      if (tempWindProtection > bestWindProtection) {
        bestWindProtection = tempWindProtection;
      }
      
      if (tempWaveProtection > bestWaveProtection) {
        bestWaveProtection = tempWaveProtection;
      }
    }
    
    // 5. Check for nearby islands
    const islandProtection = checkIslandProtection(beachPoint, greeceIslands, windDirection, waveDirection);
    
    // Combine coastline and island protection
    const totalWindProtection = Math.min(1, (bestWindProtection + islandProtection.windIslandProtection) * (0.5 + 0.5 * enclosureScore));
    const totalWaveProtection = Math.min(1, (bestWaveProtection + islandProtection.waveIslandProtection) * (0.5 + 0.5 * enclosureScore));
    
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
      bayGeometry: {
        isInBay: bayGeometry.isInBay,
        convexity: bayGeometry.convexity,
        openingWidth: bayGeometry.openingWidth
      },
      islandProtection: {
        windProtection: islandProtection.windIslandProtection,
        waveProtection: islandProtection.waveIslandProtection
      }
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

// Main geographic protection analysis function (API entry point)
export const calculateGeographicProtection = async (beach, windDirection, waveDirection) => {
  if (!beach || !beach.latitude || !beach.longitude) {
    throw new Error('Invalid beach data for protection calculation');
  }
  
  try {
    // Use the enhanced bay protection analysis
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

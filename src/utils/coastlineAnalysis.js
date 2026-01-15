// src/utils/coastlineAnalysis.js
import * as turf from '@turf/turf';
import { greeceCoastlines } from '../data/greece-coastlines';
import { greeceIslands } from '../data/greece-islands';

// Generate rays from a point in all directions
export function generateRays(center, numRays, distance) {
  const rays = [];
  
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
          name: feature.properties?.name || "Unnamed Island",
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
  
  // Calculate wind and wave protection from islands
  // KEY DIFFERENCE: Waves diffract (bend) around obstacles, so narrow islands
  // provide much less wave protection than wind protection
  let windIslandProtection = 0;
  let waveIslandProtection = 0;

  for (const shield of shieldedDirections) {
    // Wind protection - wind is blocked locally by obstacles
    const windShieldExposure = calculateDirectionalExposure(windDirection, shield.direction);
    if (windShieldExposure <= shield.width / 2) {
      const directionalFactor = 1 - (windShieldExposure / (shield.width / 2));
      windIslandProtection += shield.strength * directionalFactor;
    }

    // Wave protection - waves diffract around obstacles
    // Narrow obstacles (small angular width) provide much less protection
    // Waves need ~60° of blockage for significant protection
    const waveShieldExposure = calculateDirectionalExposure(waveDirection, shield.direction);
    if (waveShieldExposure <= shield.width / 2) {
      const directionalFactor = 1 - (waveShieldExposure / (shield.width / 2));
      // Apply diffraction penalty: narrow obstacles let waves wrap around
      // angularWidth < 30° = very little wave protection
      // angularWidth > 60° = good wave protection
      const diffractionFactor = Math.min(1, shield.width / 60);
      waveIslandProtection += shield.strength * directionalFactor * diffractionFactor;
    }
  }

  // Cap protection (waves can never be fully blocked by islands due to diffraction)
  windIslandProtection = Math.min(0.8, windIslandProtection);
  waveIslandProtection = Math.min(0.6, waveIslandProtection); // Lower cap for waves
  
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

// Advanced bay detection algorithm that measures enclosure in multiple ways
function analyzeBayGeometry(beachPoint) {
  // Multi-scale approach - test multiple ray distances
  const rayDistances = [0.5, 1.0, 2.0, 3.0, 5.0]; // kilometers
  const numRays = 36; // every 10 degrees
  
  // Results for each scale
  const rayResults = rayDistances.map(distance => {
    const rays = generateRays(beachPoint, numRays, distance);
    const hits = rays.map(ray => intersectsLandmass(ray, greeceCoastlines, greeceIslands));
    
    // Calculate hit rate (enclosure)
    const hitCount = hits.filter(hit => hit.intersects).length;
    const hitRate = hitCount / numRays;
    
    // Analyze hit patterns to find gaps/entrances
    const hitsByAngle = {};
    hits.forEach((hit, index) => {
      const angle = (index * 360) / numRays;
      hitsByAngle[angle] = hit;
    });
    
    return {
      distance,
      hitRate,
      hitsByAngle
    };
  });
  
  // Calculate enclosure pattern
  const enclosureCurve = rayResults.map(r => r.hitRate);
  
  // Sharp increase in enclosure with distance = deep bay characteristic
  const enclosureIncrease = enclosureCurve.length >= 3 ? 
    (enclosureCurve[2] - enclosureCurve[0]) / 2 : 0;
  
  // Calculate bay type statistics
  const shortRangeEnclosure = rayResults[0]?.hitRate || 0; // 0.5km
  const midRangeEnclosure = rayResults[1]?.hitRate || 0;   // 1.0km
  const longRangeEnclosure = rayResults[3]?.hitRate || 0;  // 3.0km
  
  // Find patterns characteristic of different bay types

  // Deep/protected bay: high enclosure at all scales (e.g., Navarino Bay)
  const isDeepBay = shortRangeEnclosure > 0.65 && midRangeEnclosure > 0.55 && longRangeEnclosure > 0.45;

  // Medium bay: good enclosure at short/mid range (e.g., Vouliagmeni, 800m-1.5km wide bays)
  // These provide excellent SUP protection even if longer rays reach open water
  const isMediumBay = !isDeepBay && shortRangeEnclosure > 0.55 && midRangeEnclosure > 0.4;

  // Peninsula/wide bay: enclosure INCREASES with distance (e.g., Astir Beach on Vouliagmeni peninsula)
  // Immediate area is open but surrounded by land at larger scale - provides regional wind shelter
  const isPeninsulaBeach = !isDeepBay && !isMediumBay &&
    longRangeEnclosure > midRangeEnclosure &&
    midRangeEnclosure > shortRangeEnclosure &&
    longRangeEnclosure > 0.5;

  // Shallow bay/cove: high enclosure short range, drops off at longer (small coves)
  const isShallowBay = !isDeepBay && !isMediumBay && !isPeninsulaBeach && shortRangeEnclosure > 0.5 && midRangeEnclosure > 0.3;
  
  // Analyze the actual pattern for more precise results
  let enclosurePattern = '';
  if (enclosureCurve[0] > 0.8 && enclosureCurve[1] > 0.7 && enclosureCurve[2] > 0.6) {
    enclosurePattern = 'highly-enclosed';
  } else if (enclosureCurve[0] > 0.6 && enclosureCurve[1] > 0.5) {
    enclosurePattern = 'moderately-enclosed';
  } else if (enclosureCurve[0] < 0.3 && enclosureCurve[1] < 0.4) {
    enclosurePattern = 'exposed';
  } else {
    enclosurePattern = 'partially-enclosed';
  }
  
  return {
    isDeepBay,
    isMediumBay,
    isPeninsulaBeach,
    isShallowBay,
    shortRangeEnclosure,
    midRangeEnclosure,
    longRangeEnclosure,
    enclosurePattern,
    enclosureIncrease
  };
}

// Main analysis function with improved bay detection
export async function analyzeBayProtection(latitude, longitude, windDirection, waveDirection) {
  try {
    // Create a point from the coordinates
    const beachPoint = turf.point([longitude, latitude]);
    
    // Advanced bay geometry analysis
    const bayGeometry = analyzeBayGeometry(beachPoint);
    
    // Bay detection is now handled algorithmically - no hardcoded overrides
    
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
    
    // Calculate ray-based enclosure scores at different distances
    // Short rays (0.7km) to detect small protected coves
    const shortRays = generateRays(beachPoint, 36, 0.7);
    const shortHits = shortRays.map(ray => intersectsLandmass(ray, greeceCoastlines, greeceIslands));
    const shortEnclosure = shortHits.filter(hit => hit.intersects).length / shortRays.length;
    
    // Medium rays (1.5km) for typical bay/cove detection
    const mediumRays = generateRays(beachPoint, 36, 1.5);
    const mediumHits = mediumRays.map(ray => intersectsLandmass(ray, greeceCoastlines, greeceIslands));
    const mediumEnclosure = mediumHits.filter(hit => hit.intersects).length / mediumRays.length;
    
    // Long rays (3.0km) for broader geography 
    const longRays = generateRays(beachPoint, 36, 3.0);
    const longHits = longRays.map(ray => intersectsLandmass(ray, greeceCoastlines, greeceIslands));
    const longEnclosure = longHits.filter(hit => hit.intersects).length / longRays.length;
    
    // Calculate weighted enclosure score based on bay type
    let enclosureScore;

    if (bayGeometry.isDeepBay) {
      // Deep bay - high protection (e.g., Navarino)
      enclosureScore = Math.min(0.95, (shortEnclosure * 0.3) + (mediumEnclosure * 0.3) + (longEnclosure * 0.4) + 0.2);
      console.log("Using deep bay enclosure calculation:", enclosureScore);
    } else if (bayGeometry.isMediumBay) {
      // Medium bay - good protection for SUP (e.g., Vouliagmeni, 800m-1.5km wide)
      // Short/medium range matters most, long range less important
      enclosureScore = Math.min(0.85, (shortEnclosure * 0.45) + (mediumEnclosure * 0.35) + (longEnclosure * 0.1) + 0.1);
      console.log("Using medium bay enclosure calculation:", enclosureScore);
    } else if (bayGeometry.isPeninsulaBeach) {
      // Peninsula beach - inverted pattern where long range has MORE enclosure (e.g., Astir)
      // Regional geography provides wind shelter even though immediate area is open
      // Weight long range highly since that's where the protection comes from
      enclosureScore = Math.min(0.75, (shortEnclosure * 0.15) + (mediumEnclosure * 0.35) + (longEnclosure * 0.4) + 0.05);
      console.log("Using peninsula beach enclosure calculation:", enclosureScore);
    } else if (bayGeometry.isShallowBay) {
      // Shallow bay/cove - medium protection
      enclosureScore = (shortEnclosure * 0.5) + (mediumEnclosure * 0.3) + (longEnclosure * 0.2);
      console.log("Using shallow bay enclosure calculation:", enclosureScore);
    } else {
      // Regular coastline - exposed
      enclosureScore = (shortEnclosure * 0.6) + (mediumEnclosure * 0.3) + (longEnclosure * 0.1);
      console.log("Using standard enclosure calculation:", enclosureScore);
    }
    
    // Find multiple relevant coastline segments
    const relevantSegments = findRelevantCoastlineSegments(beachPoint, greeceCoastlines);
    
    // Calculate protection using multiple segments
    let bestWindProtection = 0;
    let bestWaveProtection = 0;
    
    // Consider up to 5 closest segments
for (const segment of relevantSegments.slice(0, 5)) {
  const segmentAngle = segment.angle;

  // Calculate wind protection - direct blockage
  const windExposure = calculateDirectionalExposure(windDirection, segmentAngle);
  const windProtection = Math.min(1.0, 1 - Math.cos(windExposure * Math.PI / 180));

  // Calculate wave protection - affected by diffraction
  // Waves bend around headlands, so protection is reduced unless in an enclosed bay
  const waveExposure = calculateDirectionalExposure(waveDirection, segmentAngle);
  const baseWaveProtection = Math.min(1.0, 1 - Math.cos(waveExposure * Math.PI / 180));
  // Reduce wave protection for exposed coastlines (not enclosed bays)
  // Enclosure provides the real wave protection, not individual segments
  const waveProtection = baseWaveProtection * 0.7; // 30% reduction for diffraction

      // Keep the best protection values
      if (windProtection > bestWindProtection) bestWindProtection = windProtection;
      if (waveProtection > bestWaveProtection) bestWaveProtection = waveProtection;
    }
    
// Calculate total protection
// Wind: combination of direct blockage and enclosure
const totalWindProtection = Math.min(1.0, bestWindProtection * (0.5 + 0.5 * enclosureScore));
// Waves: enclosure matters much more due to diffraction - waves wrap around obstacles
// Only enclosed bays provide significant wave protection
const totalWaveProtection = Math.min(1.0, bestWaveProtection * (0.3 + 0.7 * enclosureScore));
    
    // Compute final protection score
    const protectionScore = (
      0.3 * totalWindProtection +
      0.3 * totalWaveProtection +
      0.4 * enclosureScore
    ) * 100;
    
    // Use calculated protection score (no hardcoded overrides)
    const finalScore = protectionScore;
    
return {
  protectionScore: finalScore,
  coastlineAngle,
  enclosureScore,
  windProtection: Math.min(1.0, totalWindProtection),
  waveProtection: Math.min(1.0, totalWaveProtection),
  bayEnclosure: enclosureScore,
      isProtected: protectionScore > 50,
      description: generateProtectionDescription(
        enclosureScore, 
        coastlineAngle, 
        totalWindProtection,
        totalWaveProtection
      ),
      isDeepBay: bayGeometry.isDeepBay,
      isMediumBay: bayGeometry.isMediumBay,
      isPeninsulaBeach: bayGeometry.isPeninsulaBeach,
      debugInfo: {
        shortEnclosure,
        mediumEnclosure,
        longEnclosure,
        bayType: bayGeometry.isDeepBay ? 'deep' : bayGeometry.isMediumBay ? 'medium' : bayGeometry.isPeninsulaBeach ? 'peninsula' : bayGeometry.isShallowBay ? 'shallow' : 'exposed'
      }
    };
  } catch (error) {
    console.error("Error in coastline analysis:", error);
    // Return WORST-CASE values as fallback (assume fully exposed for safety)
    return {
      protectionScore: 0,
      coastlineAngle: 0,
      enclosureScore: 0,
      windProtection: 0,
      waveProtection: 0,
      bayEnclosure: 0,
      isProtected: false,
      analysisError: true,
      description: "Could not analyze coastline protection. Assuming fully exposed conditions for safety."
    };
  }
}

// Main geographic protection analysis function
import { getCachedProtection, setCachedProtection } from './protectionCache';
import { adjustDirectionForSeason } from './seasonal';

export const calculateGeographicProtection = async (beach, windDirection, waveDirection, date = new Date()) => {
  if (!beach || !beach.latitude || !beach.longitude) {
    throw new Error('Invalid beach data for protection calculation');
  }

  const adjustedWind = adjustDirectionForSeason(windDirection, date);
  const adjustedWave = adjustDirectionForSeason(waveDirection, date);
  const cacheKey = `${beach.latitude.toFixed(3)},${beach.longitude.toFixed(3)}-${Math.round(adjustedWind)}-${Math.round(adjustedWave)}-${date.getMonth()}`;
  const cached = getCachedProtection(cacheKey);
  if (cached) return cached;
  
  try {
    // Use dynamic analysis for all beaches
    const dynamicAnalysis = await analyzeBayProtection(
      beach.latitude,
      beach.longitude,
      adjustedWind,
      adjustedWave
    );

    setCachedProtection(cacheKey, dynamicAnalysis);
    return dynamicAnalysis;
  } catch (error) {
    console.error("Dynamic protection analysis failed:", error);

    // Fallback to WORST-CASE (assume fully exposed for safety)
    return {
      protectionScore: 0,
      windProtection: 0,
      waveProtection: 0,
      bayEnclosure: 0,
      isProtected: false,
      analysisError: true
    };
  }
};

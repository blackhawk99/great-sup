// src/utils/coastlineAnalysis.js
import * as turf from '@turf/turf';
import { greeceCoastlines } from '../data/greece-coastlines';
import { greeceIslands } from '../data/greece-islands';

// ============================================================================
// TILE-BASED COASTLINE LOADING
// ============================================================================

const TILE_SIZE = 0.5; // degrees - must match the tile generation script
const TILE_CACHE = new Map(); // Cache loaded tiles in memory
const TILE_LOADING = new Map(); // Track in-progress tile loads to avoid duplicates

/**
 * Get the tile key for a coordinate
 */
function getTileKey(lat, lng) {
  const tileLat = Math.floor(lat / TILE_SIZE) * TILE_SIZE;
  const tileLng = Math.floor(lng / TILE_SIZE) * TILE_SIZE;
  return `${tileLat.toFixed(1)}_${tileLng.toFixed(1)}`;
}

/**
 * Get all tile keys needed to cover an area around a point
 */
function getRequiredTileKeys(lat, lng, radiusKm = 5) {
  // Convert radius to approximate degrees (1 degree ≈ 111km)
  const radiusDeg = radiusKm / 111;

  const keys = new Set();
  // Get tiles that cover the bounding box around the point
  for (let latOffset = -radiusDeg; latOffset <= radiusDeg; latOffset += TILE_SIZE) {
    for (let lngOffset = -radiusDeg; lngOffset <= radiusDeg; lngOffset += TILE_SIZE) {
      keys.add(getTileKey(lat + latOffset, lng + lngOffset));
    }
  }
  return Array.from(keys);
}

/**
 * Load a single tile from the server
 */
async function loadTile(tileKey) {
  // Check cache first
  if (TILE_CACHE.has(tileKey)) {
    return TILE_CACHE.get(tileKey);
  }

  // Check if already loading
  if (TILE_LOADING.has(tileKey)) {
    return TILE_LOADING.get(tileKey);
  }

  // Start loading
  const loadPromise = (async () => {
    try {
      const response = await fetch(`/coastline-tiles/tile_${tileKey}.json`);
      if (!response.ok) {
        console.warn(`Tile ${tileKey} not found (${response.status})`);
        return null;
      }
      const data = await response.json();
      TILE_CACHE.set(tileKey, data);
      return data;
    } catch (error) {
      console.warn(`Failed to load tile ${tileKey}:`, error.message);
      return null;
    } finally {
      TILE_LOADING.delete(tileKey);
    }
  })();

  TILE_LOADING.set(tileKey, loadPromise);
  return loadPromise;
}

/**
 * Load all tiles needed for a location and merge into coastline/island data
 */
export async function loadCoastlineDataForLocation(lat, lng, radiusKm = 5) {
  const tileKeys = getRequiredTileKeys(lat, lng, radiusKm);

  // Load all required tiles in parallel
  const tilePromises = tileKeys.map(key => loadTile(key));
  const tiles = await Promise.all(tilePromises);

  // Merge tile data
  const coastlines = { type: 'FeatureCollection', features: [] };
  const islands = { type: 'FeatureCollection', features: [] };

  let loadedTiles = 0;
  for (const tile of tiles) {
    if (!tile) continue;
    loadedTiles++;

    for (const feature of tile.features) {
      if (feature.geometry.type === 'LineString') {
        coastlines.features.push(feature);
      } else if (feature.geometry.type === 'Polygon') {
        islands.features.push(feature);
      }
    }
  }

  return {
    coastlines,
    islands,
    loadedTiles,
    totalTiles: tileKeys.length,
    usedTiles: loadedTiles > 0
  };
}

// ============================================================================
// FILTER INVALID COASTLINES FROM BUNDLED DATA
// ============================================================================

/**
 * Filter out invalid coastline features (duplicate points, single points, etc.)
 * This is used as a fallback when tiles can't be loaded
 */
function filterValidCoastlines(coastlines) {
  const validFeatures = coastlines.features.filter(feature => {
    if (feature.geometry.type !== 'LineString') return false;
    const coords = feature.geometry.coordinates;

    // Must have at least 2 points
    if (!coords || coords.length < 2) return false;

    // Check for duplicate points (all points the same)
    const uniquePoints = new Set(coords.map(c => `${c[0]},${c[1]}`));
    if (uniquePoints.size < 2) return false;

    return true;
  });

  return {
    type: 'FeatureCollection',
    features: validFeatures
  };
}

// ============================================================================
// DATA DENSITY CHECK (works with both bundled and tile data)
// ============================================================================

// Check coastline data density around a point to determine analysis confidence
// Returns { density, confidence, isLowConfidence, nearbySegments, totalPoints }
export function checkCoastlineDataDensity(latitude, longitude, radiusKm = 5, coastlineData = null, islandData = null) {
  const point = turf.point([longitude, latitude]);
  let totalPoints = 0;
  let validSegments = 0;
  let nearbySegments = 0;

  // Use provided data or fall back to bundled data
  const coastlines = coastlineData || greeceCoastlines;
  const islands = islandData || greeceIslands;

  // Check coastlines within radius
  for (const feature of coastlines.features) {
    if (feature.geometry.type === 'LineString') {
      const coords = feature.geometry.coordinates;

      // Skip single-point or invalid segments
      if (coords.length < 2) continue;
      if (coords.length === 2 &&
          coords[0][0] === coords[1][0] &&
          coords[0][1] === coords[1][1]) continue;

      validSegments++;

      // Check if any point of this segment is within radius
      let segmentNearby = false;
      for (const coord of coords) {
        const segPoint = turf.point(coord);
        const distance = turf.distance(point, segPoint, { units: 'kilometers' });
        if (distance <= radiusKm) {
          totalPoints++;
          segmentNearby = true;
        }
      }
      if (segmentNearby) nearbySegments++;
    }
  }

  // Also check islands
  for (const feature of islands.features) {
    if (feature.geometry.type === 'Polygon') {
      const coords = feature.geometry.coordinates[0]; // outer ring
      for (const coord of coords) {
        const segPoint = turf.point(coord);
        const distance = turf.distance(point, segPoint, { units: 'kilometers' });
        if (distance <= radiusKm) {
          totalPoints++;
        }
      }
    }
  }

  // Calculate density (points per km²)
  const areaKm2 = Math.PI * radiusKm * radiusKm;
  const density = totalPoints / areaKm2;

  // Confidence thresholds based on empirical testing
  // Good data: > 10 points per km² in 5km radius
  // Moderate: 3-10 points per km²
  // Low: < 3 points per km²
  let confidence;
  let isLowConfidence;

  if (density >= 10 && nearbySegments >= 3) {
    confidence = 'high';
    isLowConfidence = false;
  } else if (density >= 3 && nearbySegments >= 1) {
    confidence = 'moderate';
    isLowConfidence = false;
  } else {
    confidence = 'low';
    isLowConfidence = true;
  }

  return {
    density: Math.round(density * 100) / 100,
    confidence,
    isLowConfidence,
    nearbySegments,
    totalPoints,
    radiusKm
  };
}

// Snap coordinates to nearest coastline point
export function snapToCoastline(latitude, longitude, maxDistance = 2) {
  try {
    const point = turf.point([longitude, latitude]);
    let nearestPoint = null;
    let minDistance = Infinity;

    // Check coastlines
    for (const feature of greeceCoastlines.features) {
      if (feature.geometry.type === 'LineString') {
        try {
          const line = turf.lineString(feature.geometry.coordinates);
          const nearest = turf.nearestPointOnLine(line, point, { units: 'kilometers' });

          if (nearest.properties.dist < minDistance) {
            minDistance = nearest.properties.dist;
            nearestPoint = nearest;
          }
        } catch (e) {
          // Skip invalid geometries
        }
      }
    }

    // Check island coastlines
    for (const feature of greeceIslands.features) {
      if (feature.geometry.type === 'Polygon') {
        try {
          const polygon = turf.polygon(feature.geometry.coordinates);
          const boundary = turf.polygonToLine(polygon);
          const nearest = turf.nearestPointOnLine(boundary, point, { units: 'kilometers' });

          if (nearest.properties.dist < minDistance) {
            minDistance = nearest.properties.dist;
            nearestPoint = nearest;
          }
        } catch (e) {
          // Skip invalid geometries
        }
      }
    }

    // Only snap if within maxDistance km
    if (nearestPoint && minDistance <= maxDistance) {
      const [newLng, newLat] = nearestPoint.geometry.coordinates;
      return {
        latitude: newLat,
        longitude: newLng,
        snapped: true,
        distance: minDistance,
        originalLatitude: latitude,
        originalLongitude: longitude
      };
    }

    // Return original if no coastline found nearby
    return {
      latitude,
      longitude,
      snapped: false,
      distance: minDistance === Infinity ? null : minDistance
    };
  } catch (error) {
    console.error("Error snapping to coastline:", error);
    return {
      latitude,
      longitude,
      snapped: false,
      error: error.message
    };
  }
}

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
function analyzeBayGeometry(beachPoint, coastlineData = greeceCoastlines, islandData = greeceIslands) {
  // Multi-scale approach - test multiple ray distances
  const rayDistances = [0.5, 1.0, 2.0, 3.0, 5.0]; // kilometers
  const numRays = 36; // every 10 degrees

  // Results for each scale
  const rayResults = rayDistances.map(distance => {
    const rays = generateRays(beachPoint, numRays, distance);
    const hits = rays.map(ray => intersectsLandmass(ray, coastlineData, islandData));
    
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
  // NOTE: Thresholds are strict to avoid false positives on islands

  // Deep/protected bay: high enclosure at ALL scales including long range (e.g., Navarino Bay)
  // Must have significant enclosure even at 3km to be considered truly deep
  const isDeepBay = shortRangeEnclosure > 0.75 && midRangeEnclosure > 0.65 && longRangeEnclosure > 0.55;

  // Medium bay: good enclosure at short/mid range (e.g., Vouliagmeni, 800m-1.5km wide bays)
  // Requires higher thresholds to avoid island false positives
  const isMediumBay = !isDeepBay && shortRangeEnclosure > 0.70 && midRangeEnclosure > 0.55 && longRangeEnclosure > 0.35;

  // Peninsula beach: enclosure INCREASES with distance (e.g., Astir Beach on Vouliagmeni peninsula)
  // Immediate area is open but surrounded by land at larger scale - provides regional wind shelter
  const isPeninsulaBeach = !isDeepBay && !isMediumBay &&
    longRangeEnclosure > midRangeEnclosure &&
    midRangeEnclosure > shortRangeEnclosure &&
    longRangeEnclosure > 0.5;

  // Wide bay: moderate short but good mid/long enclosure (e.g., Kapsali - wide mouth but headlands at distance)
  // Bay is wide at entrance but protected by surrounding geography
  const isWideBay = !isDeepBay && !isMediumBay && !isPeninsulaBeach &&
    shortRangeEnclosure > 0.35 &&
    midRangeEnclosure > 0.5 &&
    longRangeEnclosure > 0.45;

  // Shallow bay/cove: high enclosure short range, drops off at longer (small coves)
  const isShallowBay = !isDeepBay && !isMediumBay && !isPeninsulaBeach && !isWideBay && shortRangeEnclosure > 0.5 && midRangeEnclosure > 0.3;

  // Moderate coast: decent protection at multiple ranges but doesn't fit specific bay patterns
  // Catches beaches with some shelter that would otherwise be marked "exposed"
  const isModerateCoast = !isDeepBay && !isMediumBay && !isPeninsulaBeach && !isWideBay && !isShallowBay &&
    ((shortRangeEnclosure > 0.3 && midRangeEnclosure > 0.3) ||
     (shortRangeEnclosure + midRangeEnclosure + longRangeEnclosure) / 3 > 0.35);

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
    isWideBay,
    isShallowBay,
    isModerateCoast,
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

    // Try to load tile data for this location (with fallback to bundled data)
    let coastlineData = greeceCoastlines;
    let islandData = greeceIslands;
    let usingTiles = false;

    try {
      const tileResult = await loadCoastlineDataForLocation(latitude, longitude, 5);
      if (tileResult.usedTiles && tileResult.coastlines.features.length > 0) {
        coastlineData = tileResult.coastlines;
        islandData = tileResult.islands;
        usingTiles = true;
        console.log(`Loaded ${tileResult.loadedTiles} tiles with ${coastlineData.features.length} coastlines, ${islandData.features.length} islands`);
      } else {
        console.log('Tiles empty or not found, using filtered bundled data');
        // Filter invalid segments from bundled data
        coastlineData = filterValidCoastlines(greeceCoastlines);
        islandData = greeceIslands;
      }
    } catch (tileError) {
      console.warn('Tile loading failed, using filtered bundled data:', tileError.message);
      // Filter invalid segments from bundled data
      coastlineData = filterValidCoastlines(greeceCoastlines);
      islandData = greeceIslands;
    }

    // Check coastline data density for this location (informational only)
    const dataDensity = checkCoastlineDataDensity(latitude, longitude, 5, coastlineData, islandData);

    // =========================================================================
    // DIRECTIONAL PROTECTION CHECK
    // Key insight: On island beaches, nearby coastline hits don't mean protection.
    // Real protection = land ACROSS THE WATER blocking wind, not same-shore curves.
    // =========================================================================

    // First, find the seaward direction (which way the beach faces the sea)
    const nearestSegment = findNearestCoastlineSegment(beachPoint, coastlineData);
    if (!nearestSegment) {
      throw new Error('Could not find nearby coastline');
    }

    const coastlineAngle = turf.bearing(
      turf.point(nearestSegment[0]),
      turf.point(nearestSegment[1])
    );
    // Seaward is perpendicular to coast, pointing away from land
    const seawardDirection = (coastlineAngle + 90) % 360;

    // Check if wind is coming from seaward (exposed) or landward (sheltered)
    const windFromSeaward = Math.abs(((windDirection - seawardDirection + 180) % 360) - 180) < 90;
    const waveFromSeaward = Math.abs(((waveDirection - seawardDirection + 180) % 360) - 180) < 90;

    // Cast rays to check for blocking land
    const windAngleRay = turf.lineString([
      beachPoint.geometry.coordinates,
      turf.destination(beachPoint, 5, windDirection, { units: 'kilometers' }).geometry.coordinates
    ]);
    const windBlocked = intersectsLandmass(windAngleRay, coastlineData, islandData);

    const waveAngleRay = turf.lineString([
      beachPoint.geometry.coordinates,
      turf.destination(beachPoint, 5, waveDirection, { units: 'kilometers' }).geometry.coordinates
    ]);
    const waveBlocked = intersectsLandmass(waveAngleRay, coastlineData, islandData);

    // CRITICAL: Only count as protected if:
    // 1. Wind/waves from LANDWARD direction (naturally sheltered), OR
    // 2. Wind/waves from SEAWARD but blocked by land at SIGNIFICANT distance (>0.5km)
    //    (close hits are just the curving coastline of the same beach, not real protection)
    const MIN_BLOCKING_DISTANCE = 0.5; // km - land must be this far to count as real protection

    let windProtection = 0;
    if (!windFromSeaward) {
      // Wind from land side = naturally protected
      windProtection = 0.8;
    } else if (windBlocked.intersects && windBlocked.distance > MIN_BLOCKING_DISTANCE) {
      // Wind from sea but blocked by distant land (island, headland across water)
      windProtection = Math.min(0.9, (1 - (windBlocked.distance / 5.0)) * 0.9);
    }
    // If wind from seaward and no significant blocking = exposed (windProtection stays 0)

    let waveProtection = 0;
    if (!waveFromSeaward) {
      waveProtection = 0.7; // Land blocks waves but less than wind (some refraction)
    } else if (waveBlocked.intersects && waveBlocked.distance > MIN_BLOCKING_DISTANCE) {
      // Waves diffract around obstacles, so less protection than wind
      waveProtection = Math.min(0.6, (1 - (waveBlocked.distance / 5.0)) * 0.6);
    }

    // Check for bay enclosure - headlands on sides providing shelter
    // Only count hits that are SIGNIFICANT distance away (not just beach curve)
    let significantSeawardHits = 0;
    let seawardRays = 0;
    const rays = generateRays(beachPoint, 36, 3.0); // 36 rays at 3km

    for (let i = 0; i < 36; i++) {
      const rayAngle = (i * 360) / 36;
      const angleDiff = Math.abs(((rayAngle - seawardDirection + 180) % 360) - 180);
      if (angleDiff <= 90) {
        seawardRays++;
        const hit = intersectsLandmass(rays[i], coastlineData, islandData);
        // Only count if land is at meaningful distance (headland, not just shore curve)
        if (hit.intersects && hit.distance > 0.3) {
          significantSeawardHits++;
        }
      }
    }

    // Bay enclosure based on significant land features in seaward arc
    const bayEnclosure = seawardRays > 0 ? significantSeawardHits / seawardRays : 0;

    // Final protection score:
    // - 50% from wind direction/blocking (most important for SUP)
    // - 25% from wave blocking
    // - 25% from bay enclosure
    const protectionScore = (
      0.5 * windProtection +
      0.25 * waveProtection +
      0.25 * bayEnclosure
    ) * 100;

    const finalScore = Math.round(protectionScore);

    return {
      protectionScore: finalScore,
      coastlineAngle,
      enclosureScore: bayEnclosure,
      windProtection,
      waveProtection,
      bayEnclosure,
      isProtected: finalScore > 50,
      dataConfidence: dataDensity.confidence,
      isLowConfidence: dataDensity.isLowConfidence,
      usingTiles,
      windBlocked: windBlocked.intersects,
      waveBlocked: waveBlocked.intersects,
      description: generateSimpleProtectionDescription(windProtection, waveProtection, bayEnclosure, windDirection),
      debugInfo: {
        windDirection,
        waveDirection,
        seawardDirection,
        windFromSeaward,
        waveFromSeaward,
        windBlocked: windBlocked.intersects,
        windBlockDistance: windBlocked.distance,
        waveBlocked: waveBlocked.intersects,
        waveBlockDistance: waveBlocked.distance,
        bayEnclosure,
        significantSeawardHits,
        seawardRays,
        usingTiles,
        dataDensity: dataDensity.density
      }
    };
  } catch (error) {
    console.error("Error in coastline analysis:", error);
    return {
      protectionScore: 0,
      coastlineAngle: 0,
      enclosureScore: 0,
      windProtection: 0,
      waveProtection: 0,
      bayEnclosure: 0,
      isProtected: false,
      analysisError: true,
      description: "Could not analyze coastline protection. Assuming exposed for safety."
    };
  }
}

// Generate simple, accurate protection description
function generateSimpleProtectionDescription(windProt, waveProt, bayEnc, windDir) {
  const dir = getCardinalDirection(windDir);

  if (windProt > 0.6 && waveProt > 0.4) {
    return `Well protected from ${dir} winds and waves by nearby land.`;
  } else if (windProt > 0.3 || bayEnc > 0.4) {
    return `Partial protection from ${dir} winds. Some shelter from surrounding geography.`;
  } else {
    return `Exposed to ${dir} winds. Open water in the wind direction.`;
  }
}

// Main geographic protection analysis function
import { getCachedProtection, setCachedProtection } from './protectionCache.js';
import { adjustDirectionForSeason } from './seasonal.js';

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

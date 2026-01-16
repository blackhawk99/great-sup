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

  // Deep/protected bay: high enclosure at all scales (e.g., Navarino Bay)
  const isDeepBay = shortRangeEnclosure > 0.65 && midRangeEnclosure > 0.55 && longRangeEnclosure > 0.45;

  // Medium bay: good enclosure at short/mid range (e.g., Vouliagmeni, 800m-1.5km wide bays)
  // These provide excellent SUP protection even if longer rays reach open water
  const isMediumBay = !isDeepBay && shortRangeEnclosure > 0.55 && midRangeEnclosure > 0.4;

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
      }
    } catch (tileError) {
      console.warn('Tile loading failed, using bundled data:', tileError.message);
    }

    // Check coastline data density for this location
    const dataDensity = checkCoastlineDataDensity(latitude, longitude, 5, coastlineData, islandData);

    // If data is too sparse, return conservative estimate with warning
    if (dataDensity.isLowConfidence) {
      return {
        protectionScore: 0,
        coastlineAngle: 0,
        enclosureScore: 0,
        windProtection: 0,
        waveProtection: 0,
        bayEnclosure: 0,
        isProtected: false,
        dataConfidence: dataDensity.confidence,
        isLowConfidence: true,
        usingTiles,
        description: `Insufficient coastline data for accurate analysis (${dataDensity.totalPoints} points in ${dataDensity.radiusKm}km radius). Assuming exposed conditions for safety.`,
        debugInfo: {
          dataDensity: dataDensity.density,
          nearbySegments: dataDensity.nearbySegments,
          totalPoints: dataDensity.totalPoints,
          usingTiles
        }
      };
    }

    // Advanced bay geometry analysis (pass coastline data)
    const bayGeometry = analyzeBayGeometry(beachPoint, coastlineData, islandData);

    // Bay detection is now handled algorithmically - no hardcoded overrides

    // Find the nearest coastline segment
    const nearestSegment = findNearestCoastlineSegment(beachPoint, coastlineData);
    
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
    const shortHits = shortRays.map(ray => intersectsLandmass(ray, coastlineData, islandData));
    const shortEnclosure = shortHits.filter(hit => hit.intersects).length / shortRays.length;

    // Medium rays (1.5km) for typical bay/cove detection
    const mediumRays = generateRays(beachPoint, 36, 1.5);
    const mediumHits = mediumRays.map(ray => intersectsLandmass(ray, coastlineData, islandData));
    const mediumEnclosure = mediumHits.filter(hit => hit.intersects).length / mediumRays.length;

    // Long rays (3.0km) for broader geography
    const longRays = generateRays(beachPoint, 36, 3.0);
    const longHits = longRays.map(ray => intersectsLandmass(ray, coastlineData, islandData));
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
    } else if (bayGeometry.isWideBay) {
      // Wide bay - moderate short but good mid/long (e.g., Kapsali with wide mouth but headlands)
      // Weight medium/long more since that's where the actual protection is
      enclosureScore = Math.min(0.70, (shortEnclosure * 0.2) + (mediumEnclosure * 0.4) + (longEnclosure * 0.3) + 0.05);
      console.log("Using wide bay enclosure calculation:", enclosureScore);
    } else if (bayGeometry.isShallowBay) {
      // Shallow bay/cove - medium protection
      enclosureScore = (shortEnclosure * 0.5) + (mediumEnclosure * 0.3) + (longEnclosure * 0.2);
      console.log("Using shallow bay enclosure calculation:", enclosureScore);
    } else if (bayGeometry.isModerateCoast) {
      // Moderate coast - some protection but not a defined bay shape
      // Better than fully exposed, give a small bonus
      enclosureScore = Math.min(0.55, (shortEnclosure * 0.4) + (mediumEnclosure * 0.35) + (longEnclosure * 0.25) + 0.05);
      console.log("Using moderate coast enclosure calculation:", enclosureScore);
    } else {
      // Regular coastline - exposed
      enclosureScore = (shortEnclosure * 0.6) + (mediumEnclosure * 0.3) + (longEnclosure * 0.1);
      console.log("Using standard enclosure calculation:", enclosureScore);
    }
    
    // Find multiple relevant coastline segments
    const relevantSegments = findRelevantCoastlineSegments(beachPoint, coastlineData);
    
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
      dataConfidence: dataDensity.confidence,
      isLowConfidence: false,
      description: generateProtectionDescription(
        enclosureScore,
        coastlineAngle,
        totalWindProtection,
        totalWaveProtection
      ),
      isDeepBay: bayGeometry.isDeepBay,
      isMediumBay: bayGeometry.isMediumBay,
      isPeninsulaBeach: bayGeometry.isPeninsulaBeach,
      isWideBay: bayGeometry.isWideBay,
      isModerateCoast: bayGeometry.isModerateCoast,
      usingTiles,
      debugInfo: {
        shortEnclosure,
        mediumEnclosure,
        longEnclosure,
        dataDensity: dataDensity.density,
        nearbySegments: dataDensity.nearbySegments,
        usingTiles,
        bayType: bayGeometry.isDeepBay ? 'deep' : bayGeometry.isMediumBay ? 'medium' : bayGeometry.isPeninsulaBeach ? 'peninsula' : bayGeometry.isWideBay ? 'wide' : bayGeometry.isShallowBay ? 'shallow' : bayGeometry.isModerateCoast ? 'moderate' : 'exposed'
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

#!/usr/bin/env node
/**
 * Split coastline data into geographic tiles for on-demand loading
 *
 * This script:
 * 1. Reads existing coastline and island data
 * 2. Filters out invalid geometries (duplicate points, etc.)
 * 3. Splits into tiles based on geographic grid
 * 4. Outputs individual tile files for lazy loading
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Tile configuration
const TILE_SIZE = 0.5; // degrees (roughly 50km at Greek latitudes)
const GREECE_BOUNDS = {
  minLat: 34.5,
  maxLat: 42.0,
  minLng: 19.0,
  maxLng: 30.0
};

// Output directory
const OUTPUT_DIR = join(__dirname, '..', 'public', 'coastline-tiles');

// Stats tracking
const stats = {
  totalFeatures: 0,
  validFeatures: 0,
  invalidFeatures: 0,
  tilesCreated: 0,
  emptyTiles: 0
};

/**
 * Check if a LineString geometry is valid
 */
function isValidLineString(coords) {
  if (!coords || coords.length < 2) return false;

  // Check for duplicate points (all points the same)
  const uniquePoints = new Set(coords.map(c => `${c[0]},${c[1]}`));
  if (uniquePoints.size < 2) return false;

  return true;
}

/**
 * Check if a Polygon geometry is valid
 */
function isValidPolygon(coords) {
  if (!coords || !coords[0] || coords[0].length < 4) return false;
  return true;
}

/**
 * Get the tile key for a coordinate
 */
function getTileKey(lng, lat) {
  const tileLng = Math.floor(lng / TILE_SIZE) * TILE_SIZE;
  const tileLat = Math.floor(lat / TILE_SIZE) * TILE_SIZE;
  return `${tileLat.toFixed(1)}_${tileLng.toFixed(1)}`;
}

/**
 * Get all tile keys that a feature intersects
 */
function getFeatureTileKeys(feature) {
  const keys = new Set();

  if (feature.geometry.type === 'LineString') {
    for (const coord of feature.geometry.coordinates) {
      keys.add(getTileKey(coord[0], coord[1]));
    }
  } else if (feature.geometry.type === 'Polygon') {
    for (const coord of feature.geometry.coordinates[0]) {
      keys.add(getTileKey(coord[0], coord[1]));
    }
  }

  return Array.from(keys);
}

/**
 * Clip a LineString to a tile bounds (simple version - keeps segments that touch the tile)
 */
function clipLineStringToTile(coords, tileLat, tileLng) {
  const minLat = tileLat;
  const maxLat = tileLat + TILE_SIZE;
  const minLng = tileLng;
  const maxLng = tileLng + TILE_SIZE;

  // Filter to points within or near the tile (with small buffer for edge cases)
  const buffer = 0.01; // ~1km buffer
  const clippedCoords = coords.filter(([lng, lat]) =>
    lat >= minLat - buffer && lat <= maxLat + buffer &&
    lng >= minLng - buffer && lng <= maxLng + buffer
  );

  return clippedCoords.length >= 2 ? clippedCoords : null;
}

/**
 * Clip a Polygon to a tile bounds
 */
function clipPolygonToTile(coords, tileLat, tileLng) {
  const minLat = tileLat;
  const maxLat = tileLat + TILE_SIZE;
  const minLng = tileLng;
  const maxLng = tileLng + TILE_SIZE;

  const buffer = 0.01;
  const ring = coords[0];

  // Check if any point is in the tile
  const hasPointInTile = ring.some(([lng, lat]) =>
    lat >= minLat - buffer && lat <= maxLat + buffer &&
    lng >= minLng - buffer && lng <= maxLng + buffer
  );

  // For simplicity, include entire polygon if it touches the tile
  // A proper implementation would clip the polygon
  return hasPointInTile ? coords : null;
}

/**
 * Main processing function
 */
async function main() {
  console.log('🗺️  Coastline Tile Splitter\n');

  // Create output directory
  if (!existsSync(OUTPUT_DIR)) {
    mkdirSync(OUTPUT_DIR, { recursive: true });
    console.log(`📁 Created output directory: ${OUTPUT_DIR}\n`);
  }

  // Read source data
  console.log('📖 Reading source data...');

  const coastlinesPath = join(__dirname, '..', 'src', 'data', 'greece-coastlines.js');
  const islandsPath = join(__dirname, '..', 'src', 'data', 'greece-islands.js');

  // Parse the JS files (they export objects)
  const coastlinesContent = readFileSync(coastlinesPath, 'utf-8');
  const islandsContent = readFileSync(islandsPath, 'utf-8');

  // Extract JSON from JS export
  const coastlinesMatch = coastlinesContent.match(/export const greeceCoastlines = (\{[\s\S]*\});?\s*$/);
  const islandsMatch = islandsContent.match(/export const greeceIslands = (\{[\s\S]*\});?\s*$/);

  if (!coastlinesMatch || !islandsMatch) {
    console.error('❌ Could not parse source files');
    process.exit(1);
  }

  const coastlines = JSON.parse(coastlinesMatch[1]);
  const islands = JSON.parse(islandsMatch[1]);

  console.log(`   Coastlines: ${coastlines.features.length} features`);
  console.log(`   Islands: ${islands.features.length} features\n`);

  // Initialize tile storage
  const tiles = {};

  // Process coastlines
  console.log('🔍 Processing coastlines...');
  for (const feature of coastlines.features) {
    stats.totalFeatures++;

    if (feature.geometry.type !== 'LineString') continue;

    if (!isValidLineString(feature.geometry.coordinates)) {
      stats.invalidFeatures++;
      continue;
    }

    stats.validFeatures++;

    // Add to all tiles this feature touches
    const tileKeys = getFeatureTileKeys(feature);
    for (const key of tileKeys) {
      if (!tiles[key]) {
        tiles[key] = { coastlines: [], islands: [] };
      }

      const [tileLat, tileLng] = key.split('_').map(Number);
      const clipped = clipLineStringToTile(feature.geometry.coordinates, tileLat, tileLng);

      if (clipped) {
        tiles[key].coastlines.push({
          type: 'Feature',
          properties: feature.properties,
          geometry: {
            type: 'LineString',
            coordinates: clipped
          }
        });
      }
    }
  }

  // Process islands
  console.log('🏝️  Processing islands...');
  for (const feature of islands.features) {
    stats.totalFeatures++;

    if (feature.geometry.type !== 'Polygon') continue;

    if (!isValidPolygon(feature.geometry.coordinates)) {
      stats.invalidFeatures++;
      continue;
    }

    stats.validFeatures++;

    // Add to all tiles this feature touches
    const tileKeys = getFeatureTileKeys(feature);
    for (const key of tileKeys) {
      if (!tiles[key]) {
        tiles[key] = { coastlines: [], islands: [] };
      }

      const [tileLat, tileLng] = key.split('_').map(Number);
      const clipped = clipPolygonToTile(feature.geometry.coordinates, tileLat, tileLng);

      if (clipped) {
        tiles[key].islands.push({
          type: 'Feature',
          properties: feature.properties,
          geometry: {
            type: 'Polygon',
            coordinates: clipped
          }
        });
      }
    }
  }

  // Write tiles
  console.log('\n💾 Writing tiles...');

  const tileStats = [];

  for (const [key, data] of Object.entries(tiles)) {
    const coastlineCount = data.coastlines.length;
    const islandCount = data.islands.length;

    if (coastlineCount === 0 && islandCount === 0) {
      stats.emptyTiles++;
      continue;
    }

    const tileData = {
      type: 'FeatureCollection',
      properties: {
        tile: key,
        coastlineCount,
        islandCount
      },
      features: [...data.coastlines, ...data.islands]
    };

    const filename = `tile_${key}.json`;
    const filepath = join(OUTPUT_DIR, filename);
    const content = JSON.stringify(tileData);

    writeFileSync(filepath, content);
    stats.tilesCreated++;

    const sizeKB = (content.length / 1024).toFixed(1);
    tileStats.push({ key, coastlineCount, islandCount, sizeKB: parseFloat(sizeKB) });
  }

  // Generate tile index
  const tileIndex = {
    tileSize: TILE_SIZE,
    bounds: GREECE_BOUNDS,
    tiles: tileStats.map(t => ({
      key: t.key,
      file: `tile_${t.key}.json`,
      features: t.coastlineCount + t.islandCount
    }))
  };

  writeFileSync(
    join(OUTPUT_DIR, 'index.json'),
    JSON.stringify(tileIndex, null, 2)
  );

  // Print summary
  console.log('\n📊 Summary:');
  console.log(`   Total features processed: ${stats.totalFeatures}`);
  console.log(`   Valid features: ${stats.validFeatures} (${((stats.validFeatures/stats.totalFeatures)*100).toFixed(1)}%)`);
  console.log(`   Invalid features filtered: ${stats.invalidFeatures} (${((stats.invalidFeatures/stats.totalFeatures)*100).toFixed(1)}%)`);
  console.log(`   Tiles created: ${stats.tilesCreated}`);
  console.log(`   Empty tiles skipped: ${stats.emptyTiles}`);

  // Size analysis
  const sortedBySize = tileStats.sort((a, b) => b.sizeKB - a.sizeKB);
  const totalSizeKB = tileStats.reduce((sum, t) => sum + t.sizeKB, 0);

  console.log(`\n📦 Size Analysis:`);
  console.log(`   Total tile data: ${totalSizeKB.toFixed(1)} KB`);
  console.log(`   Average tile size: ${(totalSizeKB / stats.tilesCreated).toFixed(1)} KB`);
  console.log(`   Largest tiles:`);
  for (const tile of sortedBySize.slice(0, 5)) {
    console.log(`     - ${tile.key}: ${tile.sizeKB} KB (${tile.coastlineCount} coastlines, ${tile.islandCount} islands)`);
  }

  console.log('\n✅ Done! Tiles written to:', OUTPUT_DIR);
}

main().catch(console.error);

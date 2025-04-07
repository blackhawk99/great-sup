// data-processing/process-coastlines.js
import fs from 'fs';
import path from 'path';
import * as turf from '@turf/turf';
import { fileURLToPath } from 'url';

// Get current directory
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configuration
const INPUT_FILE = './gadm41_GRC_1.json';
const OUTPUT_DIR = path.join(__dirname, '../src/data');

// Simplification settings
const SIMPLIFY_TOLERANCE = 0.005; // Higher = more simplification, smaller files

console.log('Starting Greek coastline processing...');

// Check if input file exists
if (!fs.existsSync(INPUT_FILE)) {
  console.error(`Error: Input file ${INPUT_FILE} not found.`);
  console.log('Please download the file from GADM first:');
  console.log('1. Go to https://gadm.org/download_country.html');
  console.log('2. Select "Greece" from the country list');
  console.log('3. Download the GeoJSON format (Level 1)');
  console.log('4. Save the file as gadm41_GRC_1.json in this directory');
  process.exit(1);
}

// Load the data
console.log(`Loading Greece GeoJSON data from ${INPUT_FILE}...`);
let greeceData;
try {
  const data = fs.readFileSync(INPUT_FILE, 'utf8');
  greeceData = JSON.parse(data);
} catch (error) {
  console.error(`Error loading data: ${error.message}`);
  process.exit(1);
}

// Check the data structure
if (!greeceData || !greeceData.features || !Array.isArray(greeceData.features)) {
  console.error('Error: Invalid GeoJSON structure');
  process.exit(1);
}

console.log(`Loaded ${greeceData.features.length} features.`);

// Function to simplify geometries
function simplifyGeometry(feature, tolerance = SIMPLIFY_TOLERANCE) {
  try {
    return turf.simplify(feature, {
      tolerance: tolerance,
      highQuality: true
    });
  } catch (error) {
    console.error(`Error simplifying geometry: ${error.message}`);
    return feature;
  }
}

// Function to extract coastlines and islands
function processFeatures(features) {
  const coastlines = [];
  const islands = [];
  
  features.forEach((feature, index) => {
    try {
      // Process MultiPolygon features (typical for regions with islands)
      if (feature.geometry.type === 'MultiPolygon') {
        feature.geometry.coordinates.forEach((polygonCoords, polyIndex) => {
          // The outer ring of each polygon could be a coastline or an island
          const polygon = turf.polygon(polygonCoords);
          const area = turf.area(polygon);
          
          // Determine if it's an island (smaller than mainland, larger than tiny islets)
          const isIslandCandidate = area > 0.1 * 1000000 && area < 20000 * 1000000;
          
          if (isIslandCandidate) {
            // It's likely an island
            const simplifiedIsland = simplifyGeometry(polygon);
            islands.push({
              type: 'Feature',
              properties: {
                name: `${feature.properties?.NAME_1 || 'Region'}_Island_${polyIndex}`,
                region: feature.properties?.NAME_1 || 'Unknown'
              },
              geometry: simplifiedIsland.geometry
            });
          }
          
          // Add the coastline regardless (both mainland and islands have coastlines)
          // Convert polygon outer ring to LineString (coastline)
          coastlines.push({
            type: 'Feature',
            properties: {
              name: `${feature.properties?.NAME_1 || 'Region'}_Coast_${polyIndex}`,
              region: feature.properties?.NAME_1 || 'Unknown'
            },
            geometry: {
              type: 'LineString',
              coordinates: polygonCoords[0] // Outer ring
            }
          });
        });
      } 
      // Process Polygon features
      else if (feature.geometry.type === 'Polygon') {
        const polygon = turf.polygon(feature.geometry.coordinates);
        const area = turf.area(polygon);
        
        // Determine if it's an island
        const isIslandCandidate = area > 0.1 * 1000000 && area < 20000 * 1000000;
        
        if (isIslandCandidate) {
          // It's likely an island
          const simplifiedIsland = simplifyGeometry(polygon);
          islands.push({
            type: 'Feature',
            properties: {
              name: feature.properties?.NAME_1 || `Island_${index}`,
              region: feature.properties?.NAME_1 || 'Unknown'
            },
            geometry: simplifiedIsland.geometry
          });
        }
        
        // Add the coastline
        coastlines.push({
          type: 'Feature',
          properties: {
            name: `${feature.properties?.NAME_1 || 'Region'}_Coast`,
            region: feature.properties?.NAME_1 || 'Unknown'
          },
          geometry: {
            type: 'LineString',
            coordinates: feature.geometry.coordinates[0] // Outer ring
          }
        });
      }
    } catch (error) {
      console.error(`Error processing feature ${index}: ${error.message}`);
    }
  });
  
  return { coastlines, islands };
}

console.log('Processing features to extract coastlines and islands...');
const { coastlines, islands } = processFeatures(greeceData.features);

// Simplify coastlines
console.log('Simplifying coastlines...');
const simplifiedCoastlines = coastlines.map(coastline => {
  try {
    return simplifyGeometry(coastline);
  } catch (error) {
    console.error(`Error simplifying coastline: ${error.message}`);
    return coastline;
  }
});

console.log(`Processed ${simplifiedCoastlines.length} coastline segments and ${islands.length} islands.`);

// Create GeoJSON collections
const coastlineCollection = {
  type: 'FeatureCollection',
  features: simplifiedCoastlines
};

const islandCollection = {
  type: 'FeatureCollection',
  features: islands
};

// Ensure output directory exists
if (!fs.existsSync(OUTPUT_DIR)) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

// Save coastlines
const coastlinesFilePath = path.join(OUTPUT_DIR, 'greece-coastlines.js');
console.log(`Saving coastlines to ${coastlinesFilePath}...`);

fs.writeFileSync(
  coastlinesFilePath,
  `// Auto-generated Greek coastlines from GADM data
export const greeceCoastlines = ${JSON.stringify(coastlineCollection, null, 2)};
`
);

// Save islands
const islandsFilePath = path.join(OUTPUT_DIR, 'greece-islands.js');
console.log(`Saving islands to ${islandsFilePath}...`);

fs.writeFileSync(
  islandsFilePath,
  `// Auto-generated Greek islands from GADM data
export const greeceIslands = ${JSON.stringify(islandCollection, null, 2)};
`
);

console.log('Processing complete!');

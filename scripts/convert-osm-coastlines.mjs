// Convert OSM coastline data to GeoJSON format for the app
import fs from 'fs';

const data = JSON.parse(fs.readFileSync('/tmp/greece_coastlines.json', 'utf8'));

console.log('Processing', data.elements.length, 'coastline ways...');

const coastlineFeatures = [];
const islandFeatures = [];

// Greek bounds for region detection
const regionBounds = {
  'Aegean': { minLon: 24.0, maxLon: 29.8, minLat: 34.6, maxLat: 40.0 },
  'Ionian': { minLon: 19.0, maxLon: 21.5, minLat: 36.0, maxLat: 40.0 },
  'Attica': { minLon: 23.2, maxLon: 24.2, minLat: 37.5, maxLat: 38.5 },
  'Peloponnese': { minLon: 21.0, maxLon: 24.0, minLat: 36.0, maxLat: 38.5 },
  'Crete': { minLon: 23.5, maxLon: 26.5, minLat: 34.6, maxLat: 36.0 },
  'Dodecanese': { minLon: 26.5, maxLon: 29.8, minLat: 35.0, maxLat: 37.5 },
  'Cyclades': { minLon: 24.0, maxLon: 26.0, minLat: 36.0, maxLat: 38.0 },
  'Northern': { minLon: 22.0, maxLon: 26.5, minLat: 39.5, maxLat: 41.9 },
};

function getRegion(lon, lat) {
  for (const [name, bounds] of Object.entries(regionBounds)) {
    if (lon >= bounds.minLon && lon <= bounds.maxLon &&
        lat >= bounds.minLat && lat <= bounds.maxLat) {
      return name;
    }
  }
  return 'Greece';
}

let coastlineId = 0;
let islandId = 0;

for (const element of data.elements) {
  if (!element.geometry || element.geometry.length < 2) continue;

  // Convert geometry to [lon, lat] format
  const coords = element.geometry.map(pt => [pt.lon, pt.lat]);

  // Determine region from centroid
  const centroidLon = coords.reduce((s, c) => s + c[0], 0) / coords.length;
  const centroidLat = coords.reduce((s, c) => s + c[1], 0) / coords.length;
  const region = getRegion(centroidLon, centroidLat);

  // Check if it's a closed polygon (island)
  const first = coords[0];
  const last = coords[coords.length - 1];
  const isClosed = Math.abs(first[0] - last[0]) < 0.0001 &&
                   Math.abs(first[1] - last[1]) < 0.0001;

  if (isClosed && coords.length >= 4) {
    // Island polygon
    islandFeatures.push({
      type: 'Feature',
      properties: {
        name: `${region}_Island_${islandId++}`,
        region: region,
        osmId: element.id
      },
      geometry: {
        type: 'Polygon',
        coordinates: [coords]
      }
    });
  } else {
    // Open coastline
    coastlineFeatures.push({
      type: 'Feature',
      properties: {
        name: `${region}_Coast_${coastlineId++}`,
        region: region,
        osmId: element.id
      },
      geometry: {
        type: 'LineString',
        coordinates: coords
      }
    });
  }
}

// Create GeoJSON collections
const coastlinesGeoJSON = {
  type: 'FeatureCollection',
  features: coastlineFeatures
};

const islandsGeoJSON = {
  type: 'FeatureCollection',
  features: islandFeatures
};

// Count total points
const coastlinePoints = coastlineFeatures.reduce((s, f) => s + f.geometry.coordinates.length, 0);
const islandPoints = islandFeatures.reduce((s, f) => s + f.geometry.coordinates[0].length, 0);

console.log('Coastlines:', coastlineFeatures.length, 'features,', coastlinePoints, 'points');
console.log('Islands:', islandFeatures.length, 'features,', islandPoints, 'points');
console.log('Total points:', coastlinePoints + islandPoints);

// Generate JS module files
const coastlinesJS = `// Greek coastlines from OpenStreetMap data
// Generated: ${new Date().toISOString()}
// Source: OpenStreetMap contributors (ODbL license)
// Total features: ${coastlineFeatures.length}, Total points: ${coastlinePoints}

export const greeceCoastlines = ${JSON.stringify(coastlinesGeoJSON, null, 2)};
`;

const islandsJS = `// Greek islands from OpenStreetMap data
// Generated: ${new Date().toISOString()}
// Source: OpenStreetMap contributors (ODbL license)
// Total features: ${islandFeatures.length}, Total points: ${islandPoints}

export const greeceIslands = ${JSON.stringify(islandsGeoJSON, null, 2)};
`;

// Write files
fs.writeFileSync('src/data/greece-coastlines.js', coastlinesJS);
fs.writeFileSync('src/data/greece-islands.js', islandsJS);

console.log('\nFiles written:');
console.log('- src/data/greece-coastlines.js');
console.log('- src/data/greece-islands.js');

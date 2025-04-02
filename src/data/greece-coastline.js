// Create a new file: src/data/greece-coastline.js
// This is a simplified GeoJSON for Greece coastlines

export const greeceCoastline = {
  "type": "FeatureCollection",
  "features": [
    {
      "type": "Feature",
      "properties": {},
      "geometry": {
        "type": "LineString",
        "coordinates": [
          // Athens Riviera section (partial)
          [23.7686, 37.8207], // Kavouri
          [23.7761, 37.8235], 
          [23.7850, 37.8095], // Astir Beach area
          [23.7938, 37.8024],
          [23.8011, 37.8133], // Varkiza
          [23.7808, 37.8179], // Vouliagmeni
          [23.7470, 37.8650], // Glyfada
          // More coastal points would be added here...
        ]
      }
    },
    // Kythira island (simplified)
    {
      "type": "Feature",
      "properties": {},
      "geometry": {
        "type": "LineString",
        "coordinates": [
          [22.9980, 36.1360], // Kapsali
          [22.9944, 36.1388],
          [22.9896, 36.1422],
          [23.0410, 36.2260], // Palaiopoli
          [23.0380, 36.2310],
          [23.0330, 36.2350]
          // More points for complete coastline...
        ]
      }
    }
  ]
};

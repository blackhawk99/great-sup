import * as turf from '@turf/turf';

export function generateRays(center, numRays, distance) {
  const rays = [];
  const [lng, lat] = center.geometry.coordinates;
  
  for (let i = 0; i < numRays; i++) {
    const angle = (i * 360) / numRays;
    const destination = turf.destination(center, distance, angle, { units: 'kilometers' });
    rays.push(turf.lineString([center.geometry.coordinates, destination.geometry.coordinates]));
  }

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

export function calculateDirectionalExposure(windDirection, coastlineAngle) {
  // Normalize angles to 0-360
  windDirection = (windDirection + 360) % 360;
  coastlineAngle = (coastlineAngle + 360) % 360;
  
  // Calculate the absolute angular difference
  const diff = Math.abs(windDirection - coastlineAngle);
  return Math.min(diff, 360 - diff);
}


import * as turf from '@turf/turf';
import { greeceCoastline } from '../data/greece-coastline';

export function generateRays(center: turf.helpers.Point, numRays: number, distance: number) {
  try {
    const rays: turf.helpers.Feature<turf.helpers.LineString>[] = [];
    const [lng, lat] = center.geometry.coordinates;

    for (let i = 0; i < numRays; i++) {
      const angle = (i * 360) / numRays;
      const destination = turf.destination(center, distance, angle, { units: 'kilometers' });
      rays.push(turf.lineString([center.geometry.coordinates, destination.geometry.coordinates]));
    }

    return rays;
  } catch (error) {
    console.error('Error generating rays:', error);
    return [];
  }
}

export function intersectsCoastline(ray: turf.helpers.Feature<turf.helpers.LineString>, coastline: any) {
  try {
    let minDistance = Infinity;
    let intersection = null;

    for (const feature of coastline.features) {
      if (feature.geometry.type === 'LineString') {
        const line = turf.lineString(feature.geometry.coordinates);
        const intersects = turf.lineIntersect(ray, line);

        if (intersects.features.length > 0) {
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
      distance: minDistance,
      intersection,
    };
  } catch (error) {
    console.error('Error in coastline intersection logic:', error);
    return { intersects: false, distance: Infinity, intersection: null };
  }
}

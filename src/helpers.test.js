import assert from 'node:assert/strict';
import { parseGoogleMapsUrl } from './googleMapsUtils.js';

// test 1: q=lat,lng pattern
const result1 = parseGoogleMapsUrl('https://maps.google.com/?q=37.8235,23.7761');
assert.equal(result1.latitude, 37.8235);
assert.equal(result1.longitude, 23.7761);
console.log('Test 1 passed');

// test 2: @lat,lng pattern
const result2 = parseGoogleMapsUrl('https://maps.google.com/@37.8235,23.7761,15z');
assert.equal(result2.latitude, 37.8235);
assert.equal(result2.longitude, 23.7761);
console.log('Test 2 passed');

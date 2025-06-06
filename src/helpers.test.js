import assert from 'node:assert/strict';
import { parseGoogleMapsUrl } from './googleMapsUtils.js';
import { timeStringToMinutes } from './timeUtils.js';

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

// test 3: HH:mm to minutes conversion
assert.equal(timeStringToMinutes('10:30'), 630);
assert.equal(timeStringToMinutes('00:00'), 0);
console.log('Test 3 passed');

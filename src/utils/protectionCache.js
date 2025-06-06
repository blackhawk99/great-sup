const CACHE_KEY = 'geoProtectionCache_v1';

function loadCache() {
  if (typeof localStorage === 'undefined') return {};
  try {
    const item = localStorage.getItem(CACHE_KEY);
    return item ? JSON.parse(item) : {};
  } catch {
    return {};
  }
}

function saveCache(cache) {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(cache));
  } catch {
    // Ignore write errors (e.g., storage quota exceeded)
  }
}

const cache = loadCache();

export function getCachedProtection(key) {
  return cache[key];
}

export function setCachedProtection(key, value) {
  cache[key] = value;
  saveCache(cache);
}

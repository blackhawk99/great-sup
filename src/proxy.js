// proxy.js
export const resolveGoogleMapsShortUrl = async (shortUrl) => {
  try {
    // Use the cors-anywhere proxy to resolve redirects
    const proxyUrl = 'https://cors-anywhere.herokuapp.com/';
    
    // Make a HEAD request to follow redirects
    const response = await fetch(proxyUrl + shortUrl, {
      method: 'HEAD',
      redirect: 'follow'
    });
    
    // Get the final URL after redirects
    const finalUrl = response.url.replace(proxyUrl, '');
    
    // Extract location name from the final URL
    let locationName = "New Beach";
    const placeMatch = finalUrl.match(/\/place\/([^\/]+)\//);
    if (placeMatch && placeMatch[1]) {
      locationName = decodeURIComponent(placeMatch[1])
        .replace(/\+/g, ' ')
        .replace(/\d+\.\d+,\d+\.\d+/, '')
        .trim();
    }
    
    // Extract coordinates from the final URL
    const coordsMatch = finalUrl.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/);
    if (coordsMatch) {
      return {
        name: locationName,
        latitude: parseFloat(coordsMatch[1]),
        longitude: parseFloat(coordsMatch[2]),
        googleMapsUrl: shortUrl
      };
    }
    
    return null;
  } catch (error) {
    console.error("Error resolving Google Maps URL:", error);
    return null;
  }
};

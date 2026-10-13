// API configuration and endpoint URLs
const GEOAPIFY_KEY = "73d1a42d80b040749c2a4b5477a52e2c";
const GEOCODE_URL = "https://api.geoapify.com/v1/geocode/search";
const WIKI_URL = "https://en.wikipedia.org/w/api.php";

// Pagination and search grid limits
export const PAGE_SIZE = 10;        // Max results per Wikipedia geosearch call
export const MAX_TILE_CALLS = 18;   // Maximum grid sample calls allowed per search
export const TILE_RADIUS_M = 3000;  // Search radius in meters for each query point

// Offsets [north_meters, east_meters] sorted radially from center
// Allows expanding coverage across the area starting from the exact location
const TILE_OFFSETS_M = [
  [0, 0],
  [2500, 0], [-2500, 0], [0, 2500], [0, -2500],
  [2500, 2500], [2500, -2500], [-2500, 2500], [-2500, -2500],
  [5000, 0], [-5000, 0], [0, 5000], [0, -5000],
  [5000, 5000], [5000, -5000], [-5000, 5000], [-5000, -5000],
  [7500, 0],
];

// Calculates the straight-line distance in meters between two lat/lon points (Haversine formula)
function haversineM(aLat, aLon, bLat, bLon) {
  const R = 6371000;
  const dLat = ((bLat - aLat) * Math.PI) / 180;
  const dLon = ((bLon - aLon) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((aLat * Math.PI) / 180) * Math.cos((bLat * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

// Calculates new coordinates given north and east distance offsets in meters
function offsetLatLon(lat, lon, northM, eastM) {
  const dLat = northM / 111320;
  const dLon = eastM / (111320 * Math.cos((lat * Math.PI) / 180));
  return [lat + dLat, lon + dLon];
}

// Custom error class to categorize network, quota, and empty result errors
export class ApiError extends Error {
  constructor(message, kind = "network") {
    super(message);
    this.kind = kind; // "network", "quota", or "empty"
  }
}

// Fetches and parses JSON from a URL with standardized error handling
async function getJson(url) {
  let res;
  try {
    res = await fetch(url);
  } catch {
    throw new ApiError("Connection issue. Check your internet and retry.", "network");
  }
  if (res.status === 401 || res.status === 403) {
    throw new ApiError("API limit reached or invalid key.", "quota");
  }
  if (!res.ok) throw new ApiError(`Request failed (${res.status}).`, "network");
  return res.json();
}

// Geocodes a text query into geographical coordinates using Geoapify
export async function geocodeCity(text) {
  const url = `${GEOCODE_URL}?text=${encodeURIComponent(text)}&limit=1&format=json&apiKey=${GEOAPIFY_KEY}`;
  const data = await getJson(url);
  const hit = data?.results?.[0];
  if (!hit) throw new ApiError("No results for that search.", "empty");
  return {
    name: hit.formatted || hit.city || text,
    lat: hit.lat,
    lon: hit.lon,
  };
}

// Queries a single batch of Wikipedia places around a specific coordinate
async function fetchTile(lat, lon) {
  const params = new URLSearchParams({
    action: "query",
    list: "geosearch",
    gscoord: `${lat}|${lon}`,
    gsradius: String(TILE_RADIUS_M),
    gslimit: String(PAGE_SIZE),
    format: "json",
    origin: "*",
  });
  const data = await getJson(`${WIKI_URL}?${params}`);
  return data?.query?.geosearch ?? [];
}

// Performs a single search around coordinates, returning up to 10 closest places
export async function searchPlaces(lat, lon) {
  const rows = await fetchTile(lat, lon);
  if (!rows.length) throw new ApiError("No results near this location.", "empty");
  return rows.map((p) => ({
    pageid: p.pageid,
    name: p.title,
    lat: p.lat,
    lon: p.lon,
    dist: haversineM(lat, lon, p.lat, p.lon),
  }));
}

// Progressively streams place results in batches around a center coordinate
export async function searchPlacesStream(centerLat, centerLon, onBatch, shouldAbort) {
  const seen = new Set();
  let totalNew = 0;
  let emptyStreak = 0;
  const calls = Math.min(MAX_TILE_CALLS, TILE_OFFSETS_M.length);

  for (let i = 0; i < calls; i++) {
    // Check if the current search was superseded or cancelled
    if (shouldAbort?.()) break;

    const [nM, eM] = TILE_OFFSETS_M[i];
    const [tLat, tLon] = offsetLatLon(centerLat, centerLon, nM, eM);
    let rows;
    try {
      rows = await fetchTile(tLat, tLon);
    } catch {
      continue; // Skip failed tile queries without breaking entire stream
    }

    if (shouldAbort?.()) break;

    // Filter out duplicate places already encountered in previous tiles
    const fresh = [];
    for (const p of rows) {
      if (seen.has(p.pageid)) continue;
      seen.add(p.pageid);
      fresh.push({
        pageid: p.pageid,
        name: p.title,
        lat: p.lat,
        lon: p.lon,
        dist: haversineM(centerLat, centerLon, p.lat, p.lon),
      });
    }

    // Stop searching if consecutive queries return no new places
    if (!fresh.length) {
      emptyStreak++;
      if (emptyStreak >= 3 && totalNew > 0) break;
      continue;
    }

    emptyStreak = 0;
    // Sort the new batch by distance before passing to callback
    fresh.sort((a, b) => a.dist - b.dist);
    totalNew += fresh.length;
    await onBatch?.(fresh);
  }

  if (!totalNew) throw new ApiError("No results near this location.", "empty");
  return totalNew;
}

// Fetches detailed article information (image, summary, coordinates) for a given place ID
export async function getPlaceDetails(pageid) {
  const params = new URLSearchParams({
    action: "query",
    pageids: String(pageid),
    prop: "pageimages|extracts|coordinates",
    exintro: "1",
    explaintext: "1",
    pithumbsize: "600",
    format: "json",
    origin: "*",
  });
  const data = await getJson(`${WIKI_URL}?${params}`);
  const page = data?.query?.pages?.[pageid];
  if (!page) throw new ApiError("Details not available.", "empty");

  return {
    pageid,
    name: page.title,
    description: page.extract || "No description available.",
    image: page.thumbnail?.source || "",
    coords: page.coordinates?.[0] || null,
    wikiUrl: `https://en.wikipedia.org/?curid=${pageid}`,
  };
}

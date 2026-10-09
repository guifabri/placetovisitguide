// §6 api.mjs — Geoapify geocode + Wikipedia geosearch/details + error handling.
// No OpenTripMap/xid logic (removed in proposal v2).

// Educational project: Geoapify key hardcoded (public teaching key).
const GEOAPIFY_KEY = "73d1a42d80b040749c2a4b5477a52e2c";

const GEOCODE_URL = "https://api.geoapify.com/v1/geocode/search";
const WIKI_URL = "https://en.wikipedia.org/w/api.php";
export const SEARCH_RADIUS_M = 5000; // fixed 5 km radius (proposal §5)

export class ApiError extends Error {
  constructor(message, kind = "network") {
    super(message);
    this.kind = kind; // network | quota | empty | key
  }
}

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

// §3.1 Location search — first Geoapify result wins.
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

// §3.3 Attractions list — Wikipedia geosearch around the center.
export async function searchPlaces(lat, lon) {
  const params = new URLSearchParams({
    action: "query",
    list: "geosearch",
    gscoord: `${lat}|${lon}`,
    gsradius: String(SEARCH_RADIUS_M),
    gslimit: "50",
    format: "json",
    origin: "*",
  });
  const data = await getJson(`${WIKI_URL}?${params}`);
  const places = data?.query?.geosearch ?? [];
  if (!places.length) throw new ApiError("No results near this location.", "empty");
  return places.map((p) => ({
    pageid: p.pageid,
    name: p.title,
    lat: p.lat,
    lon: p.lon,
    dist: p.dist, // meters from center, provided by Wikipedia
  }));
}

// §3.5 Place details — image + summary + coordinates + Wikipedia link.
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

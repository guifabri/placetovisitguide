// Tile layer URL and attribution for Esri World Street Map
const ESRI_TILES =
  "https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}";
const ATTRIBUTION =
  "&copy; <a href='https://www.esri.com/'>Esri</a>, Maxar, Earthstar Geographics";

// Internal map instance and registry of rendered markers indexed by pageid
let map = null;
let markers = new Map();

// Initializes the Leaflet map attached to a DOM element ID
export function initMap(elId, center = [40.7708, -111.8921], zoom = 15) {
  map = L.map(elId).setView(center, zoom);
  L.tileLayer(ESRI_TILES, { maxZoom: 19, attribution: ATTRIBUTION }).addTo(map);
  return map;
}

// Moves and zooms the map view to specified coordinates
export function centerMap(lat, lon, zoom = 13) {
  map?.setView([lat, lon], zoom);
}

// Removes all current markers from the map and clears the internal registry
export function clearMarkers() {
  for (const m of markers.values()) m.remove();
  markers.clear();
}

// Clears all existing markers and redraws markers for the provided places list
export function addMarkers(places, onSelect) {
  clearMarkers();
  addMarkersIncremental(places, onSelect);
}

// Incrementally adds markers for new places without removing already rendered ones
export function addMarkersIncremental(places, onSelect) {
  if (!map) return;
  for (const p of places) {
    if (markers.has(p.pageid)) continue; // Skip places already represented on the map
    const m = L.marker([p.lat, p.lon]).addTo(map).bindPopup(p.name);
    m.on("click", () => onSelect?.(p.pageid));
    markers.set(p.pageid, m);
  }
}

// Opens the popup of a marker by place ID and pans the map to its position
export function highlightMarker(pageid) {
  const m = markers.get(pageid);
  if (m) {
    m.openPopup();
    map?.panTo(m.getLatLng());
  }
}

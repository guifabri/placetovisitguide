// §6 map.mjs — Leaflet + Esri World Street Map tiles.
// NOTE: Esri order is {z}/{y}/{x}, NOT OSM's {z}/{x}/{y} (proposal §10).

const ESRI_TILES =
  "https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}";
const ATTRIBUTION =
  "&copy; <a href='https://www.esri.com/'>Esri</a>, Maxar, Earthstar Geographics";

let map = null;
let markers = new Map(); // pageid -> L.Marker

export function initMap(elId, center = [40.7708, -111.8921], zoom = 15) {
  map = L.map(elId).setView(center, zoom);
  L.tileLayer(ESRI_TILES, { maxZoom: 19, attribution: ATTRIBUTION }).addTo(map);
  return map;
}

export function centerMap(lat, lon, zoom = 13) {
  map?.setView([lat, lon], zoom);
}

export function clearMarkers() {
  for (const m of markers.values()) m.remove();
  markers.clear();
}

// Markers stay synced with the list: addMarkers() is called on every search/filter change.
export function addMarkers(places, onSelect) {
  clearMarkers();
  addMarkersIncremental(places, onSelect);
}

// Agregado progresivo: solo añade pageids nuevos, sin borrar los ya pintados.
export function addMarkersIncremental(places, onSelect) {
  if (!map) return;
  for (const p of places) {
    if (markers.has(p.pageid)) continue;
    const m = L.marker([p.lat, p.lon]).addTo(map).bindPopup(p.name);
    m.on("click", () => onSelect?.(p.pageid));
    markers.set(p.pageid, m);
  }
}

export function highlightMarker(pageid) {
  const m = markers.get(pageid);
  if (m) {
    m.openPopup();
    map?.panTo(m.getLatLng());
  }
}

// Imports: API utilities, map functions, UI renderers, and storage handlers
import { geocodeCity, searchPlacesStream, getPlaceDetails, ApiError } from "./api.mjs";
import { initMap, centerMap, addMarkers, addMarkersIncremental, clearMarkers, highlightMarker } from "./map.mjs";
import {
  renderCards, renderChips, renderModal, closeModal, showLoading, showMessage,
} from "./ui.mjs";
import { getFavorites, isFavorite, toggleFavorite } from "./storage.mjs";

// Helper shortcut to access DOM elements by ID
const $ = (id) => document.getElementById(id);

// Application state
let center = null;          // Holds coordinates and name of current search center
let places = [];            // Accumulated list of place results
let activeCategory = "all"; // Current category filter selection
let searchSeq = 0;          // Monotonic counter to discard stale asynchronous search responses

// Checks whether a place matches the currently selected category filter
function passesFilter(p) {
  if (activeCategory === "all") return true;
  return p.name.toLowerCase().includes(activeCategory.toLowerCase());
}

// Executes a progressive geographical search around the given latitude and longitude
async function runSearchByCoords(lat, lon, label) {
  const myId = ++searchSeq; // Tag this search invocation to prevent race conditions
  const loader = $("loader");
  showMessage($("message")); // Clear existing status messages
  loader.textContent = "Loading… 0 places…";
  showLoading(loader, true);

  try {
    // Reset view and state for new location
    center = { lat, lon, name: label };
    $("placeName").textContent = label;
    centerMap(lat, lon);
    places = [];
    clearMarkers();
    refreshListOnly();
    let firstPaint = false;

    // Stream results progressively in batches
    await searchPlacesStream(lat, lon, async (batch) => {
      // Discard batch if a newer search was initiated
      if (myId !== searchSeq) return;

      places.push(...batch);

      // Sort full list globally by distance to center
      places.sort((a, b) => (a.dist ?? Infinity) - (b.dist ?? Infinity));
      refreshListOnly();

      // Add only matching places to map incrementally
      addMarkersIncremental(batch.filter(passesFilter), (pageid) => highlightMarker(pageid));

      // Update loading counters and place title
      loader.textContent = `Loading… ${places.length} places…`;
      $("placeName").textContent = `${label} (${places.length})`;

      // Center and open popup for the closest first place on first paint
      if (!firstPaint && places.length) {
        firstPaint = true;
        highlightMarker(places[0].pageid);
      }
    }, () => myId !== searchSeq);

    // Abort if another search took over
    if (myId !== searchSeq) return;
    if (!places.length) showMessage($("message"), "No results near this location.");
  } catch (e) {
    if (myId !== searchSeq) return;

    // Keep partial results if any arrived, otherwise display error
    if (!places.length) {
      showMessage($("message"), e instanceof ApiError ? e.message : "Connection issue.");
    } else {
      showMessage($("message"), "Showing partial results (some areas failed to load).");
    }
  } finally {
    // Only hide loader if this is still the active search
    if (myId === searchSeq) showLoading(loader, false);
  }
}

// Filters places based on the active category name
function filtered() {
  if (activeCategory === "all") return places;
  const q = activeCategory.toLowerCase();
  return places.filter((p) => p.name.toLowerCase().includes(q));
}

// Re-renders the card list without resetting map markers
function refreshListOnly() {
  const list = filtered();
  const favIds = new Set(getFavorites().map((f) => f.pageid));
  renderCards($("cards"), list, center, favIds, openDetails, (p) => {
    toggleFavorite(p);
    refresh();
  });
  if (!list.length && places.length) showMessage($("message"), "No results for this filter.");
}

// Full view refresh: updates both the cards list and map markers
function refresh() {
  const list = filtered();
  const favIds = new Set(getFavorites().map((f) => f.pageid));
  renderCards($("cards"), list, center, favIds, openDetails, (p) => {
    toggleFavorite(p);
    refresh();
  });
  addMarkers(list, (pageid) => highlightMarker(pageid));
  if (!list.length) showMessage($("message"), "No results for this filter.");
}

// Fetches details for a place and displays the detail modal dialog
async function openDetails(pageid) {
  try {
    const d = await getPlaceDetails(pageid);
    const place = places.find((p) => p.pageid === pageid) || { ...d, lat: d.coords?.lat, lon: d.coords?.lon };
    renderModal($("modal"), d, isFavorite(pageid), () => {
      toggleFavorite({ ...place, image: d.image });
      openDetails(pageid);
      refresh();
    }, () => closeModal($("modal")));
    highlightMarker(pageid);
  } catch (e) {
    showMessage($("message"), e instanceof ApiError ? e.message : "Connection issue.");
  }
}

// Handles selecting a category chip to filter the places
function onPickChip(c) {
  activeCategory = c;
  document.querySelectorAll("#chips .chip").forEach((el) =>
    el.classList.toggle("active", el.textContent === c));
  refresh();
}

// Binds all DOM event listeners for inputs, buttons, and navigation links
function wireEvents() {
  // Triggers city geocoding and subsequent place search
  const doSearch = () => {
    const q = $("search").value.trim();
    if (!q) return;
    showLoading($("loader"), true);
    geocodeCity(q)
      .then((g) => runSearchByCoords(g.lat, g.lon, g.name))
      .catch((e) => {
        showLoading($("loader"), false);
        showMessage($("message"), e instanceof ApiError ? e.message : "Connection issue.");
      });
  };

  $("searchBtn").onclick = doSearch;
  $("search").addEventListener("keydown", (e) => { if (e.key === "Enter") doSearch(); });

  // Browser Geolocation API to find nearby places based on device GPS
  $("locateBtn").onclick = () => {
    if (!navigator.geolocation) return showMessage($("message"), "Geolocation not supported.");
    navigator.geolocation.getCurrentPosition(
      (pos) => runSearchByCoords(pos.coords.latitude, pos.coords.longitude, "My location"),
      () => showMessage($("message"), "Location unavailable.")
    );
  };

  renderChips($("chips"), activeCategory, onPickChip);

  // Switches the view to saved favorites
  $("favLink").onclick = (e) => {
    e.preventDefault();
    searchSeq++; // Invalidate and cancel any ongoing search stream
    places = getFavorites();
    center = null;
    $("placeName").textContent = "Favorites";
    refresh();
  };

  // Navigates to search input focus when clicking home
  $("homeLink").onclick = (e) => { e.preventDefault(); $("search").focus(); };
}

// Application startup: initialize map, bind events, and render category chips
initMap("map", [40.7708, -111.8921], 15);
wireEvents();
renderChips($("chips"), activeCategory, onPickChip);

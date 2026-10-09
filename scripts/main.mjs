// §6 main.mjs — entry point: events, geolocation, view switching.

import { geocodeCity, searchPlacesStream, getPlaceDetails, ApiError } from "./api.mjs";
import { initMap, centerMap, addMarkers, addMarkersIncremental, clearMarkers, highlightMarker } from "./map.mjs";
import {
  renderCards, renderChips, renderModal, closeModal, showLoading, showMessage,
} from "./ui.mjs";
import { getFavorites, isFavorite, toggleFavorite } from "./storage.mjs";

const $ = (id) => document.getElementById(id);

let center = null;
let places = [];
let activeCategory = "all";
let searchSeq = 0;

function passesFilter(p) {
  if (activeCategory === "all") return true;
  return p.name.toLowerCase().includes(activeCategory.toLowerCase());
}

async function runSearchByCoords(lat, lon, label) {
  const myId = ++searchSeq;
  const loader = $("loader");
  showMessage($("message"));
  loader.textContent = "Loading… 0 places…";
  showLoading(loader, true);
  try {
    center = { lat, lon, name: label };
    $("placeName").textContent = label;
    centerMap(lat, lon);
    places = [];
    clearMarkers();
    refreshListOnly();
    let firstPaint = false;
    await searchPlacesStream(lat, lon, async (batch) => {
      if (myId !== searchSeq) return;
      places.push(...batch);
      // Orden global por distancia al centro.
      places.sort((a, b) => (a.dist ?? Infinity) - (b.dist ?? Infinity));
      refreshListOnly();
      addMarkersIncremental(batch.filter(passesFilter), (pageid) => highlightMarker(pageid));
      loader.textContent = `Loading… ${places.length} places…`;
      $("placeName").textContent = `${label} (${places.length})`;
      if (!firstPaint && places.length) {
        firstPaint = true;
        highlightMarker(places[0].pageid);
      }
    }, () => myId !== searchSeq);
    if (myId !== searchSeq) return; // búsqueda nueva tomó el control
    if (!places.length) showMessage($("message"), "No results near this location.");
  } catch (e) {
    if (myId !== searchSeq) return;
    // Si ya hay resultados parciales, consérvalos y avisa; si no, muestra error.
    if (!places.length) {
      showMessage($("message"), e instanceof ApiError ? e.message : "Connection issue.");
    } else {
      showMessage($("message"), "Showing partial results (some areas failed to load).");
    }
  } finally {
    if (myId === searchSeq) showLoading(loader, false);
  }
}

function filtered() {
  if (activeCategory === "all") return places;
  const q = activeCategory.toLowerCase();
  return places.filter((p) => p.name.toLowerCase().includes(q));
}

function refreshListOnly() {
  const list = filtered();
  const favIds = new Set(getFavorites().map((f) => f.pageid));
  renderCards($("cards"), list, center, favIds, openDetails, (p) => {
    toggleFavorite(p);
    refresh();
  });
  if (!list.length && places.length) showMessage($("message"), "No results for this filter.");
}

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

function onPickChip(c) {
  activeCategory = c;
  document.querySelectorAll("#chips .chip").forEach((el) =>
    el.classList.toggle("active", el.textContent === c));
  refresh();
}

function wireEvents() {
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
  // §3.7 Use my location (browser Geolocation API, no key).
  $("locateBtn").onclick = () => {
    if (!navigator.geolocation) return showMessage($("message"), "Geolocation not supported.");
    navigator.geolocation.getCurrentPosition(
      (pos) => runSearchByCoords(pos.coords.latitude, pos.coords.longitude, "My location"),
      () => showMessage($("message"), "Location unavailable.")
    );
  };
  renderChips($("chips"), activeCategory, onPickChip);
  $("favLink").onclick = (e) => {
    e.preventDefault();
    searchSeq++; // aborta cualquier stream en curso
    places = getFavorites();
    center = null;
    $("placeName").textContent = "Favorites";
    refresh();
  };
  $("homeLink").onclick = (e) => { e.preventDefault(); $("search").focus(); };
}

initMap("map", [40.7708, -111.8921], 15);
wireEvents();
renderChips($("chips"), activeCategory, onPickChip);

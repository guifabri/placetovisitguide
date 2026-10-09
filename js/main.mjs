// §6 main.mjs — entry point: events, geolocation, view switching.

import { geocodeCity, searchPlaces, getPlaceDetails, ApiError } from "./api.mjs";
import { initMap, centerMap, addMarkers, highlightMarker } from "./map.mjs";
import {
  renderCards, renderChips, renderModal, closeModal, showLoading, showMessage,
} from "./ui.mjs";
import { getFavorites, isFavorite, toggleFavorite } from "./storage.mjs";

const $ = (id) => document.getElementById(id);

let center = null;
let places = [];
let activeCategory = "all";

async function runSearchByCoords(lat, lon, label) {
  showMessage($("message"));
  showLoading($("loader"), true);
  try {
    center = { lat, lon, name: label };
    $("placeName").textContent = label;
    centerMap(lat, lon);
    places = await searchPlaces(lat, lon);
    refresh();
  } catch (e) {
    showMessage($("message"), e instanceof ApiError ? e.message : "Connection issue.");
  } finally {
    showLoading($("loader"), false);
  }
}

function filtered() {
  if (activeCategory === "all") return places;
  const q = activeCategory.toLowerCase();
  return places.filter((p) => p.name.toLowerCase().includes(q));
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
    places = getFavorites();
    center = null;
    $("placeName").textContent = "Favorites";
    refresh();
  };
  $("homeLink").onclick = (e) => { e.preventDefault(); $("search").focus(); };
}

initMap("map");
wireEvents();
renderChips($("chips"), activeCategory, onPickChip);

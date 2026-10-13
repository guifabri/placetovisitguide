// LocalStorage key for saving favorite places
const KEY = "favorites";

// Retrieves the list of favorite places from localStorage
export function getFavorites() {
  try {
    return JSON.parse(localStorage.getItem(KEY)) ?? [];
  } catch {
    return [];
  }
}

// Checks if a specific place ID is already in favorites
export function isFavorite(pageid) {
  return getFavorites().some((f) => f.pageid === pageid);
}

// Adds or removes a place from favorites, returning true if added, false if removed
export function toggleFavorite(place) {
  const favs = getFavorites();
  const i = favs.findIndex((f) => f.pageid === place.pageid);

  if (i >= 0) {
    // Remove if already favorite
    favs.splice(i, 1);
  } else {
    // Add new favorite entry
    favs.push({
      pageid: place.pageid,
      name: place.name,
      lat: place.lat,
      lon: place.lon,
      image: place.image || "",
    });
  }

  // Persist updated array to localStorage
  localStorage.setItem(KEY, JSON.stringify(favs));
  return i < 0;
}

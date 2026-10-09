// §6 storage.mjs — favorites in localStorage, keyed by Wikipedia pageid (§5).

const KEY = "favorites";

export function getFavorites() {
  try {
    return JSON.parse(localStorage.getItem(KEY)) ?? [];
  } catch {
    return [];
  }
}

export function isFavorite(pageid) {
  return getFavorites().some((f) => f.pageid === pageid);
}

export function toggleFavorite(place) {
  const favs = getFavorites();
  const i = favs.findIndex((f) => f.pageid === place.pageid);
  if (i >= 0) favs.splice(i, 1);
  else {
    favs.push({
      pageid: place.pageid,
      name: place.name,
      lat: place.lat,
      lon: place.lon,
      image: place.image || "",
    });
  }
  localStorage.setItem(KEY, JSON.stringify(favs));
  return i < 0;
}

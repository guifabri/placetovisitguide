# Places to Visit Guide

Web app (WDD330) where users enter a city or address — or use their current
location — to get a list and an interactive map of nearby tourist attractions.
Free to use, no account required.

Proposal: `Places_to_Visit_Guide_proposal_v2.md` (+ `.pdf`).
Planning board: https://trello.com/b/bGgvGUAd/places-visit-guide

## APIs 

| Source | URL | API key? |
|---|---|---|
| Geoapify Geocoding (city → lat/lon) | `https://api.geoapify.com/v1/geocode/search` | **Yes** — free 3000 req/day, get one at https://myprojects.geoapify.com |
| Wikipedia (nearby places + details) | `https://en.wikipedia.org/w/api.php` | No |
| Esri World Street Map (tiles) | `.../MapServer/tile/{z}/{y}/{x}` | No |
| Leaflet (map library) | `https://leafletjs.com/` | No |


## Structure 
```
index.html      entry point, Leaflet + Esri wiring (§3.2)
styles.css      graphic identity §7 (Teal #0F6B6B, Orange #E8743B, Inter)
js/api.mjs      Geoapify geocode (hardcoded key) + Wikipedia geosearch/details + errors
js/map.mjs      Leaflet + Esri tiles ({z}/{y}/{x}), markers synced to list
js/ui.mjs       cards, detail modal, filter chips, loaders, haversine distance
js/storage.mjs  favorites in localStorage (keyed by Wikipedia pageid)
js/main.mjs     events, geolocation, view switching
wireframes/     View 1–3 mockups recovered from v1
```

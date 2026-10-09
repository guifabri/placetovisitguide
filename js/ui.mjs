// §6 ui.mjs — cards, detail modal, filter chips, loaders/messages, haversine distance.

export const CATEGORIES = ["museums", "architecture", "nature", "religion", "history", "entertainment"];

export function haversineMeters(aLat, aLon, bLat, bLon) {
  const R = 6371000;
  const dLat = ((bLat - aLat) * Math.PI) / 180;
  const dLon = ((bLon - aLon) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((aLat * Math.PI) / 180) * Math.cos((bLat * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

export function formatDistance(m) {
  if (m == null) return "—";
  return m >= 1000 ? `${(m / 1000).toFixed(1)} km` : `${Math.round(m)} m`;
}

export function showLoading(el, on = true) {
  el.classList.toggle("hidden", !on);
}

export function showMessage(el, text = "") {
  el.textContent = text;
  el.classList.toggle("hidden", !text);
}

export function renderChips(el, active, onPick) {
  el.innerHTML = "";
  for (const c of ["all", ...CATEGORIES]) {
    const b = document.createElement("button");
    b.className = "chip" + (c === active ? " active" : "");
    b.textContent = c;
    b.onclick = () => onPick(c);
    el.appendChild(b);
  }
}

// Clicking a card highlights its marker (proposal §3.3).
export function renderCards(el, places, center, favorites, onOpen, onFav) {
  el.innerHTML = "";
  for (const p of places) {
    const dist = center ? haversineMeters(center.lat, center.lon, p.lat, p.lon) : p.dist;
    const card = document.createElement("article");
    card.className = "card";
    card.innerHTML = `
      <div class="card-body">
        <h3></h3>
        <p class="meta"></p>
      </div>
      <button class="fav" aria-label="favorite"></button>`;
    card.querySelector("h3").textContent = p.name;
    card.querySelector(".meta").textContent = formatDistance(dist);
    const fav = card.querySelector(".fav");
    fav.textContent = favorites.has(p.pageid) ? "♥" : "♡";
    fav.onclick = (e) => { e.stopPropagation(); onFav(p); };
    card.onclick = () => onOpen(p.pageid);
    el.appendChild(card);
  }
}

// §3.5 modal: image, description, coords, Wikipedia link, directions button.
export function renderModal(el, details, isFav, onFav, onClose) {
  el.innerHTML = `
    <div class="modal-box">
      <button class="modal-close">Back</button>
      <h2></h2>
      <img alt=""/>
      <p class="desc"></p>
      <p class="addr"></p>
      <div class="row">
        <a class="btn wiki" target="_blank" rel="noopener">Wikipedia</a>
        <a class="btn dirs" target="_blank" rel="noopener">Get directions</a>
        <button class="btn favbtn"></button>
      </div>
    </div>`;
  el.querySelector("h2").textContent = details.name;
  const img = el.querySelector("img");
  if (details.image) img.src = details.image;
  else img.classList.add("hidden");
  el.querySelector(".desc").textContent = details.description;
  el.querySelector(".addr").textContent = details.coords
    ? `${details.coords.lat.toFixed(4)}, ${details.coords.lon.toFixed(4)}`
    : "";
  el.querySelector(".wiki").href = details.wikiUrl;
  el.querySelector(".dirs").href = details.coords
    ? `https://www.google.com/maps/dir/?api=1&destination=${details.coords.lat},${details.coords.lon}`
    : details.wikiUrl;
  const favBtn = el.querySelector(".favbtn");
  favBtn.textContent = isFav ? "♥ Saved" : "♡ Save";
  favBtn.onclick = () => onFav();
  el.querySelector(".modal-close").onclick = onClose;
  el.classList.remove("hidden");
}

export function closeModal(el) {
  el.classList.add("hidden");
  el.innerHTML = "";
}

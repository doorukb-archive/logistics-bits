const DEPOT = [41.0082, 28.9784]; // Sultanahmet, Istanbul
const STOP_COUNT = 10;

const map = L.map("map", { zoomControl: false }).setView(DEPOT, 13);
L.control.zoom({ position: "bottomleft" }).addTo(map);
L.tileLayer("https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png", {
  maxZoom: 19,
  attribution:
    '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/">CARTO</a>',
}).addTo(map);

const statusEl = document.getElementById("status");

function pinIcon(label, depot = false) {
  return L.divIcon({
    className: "",
    html: `<div class="pin${depot ? " depot" : ""}">${label}</div>`,
    iconSize: depot ? [30, 30] : [26, 26],
    iconAnchor: depot ? [15, 15] : [13, 13],
  });
}

const depotMarker = L.marker(DEPOT, { icon: pinIcon("D", true), draggable: true })
  .addTo(map)
  .bindTooltip("Depot — start & end");
depotMarker.on("dragend", invalidateRoute);

let stopMarkers = [];

function randomStops() {
  // Scatter around the depot: ~±3 km latitude, ~±4 km longitude.
  const [lat, lng] = depotMarker.getLatLng() ? Object.values(depotMarker.getLatLng()) : DEPOT;
  return Array.from({ length: STOP_COUNT }, () => [
    lat + (Math.random() - 0.5) * 0.055,
    lng + (Math.random() - 0.5) * 0.075,
  ]);
}

function setStops(latlngs) {
  stopMarkers.forEach((m) => m.remove());
  stopMarkers = latlngs.map((ll, i) =>
    L.marker(ll, { icon: pinIcon(i + 1), draggable: true })
      .addTo(map)
      .on("dragend", invalidateRoute)
  );
  invalidateRoute();
}

function invalidateRoute() {
  // Placeholder until route drawing lands: just reset the hint.
  statusEl.textContent = "Pins moved — hit “Optimize route”.";
}

document.getElementById("shuffle").addEventListener("click", () => setStops(randomStops()));

setStops(randomStops());
statusEl.textContent = "Drag any pin (even the depot), then optimize.";

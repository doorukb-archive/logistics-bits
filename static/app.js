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
const statsEl = document.getElementById("stats");
const optimizeBtn = document.getElementById("optimize");

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
let routeLayer = null;

function randomStops() {
  // Scatter around the depot: ~±3 km latitude, ~±4 km longitude.
  const { lat, lng } = depotMarker.getLatLng();
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
  clearRoute();
  statusEl.textContent = "Drag any pin (even the depot), then optimize.";
}

function clearRoute() {
  if (routeLayer) {
    routeLayer.remove();
    routeLayer = null;
  }
  statsEl.hidden = true;
  stopMarkers.forEach((m, i) => m.setIcon(pinIcon(i + 1)).unbindTooltip());
}

function invalidateRoute() {
  if (routeLayer) {
    routeLayer.eachLayer((l) => l.getElement()?.classList.add("route-stale"));
    statusEl.textContent = "Pins moved — route is stale, re-optimize.";
  }
}

function drawRoute(latlngsOrGeojson, isGeojson) {
  if (routeLayer) routeLayer.remove();
  const casing = { color: "#fff", weight: 9, opacity: 0.9 };
  const line = { color: "#4f46e5", weight: 5, className: "route-line" };
  routeLayer = L.layerGroup(
    isGeojson
      ? [L.geoJSON(latlngsOrGeojson, { style: casing }), L.geoJSON(latlngsOrGeojson, { style: line })]
      : [L.polyline(latlngsOrGeojson, casing), L.polyline(latlngsOrGeojson, { ...line, dashArray: "6 10" })]
  ).addTo(map);
  map.fitBounds(
    (isGeojson ? L.geoJSON(latlngsOrGeojson) : L.polyline(latlngsOrGeojson)).getBounds(),
    { padding: [40, 40], paddingTopLeft: [40, 40], paddingBottomRight: [340, 40] }
  );
}

function fmtTime(s) {
  const min = Math.round(s / 60);
  return min < 60 ? `${min} min` : `${Math.floor(min / 60)} h ${String(min % 60).padStart(2, "0")}`;
}

async function optimize() {
  optimizeBtn.disabled = true;
  statusEl.textContent = "Fetching drive times & solving…";
  const { lat, lng } = depotMarker.getLatLng();
  const points = [[lat, lng], ...stopMarkers.map((m) => [m.getLatLng().lat, m.getLatLng().lng])];

  try {
    const resp = await fetch("/api/optimize", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ stops: points }),
    });
    if (!resp.ok) throw new Error(`API ${resp.status}`);
    const d = await resp.json();

    // Renumber pins to the visit order (order[0] is always the depot).
    d.order.forEach((payloadIdx, visitPos) => {
      if (payloadIdx === 0) return;
      const m = stopMarkers[payloadIdx - 1];
      m.setIcon(pinIcon(visitPos));
      m.bindTooltip(`Visit #${visitPos}`);
    });

    if (d.geometry) {
      drawRoute(d.geometry, true);
    } else {
      // OSRM down: straight legs through the ordered points, back to depot.
      drawRoute([...d.order.map((i) => points[i]), points[0]], false);
    }

    document.getElementById("stat-time").textContent = fmtTime(d.total_seconds);
    document.getElementById("stat-dist").textContent =
      d.distance_meters ? `${(d.distance_meters / 1000).toFixed(1)} km` : "—";
    const saved = 1 - d.optimized_seconds / d.naive_seconds;
    document.getElementById("stat-saved").textContent =
      saved > 0.005 ? `−${Math.round(saved * 100)}%` : "already optimal";
    statsEl.hidden = false;

    statusEl.textContent = d.fallback
      ? "OSRM unreachable — times are straight-line estimates."
      : "Optimized with real road times. Drag pins to try again.";
  } catch (err) {
    statusEl.textContent = `Something broke: ${err.message}`;
  } finally {
    optimizeBtn.disabled = false;
  }
}

optimizeBtn.addEventListener("click", optimize);
document.getElementById("shuffle").addEventListener("click", () => setStops(randomStops()));

setStops(randomStops());

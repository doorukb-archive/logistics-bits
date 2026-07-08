# logistics-bits — Route Optimizer

The problem Amazon and DPD solve millions of times a day, at demo scale: given a depot and
10 delivery stops, find the fastest closed tour for one driver — using **real road drive
times**, not straight-line distance.

- **Solver:** [Google OR-Tools](https://developers.google.com/optimization) routing model
  (TSP, `PATH_CHEAPEST_ARC` first solution + guided local search, 2 s budget)
- **Drive times:** [OSRM](https://project-osrm.org/) public demo server on OpenStreetMap
  data — `table` service for the N×N duration matrix, `route` service for the
  road-following polyline
- **UI:** [Leaflet](https://leafletjs.com/) map with a draggable depot and 10 draggable,
  numbered stop pins

Typical result: the optimized tour beats visiting stops in their given order by **25–35 %**.

## Run it

```sh
python -m venv .venv
.venv/Scripts/pip install -r requirements.txt   # Scripts → bin on macOS/Linux
.venv/Scripts/python -m uvicorn app.main:app
```

Open <http://localhost:8000>, drag pins anywhere (the dark square is the depot), hit
**Optimize route**. **Shuffle stops** deals a fresh random scenario.

## How it works

```
Leaflet UI ── POST /api/optimize {stops: [[lat,lng] × 11]}
                │
                ├─ OSRM /table  → 11×11 drive-time matrix (seconds)
                ├─ OR-Tools TSP → visit order + tour cost
                ├─ OSRM /route  → GeoJSON road geometry through the ordered stops
                │
                └─ {order, optimized_seconds, naive_seconds, geometry, …}
```

`naive_seconds` is the cost of driving the stops in the order they were given — that's the
baseline the "vs. naive order" saving on the map is measured against. If OSRM is
unreachable, the API falls back to a haversine estimate (straight-line × 1.3 detour factor
at 30 km/h) and flags it, so the demo stays alive offline.

## Layout

| Path                   | What                                              |
| ---------------------- | ------------------------------------------------- |
| `app/solver.py`        | OR-Tools TSP over any cost matrix                 |
| `app/osrm.py`          | OSRM table/route client + haversine fallback      |
| `app/main.py`          | FastAPI: `/api/optimize` + serves `static/`       |
| `static/`              | Leaflet frontend — no build step, no npm          |
| `tests/`               | solver optimality + client sanity (`pytest`)      |

## Next steps

- Multiple drivers → it's already a `RoutingModel`; raise the vehicle count and add
  capacities/time windows (VRP)
- Self-host OSRM (`osrm-backend` Docker + a regional OSM extract) to drop the public
  demo-server dependency

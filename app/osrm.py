"""OSRM client: real drive times and road geometry from the public demo server."""

import math

import httpx

OSRM_BASE = "https://router.project-osrm.org"
TIMEOUT_S = 10


def _coord_path(stops: list[list[float]]) -> str:
    """OSRM wants lon,lat;lon,lat — stops arrive as [lat, lng]."""
    return ";".join(f"{lng:.6f},{lat:.6f}" for lat, lng in stops)


async def duration_matrix(stops: list[list[float]]) -> list[list[float]]:
    """N×N drive-time matrix in seconds via the OSRM table service."""
    url = f"{OSRM_BASE}/table/v1/driving/{_coord_path(stops)}"
    async with httpx.AsyncClient(timeout=TIMEOUT_S) as client:
        resp = await client.get(url, params={"annotations": "duration"})
        resp.raise_for_status()
        data = resp.json()
    if data.get("code") != "Ok" or None in (d for row in data["durations"] for d in row):
        raise RuntimeError(f"OSRM table failed: {data.get('code')}")
    return data["durations"]


async def route_geometry(ordered_stops: list[list[float]]) -> dict:
    """Road-following GeoJSON LineString + totals through stops in visit order."""
    url = f"{OSRM_BASE}/route/v1/driving/{_coord_path(ordered_stops)}"
    async with httpx.AsyncClient(timeout=TIMEOUT_S) as client:
        resp = await client.get(url, params={"overview": "full", "geometries": "geojson"})
        resp.raise_for_status()
        data = resp.json()
    if data.get("code") != "Ok":
        raise RuntimeError(f"OSRM route failed: {data.get('code')}")
    route = data["routes"][0]
    return {
        "geometry": route["geometry"],
        "duration": route["duration"],
        "distance": route["distance"],
    }


def haversine_matrix(stops: list[list[float]]) -> list[list[float]]:
    """Fallback drive-time estimate when OSRM is unreachable.

    ponytail: straight-line distance × 1.3 detour factor at 30 km/h urban
    speed. Good enough to keep the demo alive; swap in a self-hosted OSRM
    if accuracy matters.
    """
    def seconds(a: list[float], b: list[float]) -> float:
        lat1, lng1, lat2, lng2 = map(math.radians, (*a, *b))
        d = 2 * 6371000 * math.asin(math.sqrt(
            math.sin((lat2 - lat1) / 2) ** 2
            + math.cos(lat1) * math.cos(lat2) * math.sin((lng2 - lng1) / 2) ** 2
        ))
        return d * 1.3 / (30 / 3.6)

    return [[0.0 if i == j else seconds(a, b) for j, b in enumerate(stops)]
            for i, a in enumerate(stops)]

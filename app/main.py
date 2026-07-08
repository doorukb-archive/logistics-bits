from pathlib import Path

from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field, field_validator

from app import osrm, solver

app = FastAPI(title="logistics-bits route optimizer")


class OptimizeRequest(BaseModel):
    """Stops as [lat, lng]; index 0 is the depot."""

    stops: list[tuple[float, float]] = Field(min_length=3, max_length=25)

    @field_validator("stops")
    @classmethod
    def coords_in_range(cls, stops):
        for lat, lng in stops:
            if not (-90 <= lat <= 90 and -180 <= lng <= 180):
                raise ValueError(f"coordinate out of range: [{lat}, {lng}]")
        return stops


@app.post("/api/optimize")
async def optimize(req: OptimizeRequest):
    stops = [list(s) for s in req.stops]
    fallback = False
    try:
        matrix = await osrm.duration_matrix(stops)
    except Exception:
        matrix = osrm.haversine_matrix(stops)
        fallback = True

    order, _ = solver.solve_tsp(matrix)
    optimized = solver.tour_cost(matrix, order)
    naive = solver.tour_cost(matrix, list(range(len(stops))))

    # Road geometry for the closed tour; skip when OSRM is already down.
    geometry = None
    duration = optimized
    distance = None
    if not fallback:
        try:
            route = await osrm.route_geometry([stops[i] for i in order] + [stops[0]])
            geometry = route["geometry"]
            duration = route["duration"]
            distance = route["distance"]
        except Exception:
            pass

    return {
        "order": order,
        "total_seconds": duration,
        "naive_seconds": naive,
        "distance_meters": distance,
        "geometry": geometry,
        "fallback": fallback,
    }


STATIC_DIR = Path(__file__).resolve().parent.parent / "static"
app.mount("/", StaticFiles(directory=STATIC_DIR, html=True), name="static")

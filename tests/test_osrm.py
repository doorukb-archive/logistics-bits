from app.osrm import _coord_path, haversine_matrix

ISTANBUL = [41.0082, 28.9784]
ANKARA = [39.9334, 32.8597]


def test_coord_path_is_lon_lat():
    assert _coord_path([ISTANBUL]) == "28.978400,41.008200"


def test_haversine_matrix_sane():
    m = haversine_matrix([ISTANBUL, ANKARA])
    assert m[0][0] == 0 and m[1][1] == 0
    assert m[0][1] == m[1][0]
    # Istanbul–Ankara is ~350 km straight-line; at 30 km/h with 1.3 detour
    # the estimate lands in the 10–20 h band.
    assert 10 * 3600 < m[0][1] < 20 * 3600

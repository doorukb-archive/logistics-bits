from app.solver import solve_tsp, tour_cost

# Four points on a line at 0, 10, 20, 30: the only optimal closed tours sweep
# the line once (cost 60); any zig-zag costs more.
LINE = [[abs(i - j) * 10 for j in range(4)] for i in range(4)]


def test_optimal_on_line():
    order, cost = solve_tsp(LINE)
    assert cost == 60
    assert order[0] == 0
    assert sorted(order) == [0, 1, 2, 3]
    assert order in ([0, 1, 2, 3], [0, 3, 2, 1])


def test_tour_cost_matches_objective():
    order, cost = solve_tsp(LINE)
    assert tour_cost(LINE, order) == cost


def test_tour_cost_naive_order():
    assert tour_cost(LINE, [0, 2, 1, 3]) == 80

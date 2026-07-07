"""TSP solver: best closed tour over a travel-time matrix, via OR-Tools."""

from ortools.constraint_solver import pywrapcp, routing_enums_pb2


def solve_tsp(matrix: list[list[float]], time_limit_s: int = 2) -> tuple[list[int], int]:
    """Return (visit order starting at node 0, total cost in matrix units).

    The tour is closed: cost includes the final leg back to node 0.
    """
    n = len(matrix)
    manager = pywrapcp.RoutingIndexManager(n, 1, 0)
    routing = pywrapcp.RoutingModel(manager)

    def arc_cost(from_index: int, to_index: int) -> int:
        # OR-Tools requires integer costs; OSRM durations are float seconds.
        return round(matrix[manager.IndexToNode(from_index)][manager.IndexToNode(to_index)])

    transit = routing.RegisterTransitCallback(arc_cost)
    routing.SetArcCostEvaluatorOfAllVehicles(transit)

    params = pywrapcp.DefaultRoutingSearchParameters()
    params.first_solution_strategy = routing_enums_pb2.FirstSolutionStrategy.PATH_CHEAPEST_ARC
    params.local_search_metaheuristic = routing_enums_pb2.LocalSearchMetaheuristic.GUIDED_LOCAL_SEARCH
    params.time_limit.FromSeconds(time_limit_s)

    solution = routing.SolveWithParameters(params)
    if solution is None:
        raise RuntimeError("OR-Tools found no solution")

    order = []
    index = routing.Start(0)
    while not routing.IsEnd(index):
        order.append(manager.IndexToNode(index))
        index = solution.Value(routing.NextVar(index))
    return order, solution.ObjectiveValue()


def tour_cost(matrix: list[list[float]], order: list[int]) -> float:
    """Cost of visiting `order` as a closed tour (returns to order[0])."""
    return sum(matrix[a][b] for a, b in zip(order, order[1:] + order[:1]))

import math


class Point:
    def __init__(self, x, y, name, slab, face):
        self.x = x
        self.y = y
        self.name = name
        self.slab = slab
        self.face = face

    def __str__(self):
        return f"{self.name}({self.x}, {self.y})"


class Slab:
    def __init__(self, start, name, version):
        self.start = start
        self.name = name
        self.version = version

    def __str__(self):
        return f"{self.name}({self.start})"


class Vertex:
    @staticmethod
    def get_name_from_index(index):
        return f"v{index}"

    def __init__(self, name, x, y):
        self.name = name
        self.x = x
        self.y = y
        self.edges = []
        self.slab = None

    def __str__(self):
        return f"{self.name}({self.x}, {self.y})"

    def __eq__(self, other):
        return self.x == other.x and self.y == other.y

    def __lt__(self, other):
        return self.x < other.x or (self.x == other.x and self.y < other.y)

    def add_edge(self, edge):
        if edge not in self.edges:
            self.edges.append(edge)


class Edge:
    def __init__(self, u, v):
        self.u = u
        self.v = v

    def __str__(self):
        return f"({self.u.name} -> {self.v.name})"

    def __eq__(self, other):
        return self.u == other.u and self.v == other.v

    def __lt__(self, other):
        return self.u < other.u or (self.u == other.u and self.v < other.v)


class Face:
    def __init__(self, name, vertices):
        self.name = name
        self.vertices = vertices

    def __str__(self):
        return f"{self.name}({', '.join([str(vertex) for vertex in self.vertices])})"


def centroid(points) -> tuple:
    x = [p.x for p in points]
    y = [p.y for p in points]
    n = len(points)
    return sum(x) / n, sum(y) / n


def compare_x_asc_y_desc(v1: Vertex, v2: Vertex) -> int:
    # compare x first asc, then y desc
    if v1.x < v2.x:
        return -1
    elif v1.x > v2.x:
        return 1
    else:
        if v1.y > v2.y:
            return -1
        elif v1.y < v2.y:
            return 1
        else:
            return 0


def compare_line_segments(e1: Edge, e2: Edge) -> int:
    if e1 == e2:
        return 0
    if e1.u == e2.u:
        return 1 if e1.v.y > e2.v.y else -1
    else:
        return 1 if e1.u.y > e2.u.y else -1


def is_below_or_on_line(e: Edge, p: Point) -> bool:
    v1 = e.u
    v2 = e.v

    def line_eq(v1, v2):
        return lambda x: (v2.y - v1.y) * ((x - v1.x) / (v2.x - v1.x)) + v1.y

    return line_eq(v1, v2)(p.x) - p.y


def binary_search(arr, target, compare):
    """
    Pseudo binary search for the points below line segments
    """
    low = 0
    high = len(arr) - 1

    mid = math.ceil((low + high) / 2)
    while low <= high and compare(arr[mid], target) >= 0:
        high = mid - 1
        mid = math.ceil((low + high) / 2)

    if high < low:
        return -1
    else:
        while compare(arr[mid], target) < 0:
            mid += 1
            if mid >= len(arr):
                return -1
        return mid

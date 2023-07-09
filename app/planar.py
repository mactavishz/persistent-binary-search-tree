import networkx as nx
import matplotlib as mpl
import matplotlib.pyplot as plt
mpl.use('macosx')
from matplotlib.widgets import Button
from matplotlib.gridspec import GridSpec
from functools import cmp_to_key
import os, sys, pywavefront
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))
from lib.partial_persistence.pp_path_copying_bst import PartialPersistentBst
from lib.binary_search_tree import BinarySearchTree as Bst
from itertools import cycle

cycol = cycle('bgrcmykw')
obj_file = os.path.join(os.path.dirname(__file__), 'example.obj')
scene = pywavefront.Wavefront(obj_file, collect_faces=True)

def centroid(points):
    x = [p.x for p in points]
    y = [p.y for p in points]
    n = len(points)
    return sum(x) / n, sum(y) / n

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
        return f'v{index}'

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

# print(f"Vertices: {scene.vertices}")
faces = scene.mesh_list[0].faces
# for face in faces:
#     print("Face:", face)

def comapre_line_segments(e1, e2):
    if e1 == e2:
        return 0
    if e1.u == e2.u:
        return 1 if e1.v.y > e2.v.y else -1
    else:
        return 1 if e1.u.y > e2.u.y else -1 

nodes = []
areas = []
points = []
slabs = Bst(key_fn=lambda s: s.start)
line_segments = PartialPersistentBst(compare_fn=comapre_line_segments)

G = nx.Graph()
for i, vertex in enumerate(scene.vertices):
    name = Vertex.get_name_from_index(i)
    nodes.append(Vertex(name, vertex[0], vertex[1]))
    G.add_node(name, pos=vertex[:2])

for j, face in enumerate(faces):
    n = len(face)
    vertices = []
    for i in range(n):
        v1 = nodes[face[i]]
        v2 = nodes[face[(i + 1) % n]]
        vertices.append(v1)
        G.add_edge(v1.name, v2.name)
        edge1 = Edge(v1, v2)
        edge2 = Edge(v2, v1)
        v1.add_edge(edge1)
        v2.add_edge(edge2)
    areas.append(Face(f'F{j}', vertices))

pos = nx.get_node_attributes(G, 'pos')
is_planar, cert = nx.check_planarity(G)

# print(cert.traverse_face('v3', 'v0'))

options = {
    "font_size": 8,
    "node_size": 500,
    "node_color": "white",
    "edgecolors": "black",
    "linewidths": 1,
    "width": 1,
    "label": "Planar Graph",
}


# Create the main plot
fig = plt.figure(layout="constrained", figsize=(8, 8))
cid, done = None, False
gs = GridSpec(4, 4, figure=fig)
ax1 = fig.add_subplot(gs[:-1, :])
nx.draw_networkx(G, pos, **options)
plt.draw()
ax1.set_title("Click in the Faces to add Points")
ax1.margins(0.10)
table_ax = fig.add_subplot(gs[-1, :-1])
table_ax.axis("off")
table_ax.set_title("Points Table")
# Create the button
button_ax = fig.add_subplot(gs[-1, -1])
button = Button(button_ax, 'Locate Points')

def update_table():
    if len(points) == 0:
        return
    headers = ["Name", "X", "Y", "Slab", "Face"]
    col_widths = [0.1, 0.3, 0.3, 0.2, 0.1]
    rows = [[p.name, p.x, p.y, p.slab, p.face] for p in points]
    table_ax.table(cellText=rows, colLabels=headers, loc='center', cellLoc='center', colWidths=col_widths, colLoc='center')

# Define the onclick event function
def onclick(event):
    if event.xdata and event.ydata and event.inaxes == ax1:
        ax1.plot(event.xdata, event.ydata, 'ro', markersize=3)
        p = Point(round(event.xdata, 2), round(event.ydata, 2), f'p{len(points)}', None, None)
        points.append(p)
        ax1.text(p.x + 0.05, p.y + 0.05, p.name, fontsize=8) 
        update_table()
        plt.draw()

cid = plt.connect('button_press_event', onclick)

for area in areas:
    x = []
    y = []
    for vertex in area.vertices:
        x.append(vertex.x)
        y.append(vertex.y)
    ax1.fill(x, y, next(cycol), alpha=0.3)
    ax1.text(*centroid(area.vertices), area.name, fontsize=10, fontweight='bold', ha='center', va='center')

def compare_x_y(v1, v2):
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

def find_face(face_nodes):
    nodes_int = [int(node[1:]) for node in face_nodes]
    v_nodes = [nodes[i] for i in nodes_int]
    for area in areas:
        if (sorted(v_nodes) == sorted(area.vertices)):
            return area.name
    return None

def is_below_or_on_line(v1, v2, p):
    line_eq = lambda v1, v2: lambda x: (v2.y - v1.y) * ((x - v1.x) / (v2.x - v1.x)) + v1.y
    res = (line_eq(v1, v2)(p.x) - p.y)
    return res >= 0

def locate_point(p):
    slab = slabs.search_le(p.x)
    face_name = None
    if slab:
        slab = slab.key
        p.slab = slab.name
        segs = line_segments.inorder(slab.version)
        for line in segs:
            if is_below_or_on_line(line.u, line.v, p):
                face_nodes = cert.traverse_face(line.u.name, line.v.name)
                face_name = find_face(face_nodes)
                print(f"Point {p.name} is in slab {slab.name}, below or on line {str(line)}, in face {face_name if face_name else 'N/A'}")
                p.face = face_name
                break
        if face_name is None:
            p.face = 'N/A'
            print(f"Point {p.name} is in slab {slab.name}, is in face {face_name if face_name else 'N/A'}")
    return

def run():
    global done
    if done:
        return
    sorted_nodes = sorted(nodes, key=cmp_to_key(compare_x_y))
    i = 0
    old_slab = (slabs.insert(Slab(float('-inf'), f'slab{i}', None))).key
    ax1.text(-0.5, -0.5, old_slab.name, fontsize=10, fontweight='bold') 
    i += 1
    for v in sorted_nodes:
        slb = slabs.insert(Slab(v.x, f'slab{i}', None))
        if slb:
            v.slab = slb.key
            ax1.axvline(v.x, color='C1', linestyle='--')
            ax1.text(v.x, -0.5, slb.key.name, fontsize=10, fontweight='bold') 
            i += 1
            old_slab = slb.key
        else:
            v.slab = old_slab
    plt.draw()
    curr_ver = -1
    curr_slab = None
    curr_segs = []
    # build the line segment tree using persistent binary tree
    for v in sorted_nodes:
        if not curr_slab or curr_slab != v.slab:
            curr_slab = v.slab
        curr_segs = line_segments.inorder(curr_ver)
        for e in v.edges:
            for s in curr_segs:
                if e.u == s.v:
                    line_segments.delete(s)
                else:
                    continue
            if e.v.x > v.x:
                line_segments.insert(e)
            curr_ver = line_segments.get_latest_version()
        curr_slab.version = curr_ver
    # locate points
    for p in points:
        locate_point(p)

    update_table()
    plt.draw()
    done = True

def on_button_clicked(event):
    plt.disconnect(cid)
    run()

button.on_clicked(on_button_clicked)
plt.get_current_fig_manager().set_window_title('Planar Point Location Demo')
plt.show()

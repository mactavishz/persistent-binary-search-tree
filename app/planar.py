# import matplotlib as mpl
import matplotlib.pyplot as plt
from matplotlib.widgets import Button
from matplotlib.gridspec import GridSpec
from functools import cmp_to_key
import networkx as nx
import os
import sys
import pywavefront
from typing import cast

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))
from lib.pp_node_copying_bst import PartialPersistentBst  # noqa
from lib.bst import Bst, BstNode  # noqa
from itertools import cycle  # noqa
from utils import (  # noqa
    centroid,
    compare_line_segments,
    compare_x_asc_y_desc,
    is_below_or_on_line,
    binary_search,
    Edge,
    Face,
    Vertex,
    Point,
    Slab,
)

# for debug purposes
# mpl.use("macosx")
cycol = cycle("bgrcmykw")


class App:
    def __init__(self):
        self.nodes = []
        self.areas = []
        self.points = []
        self.slabs = Bst(key_fn=lambda s: s.start)
        self.line_segments = PartialPersistentBst(compare_fn=compare_line_segments)
        self.planar_graph = nx.Graph()
        self.obj_file = None
        self.analyzed = False
        self.planar_embedding = None
        self.graph_options = {
            "font_size": 8,
            "node_size": 500,
            "node_color": "white",
            "edgecolors": "black",
            "linewidths": 1,
            "width": 1,
        }
        self.fig = None
        self.cid = None
        self.planar_ax = None
        self.table_ax = None
        self.button_ax = None
        self.button = None
        self.table_header = ["Name", "X", "Y", "Slab", "Face"]
        self.table_col_widths = [0.1, 0.3, 0.3, 0.2, 0.1]

    def setup(self, obj_file):
        vertices, faces = self.parse_obj(obj_file)
        for i, vertex in enumerate(vertices):
            # vertex is a tuple of (x, y, z)
            name = Vertex.get_name_from_index(i)
            self.nodes.append(Vertex(name, vertex[0], vertex[1]))
            self.planar_graph.add_node(name, pos=vertex[:2])

        for j, face in enumerate(faces):
            n = len(face)
            vertices = []
            for i in range(n):
                v1 = self.nodes[face[i]]
                v2 = self.nodes[face[(i + 1) % n]]
                vertices.append(v1)
                self.planar_graph.add_edge(v1.name, v2.name)
                edge1 = Edge(v1, v2)
                edge2 = Edge(v2, v1)
                v1.add_edge(edge1)
                v2.add_edge(edge2)
            self.areas.append(Face(f"F{j}", vertices))

        is_planar, cert = nx.check_planarity(self.planar_graph)
        if is_planar:
            self.planar_embedding = cert
        else:
            raise Exception("Graph is not planar")

    def draw(self):
        self.fig = plt.figure(layout="constrained", figsize=(8, 8))
        gs = GridSpec(4, 4, figure=self.fig)
        self.planar_ax = self.fig.add_subplot(gs[:-1, :])
        pos = nx.get_node_attributes(self.planar_graph, "pos")
        nx.draw_networkx(self.planar_graph, pos, **self.graph_options)
        self.planar_ax.set_title("Click in the Faces to add Points")
        self.planar_ax.margins(0.10)
        self.table_ax = self.fig.add_subplot(gs[-1, :-1])
        self.table_ax.axis("off")
        # Create the button
        self.cid = plt.connect("button_press_event", self.onclick)
        self.button_ax = self.fig.add_subplot(gs[-1, -1])
        self.button = Button(self.button_ax, "Locate Points")
        self.button.on_clicked(self.button_onclick)
        for area in self.areas:
            x = []
            y = []
            for vertex in area.vertices:
                x.append(vertex.x)
                y.append(vertex.y)
            self.planar_ax.fill(x, y, next(cycol), alpha=0.3)
            self.planar_ax.text(
                *centroid(area.vertices),
                area.name,
                fontsize=10,
                fontweight="bold",
                ha="center",
                va="center",
            )
        plt.get_current_fig_manager().set_window_title("Planar Point Location Demo")

    def update_table(self):
        if len(self.points) == 0:
            return
        rows = [[p.name, p.x, p.y, p.slab, p.face] for p in self.points]
        if self.table_ax is None:
            return
        self.table_ax.table(
            cellText=rows,
            colLabels=self.table_header,
            loc="center",
            cellLoc="center",
            colWidths=self.table_col_widths,
            colLoc="center",
        )

    # Define the onclick event function
    def onclick(self, event):
        if (
            event.xdata
            and event.ydata
            and event.inaxes == self.planar_ax
            and self.planar_ax
        ):
            self.planar_ax.plot(event.xdata, event.ydata, "ro", markersize=3)
            p = Point(
                round(event.xdata, 2),
                round(event.ydata, 2),
                f"p{len(self.points)}",
                None,
                None,
            )
            self.points.append(p)
            self.planar_ax.text(p.x + 0.05, p.y + 0.05, p.name, fontsize=8)
            self.update_table()
            plt.draw()

    def button_onclick(self, _):
        plt.disconnect(self.cid)
        self.analyze()

    def analyze(self):
        if self.analyzed or self.planar_ax is None:
            return
        sorted_nodes = sorted(self.nodes, key=cmp_to_key(compare_x_asc_y_desc))
        i = 0
        old_slab = self.slabs.insert(Slab(float("-inf"), f"slab{i}", None))
        # handle optional type
        old_slab = cast(BstNode, old_slab).key
        self.planar_ax.text(-0.5, -0.5, old_slab.name, fontsize=10, fontweight="bold")
        i += 1
        for v in sorted_nodes:
            slb = self.slabs.insert(Slab(v.x, f"slab{i}", None))
            if slb:
                v.slab = slb.key
                self.planar_ax.axvline(v.x, color="C1", linestyle="--")
                self.planar_ax.text(
                    v.x, -0.5, slb.key.name, fontsize=10, fontweight="bold"
                )
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
            curr_segs = self.line_segments.inorder(curr_ver)
            for e in v.edges:
                for s in curr_segs:
                    if e.u == s.v:
                        self.line_segments.delete(s)
                    else:
                        continue
                if e.v.x > v.x:
                    self.line_segments.insert(e)
                curr_ver = self.line_segments.get_latest_version()
            curr_slab.version = curr_ver
        # locate points
        for p in self.points:
            self.locate_point(p)

        self.update_table()
        plt.draw()
        self.analyzed = True

    def run(self):
        args = sys.argv[1:]
        if len(args) == 0:
            self.obj_file = "planar_1.obj"
        else:
            num = args[0]
            match num:
                case "1":
                    self.obj_file = "planar_1.obj"
                case "2":
                    self.obj_file = "planar_2.obj"
                case _:
                    self.obj_file = "planar_1.obj"
        self.setup(self.obj_file)
        self.draw()
        plt.show()

    def parse_obj(self, file_path):
        file_path = (
            file_path
            if os.path.isabs(file_path)
            else os.path.join(os.path.dirname(__file__), file_path)
        )
        scene = pywavefront.Wavefront(file_path, collect_faces=True)
        return scene.vertices, scene.mesh_list[0].faces

    def find_face(self, face_nodes):
        nodes_int = [int(node[1:]) for node in face_nodes]
        v_nodes = [self.nodes[i] for i in nodes_int]
        for area in self.areas:
            if sorted(v_nodes) == sorted(area.vertices):
                return area.name
        return None

    def locate_point(self, p: Point):
        slab = self.slabs.search_le(p.x)
        face_name = None
        if slab:
            slab = slab.key
            p.slab = slab.name
            segs = self.line_segments.inorder(slab.version)
            idx = binary_search(segs, p, is_below_or_on_line)
            try:
                if idx < 0:
                    raise IndexError
                line = segs[idx]
                self.planar_embedding = cast(nx.PlanarEmbedding, self.planar_embedding)
                args = (
                    (line.v.name, line.u.name)
                    if self.obj_file == "planar_2.obj"
                    else (line.u.name, line.v.name)
                )
                face_nodes = self.planar_embedding.traverse_face(*args)
                face_name = self.find_face(face_nodes)
                print(
                    f"Point {p.name} is in slab {slab.name}, "
                    f"below or on line {str(line)}, "
                    f"in face {face_name if face_name else 'N/A'}"
                )
                p.face = face_name
            except IndexError:
                pass
            if face_name is None:
                p.face = "N/A"
                print(
                    f"Point {p.name} is in slab {slab.name}, "
                    f"is in face {face_name if face_name else 'N/A'}"
                )
        return


if __name__ == "__main__":
    app = App()
    app.run()

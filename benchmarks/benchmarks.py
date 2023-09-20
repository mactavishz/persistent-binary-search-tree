import random
import gc
from pyinstrument import Profiler
from rich.console import Console
from rich.table import Table
from copy import copy
import timeit
import os
import sys

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from lib.bst import Bst
from lib.pp_naive_bst import PartialPersistentBst as PPNaiveBst
from lib.pp_fatnode_bst import PartialPersistentBst as PPFatNodeBst
from lib.pp_node_copying_bst import PartialPersistentBst as PPPathCopyingBst

iterations = 1
Bst_classes = [
    (Bst, "Standard"),
    (PPFatNodeBst, "Fat Node PP"),
    (PPPathCopyingBst, "Node-Copying PP"),
    (PPNaiveBst, "Naive PP"),
]


def insert_perf(tree, n=10):
    control = random.sample([i for i in range(n)], n)
    for i in control:
        tree.insert(i)


def run_insert_prefs():
    gc.disable()
    for n in [10**i for i in range(1, 6)]:
        print(f"insert {n} elements:")
        for cls, name in Bst_classes:
            t = timeit.Timer(lambda: insert_perf(cls(), n))
            print(
                f"[{name}] average time for {iterations} iterations: {t.timeit(iterations) / iterations * 1000:.2f} ms"
            )
            gc.collect()
    gc.enable()


run_insert_prefs()

# table = Table(title="Star Wars Movies")
#
# table.add_column("Released", justify="right", style="cyan", no_wrap=True)
# table.add_column("Title", style="magenta")
# table.add_column("Box Office", justify="right", style="green")
#
# table.add_row("Dec 20, 2019", "Star Wars: The Rise of Skywalker", "$952,110,690")
# table.add_row("May 25, 2018", "Solo: A Star Wars Story", "$393,151,347")
# table.add_row("Dec 15, 2017", "Star Wars Ep. V111: The Last Jedi", "$1,332,539,889")
# table.add_row("Dec 16, 2016", "Rogue One: A Star Wars Story", "$1,332,439,889")
#
# console = Console()
# console.print(table)

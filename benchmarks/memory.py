import random
import gc
import memray
import matplotlib.pyplot as plt
import os
import sys

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from lib.pp_naive_bst import PartialPersistentBst as PPNaiveBst
from lib.pp_fatnode_bst import PartialPersistentBst as PPFatNodeBst
from lib.pp_node_copying_bst import PartialPersistentBst as PPNodeCopyingBst

perf_range = [2**i for i in range(4, 11)]
Bst_classes = [
    (PPFatNodeBst, "Fat Node", "fatnode"),
    (PPNodeCopyingBst, "Node-Copying", "nodecopying"),
    (PPNaiveBst, "Naive", "naive"),
]


def run_insert_mem_pref():
    gc.disable()
    data = []
    for cls, _ in Bst_classes:
        rows = []
        for n in perf_range:
            arr = random.sample([i for i in range(n)], n)
            with memray.Tracker(
                destination=memray.FileDestination(
                    "benchmarks/results/{n}.bin".format(n=n), True
                )
            ):
                tree = cls()
                for i in arr:
                    tree.insert(i)
            gc.collect()
        rows.append(0)
        data.append(rows)
    gc.enable()
    return data


run_insert_mem_pref()

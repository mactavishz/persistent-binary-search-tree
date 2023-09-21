import random
import gc
import matplotlib.pyplot as plt
import timeit
import os
import sys

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from lib.bst import Bst
from lib.pp_naive_bst import PartialPersistentBst as PPNaiveBst
from lib.pp_fatnode_bst import PartialPersistentBst as PPFatNodeBst
from lib.pp_node_copying_bst import PartialPersistentBst as PPNodeCopyingBst

iterations = 10
perf_range = [2**i for i in range(4, 12)]
Bst_classes = [
    (Bst, "Standard"),
    (PPFatNodeBst, "Fat Node"),
    (PPNodeCopyingBst, "Node-Copying"),
    (PPNaiveBst, "Naive"),
]


def batch_op(op, tree, targets=[]):
    match op:
        case "insert":
            for i in targets:
                tree.insert(i)
        case "search":
            for i in targets:
                tree.search(i)
        case "delete":
            for i in targets:
                tree.delete(i)
        case "inorder":
            tree.inorder()


def run_insert_prefs():
    gc.disable()
    data = []
    for cls, _ in Bst_classes:
        rows = []
        for n in perf_range:

            def run():
                arr = random.sample([i for i in range(n)], n)
                tree = cls()
                ms = (
                    timeit.timeit(lambda: batch_op("insert", tree, arr), number=1)
                    * 1000
                )
                gc.collect()
                return ms

            ms = sum([run() for _ in range(iterations)]) / iterations
            rows.append(ms)
        data.append(rows)
    gc.enable()
    return data


def run_search_prefs():
    gc.disable()
    data = []
    for cls, _ in Bst_classes:
        rows = []
        for n in perf_range:

            def run():
                arr = random.sample([i for i in range(n)], n)
                tree = cls()
                batch_op("insert", tree, arr)
                search_arr = random.sample(arr, n)
                ms = (
                    timeit.timeit(
                        lambda: batch_op("search", tree, search_arr), number=1
                    )
                    * 1000
                )
                gc.collect()
                return ms

            ms = sum([run() for _ in range(iterations)]) / iterations
            rows.append(ms)
        data.append(rows)
    gc.enable()
    return data


def run_delete_prefs():
    gc.disable()
    data = []
    for cls, _ in Bst_classes:
        rows = []
        for n in perf_range:
            arr = random.sample([i for i in range(n)], n)

            def run():
                tree = cls()
                batch_op("insert", tree, arr)
                ms = (
                    timeit.timeit(
                        lambda: batch_op("delete", tree, random.sample(arr, n)),
                        number=1,
                    )
                    * 1000
                )
                gc.collect()
                return ms

            ms = sum([run() for _ in range(iterations)]) / iterations
            rows.append(ms)
        data.append(rows)
    gc.enable()
    return data


def run_inorder_prefs():
    gc.disable()
    data = []
    for cls, _ in Bst_classes:
        rows = []
        for n in perf_range:

            def run():
                arr = random.sample([i for i in range(n)], n)
                tree = cls()
                batch_op("insert", tree, arr)
                ms = timeit.timeit(lambda: batch_op("inorder", tree), number=1) * 1000
                gc.collect()
                return ms

            ms = sum([run() for _ in range(iterations)]) / iterations
            rows.append(ms)
        data.append(rows)
    gc.enable()
    return data


data = run_insert_prefs()
fig, axs = plt.subplots(ncols=2, nrows=2, figsize=(16, 9), layout="constrained")
axs[0, 0].set_xlabel("Number of insertions")
axs[0, 0].set_ylabel("Time (ms), log")
axs[0, 0].set_yscale("log")
for i, (cls, name) in enumerate(Bst_classes):
    axs[0, 0].plot(perf_range, data[i], label=name)
#
data = run_search_prefs()
axs[0, 1].set_xlabel("Number of search")
axs[0, 1].set_ylabel("Time (ms)")
axs[0, 1].set_yscale("linear")
for i, (cls, name) in enumerate(Bst_classes):
    axs[0, 1].plot(perf_range, data[i], label=name)

data = run_delete_prefs()
axs[1, 0].set_xlabel("Number of deletions")
axs[1, 0].set_ylabel("Time (ms), log")
axs[1, 0].set_yscale("log")
for i, (cls, name) in enumerate(Bst_classes):
    axs[1, 0].plot(perf_range, data[i], label=name)

data = run_inorder_prefs()
axs[1, 1].set_xlabel("Number of nodes")
axs[1, 1].set_ylabel("Time (ms)")
axs[1, 1].set_yscale("linear")
for i, (cls, name) in enumerate(Bst_classes):
    axs[1, 1].plot(perf_range, data[i], label=name)

axs[0, 0].legend()
axs[0, 1].legend()
axs[1, 0].legend()
axs[1, 1].legend()
plt.show()

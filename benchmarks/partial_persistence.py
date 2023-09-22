import random
import gc
import matplotlib.pyplot as plt
import timeit
import os
import sys

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from lib.pp_naive_bst import PartialPersistentBst as PPNaiveBst
from lib.pp_fatnode_bst import PartialPersistentBst as PPFatNodeBst
from lib.pp_node_copying_bst import PartialPersistentBst as PPNodeCopyingBst

iterations = 10
perf_range = [2**i for i in range(4, 11)]
perf_range_more = [2**i for i in range(4, 17)]
Bst_classes = [
    (PPFatNodeBst, "Fat Node"),
    (PPNodeCopyingBst, "Node-Copying"),
    (PPNaiveBst, "Naive"),
]


def mixed_ops(tree, op_arr):
    for op, x in op_arr:
        match op:
            case "insert":
                tree.insert(x)
            case "delete":
                tree.delete(x)
            case "search":
                tree.search(x[1], x[0])


def run_mixed_perf(classes, prange):
    gc.disable()
    data = []
    for cls, _ in classes:
        rows = []
        for n in prange:

            def run():
                arr = random.sample([i for i in range(n // 2)], n // 2)
                search_arr = random.sample(list(enumerate(arr)), n // 2)
                delete_arr = random.sample(arr[: n // 4], n // 4)
                insert_arr = random.sample(
                    [i for i in range(n // 2, n // 2 + n // 4)], n // 4
                )
                op_arr = random.sample(
                    list(map(lambda x: ("insert", x), insert_arr))
                    + list(map(lambda x: ("search", x), search_arr))
                    + list(map(lambda x: ("delete", x), delete_arr)),
                    n,
                )
                tree = cls()
                for x in arr:
                    tree.insert(x)
                ms = (
                    timeit.timeit(
                        lambda: mixed_ops(tree, op_arr),
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


data = run_mixed_perf(Bst_classes, perf_range)
fig, axs = plt.subplots(ncols=2, nrows=1, figsize=(16, 5), layout="constrained")
axs[0].set_xlabel("Number of operations")
axs[0].set_ylabel("Time (ms), log")
axs[0].set_yscale("log")
for i, (cls, name) in enumerate(Bst_classes):
    axs[0].plot(perf_range, data[i], label=name)
axs[0].legend()

data = run_mixed_perf(Bst_classes[:-1], perf_range_more)
axs[1].set_xlabel("Number of operations")
axs[1].set_ylabel("Time (ms)")
axs[1].set_yscale("linear")
for i, (cls, name) in enumerate(Bst_classes[:-1]):
    axs[1].plot(perf_range_more, data[i], label=name)
axs[1].legend()
plt.show()

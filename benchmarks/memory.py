import random
import gc
import memray
import matplotlib.pyplot as plt
import os
import sys
import json
import numpy as np

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from lib.bst import Bst
from lib.pp_naive_bst import PartialPersistentBst as PPNaiveBst
from lib.pp_fatnode_bst import PartialPersistentBst as PPFatNodeBst
from lib.pp_node_copying_bst import PartialPersistentBst as PPNodeCopyingBst

perf_range = [2**i for i in range(5, 10)]
Bst_classes = [
    (Bst, "Standard", "std"),
    (PPFatNodeBst, "Fat Node", "fatnode"),
    (PPNodeCopyingBst, "Node-Copying", "nodecopying"),
    (PPNaiveBst, "Naive", "naive"),
]


def run_insert_mem_perf():
    gc.disable()
    data = []
    for cls, _, abbr in Bst_classes:
        rows = []
        for n in perf_range:
            arr = random.sample([i for i in range(n)], n)
            profile_result = "benchmarks/results/{name}_insert_{n}.bin".format(
                n=n, name=abbr
            )
            result_json = "benchmarks/results/{name}_insert_{n}.json".format(
                n=n, name=abbr
            )
            with memray.Tracker(
                destination=memray.FileDestination(profile_result, True)
            ):
                tree = cls()
                for i in arr:
                    tree.insert(i)
            os.system(
                "python -m memray stats {result} --json -o {json} -f > /dev/null".format(
                    result=profile_result, json=result_json
                )
            )
            with open(result_json, "r") as json_file:
                json_data = json.load(json_file)
                rows.append(json_data.get("total_bytes_allocated"))
            gc.collect()
        data.append(rows)
    gc.enable()
    return data


def run_delete_mem_perf():
    gc.disable()
    data = []
    for cls, _, abbr in Bst_classes:
        rows = []
        for n in perf_range:
            arr = random.sample([i for i in range(n)], n)
            profile_result = "benchmarks/results/{name}_delete_{n}.bin".format(
                n=n, name=abbr
            )
            result_json = "benchmarks/results/{name}_delete_{n}.json".format(
                n=n, name=abbr
            )
            tree = cls()
            for i in arr:
                tree.insert(i)
            arr = random.sample(arr, n)
            with memray.Tracker(
                destination=memray.FileDestination(profile_result, True)
            ):
                for i in arr:
                    tree.delete(i)
            os.system(
                "python -m memray stats {result} --json -o {json} -f > /dev/null".format(
                    result=profile_result, json=result_json
                )
            )
            with open(result_json, "r") as json_file:
                json_data = json.load(json_file)
                rows.append(json_data.get("total_bytes_allocated"))
            gc.collect()
        data.append(rows)
    gc.enable()
    return data


x = np.arange(len(perf_range))
width = 0.25
multiplier = 0

data = np.array(run_insert_mem_perf(), dtype=np.int64)
data = data / 2**10
fig, axs = plt.subplots(ncols=2, nrows=1, figsize=(16, 5), layout="constrained")
for i, (cls, name, _) in enumerate(Bst_classes):
    offset = width * multiplier
    rects = axs[0].bar(x + offset, data[i], width, label=name)
    axs[0].bar_label(rects, padding=3, fmt="%d")
    multiplier += 1

axs[0].set_xlabel("Number of insertions")
axs[0].set_ylabel("Memory Usage (KiB), log")
axs[0].set_xticks(x + width, perf_range)
axs[0].set_yscale("log")
# axs[0].set_ylim(data.min(), data.max())
axs[0].legend()

multiplier = 0
data = np.array(run_delete_mem_perf(), dtype=np.int64)
data = data / 2**10
for i, (cls, name, _) in enumerate(Bst_classes):
    offset = width * multiplier
    rects = axs[1].bar(x + offset, data[i], width, label=name)
    axs[1].bar_label(rects, padding=3, fmt="%d")
    multiplier += 1

axs[1].set_xlabel("Number of deletions")
axs[1].set_ylabel("Memory Usage (KiB), log")
axs[1].set_xticks(x + width, perf_range)
axs[1].set_yscale("log")
# axs[0].set_ylim(data.min(), data.max())
axs[1].legend()
plt.show()

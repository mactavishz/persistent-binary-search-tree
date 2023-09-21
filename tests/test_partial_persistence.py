import pytest
import random
import os
import sys

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from lib.pp_naive_bst import PartialPersistentBst as PPNaiveBst
from lib.pp_fatnode_bst import PartialPersistentBst as PPFatNodeBst
from lib.pp_node_copying_bst import PartialPersistentBst as PPNodeCopyingBst
from copy import copy


@pytest.mark.parametrize("Bst", [PPNaiveBst, PPFatNodeBst, PPNodeCopyingBst])
class TestPartialPersistence:
    def test_insert_search(self, Bst):
        tree = Bst()
        control = [i for i in range(100)]
        control = random.sample(control, len(control))
        for i in control:
            tree.insert(i)
            version = tree.get_latest_version()
            node = tree.search(i)
            # print(f"version: {version}, insert: {i}, search get: {node}")
            assert node.key == i
            node = tree.search(i, version - 1)
            assert node is None

    def test_insert_multi_search(self, Bst):
        tree = Bst()
        control = [i for i in range(100)]
        control = random.sample(control, len(control))
        k1 = random.randint(0, 50)
        k2 = random.randint(k1, 100)
        # insert first k1 elements one by one
        for i in control[:k1]:
            tree.insert(i)
            version = tree.get_latest_version()
            node = tree.search(i)
            # print(f"version: {version}, insert: {i}, search get: {node}")
            assert node.key == i
            node = tree.search(i, version - 1)
            assert node is None
        # insert the k1-k2 elements in one go
        tree.insert(control[k1:k2])
        version = tree.get_latest_version()
        for i in control[k1:k2]:
            node = tree.search(i)
            # print(f"version: {version}, insert: {i}, search get: {node}")
            assert node.key == i
            node = tree.search(i, version - 1)
            assert node is None
        # insert the rest elements one by one
        for i in control[k2:]:
            tree.insert(i)
            version = tree.get_latest_version()
            node = tree.search(i)
            # print(f"version: {version}, insert: {i}, search get: {node}")
            assert node.key == i
            node = tree.search(i, version - 1)
            assert node is None

    def test_inorder(self, Bst):
        tree = Bst()
        control = [i for i in range(100)]
        control = random.sample(control, len(control))
        compare_list = []
        for i in control:
            compare_list.append(i)
            tree.insert(i)
            version = tree.get_latest_version()
            # print(f"insert: {i}, latest version: {version}")
            sorted_list = tree.inorder()
            assert sorted_list == sorted(list(compare_list))
            sorted_list = tree.inorder(version - 1)
            assert sorted_list != sorted(list(compare_list))

    def test_delete_ordered(self, Bst):
        tree = Bst()
        control = []
        control = [i for i in range(100)]
        control = random.sample(control, len(control))
        for i in control:
            tree.insert(i)
            version = tree.get_latest_version()
            # print(f"version: {version}, insert: {i}")
        assert tree.inorder() == sorted(control)

        copy_control = copy(control)
        for key in control:
            tree.delete(key)
            copy_control.remove(key)
            version = tree.get_latest_version()
            # print(f"version: {version}, delete: {key}")
            node = tree.search(key)
            assert node is None
            assert tree.inorder() == sorted(copy_control)

    def test_delete_random(self, Bst):
        tree = Bst()
        control = [i for i in range(100)]
        control = random.sample(control, len(control))
        for i in control:
            tree.insert(i)
        control_copy = copy(control)

        for key in control:
            tree.delete(key)
            control_copy.remove(key)
            assert tree.search(key) is None
            assert tree.inorder() == sorted(control_copy)

    def test_delete_multi(self, Bst):
        tree = Bst()
        control = [i for i in range(100)]
        control = random.sample(control, len(control))
        version = None
        k1 = random.randint(25, 50)
        k2 = random.randint(k1, 75)
        for i in control:
            tree.insert(i)
        assert tree.inorder() == sorted(control)
        # delete the first k1 elements one by one
        for i in control[:k1]:
            tree.delete(i)
            assert tree.search(i) is None
        assert tree.inorder() == sorted(control[k1:])
        # delete the k1-k2 elements in one go
        tree.delete(control[k1:k2])
        version = tree.get_latest_version()
        for i in control[k1:k2]:
            assert tree.search(i, version) is None
            # the elements deleted in this batch should remain in the previous version
            assert tree.search(i, version - 1).key == i
        # the rest elements should remain
        assert tree.inorder() == sorted(control[k2:])

    def test_delete_all(self, Bst):
        tree = Bst()
        for i in range(100):
            tree.insert(i)
        assert tree.inorder() == [i for i in range(100)]
        for i in reversed(range(100)):
            tree.delete(i)
        assert tree.inorder() == []
        for i in range(100):
            tree.insert(i)
        assert tree.inorder() == [i for i in range(100)]

    def test_manual_random(self, Bst):
        tree = Bst()
        tree.insert([8, 3, 10])  # version 0
        tree.insert(1)  # version 1
        tree.insert(6)  # version 2
        tree.insert([14, 4])  # version 3
        tree.insert(7)  # version 4
        tree.delete(4)  # version 5
        tree.delete([6, 3])  # version 6
        tree.delete(8)  # version 7
        tree.insert(0)  # version 8
        tree.insert([2, 5])  # version 9
        tree.delete(tree.inorder(9))  # version 10
        tree.insert(1)  # version 11

        # check if the nodes are inserted correctly
        assert tree.inorder(0) == [3, 8, 10]
        assert tree.inorder(1) == [1, 3, 8, 10]
        assert tree.inorder(2) == [1, 3, 6, 8, 10]
        assert tree.inorder(3) == [1, 3, 4, 6, 8, 10, 14]
        assert tree.inorder(4) == [1, 3, 4, 6, 7, 8, 10, 14]

        # check if the nodes deleted in the past still exists
        assert tree.search(8, 4).key == 8
        assert tree.search(3, 4).key == 3
        assert tree.search(4, 4).key == 4
        assert tree.search(6, 4).key == 6
        assert tree.search(0, 9).key == 0
        assert tree.search(1, 9).key == 1
        assert tree.search(2, 9).key == 2
        assert tree.search(5, 9).key == 5
        assert tree.search(7, 9).key == 7
        assert tree.search(10, 9).key == 10
        assert tree.search(14, 9).key == 14

        # check if the nodes after the deletion don't exist
        assert tree.search(4, 5) is None
        assert tree.search(6, 6) is None
        assert tree.search(3, 6) is None
        assert tree.search(8, 7) is None
        assert tree.search(0, 10) is None
        assert tree.search(1, 10) is None
        assert tree.search(2, 10) is None
        assert tree.search(5, 10) is None
        assert tree.search(7, 10) is None
        assert tree.search(10, 10) is None
        assert tree.search(14, 10) is None

        # check if the nodes are still in order after deletion
        assert tree.inorder(5) == [1, 3, 6, 7, 8, 10, 14]
        assert tree.inorder(6) == [1, 7, 8, 10, 14]
        assert tree.inorder(7) == [1, 7, 10, 14]
        assert tree.inorder(10) == []

        # check if the nodes are there after new insertion
        assert tree.inorder(8) == [0, 1, 7, 10, 14]
        assert tree.inorder(9) == [0, 1, 2, 5, 7, 10, 14]
        assert tree.inorder(11) == [1]

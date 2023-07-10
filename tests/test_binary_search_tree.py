import random
import os
import sys
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from lib.binary_search_tree.bst import BinarySearchTree as Bst
from copy import copy

class TestBinarySearchTree():
    def test_search(self):
        tree = Bst()
        for _ in range(100):
            i = random.randint(0, 100)
            tree.insert(i)
            assert tree.search(i).key == i

    def test_inorder(self):
        tree = Bst()
        control = set()
        for _ in range(100):
            i = random.randint(0, 100)
            tree.insert(i)
            control.add(i)
            assert tree.inorder() == sorted(list(control))

    def test_search_le(self):
        tree = Bst()
        for i in range(100):
            tree.insert(i)
            assert tree.search_le(-1) is None
            assert tree.search_le(i + 1).key == i

        # check if the key is in the tree
        for i in range(0, 99):
            assert tree.search_le(i).key == i

        tree = Bst()
        for i in range(0, 100, 2):
            tree.insert(i)

        for i in range(1, 99, 2):
            assert tree.search_le(i).key == i - 1

    def test_search_gt(self):
        tree = Bst()
        assert tree.search_gt(1) is None
        tree.insert(0)
        for i in range(1, 100):
            tree.insert(i)
            assert tree.search_gt(i) is None
            assert tree.search_gt(i - 1).key == i

        for i in range(0, 99):
            assert tree.search_gt(i).key == i + 1

        tree = Bst()
        for i in range(0, 100, 2):
            tree.insert(i)

        for i in range(1, 99, 2):
            assert tree.search_gt(i).key == i + 1


    def test_search_le_with_gap(self):
        tree = Bst()
        for i in range(0, 100, 2):
            tree.insert(i)
            assert tree.search_le(-1) is None
            assert tree.search_le(i).key == i
            if i >= 2:
                assert tree.search_le(i-1).key == i-2

    def test_delete_ordered(self):
        tree = Bst()
        control = [i for i in range(100)]
        for i in control:
            tree.insert(i)
        control_copy = copy(control)

        for key in control:
            tree.delete(key)
            control_copy.remove(key)
            assert tree.search(key) is None
            assert tree.inorder() == sorted(control_copy)

    def test_delete_random(self):
        tree = Bst()
        control = [i for i in range(100)]
        control = random.sample(control, len(control))
        for i in control:
            tree.insert(i)
        # remove duplicates
        control_copy = copy(control)

        for key in control:
            tree.delete(key)
            control_copy.remove(key)
            assert tree.search(key) is None
            assert tree.inorder() == sorted(control_copy)

if __name__ == '__main__':
    unittest.main()

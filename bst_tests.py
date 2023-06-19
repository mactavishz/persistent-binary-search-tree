import unittest
import random
from bst import BinarySearchTree as Bst
from copy import copy

class TestNormalBST(unittest.TestCase):
    def test_search(self):
        tree = Bst()
        for _ in range(100):
            i = random.randint(0, 100)
            tree.insert(i)
            self.assertEqual(tree.search(i).key, i) # pyright: ignore[reportOptionalMemberAccess]

    def test_inorder(self):
        tree = Bst()
        control = set()
        for _ in range(100):
            i = random.randint(0, 100)
            tree.insert(i)
            control.add(i)
            self.assertEqual(tree.inorder(), sorted(list(control)))

    def test_search_le(self):
        tree = Bst()
        for i in range(100):
            tree.insert(i)
            self.assertEqual(tree.search_le(-1), None)
            self.assertEqual(tree.search_le(i + 1).key, i) # pyright: ignore[reportOptionalMemberAccess]

    def test_delete_ordered(self):
        tree = Bst()
        control = [i for i in range(100)]
        for i in control:
            tree.insert(i)
        control_copy = copy(control)

        for key in control:
            tree.delete(key)
            control_copy.remove(key)
            self.assertEqual(tree.search(key), None)
            self.assertEqual(tree.inorder(), sorted(control_copy))

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
            self.assertEqual(tree.search(key), None)
            self.assertEqual(tree.inorder(), sorted(control_copy))

if __name__ == '__main__':
    unittest.main()

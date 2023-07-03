import unittest
import random
from fp_fatnode_bst import FullPersistentBst as Bst
from copy import copy

class TestFPFatNodeBstPartialPersistence(unittest.TestCase):
    def test_insert_search(self):
        tree = Bst()
        control = []
        v = None
        for _ in range(100):
            i = random.randint(0, 100)
            while i in control:
                i = random.randint(0, 100)
            control.append(i)
            v = tree.insert(i, v)
            node = tree.search(i, v) 
            # print(f"version: {v.value}, insert: {i}, search get: {node}")
            self.assertEqual(node.key, i) # pyright: ignore[reportOptionalMemberAccess]
            node = tree.search(i, v.prev)
            self.assertEqual(node, None)

    def test_inorder(self):
        tree = Bst()
        control = []
        v = None
        for _ in range(100):
            i = random.randint(0, 100)
            while i in control:
                i = random.randint(0, 100)
            control.append(i)
            v = tree.insert(i, None)
            # print(f"insert: {i}, latest version: {v}")
            sorted_list = tree.inorder(v)
            self.assertEqual(sorted_list, sorted(list(control)))
            sorted_list = tree.inorder(v.prev)
            self.assertNotEqual(sorted_list, sorted(list(control)))

    def test_delete_ordered(self):
        tree = Bst()
        control = []
        v = None
        for i in range(100):
            i = random.randint(0, 100)
            while i in control:
                i = random.randint(0, 100)
            control.append(i)
            v = tree.insert(i)
            # print(f"version: {v}, insert: {i}")
        self.assertEqual(tree.inorder(v), sorted(control))


        copy_control = copy(control)
        for key in control:
            v = tree.delete(key, v)
            copy_control.remove(key)
            # print(f"version: {v}, delete: {key}")
            node = tree.search(key, v)
            self.assertEqual(node, None)
            self.assertEqual(tree.inorder(v), sorted(copy_control))
        
    def test_delete_random(self):
        tree = Bst()
        v = None
        control = [i for i in range(100)]
        control = random.sample(control, len(control))
        for i in control:
            v = tree.insert(i, v)
        control_copy = copy(control)

        for key in control:
            v = tree.delete(key, v)
            control_copy.remove(key)
            self.assertEqual(tree.search(key, v), None)
            self.assertEqual(tree.inorder(v), sorted(control_copy))

    def test_delete_all(self):
        tree = Bst()
        v = None
        for i in range(100):
            v = tree.insert(i, v)
        self.assertEqual(tree.inorder(v), [i for i in range(100)])
        for i in reversed(range(100)): 
            v = tree.delete(i, v)
        self.assertEqual(tree.inorder(v), [])
        for i in range(100):
            v = tree.insert(i, v)
        self.assertEqual(tree.inorder(v), [i for i in range(100)])

    def test_manual_random(self):
        tree = Bst()
        v0 = tree.insert(8)  # version 0
        v1 = tree.insert(3, v0)  # version 1
        v2 = tree.insert(10, v1) # version 2
        v3 = tree.insert(1, v2)  # version 3
        v4 = tree.insert(6, v3)  # version 4
        v5 = tree.insert(14, v4) # version 5
        v6 = tree.insert(4, v5)  # version 6
        v7 = tree.insert(7, v6)  # version 7
        v8 = tree.delete(4, v7)  # version 8
        v9 = tree.delete(6, v8)  # version 9
        v10 = tree.delete(3, v9)  # version 10
        v11 = tree.delete(8, v10)  # version 11

        # check if the nodes are inserted correctly
        self.assertEqual(tree.inorder(v0), [8])
        self.assertEqual(tree.inorder(v1), [3, 8])
        self.assertEqual(tree.inorder(v2), [3, 8, 10])
        self.assertEqual(tree.inorder(v3), [1, 3, 8, 10])
        self.assertEqual(tree.inorder(v4), [1, 3, 6, 8, 10])
        self.assertEqual(tree.inorder(v5), [1, 3, 6, 8, 10, 14])
        self.assertEqual(tree.inorder(v6), [1, 3, 4, 6, 8, 10, 14])
        self.assertEqual(tree.inorder(v7), [1, 3, 4, 6, 7, 8, 10, 14])

        # check if the nodes deleted in the past still exists
        self.assertEqual(tree.search(8, v7).key, 8) # pyright: ignore[reportOptionalMemberAccess]
        self.assertEqual(tree.search(3, v7).key, 3) # pyright: ignore[reportOptionalMemberAccess]
        self.assertEqual(tree.search(4, v7).key, 4) # pyright: ignore[reportOptionalMemberAccess]
        self.assertEqual(tree.search(6, v7).key, 6) # pyright: ignore[reportOptionalMemberAccess]

        # check if the nodes after the deletion don't exist
        self.assertEqual(tree.search(4, v8), None)
        self.assertEqual(tree.search(6, v9), None)
        self.assertEqual(tree.search(3, v10), None)
        self.assertEqual(tree.search(8, v11), None)

        # check if the nodes are still in order after deletion
        self.assertEqual(tree.inorder(v8), [1, 3, 6, 7, 8, 10, 14])
        self.assertEqual(tree.inorder(v9), [1, 3, 7, 8, 10, 14])
        self.assertEqual(tree.inorder(v10), [1, 7, 8, 10, 14])
        self.assertEqual(tree.inorder(v11), [1, 7, 10, 14])


class TestFPFatNodeBstFullPersistence(unittest.TestCase):
    def test_insert_multiple_path(self):
        tree = Bst()
        v0 = tree.insert(3)
        v1 = tree.insert(2, v0)
        v2 = tree.insert(4, v1)
        v3 = tree.insert(5, v2)
        v4 = tree.insert(1, v0)
        v5 = tree.insert(6, v0)
        v6 = tree.insert(1, v3)
        v7 = tree.insert(6, v3)

        # check the version list [v0, v5, v4, v1, v2, v3, v7, v6]
        self.assertEqual(list(tree.version_list), [0, 5, 4, 1, 2, 3, 7, 6])

        # test for v0
        self.assertEqual(tree.inorder(v0), [3])
        # test for v1
        self.assertEqual(tree.inorder(v1), [2, 3])
        # test for v2
        self.assertEqual(tree.inorder(v2), [2, 3, 4])
        # test for v3
        self.assertEqual(tree.inorder(v3), [2, 3, 4, 5])
        # test for v4
        self.assertEqual(tree.inorder(v4), [1, 3])
        # test for v5
        self.assertEqual(tree.inorder(v5), [3, 6])
        # test for v6
        self.assertEqual(tree.inorder(v6), [1, 2, 3, 4, 5])
        # test for v7
        self.assertEqual(tree.inorder(v7), [2, 3, 4, 5, 6])

    def test_delete_multiple_path(self):
        tree = Bst()
        v0 = tree.insert(10)
        v1 = tree.insert(7, v0)
        v2 = tree.insert(20, v1)
        v3 = tree.insert(15, v2)
        v4 = tree.insert(25, v3)
        v5 = tree.delete(7, v3)
        v6 = tree.delete(20, v4)
        v7 = tree.insert(30, v3)
        # delete root
        v8 = tree.delete(10, v6)
        v9 = tree.insert(5, v0)
        # delete root
        v10 = tree.delete(10, v0)
        v11 = tree.delete(7, v7)
        # delete root
        v12 = tree.delete(10, v2)
        v13 = tree.delete(15, v4)
        # delete root
        v14 = tree.delete(10, v7)

        # check the version list 
        self.assertEqual(list(tree.version_list), [0, 10, 9, 1, 2, 12, 3, 7, 14, 11, 5, 4, 13, 6, 8])

        # test for v4
        self.assertEqual(tree.inorder(v4), [7, 10, 15, 20, 25])

        # test for v5
        self.assertEqual(tree.inorder(v5), [10, 15, 20])

        # test for v6
        self.assertEqual(tree.inorder(v6), [7, 10, 15, 25])

        # test for v7
        self.assertEqual(tree.inorder(v7), [7, 10, 15, 20, 30])

        # test for v8
        self.assertEqual(tree.inorder(v8), [7, 15, 25])

        # test for v9
        self.assertEqual(tree.inorder(v9), [5, 10])

        # test for v10
        self.assertEqual(tree.inorder(v10), [])

        # test for v11
        self.assertEqual(tree.inorder(v11), [10, 15, 20, 30])

        # test for v12
        self.assertEqual(tree.inorder(v12), [7, 20])

        # test for v13
        self.assertEqual(tree.inorder(v13), [7, 10, 20, 25])

        # test for v14
        self.assertEqual(tree.inorder(v14), [7, 15, 20, 30])

if __name__ == '__main__':
    unittest.main()
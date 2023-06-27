import unittest
import random
from pp_path_copying_bst import PartialPersistentBst as Bst
from copy import copy

class TestPPFatNodeBstInsert(unittest.TestCase):
    def test_insert_search(self):
        tree = Bst()
        control = []
        for _ in range(100):
            i = random.randint(0, 100)
            while i in control:
                i = random.randint(0, 100)
            control.append(i)
            tree.insert(i)
            version = tree.get_latest_version()
            node = tree.search(i, version) 
            # print(f"version: {version}, insert: {i}, search get: {node}")
            self.assertEqual(node.key, i) # pyright: ignore[reportOptionalMemberAccess]
            node = tree.search(i, version - 1)
            self.assertEqual(node, None)

    def test_inorder(self):
        tree = Bst()
        control = []
        for _ in range(100):
            i = random.randint(0, 100)
            while i in control:
                i = random.randint(0, 100)
            control.append(i)
            tree.insert(i)
            version = tree.get_latest_version()
            # print(f"insert: {i}, latest version: {version}")
            sorted_list = tree.inorder(version)
            self.assertEqual(sorted_list, sorted(list(control)))
            sorted_list = tree.inorder(version - 1)
            self.assertNotEqual(sorted_list, sorted(list(control)))

    def test_delete_ordered(self):
        tree = Bst()
        control = []
        for i in range(100):
            i = random.randint(0, 100)
            while i in control:
                i = random.randint(0, 100)
            control.append(i)
            tree.insert(i)
            version = tree.get_latest_version()
            # print(f"version: {version}, insert: {i}")
        version = tree.get_latest_version()
        self.assertEqual(tree.inorder(version), sorted(control))

        copy_control = copy(control)
        for key in control:
            tree.delete(key)
            copy_control.remove(key)
            version = tree.get_latest_version()
            # print(f"version: {version}, delete: {key}")
            node = tree.search(key, version)
            self.assertEqual(node, None)
            self.assertEqual(tree.inorder(version), sorted(copy_control))

    def test_delete_random(self):
        tree = Bst()
        control = [i for i in range(5)]
        control = random.sample(control, len(control))
        for i in control:
            tree.insert(i)
            version = tree.get_latest_version()
            # print(f"version: {version}, insert: {i}")
        control_copy = copy(control)

        for key in control:
            tree.delete(key)
            control_copy.remove(key)
            version = tree.get_latest_version()
            # print(f"version: {version}, delete: {key}")
            self.assertEqual(tree.search(key, version), None)
            self.assertEqual(tree.inorder(version), sorted(control_copy))


    def test_delete_all(self):
        tree = Bst()
        for i in range(100):
            tree.insert(i)
        self.assertEqual(tree.inorder(tree.get_latest_version()), [i for i in range(100)])
        for i in reversed(range(100)): 
            tree.delete(i)
        self.assertEqual(tree.inorder(tree.get_latest_version()), [])
        for i in range(100):
            tree.insert(i)
        self.assertEqual(tree.inorder(tree.get_latest_version()), [i for i in range(100)])

    def test_manual_random(self):
        tree = Bst()
        tree.insert(8)  # version 0
        tree.insert(3)  # version 1
        tree.insert(10) # version 2
        tree.insert(1)  # version 3
        tree.insert(6)  # version 4
        tree.insert(14) # version 5
        tree.insert(4)  # version 6
        tree.insert(7)  # version 7
        tree.delete(4)  # version 8
        tree.delete(6)  # version 9
        tree.delete(3)  # version 10
        tree.delete(8)  # version 11

        # check if the nodes are inserted correctly
        self.assertEqual(tree.inorder(0), [8])
        self.assertEqual(tree.inorder(1), [3, 8])
        self.assertEqual(tree.inorder(2), [3, 8, 10])
        self.assertEqual(tree.inorder(3), [1, 3, 8, 10])
        self.assertEqual(tree.inorder(4), [1, 3, 6, 8, 10])
        self.assertEqual(tree.inorder(5), [1, 3, 6, 8, 10, 14])
        self.assertEqual(tree.inorder(6), [1, 3, 4, 6, 8, 10, 14])
        self.assertEqual(tree.inorder(7), [1, 3, 4, 6, 7, 8, 10, 14])

        # check if the nodes deleted in the past still exists
        self.assertEqual(tree.search(8, 7).key, 8) # pyright: ignore[reportOptionalMemberAccess]
        self.assertEqual(tree.search(3, 7).key, 3) # pyright: ignore[reportOptionalMemberAccess]
        self.assertEqual(tree.search(4, 7).key, 4) # pyright: ignore[reportOptionalMemberAccess]
        self.assertEqual(tree.search(6, 7).key, 6) # pyright: ignore[reportOptionalMemberAccess]
        
        # check if the nodes after the deletion don't exist
        self.assertEqual(tree.search(4, 8), None)
        self.assertEqual(tree.search(6, 9), None)
        self.assertEqual(tree.search(3, 10), None)
        self.assertEqual(tree.search(8, 11), None)

        # check if the nodes are still in order after deletion
        self.assertEqual(tree.inorder(8), [1, 3, 6, 7, 8, 10, 14])
        self.assertEqual(tree.inorder(9), [1, 3, 7, 8, 10, 14])
        self.assertEqual(tree.inorder(10), [1, 7, 8, 10, 14])
        self.assertEqual(tree.inorder(11), [1, 7, 10, 14])

if __name__ == '__main__':
    unittest.main()

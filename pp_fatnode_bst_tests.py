import unittest
import random
from pp_fatnode_bst import PartialPersistentBst as Bst
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
        control = [i for i in range(100)]
        control = random.sample(control, len(control))
        for i in control:
            tree.insert(i)
        control_copy = copy(control)

        for key in control:
            tree.delete(key)
            control_copy.remove(key)
            version = tree.get_latest_version()
            self.assertEqual(tree.search(key, version), None)
            self.assertEqual(tree.inorder(version), sorted(control_copy))

if __name__ == '__main__':
    unittest.main()

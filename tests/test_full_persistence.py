import pytest
import random
from copy import copy

from lib.full_persistence.fp_fatnode_bst import FullPersistentBst as FatNodeBst 

@pytest.mark.parametrize("Bst", [FatNodeBst])
class TestFullPersistence:
    def test_insert_multiple_path(self, Bst):
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
        assert list(tree.version_list) == [0, 5, 4, 1, 2, 3, 7, 6]

        # test for v0
        assert tree.inorder(v0) == [3]
        # test for v1
        assert tree.inorder(v1) == [2, 3]
        # test for v2
        assert tree.inorder(v2) == [2, 3, 4]
        # test for v3
        assert tree.inorder(v3) == [2, 3, 4, 5]
        # test for v4
        assert tree.inorder(v4) == [1, 3]
        # test for v5
        assert tree.inorder(v5) == [3, 6]
        # test for v6
        assert tree.inorder(v6) == [1, 2, 3, 4, 5]
        # test for v7
        assert tree.inorder(v7) == [2, 3, 4, 5, 6]

    def test_delete_multiple_path(self, Bst):
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
        assert list(tree.version_list) == [0, 10, 9, 1, 2, 12, 3, 7, 14, 11, 5, 4, 13, 6, 8]

        # test for v4
        assert tree.inorder(v4) == [7, 10, 15, 20, 25]

        # test for v5
        assert tree.inorder(v5) == [10, 15, 20]

        # test for v6
        assert tree.inorder(v6) == [7, 10, 15, 25]

        # test for v7
        assert tree.inorder(v7) == [7, 10, 15, 20, 30]

        # test for v8
        assert tree.inorder(v8) == [7, 15, 25]

        # test for v9
        assert tree.inorder(v9) == [5, 10]

        # test for v10
        assert tree.inorder(v10) == []

        # test for v11
        assert tree.inorder(v11) == [10, 15, 20, 30]

        # test for v12
        assert tree.inorder(v12) == [7, 20]

        # test for v13
        assert tree.inorder(v13) == [7, 10, 20, 25]

        # test for v14
        assert tree.inorder(v14) == [7, 15, 20, 30]

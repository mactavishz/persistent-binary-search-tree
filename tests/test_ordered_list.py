from random import randint
import os
import sys
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from lib.ordered_list import OrderedList, OrderedNode

class TestOrderedList:
    def check_list_order(self, l):
        for i in range(len(l)):
            curr = l[i]
            # print(f"{curr} and {curr.next}")
            assert curr.prev < curr
            assert curr < curr.next
            assert l.order(curr.prev, curr)
            assert l.order(curr, curr.next)

    def test_ordered_inserts(self):
        l = OrderedList()
        curr = None
        prev = l.base
        for i in range(1000):
            curr = OrderedNode(f"v{i}")
            # print(f"#{i} inserting {curr.value}")
            prev = l.insert(l.base, curr)
            assert len(l) == i + 1
            assert l[0] == prev

        self.check_list_order(l)

        # deletions
        for i in range(500):
            rand = randint(0, 500)
            curr = l[rand]
            # print(f"deleting {curr}")
            l.delete(curr)
            assert len(l) == 1000 - i - 1

        # check that the list is still ordered
        self.check_list_order(l)

    def test_random_inserts(self):
        l = OrderedList()
        curr = None
        prev = None
        for i in range(1000):
            curr = OrderedNode(f"v{i}")
            if i == 0:
                prev = l.base
            else:
                rand = randint(0, len(l) - 1)
                prev = l[rand]
            # print(f"#{i} inserting {curr.value}")
            prev = l.insert(prev, curr)
            assert len(l) == i + 1
            assert curr == prev

        self.check_list_order(l)

        # deletions
        for i in range(500):
            rand = randint(0, 500)
            curr = l[rand]
            # print(f"deleting {curr}")
            l.delete(curr)
            assert len(l) == 1000 - i - 1

        # check that the list is still ordered
        self.check_list_order(l)

    def test_manual(self):
        l = OrderedList()
        v1 = OrderedNode("v1")
        v2 = OrderedNode("v2")
        v3 = OrderedNode("v3")
        v4 = OrderedNode("v4")
        v5 = OrderedNode("v5")
        v6 = OrderedNode("v6")
        v7 = OrderedNode("v7")
        v1 = l.insert(v1)
        v2 = l.insert(v1, v2)
        v3 = l.insert(v1, v3)
        v4 = l.insert(v1, v4)
        v5 = l.insert(v4, v5)
        v7 = l.insert(v4, v7)
        v6 = l.insert(v3, v6)
        assert ["v1", "v4", "v7", "v5", "v3", "v6", "v2"] == list(l)
        assert len(l) == 7
        assert l.order(l.base, v1)
        assert l.order(v2, l.end)
        assert l.order(v1, v2)
        assert l.order(v1, v3)
        assert l.order(v1, v4)
        assert not l.order(v3, v5)
        assert not l.order(v6, v7)
        assert not l.order(v5, v7)
        assert not l.order(v2, v4)
        self.check_list_order(l)

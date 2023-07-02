from functools import total_ordering

LOG_M = 32
M = 1 << LOG_M
N = int(M ** 0.5) - 1


@total_ordering
class OrderedNode:
    def __init__(self, value):
        self.prev: OrderedNode | None = None
        self.next: OrderedNode | None = None
        self.label = -1
        self.value = value

    def __str__(self):
        return f"Node(val: {self.value}, label: {self.label})"

    def __eq__(self, other):
        return self.label == other.label

    def __lt__(self, other):
        return self.label < other.label


class OrderedList:
    """
    OrderedList is an implementation of a ordered list that solves the order maintenance problem.
    The labels are in monotonically increasing order from the beginning to the end of the list.
    This implementation causes relabeling roughly every log(M) insertions
    Label space is O(N^2) for N nodes
    """

    def __init__(self):
        # base node is a sentinel node which is never deleted
        # base represents the end and the beginning of the list
        self.base = OrderedNode("base")
        self.base.label = 0
        self.end = OrderedNode("end")
        self.end.label = M
        self.base.next = self.end
        self.end.prev = self.base
        self._n = 0

    # support len()
    def __len__(self):
        return self._n

    # support indexing
    def __getitem__(self, position):
        if position > len(self) - 1:
            raise IndexError
        i = 0
        curr = self.base.next
        while curr is not self.end and i < position:
            curr = curr.next
            i += 1
        return curr

    def __iter__(self):
        curr = self.base.next
        while curr is not self.end:
            yield curr.value
            curr = curr.next

    def insert(self, x, y=None):
        if y is None:
            y = x
            x = self.base
        nlabel = x.next.label
        y.label = (x.label + nlabel) // 2
        y.prev = x
        y.next = x.next
        x.next = y
        y.next.prev = y
        self._n += 1
        if y.label == x.label or y.label == nlabel:
            self._relabel()
        return y

    def delete(self, x):
        if x is self.base or x is self.end:
            return
        else:
            x.prev.next = x.next
            x.next.prev = x.prev
            self._n -= 1

    def order(self, x, y):
        return x.label < y.label

    # private method
    def _relabel(self):
        # print(f"relabeling, len: {len(self)}")
        l = self._n
        step = M // (l + 2)
        # uniformly distribute the labels
        for i in range(l):
            self[i].label = (i + 1) * step

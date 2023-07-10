from .bst import Bst
from .ordered_list import OrderedList, OrderedNode
from collections import namedtuple
from typing import Any

Record = namedtuple("VField", ("field", "value", "version"))


class FatNode:
    key = lambda t: t.version
    compare = lambda x, y: 1 if x > y else -1 if x < y else 0

    def __init__(self, key: Any, version: OrderedNode):
        """
        We require that the key will never change, so we don't need to keep track of
        versions for the key.
        """
        self.version = version
        self.left = None
        self.right = None
        self.parent = None
        self.key = key
        self._vleft = Bst(FatNode.key, FatNode.compare)
        self._vright = Bst(FatNode.key, FatNode.compare)
        self._vparent = Bst(FatNode.key, FatNode.compare)

    def __str__(self):
        return f"FatNode(key: {self.key}, version: {self.version})"

    def __getitem__(self, attr):
        match attr:
            case "left":
                return self.left
            case "right":
                return self.right
            case "parent":
                return self.parent

    def __setitem__(self, attr, new_val):
        match attr:
            case "left":
                self.left = new_val
            case "right":
                self.right = new_val
            case "parent":
                self.parent = new_val

    def get(self, attr, version) -> Record:
        if version == self.version:
            return Record(attr, self[attr], version)
        elif version < self.version:
            return Record(attr, None, version)
        else:
            record = None
            match attr:
                case "left":
                    record = self._vleft.search_le(version)
                case "right":
                    record = self._vright.search_le(version)
                case "parent":
                    record = self._vparent.search_le(version)
            if not record:
                # if we can not find a suitable version of record 
                # that is less or equal than the given version
                # then we return the latest version of the record
                return self.get(attr, self.version)
            else:
                return record.key

    def set(self, attr, new_val, version):
        if version < self.version:
            return

        i = version
        i_plus = i.next if not version.next.is_sentinel() else None
        v1 = self.get(attr, i)
        v2 = None
        i1 = v1.version if v1 else None
        i2 = None
        match attr:
            case "left":
                v2 = self._vleft.search_gt(i)
            case "right":
                v2 = self._vright.search_gt(i)
            case "parent":
                v2 = self._vparent.search_gt(i)
        i2 = v2.key.version if v2 else None

        if i1 == i:
            if i == self.version:
                self[attr] = new_val
                if v1.value is None and i_plus is not None:
                    self._update_attr(attr, None, i_plus)
            else:
                self._update_attr(attr, new_val, i)
        else:  # i1 < i (this holds)
            self._update_attr(attr, new_val, i)
            if (i_plus and not i2) or (i_plus and i2 and i_plus < i2):
                self._update_attr(attr, v1.value, i_plus)

    def _update_attr(self, attr, value, version):
        match attr:
            case "left":
                self._vleft.insert(Record("left", value, version))
            case "right":
                self._vright.insert(Record("right", value, version))
            case "parent":
                self._vparent.insert(Record("parent", value, version))


class RootNode:
    def __init__(self, next: FatNode, version: OrderedNode):
        self.next = next
        self.version = version

    def __str__(self):
        return f"RootNode(next: {self.next}, version: {self.version})"


class FullPersistentBst:
    def __init__(self):
        self.roots = Bst(FatNode.key, FatNode.compare)
        self.__latest_version = -1
        self.version_list = OrderedList()

    def create_root(self, node: FatNode, version: OrderedNode):
        self.roots.insert(RootNode(node, version))

    def get_latest_version(self):
        return self.__latest_version

    def _inc_latest_version(self):
        self.__latest_version += 1
        return self.__latest_version

    def insert(self, key, version=None):
        new_v = None
        if self.get_latest_version() == -1:
            self._inc_latest_version()
            new_v = self.version_list.insert(OrderedNode(self.__latest_version))
            self.create_root(FatNode(key, new_v), new_v)
        else:
            last_v = version if version else self.version_list.get_last()
            new_v = OrderedNode(self._inc_latest_version())
            new_v = self.version_list.insert(last_v, new_v)
            self._insert(FatNode(key, new_v), new_v)
        return new_v

    def _insert(self, node, version: OrderedNode):
        root = self.roots.search_le(version)

        if root:
            root = root.key.next
            if root.key is None:
                self.create_root(FatNode(node.key, version), version)
                return
        else:
            self.create_root(FatNode(node.key, version), version)
            return

        parent = None
        while root:
            parent = root
            if node.key < root.key:
                root = root.get("left", version).value
            elif node.key > root.key:
                root = root.get("right", version).value
            else:
                # print("Key already exists in the tree.")
                return

        node.parent = parent
        assert parent is not None
        if node.key < parent.key:
            parent.set("left", node, version)
        else:
            parent.set("right", node, version)

    def search(self, key, version=None):
        if self.get_latest_version() == -1:
            return None
        version = self.version_list.get_last() if version is None else version
        return self._search(key, version)

    def _search(self, key, version):
        root = self.roots.search_le(version)

        if root:
            root = root.key.next
            if root.key is None:
                return None

        while root:
            # handle the case when the tree is empty,
            # the root is a FatNode with key = None
            if key < root.key:
                root = root.get("left", version).value
            elif key > root.key:
                root = root.get("right", version).value
            else:
                return root
        return None

    def delete(self, key, version=None):
        if self.get_latest_version() == -1:
            return None
        else:
            last_v = version if version else self.version_list.get_last()
            node = self.search(key, last_v)
            if node:
                new_v = OrderedNode(self._inc_latest_version())
                new_v = self.version_list.insert(last_v, new_v)
                self._delete(node, new_v)
                return new_v
            else:
                return None

    def _delete(self, node, version):
        node_l = node.get("left", version).value
        node_r = node.get("right", version).value

        if node_l is None:
            self._transplant(node, node_r, version)
        elif node_r is None:
            self._transplant(node, node_l, version)
        else:
            tmp = self._successor(
                node, version
            )  # tmp has at most one child on its right
            if tmp is not node_r:
                self._transplant(tmp, tmp.get("right", version).value, version)
                tmp.set("right", node_r, version)
                tmp.get("right", version).value.set("parent", tmp, version)
            self._transplant(node, tmp, version)
            tmp.set("left", node_l, version)
            tmp.get("left", version).value.set("parent", tmp, version)

    def _find_min(self, node, version):
        while node.get("left", version).value:
            node = node.get("left", version).value
        return node

    def _successor(self, node, version):
        # if node has a right child
        if node and node.get("right", version).value:
            return self._find_min(node.get("right", version).value, version)

        # if node has no right child
        parent = node.get("parent", version).value
        while parent and parent.get("right", version).value == node:
            node = parent
        return node.get("parent", version).value

    def _transplant(self, old, node, version):
        old_parent = old.get("parent", version).value
        if not old_parent:
            if node:
                self.create_root(node, version)
            else:
                self.create_root(FatNode(None, version), version)
        elif old == old_parent.get("left", version).value:
            old_parent.set("left", node, version)
        else:
            old_parent.set("right", node, version)
        if node:
            node.set("parent", old_parent, version)

    def inorder(self, version):
        result = []
        root = self.roots.search_le(version)
        if root:
            root = root.key.next
            self._inorder(root, result, version)
            return result
        else:
            return result

    def _inorder(self, node, result, version):
        if not node or node.key is None:
            return
        self._inorder(node.get("left", version).value, result, version)
        result.append(node.key)
        self._inorder(node.get("right", version).value, result, version)

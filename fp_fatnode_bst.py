from bst import BinarySearchTree as Bst
from ordered_list import OrderedList, OrderedNode
from collections import namedtuple
from typing import Any

Record = namedtuple('VField', ('field', 'value', 'version'))

class RootNode:
    def __init__(self):
        self.next = Bst(lambda t: t.version, lambda x, y: 1 if x > y else -1 if x < y else 0)

class FatNode:
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
        self.key_fn = lambda t: t.version
        self.compare_fn = lambda x, y: 1 if x > y else -1 if x < y else 0 
        self._vleft = Bst(self.key_fn, self.compare_fn)
        self._vright = Bst(self.key_fn, self.compare_fn)
        self._vparent = Bst(self.key_fn, self.compare_fn)

    def __str__(self):
        return f"FatNode({self.key})"

    def __getitem__(self, attr):
        match attr:
            case "key":
                return self.key
            case "left":
                return self.left
            case "right":
                return self.right
            case "parent":
                return self.parent
            case "version":
                return self.version

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
                # if we can not find a suitable version of record that is less or equal than the given version
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
                    self.set(attr, None, i_plus)
            else:
                match attr:
                    case "left":
                        self._vleft.insert(Record("left", new_val, i))
                    case "right":
                        self._vright.insert(Record("right", new_val, i))
                    case "parent":
                        self._vparent.insert(Record("parent", new_val, i))
        else: # i1 < i (this holds)
            match attr:
                case "left":
                    self._vleft.insert(Record("left", new_val, i))
                case "right":
                    self._vright.insert(Record("right", new_val, i))
                case "parent":
                    self._vparent.insert(Record("parent", new_val, i))
            if (i_plus and not i2) or (i_plus and i2 and i_plus < i2):
                self.set(attr, v1.value, i_plus)
 
class FullPersistentBst:
    def __init__(self):
        # self.roots = []
        self.root = RootNode()
        self.__latest_version = -1
        self.version_list = OrderedList()

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
            self.root.next.insert(FatNode(key, new_v))
        else:
            last_v = version if version else self.version_list.get_last()
            new_v = OrderedNode(self._inc_latest_version())
            new_v = self.version_list.insert(last_v, new_v)
            self._insert(FatNode(key, new_v), new_v)
        return new_v
 
    def _insert(self, node, version: OrderedNode):
        root = self.root.next.search_le(version)

        if root:
            root = root.key
        else:
            self.root.next.insert(FatNode(node.key, version))
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
        root = self.root.next.search_le(version)
        if root:
            root = root.key
        while root:
            if key < root.key:
                root = root.get("left", version).value
            elif key > root.key:
                root = root.get("right", version).value
            else:
                return root
        return None
 
    def delete(self, key):
        if len(self.roots) == 0:
            return
        else:
            version = self.get_latest_version() + 1
            node = self.search(key, version) 
            if node:
                self._delete(node, version)
                # if the root was not changed, we just copy the last root
                if version != self.get_latest_version():
                    self.roots.append(self.roots[-1])
 
    def _delete(self, node, version):
        node_l = node.get("left", version)
        node_r = node.get("right", version)
 
        if node_l is None:
            self._transplant(node, node_r, version)
        elif node_r is None:
            self._transplant(node, node_l, version)
        else:
            tmp = self._successor(node, version) # tmp has at most one child on its right
            if tmp is not node_r:
                self._transplant(tmp, tmp.get("right", version), version)
                tmp.set("right", node_r, version)
                tmp.get("right", version).set("parent", tmp, version)
            self._transplant(node, tmp, version)
            tmp.set("left", node_l, version)
            tmp.get("left", version).set("parent", tmp, version)

    def _find_min(self, node, version):
        while node.get("left", version):
            node = node.get("left", version)
        return node

    def _successor(self, node, version):
        # if node has a right child
        if node and node.get("right", version):
            return self._find_min(node.get("right", version), version)
        
        # if node has no right child
        parent = node.get("parent", version)
        while parent and parent.get("right", version) == node:
            node = parent 
        return node.get("parent", version)

    def _transplant(self, old, node, version):
        old_parent = old.get("parent", version)
        if not old_parent:
            self.roots.append(node)
        elif old == old_parent.get("left", version):
            old_parent.set("left", node, version)
        else:
            old_parent.set("right", node, version)
        if node:
            node.set("parent", old_parent, version)

    def inorder(self, version):
        result = []
        root = self.root.next.search_le(version)
        if root:
            root = root.key
            self._inorder(root, result, version)
            return result
        else:
            return result

    def _inorder(self, node, result, version):
        if not node:
            return
        self._inorder(node.get("left", version).value, result, version)
        result.append(node.key)
        self._inorder(node.get("right", version).value, result, version)


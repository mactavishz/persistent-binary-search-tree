from bst import BinarySearchTree as Bst
from collections import namedtuple

Record = namedtuple('VField', ('field', 'value', 'version'))

class FatNode:
    def __init__(self, key, version):
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
        self._vleft = Bst(self.key_fn)
        self._vright = Bst(self.key_fn)
        self._vparent = Bst(self.key_fn)

    def __str__(self):
        return f"Node({self.key})"

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

    def __setitem__(self, attr, new_val):
        match attr:
            case "left":
                self.left = new_val
            case "right":
                self.right = new_val
            case "parent":
                self.parent = new_val

    def get(self, attr, version):
        if version == self.version:
            return self[attr]
        elif version < self.version:
            return None
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
                # the version number is smaller that the smallest version in the records
                # but bigger that the node's version
                return self[attr]
            else:
                return record.key.value

    def set(self, attr, new_val, version):
        if version == self.version:
            self[attr] = new_val
        elif version < self.version:
            return
        else:
            match attr:
                case "left":
                    self._vleft.insert(Record("left", new_val, version))
                case "right":
                    self._vright.insert(Record("right", new_val, version))
                case "parent":
                    self._vparent.insert(Record("parent", new_val, version))
 
class PartialPersistentBst:
    def __init__(self):
        self.roots = []

    def get_latest_version(self):
        return len(self.roots) - 1
 
    def insert(self, key):
        if len(self.roots) == 0:
            self.roots.append(FatNode(key, 0))
        else:
            version = self.get_latest_version() + 1
            self.roots.append(self.roots[-1])
            self._insert(FatNode(key, version), version)
 
    def _insert(self, node, version):
        root = self.roots[version]
        parent = None
        while root:
            parent = root
            if node.key < root.key:
                root = root.get("left", version)
            elif node.key > root.key:
                root = root.get("right", version)
            else:
                # print("Key already exists in the tree.")
                return

        node.parent = parent
        assert parent is not None
        if node.key < parent.key:
            parent.set("left", node, version)
        else:
            parent.set("right", node, version)
 
    def search(self, key, version):
        if version < 0 or self.get_latest_version() == -1:
            return None
        else:
            return self._search(key, version)
 
    def _search(self, key, version):
        version = min(self.get_latest_version(), version)
        root = self.roots[version]
        while root:
            if key < root.key:
                root = root.get("left", version)
            elif key > root.key:
                root = root.get("right", version)
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
        if node:
            node.set("parent", old_parent, version)
        if not old_parent:
            self.roots.append(node)
        elif old == old_parent.get("left", version):
            old_parent.set("left", node, version)
        else:
            old_parent.set("right", node, version)

    def inorder(self, version):
        result = []
        version = min(version, self.get_latest_version())
        if version < 0:
            return result
        else:
            self._inorder(self.roots[version], result, version)
            return result

    def _inorder(self, node, result, version):
        if not node:
            return
        self._inorder(node.get("left", version), result, version)
        result.append(node.key)
        self._inorder(node.get("right", version), result, version)


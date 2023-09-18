from .bst import Bst
from .mod_record import ModRecord


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
        self._vleft = Bst(FatNode.key)
        self._vright = Bst(FatNode.key)
        self._vparent = Bst(FatNode.key)

    @staticmethod
    def key(t: ModRecord):
        return t.version

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
                # if we can not find a suitable version of record
                # that is less or equal than the given version
                # then we return the latest version of the record
                return self.get(attr, self.version)
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
                    self._vleft.insert(
                        ModRecord("left", new_val, version), overwrite=True
                    )
                case "right":
                    self._vright.insert(
                        ModRecord("right", new_val, version), overwrite=True
                    )
                case "parent":
                    self._vparent.insert(
                        ModRecord("parent", new_val, version), overwrite=True
                    )


class PartialPersistentBst:
    def __init__(self):
        self.roots = []

    def get_latest_version(self):
        return len(self.roots) - 1

    def insert(self, key):
        nodes = []
        version = None
        # handle the case where we insert a list of nodes
        if type(key) is list:
            nodes = key
        else:
            nodes = [key]
        if len(self.roots) == 0:
            version = 0
            self.roots.append(FatNode(nodes[0], version))
            nodes = nodes[1:]
        else:
            version = self.get_latest_version() + 1
            last_root = self.roots[-1]
            # if the latest version gives us an empty tree
            # we need to create a new root node
            if last_root is None:
                self.roots.append(FatNode(nodes[0], version))
                nodes = nodes[1:]
            else:
                self.roots.append(last_root)
        # insert the rest of the nodes
        for k in nodes:
            self._insert(FatNode(k, version), version)

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

    def search(self, key, version=None):
        if version is None:
            version = self.get_latest_version()
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
        nodes = []
        version = None
        # handle the case where we delete a list of nodes
        if type(key) is list:
            nodes = key
        else:
            nodes = [key]
        if len(self.roots) == 0 or key is None or len(nodes) == 0:
            return
        else:
            version = self.get_latest_version() + 1
            for k in nodes:
                node = self.search(k, version)
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
            # tmp has at most one child on its right
            tmp = self._successor(node, version)
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
            if version != self.get_latest_version():
                self.roots.append(node)
            else:
                self.roots[-1] = node
        elif old == old_parent.get("left", version):
            old_parent.set("left", node, version)
        else:
            old_parent.set("right", node, version)
        if node:
            node.set("parent", old_parent, version)

    def inorder(self, version=None):
        result = []
        if version is not None:
            version = min(version, self.get_latest_version())
        else:
            version = self.get_latest_version()
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

from typing import Optional
from collections import namedtuple

Record = namedtuple('VField', ('field', 'value', 'version'))


class PNode:
    def __init__(self, tree, key, version):
        """
        We use the following notations for a persistent node x:
        d = 2, p = 1, e = 2
        d denotes the number of original pointers in node x,
        p denotes the number of predecessor pointers in node x,
        e is a chosen constant for the number of stored modifications in node x
        """
        self.key = key
        self.tree: PartialPersistentBst = tree
        self.version: int = version
        self.left: Optional[PNode] = None
        self.right: Optional[PNode] = None
        # the parent pointer is essentially the back pointer to its predecessor
        self.parent: Optional[PNode] = None
        self.mods: list[Record | None] = [None, None]
        self.copy = None

    def __str__(self):
        return f"PNode(key: {self.key}), version: {self.version}"

    def next_mod(self, attr, version):
        if self.mods[0] is None and self.mods[1] is None:
            return 0

        mod1 = self.mods[0]
        mod2 = self.mods[1]

        if mod1 and mod1.field == attr and mod1.version == version:
            return 0

        if mod2 is None:
            return 1
        else:
            if mod2.field == attr and mod2.version == version:
                return 1
            else:
                return -1

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
            record = self.get_mod(attr, version)
            if record is None:
                # if we can not find a suitable version of record that is less or equal than the given version
                # then we return the latest version of the record
                return self.get(attr, self.version)
            else:
                node = record.value
                while node and node.copy and node.copy.version <= version:
                    node = node.copy
                return node

    def set(self, attr, new_val, version):
        # get the latest version of the node
        # we always update on the latest version of the node
        new_val = PNode.get_live_node(new_val)
        if version == self.version:
            self[attr] = new_val
            return
        elif version < self.version:
            return
        else:
            # if there is a copy node, we update the copy node
            # since copy node always has a newer version than the node itself
            if self.copy:
                self.copy.set(attr, new_val, version)
                return
            # if there's no copy node, we first check if there's still available space for new mods
            i = self.next_mod(attr, version)
            if i != -1:  # if there's still available mods
                self.mods[i] = Record(attr, new_val, version)
            else:  # if there's no available space for new mods, we create a new node
                new_node = PNode(self.tree, self.key, version)
                new_node.left = self.left
                new_node.right = self.right
                new_node.parent = self.parent
                # apply all changes stored in mods to the new node in its latest version
                for mod in self.mods:
                    if mod:
                        new_node.set(mod.field, mod.value, version)
                new_node.set(attr, new_val, version)
                # update the copy pointer in the old node
                self.copy = new_node
                # update back pointers in the node's children (in latest version)
                left = new_node.left
                right = new_node.right
                if left:
                    left = PNode.get_live_node(left)
                    left.parent = new_node
                if right:
                    right = PNode.get_live_node(right)
                    right.parent = new_node
                # add the new copy node to the update set
                self.tree.update_sets.append(new_node)
                return

    def get_mod(self, attr, version):
        mod_1 = self.mods[0]
        mod_2 = self.mods[1]
        record = None
        if mod_1:
            if mod_1.field == attr and mod_1.version <= version:
                record = mod_1
        if mod_2:
            if mod_2.field == attr and mod_2.version <= version:
                if record and record.version > mod_2.version:
                    record = mod_1
                else:
                    record = mod_2
        return record

    @staticmethod
    def get_live_node(node):
        while node and node.copy:
            node = node.copy
        return node


class PartialPersistentBst:
    key_fn = lambda x: x
    compare_fn = lambda x, y: x - y

    def __init__(self, key_fn=None, compare_fn=None):
        self.roots = []
        self.update_sets = []
        self.key_fn = key_fn if key_fn else PartialPersistentBst.key_fn
        self.compare_fn = compare_fn if compare_fn else PartialPersistentBst.compare_fn 

    def get_latest_version(self):
        return len(self.roots) - 1

    def update_pointers(self):
        while len(self.update_sets) > 0:
            node = self.update_sets.pop()
            version = node.version
            parent = node.parent
            # if node is the root of the tree
            # we need to update the root pointer in the access array
            if parent is None:
                if node.tree.get_latest_version() == version:
                    node.tree.roots[version] = node
                else:
                    node.tree.roots.append(node)
                continue
            parent = PNode.get_live_node(parent)
            parent_l = PNode.get_live_node(parent.get("left", version))
            if parent_l == node:
                parent.set("left", node, version)
            else:
                parent.set("right", node, version)

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
            self.roots.append(PNode(self, nodes[0], version))
            nodes = nodes[1:]
        else:
            version = self.get_latest_version() + 1
            last_root = self.roots[-1]
            # if the latest version gives us an empty tree
            # we need to create a new root node
            if last_root is None:
                self.roots.append(PNode(self, nodes[0], version))
                nodes = nodes[1:]
            else:
                self.roots.append(last_root)
        # insert the rest of the nodes
        for k in nodes:
            self._insert(PNode(self, k, version), version)
            self.update_pointers()

    def _insert(self, node, version):
        root = self.roots[version]
        parent = None
        while root:
            parent = root
            if self.compare_fn(self.key_fn(node.key), self.key_fn(root.key)) < 0:
                root = root.get("left", version)
            elif self.compare_fn(self.key_fn(node.key), self.key_fn(root.key)) > 0:
                root = root.get("right", version)
            else:
                # print("Key already exists in the tree.")
                return

        node.parent = parent
        assert parent is not None
        if self.compare_fn(self.key_fn(node.key), self.key_fn(parent.key)) < 0:
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
            if self.compare_fn(self.key_fn(key), self.key_fn(root.key)) < 0:
                root = root.get("left", version)
            elif self.compare_fn(self.key_fn(key), self.key_fn(root.key)) > 0:
                root = root.get("right", version)
            else:
                return root
        return None

    def search_gt(self, key, version):
        if version is None:
            version = self.get_latest_version()
        if version < 0 or self.get_latest_version() == -1:
            return None
        else:
            return self._search_gt(key, version)

    def _search_gt(self, key, version):
        version = min(self.get_latest_version(), version)
        root = self.roots[version]
        while root:
            if self.compare_fn(key, self.key_fn(root.key)) > 0:
                root = root.get("right", version)
            elif self.compare_fn(key, self.key_fn(root.key)) < 0:
                if root.left and self.compare_fn(key, self.key_fn(root.left.key)) < 0:
                    root = root.get("left", version)
                else:
                    return root
            else:
                parent = root.get("parent", version)
                if parent and self.compare_fn(key, self.key_fn(parent.key)) < 0:
                    return parent
                else:
                    return root.get("right", version)
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
                    self.update_pointers()

    def _delete(self, node, version):
        node_l = node.get("left", version)
        node_r = node.get("right", version)

        if node_l is None:
            self._transplant(node, node_r, version)
        elif node_r is None:
            self._transplant(node, node_l, version)
        else:
            tmp = self._successor(node, version)  # tmp has at most one child on its right
            if tmp is not node_r:
                tmp_r = tmp.get("right", version)
                self._transplant(tmp, tmp_r, version)
                # node might be updated during the transplant and has potentially a new copy
                # (if it does not have enough space to store the modification)
                node = PNode.get_live_node(node)
                tmp.set("right", node.get("right", version), version)
                tmp = PNode.get_live_node(tmp)
                tmp.get("right", version).parent = tmp
            self._transplant(node, tmp, version)
            node = PNode.get_live_node(node)
            tmp.set("left", node.get("left", version), version)
            tmp = PNode.get_live_node(tmp)
            tmp.get("left", version).parent = tmp

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
        old_parent = old.parent
        if not old_parent:
            if version != self.get_latest_version():
                self.roots.append(node)
            else:
                self.roots[-1] = node
        else:
            old_parent_l = old_parent.get("left", version)
            if old == old_parent_l:
                old_parent.set("left", node, version)
            else:
                old_parent.set("right", node, version)
        if node:
            node.parent = PNode.get_live_node(old_parent)

    def inorder(self, version=None, extract_key=True):
        result = []
        if version is not None:
            version = min(version, self.get_latest_version())
        else:
            version = self.get_latest_version()
        if version < 0:
            return result
        else:
            self._inorder(self.roots[version], result, version, extract_key)
            return result

    def _inorder(self, node, result, version, extract_key):
        if not node:
            return
        self._inorder(node.get("left", version), result, version, extract_key)
        result.append(self.key_fn(node.key) if extract_key else node)
        self._inorder(node.get("right", version), result, version, extract_key)

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
        return f"Node({self.key}), Version: {self.version}"

    def next_mod(self):
        if self.mods[0] == self.mods[1] == None:
            return 0
        elif self.mods[0] is not None and self.mods[1] is None:
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
        while new_val and new_val.copy:
            new_val = new_val.copy
        if version == self.version:
            self[attr] = new_val
            return
        elif version < self.version:
            return
        else:
            if self.copy:
                return self.copy.set(attr, new_val, version)
            # if there's no copy node, we first check if there's still available space for new mods
            i = self.next_mod()
            if i != -1:  # if there's still available mods
                self.mods[i] = Record(attr, new_val, version)
            else:   # if there's no available space for new mods, we create a new node
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
                    while left.copy is not None:
                        left = left.copy
                    left.parent = new_node
                if right:
                    while right.copy is not None:
                        right = right.copy
                    right.parent = new_node
                # add the new copy node to the update set
                self.tree.update_sets.append(new_node)
                # update pointers
                # parent: Optional[PNode] = new_node.parent
                # if parent:
                #     if parent.get("left", version) == self:
                #         parent.set("left", new_node, version)
                #     else:
                #         parent.set("right", new_node, version)
                # else:
                #     # if the old node is the root node
                #     if self.tree.get_latest_version() == version:
                #         self.tree.roots[version] = new_node
                #     else:
                #         self.tree.roots.append(new_node)
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


class PartialPersistentBst:
    def __init__(self):
        self.roots = []
        self.update_sets = []

    def get_latest_version(self):
        return len(self.roots) - 1

    def update_pointers(self):
        while len(self.update_sets) > 0:
            node = self.update_sets.pop()
            parent = node.parent
            # node is root node
            if parent is None:
                if node.tree.get_latest_version() == node.version:
                    node.tree.roots[node.version] = node
                else:
                    node.tree.roots.append(node)
                continue
            while parent and parent.copy:
                parent = parent.copy
            parent_l = parent.get("left", node.version)
            while parent_l and parent_l.copy:
                parent_l = parent_l.copy
            if parent_l == node:
                parent.set("left", node, node.version)
            else:
                parent.set("right", node, node.version)

    def insert(self, key):
        if len(self.roots) == 0:
            self.roots.append(PNode(self, key, 0))
        else:
            version = self.get_latest_version() + 1
            last_root = self.roots[-1]
            # if the latest version gives us an empty tree
            # we need to create a new root node
            if last_root is None:
                self.roots.append(PNode(self, key, version))
            else:
                self.roots.append(last_root)
                self._insert(PNode(self, key, version), version)
            self.update_pointers()

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
                while node and node.copy:
                    node = node.copy
                tmp.set("right", node.get("right", version), version)
                while tmp and tmp.copy:
                    tmp = tmp.copy
                tmp.get("right", version).parent = tmp
            self._transplant(node, tmp, version)
            while node and node.copy:
                node = node.copy
            tmp.set("left", node.get("left", version), version)
            while tmp and tmp.copy:
                tmp = tmp.copy
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
            self.roots.append(node)
        else:
            old_parent_l = old_parent.get("left", version)
            if old == old_parent_l:
                old_parent.set("left", node, version)
            else:
                old_parent.set("right", node, version)
        if node:
            while old_parent and old_parent.copy:
                old_parent = old_parent.copy
            node.parent = old_parent

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

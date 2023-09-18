from .bst import Bst
from copy import deepcopy


class PartialPersistentBst:
    def __init__(self):
        self.roots = []

    def get_latest_version(self):
        return len(self.roots) - 1

    def insert(self, key):
        nodes = []
        # handle the case where we insert a list of nodes
        if type(key) is list:
            nodes = key
        else:
            nodes = [key]
        if len(self.roots) == 0:
            self.roots.append(Bst())
            self.roots[0].insert(nodes[0])
            nodes = nodes[1:]
        else:
            self.roots.append(deepcopy(self.roots[-1]))

        # insert the rest of the nodes
        root = self.roots[-1]
        for k in nodes:
            root.insert(k)

    def search(self, key, version=None):
        if version is None:
            version = self.get_latest_version()
        if version < 0 or self.get_latest_version() == -1:
            return None
        else:
            version = min(self.get_latest_version(), version)
            root = self.roots[version]
            return root.search(key)

    def delete(self, key):
        nodes = []
        # handle the case where we delete a list of nodes
        if type(key) is list:
            nodes = key
        else:
            nodes = [key]
        if len(self.roots) == 0 or key is None or len(nodes) == 0:
            return
        else:
            new_root = deepcopy(self.roots[-1])
            self.roots.append(new_root)
            for k in nodes:
                new_root.delete(k)

    def inorder(self, version=None):
        if version is not None:
            version = min(version, self.get_latest_version())
        else:
            version = self.get_latest_version()
        if version < 0:
            return []
        else:
            root = self.roots[version]
            return root.inorder()

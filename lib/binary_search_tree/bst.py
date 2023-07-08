class BstNode:
    def __init__(self, key):
        self.left = None
        self.right = None
        self.parent = None
        self.key = key

    def __str__(self):
        return f"BstNode({self.key})"
 
class BinarySearchTree:
    def __init__(self, key_fn=None, compare_fn=None):
        self.root = None
        self.key_fn = key_fn if key_fn else lambda x: x
        self.compare_fn = compare_fn if compare_fn else lambda x, y: x - y
 
    def insert(self, key, overwrite=False):
        if not self.root:
            self.root = BstNode(key)
        else:
            self._insert(BstNode(key), overwrite=overwrite)
 
    def _insert(self, node, overwrite=False):
        root, parent = self.root, None 
        while root:
            parent = root
            if self.compare_fn(self.key_fn(node.key), self.key_fn(root.key)) < 0:
                root = root.left
            elif self.compare_fn(self.key_fn(node.key), self.key_fn(root.key)) > 0:
                root = root.right
            else:
                if overwrite:
                    root.key = node.key
                # print(f"Key: {root.key} already exists in the tree.")
                return

        node.parent = parent
        assert parent is not None
        if self.compare_fn(self.key_fn(node.key), self.key_fn(parent.key)) < 0:
            parent.left = node
        else:
            parent.right = node
 
    def search(self, key):
        if not self.root:
            return None
        else:
            return self._search(key, self.root)
 
    def _search(self, key, node):
        while node:
            if self.compare_fn(key, self.key_fn(node.key)) < 0:
                node = node.left
            elif self.compare_fn(key, self.key_fn(node.key)) > 0:
                node = node.right
            else:
                return node
        return None
 
    def search_le(self, key):
        if not self.root:
            return None
        else:
            return self._search_le(key, self.root)

    def _search_le(self, key, node):
        result = self.search(key)
        if result:
            return result
        while node:
            if self.compare_fn(key, self.key_fn(node.key)) < 0:
                node = node.left
            elif self.compare_fn(key, self.key_fn(node.key)) > 0:
                if node.right and self.compare_fn(key, self.key_fn(node.right.key)) > 0:
                    node = node.right
                else:
                    return node

    def search_gt(self, key):
        if not self.root:
            return None
        else:
            return self._search_gt(key, self.root)

    def _search_gt(self, key, node):
        while node:
            if self.compare_fn(key, self.key_fn(node.key)) > 0:
                node = node.right
            elif self.compare_fn(key, self.key_fn(node.key)) < 0:
                if node.left and self.compare_fn(key, self.key_fn(node.left.key)) < 0:
                    node = node.left
                else:
                    return node
            else:
                if node.parent and self.compare_fn(key, self.key_fn(node.parent.key)) < 0:
                    return node.parent
                else:
                    return node.right
        return None

    def delete(self, key):
        if not self.root:
            return
        else:
            node = self.search(key) 
            if node:
                self._delete(node)
 
    def _delete(self, node):
        if node.left is None:
            self._transplant(node, node.right)
        elif node.right is None:
            self._transplant(node, node.left)
        else:
            tmp = self._successor(node) # tmp has at most one child on its right
            if tmp is not node.right:
                self._transplant(tmp, tmp.right)
                tmp.right = node.right
                tmp.right.parent = tmp
            self._transplant(node, tmp)
            tmp.left = node.left
            tmp.left.parent = tmp

    def _successor(self, node):
        # if node has a right child
        if node and node.right:
            return self._find_min(node.right)
        
        # if node has no right child
        while node.parent and node.parent.right == node:
            node = node.parent
        return node.parent

    def _find_min(self, node):
        while node.left:
            node = node.left
        return node

    def _transplant(self, old, node):
        if not old.parent:
            self.root = node
        elif old == old.parent.left:
            old.parent.left = node
        else:
            old.parent.right = node

        if node:
            node.parent = old.parent

    def inorder(self):
        result = []
        if self.root is None:
            return result
        else:
            self._inorder(self.root, result)
            return result

    def _inorder(self, node, result):
        if node is None:
            return
        self._inorder(node.left, result)
        result.append(self.key_fn(node.key))
        self._inorder(node.right, result)


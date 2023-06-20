class BstNode:
    def __init__(self, key):
        self.left = None
        self.right = None
        self.parent = None
        self.key = key

    def __str__(self):
        return f"Node({self.key})"
 
class BinarySearchTree:
    def __init__(self, key_fn=None):
        self.root = None
        self.key_fn = key_fn if key_fn else lambda x: x
 
    def insert(self, key):
        if not self.root:
            self.root = BstNode(key)
        else:
            self._insert(BstNode(key))
 
    def _insert(self, node):
        root, parent = self.root, None 
        while root:
            parent = root
            if self.key_fn(node.key) < self.key_fn(root.key):
                root = root.left
            elif self.key_fn(node.key) > self.key_fn(root.key):
                root = root.right
            else:
                # print("Key already exists in the tree.")
                return

        node.parent = parent
        assert parent is not None
        if self.key_fn(node.key) < self.key_fn(parent.key):
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
            if key < self.key_fn(node.key):
                node = node.left
            elif key > self.key_fn(node.key):
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
        while node:
            if key < self.key_fn(node.key):
                node = node.left
            elif key > self.key_fn(node.key):
                if node.right and key >= self.key_fn(node.right.key):
                    node = node.right
                else:
                    return node
            else:
                return node
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


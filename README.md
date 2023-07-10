# Persistent Binary Search Tree 

Persistent binary search tree implementation in Python. This is an example of [persistent data structure](https://en.wikipedia.org/wiki/Persistent_data_structure). The implementation is based on the algorithm from [Sleator, Tarjan et al.](https://www.cs.cmu.edu/~sleator/papers/making-data-structures-persistent.pdf).

Alternatively, you can check out these [slides](https://cs.au.dk/~gerth/aa15/slides/persistent.pdf) for an overview.

With the persistent data structure, you can access the older version of the data structure. This is useful in many scenarios. Literally, you can go back in time![^1]

<div style="display: flex; justify-content: center; margin: 1em 0">
    <img 
        src="./Back-to-the-future-logo.svg"
        alt="Back to the future logo"
        width="65%" />
</div>

<!-- ![Back to the future logo](./Back-to-the-future-logo.svg)[^1] -->

## Prerequisites

- Python 3.10 or higher.

## Getting Started

### Installation

The package is currently not available on PyPI. You can clone the repo from GitHub:

```bash
# via https
git clone https://github.com/mactavishz/persistent-binary-search-tree.git

# via ssh
git clone git@github.com:mactavishz/persistent-binary-search-tree.git
```

### Usage

Suppose you cloned the repo under you project root directory with the name `pbst`.

### Binary Search Tree

The _normal_ binary search tree is implemented in the `lib.bst` module. The `Bst` class is the main class for the binary search tree. It has the following methods:

```python
from pbst.lib.bst import (
    Bst,
    BstNode
)
```

- `insert(key)`: insert a new node with the given key and value into the tree.
- `delete(key)`: delete the node with the given key from the tree.
- `search(key)`: search the node with the given key in the tree.
- `inorder(extract_key)`: traverse the tree in **inorder**. The `extract_key` flag indicates whether to extract the key from the node.
- `search_gt(key)`: search the node with the smallest key that is greater than the given key.
- `search_le(key)`: search the node with the largest key that is less than or equal to the given key.

### Partial Persistent Binary Search Tree

Partial Persistence is a weaker form of persistence. It allows us to access the older version of the data structure but not to modify it. **You can only update the data structure based on the most recent version.**

The partial persistent binary search tree is implemented in the `lib.pp_fatnode_bst` and the `lib.pp_path_copying_bst` module. Those are two different implementations but provide the same interfaces.

#### Using Fat Node Implementation

```python
from pbst.lib.pp_fatnode_bst import (
    PartialPersistentBst as PPFatNodeBst,
    FatNode as PPFatNode
)
```

#### Using Path Copying Implementation

```python
from pbst.lib.pp_path_copying_bst import (
    PartialPersistentBst as PPPathCopyingBst,
    PNode as PPPathCopyingNode
)
```

The partial persistent binary search tree has the following methods:

- `insert(keys)`: insert a new node or multiple nodes with the given key and value into the tree.
- `delete(keys)`: delete a node or multiple nodes with the given key(s) from the tree.
- `search(key, version)`: search the node with the given key in the tree at the given version.
- `inorder(version)`: traverse the tree in **inorder** at the given version.

#### Example

```python
# You can use the fat node variant to achieve the same result.
bst = PPPathCopyingBst() # version -1
bst.insert(4) # version 0
bst.insert(1) # version 1
bst.insert(3) # version 2
bst.insert(5) # version 3
bst.delete(3) # version 4
bst.delete(1) # version 5
assert bst.search(1, 0) is None
assert bst.search(1, 1).key == 1
assert bst.inorder(5) == [4, 5]
```

## References

[^1]: By back to the future - http://www.seeklogo.com/files/B/Back_to_the_Future-vector-logo-E8A05606FB-seeklogo.com.zip, Public Domain, https://commons.wikimedia.org/w/index.php?curid=53889429

# Persistent Binary Search Tree 

Persistent binary search tree implementation in Python. This is an example of [persistent data structure](https://en.wikipedia.org/wiki/Persistent_data_structure). The implementation is based on the algorithm from [Sleator, Tarjan et al.](https://www.cs.cmu.edu/~sleator/papers/making-data-structures-persistent.pdf).

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

- `insert(key, value)`: insert a new node with the given key and value into the tree.
- `delete(key)`: delete the node with the given key from the tree.
- `search(key)`: search the node with the given key in the tree.
- `inorder(extract_key)`: traverse the tree in **inorder**. The `extract_key` flag indicates whether to extract the key from the node.
- `search_gt(key)`: search the node with the smallest key that is greater than the given key.
- `search_le(key)`: search the node with the largest key that is less than or equal to the given key.

### Partial Persistent Binary Search Tree

The partial persistent binary search tree is implemented in the `lib.pp_fatnode_bst` and the `lib.pp_path_copying_bst` module. Those are two different implementations but provide the same interfaces.

#### Fat Node

```python
from pbst.lib.pp_fatnode_bst import (
    PartialPersistentBst as PPFatNodeBst,
    FatNode as PPFatNode
)
```

#### Path Copying

```python
from pbst.lib.pp_path_copying_bst import (
    PartialPersistentBst as PPPathCopyingBst,
    PNode as PPPathCopyingNode
)
```

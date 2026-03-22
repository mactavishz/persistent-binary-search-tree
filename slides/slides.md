---
theme: academic
background: ./images/cover.jpg
class: text-center
highlighter: shiki
lineNumbers: true
drawings:
  persist: false
transition: fade-out
title: Bachelor Thesis Defence - Chao Zhan
mdc: true
---

# Bachelor Thesis Defence

Freie Universität Berlin <br/> Department of Mathematics and Computer Science

### Chao Zhan


<div class="abs-br m-6 flex gap-2">
  <a href="https://github.com/slidevjs/slidev" target="_blank" alt="GitHub"
    class="text-xl icon-btn opacity-50 !border-none !hover:text-white">
    <carbon-logo-github />
  </a>
</div>


<!--
Good afternoon everyone, welcome to my bachelor thesis defence. My name is Chao Zhan. Before I start, I would like to thank my supervisor Professor Mulzer for his guidance and support along the way and Professor Kozma for being my second reviewer. 
-->

---
layout: default
---

# Main Topics of the Thesis

- Persistence in data structures
- Mechanisms to achieve persistence
- Efficiency of different mechanisms
- Implementation of a persistent data structure in Python (binary search tree)
- Evaluation of the mechanisms
- Applications of persistent data structures

<!--
My thesis is about persistent data structures, especially, how can we achieve persistence in data structures, how efficient are the mechanisms. In addition, I have implemented a persistent binary search tree in Python using different techniques, and I have evaluated the efficiency of the implementations. Also, I have applied the persistent binary search tree to solve a classic problem in computational geometry.
-->

---
layout: default
---

# What is Persistence?

<div class="container flex mt-5 justify-center align-center">
    <div class="mr-5" v-click>
      <p>Ephemeral data structure:</p>
      <img src="/images/ephemeral-data-structure.png" class="block w-sm"/>
    </div>
    <div v-click>
      <p>Persistent data structure:</p>
      <img src="/images/persistent-data-structure.png" class="block w-sm"/>
    </div>
</div>

<!--
So, what is persistence? The majority of data structures are ephemeral. That means, when we update the data structure, the old version is gone. We don't know what the old version looks like. In contrast, persistent data structures allow us to access the old versions of the data structure. That is kind of like a time machine.
-->

---
layout: default
---

# Partial Persistence

Query on any version, update on the latest version

<div class="container flex justify-center mt-20">
  <img src="/images/partial-persistence.png" class="block w-sm"/>
</div>

<!--
There are many different types of persistence. We only concern about two of them in this thesis. The simplest one is partial persistence. We can query on any version, but we can only update on the latest versions. Therefore, we have a nice natural linear ordering of the versions.
-->

---
layout: default
---

# Full Persistence

Update on any version, query on any version

<div class="container flex justify-center mt-10">
  <img src="/images/full-persistence.png" class="block w-xs"/>
</div>


<!-- --- -->
<!-- layout: default -->
<!-- --- -->
<!---->
<!-- # Confluent Persistence -->
<!---->
<!-- Full persistence + merging -->
<!---->
<!-- <div class="container flex justify-center mt-20"> -->
<!--   <img src="/images/confluent-persistence.png" class="block w-xs"/> -->
<!-- </div> -->
<!---->
<!-- --- -->
<!-- layout: default -->
<!-- --- -->
<!---->
<!-- # Functional Persistence -->
<!---->
<!-- Immutability is the key! -->
<!---->
<!-- ```haskell -->
<!-- (++) :: [a] -> [a] -> [a] -->
<!-- []     ++ ys  = ys -->
<!-- (x:xs) ++ ys  = x : (xs ++ ys) -->
<!-- ``` -->
<!---->
<!-- <div class="container flex justify-center mt-10"> -->
<!--   <img src="/images/functional-persistence.png" class="block w-xs"/> -->
<!-- </div> -->

<!--
The other one is full persistence. Unlike partial persistence, we can update on any version. Therefore, we don't have a linear ordering of the versions anymore.  Instead, we have a tree-like structure of the versions.
-->

---
layout: default
---

# How to achieve partial persistence generally?


### Methods

- Naive Method
- Fat Node Method (Driscoll et al. 1986)
- Node-copying Method (Driscoll et al. 1986)

### Requirements

The data structure must be a **pointer-based** data structure.

**Using binary search tree as an example.**

<!--
Since we mainly focus on the partial-persistence. We are going to talk about how to achieve partial persistence in general. There are three methods that we are going to talk about. The first one is the naive method. The second one is the fat node method. The third one is the node-copying method. The last two methods along with the concept of persistence were formally discussed for the first time in 1986's paper by Driscoll and the others called "Making data structures persistent". 

In addition, the data structure must be a pointer-based data structure such as linked-lists, trees, stacks, queues etc. These methods can be applied to any pointer-based data structure. And, we are going to use binary search tree as an example.
-->

---
layout: default
---

# The Naive Method

Copy the entire data structure on every update.

<div class="container flex justify-center mt-5">
  <img src="/images/pp-naive.png" class="block w-1/3"/>
</div>

<!--
Our first idea is fairly naive and straightforward. We can just copy the entire data structure on every update. To access an old version in constant time, we can use an access array to store the root node of each version.
-->

---
layout: two-cols-header
---

# The Fat Node Method

Store the all field changes within the node.

::left::

<div class="container flex justify-center">
  <img src="/images/pp-fat-node.png" class="block w-md"/>
</div>

A mod is a triple: `(field-name, new-value, version)`

::right::

### Remarks

- Modifications (mods) can be stored in any data structure.
- Finding the correct mod should be efficient. (e.g. binary search tree)


<!--
The fat node method is also intuitive. So, the idea is to store all the field changes within the node itself. The field changes are called modifications or mods. We use a triple to specify the field name, the new value and the version. Every fat node can store arbitrary number of mods. These Mods are ordered by their version stamps and can be stored in any data structure. However, finding the correct mod should be efficient. For example, we can use a binary search tree to store the mods.
-->

---
layout: two-cols-header
---

# The Node-copying Method

Store only constant number of field changes within the node.

::left::

<div class="container flex justify-center">
  <img src="/images/pp-node.png" class="block w-xs"/>
</div>

::right::


### Requirements

- Have **constant number** of reverse pointers
- The number of mods to be $r \leq 2p$.

<!--
Even though the fat node method is simple and intuitive, it must be able to hold extra space capable of carrying an arbitrary number of modifications. And searching the correct mod can be a huge overhead. Thus, we have the node-copying method. The idea is to store only a constant number of field changes within the node itself. And anything else is basically similar to the fat node method.

However, we do have some extra requirements. First of all, we need to have a constant number of reverse pointers. Reverse pointers are the opposite of in-coming pointers, such as the parent pointer in binary search tree node. Secondly, the number of mods to be must be less than or equal to 2 times the number of reverse pointers. With theses constraints, we can achieve amortised constant time access and update per update step.
-->

---
layout: default
---

# The Node-copying Method - Simple Case

The node is not full: just save the field change in the available mod.

<div class="container flex justify-center mt-10">
  <img src="/images/pp-node-tree.png" class="block w-sm"/>
</div>

<!--
There two cases when we update a field in a node. The first case is that the mods are not full. We can just save the field change in the available mod. In the case of binary search tree, we have 2 mods in total, so we can store two field updates without any problem. 
-->

---
layout: default
---

# The Node-copying Method - Complicated Case

The node's mods are full.


- Copy the node
- Apply all changes in the mods of the old node to the copied node, then empty the mods
- Update the version stamp
- Update reverse pointers (in descendants)
- Update pointers (in ancestors)

<!--
What happens when the mods are full? Because we only have a constant number of mods, we have to make a copy of the node, and apply all changes in the mods to the copied node, and empty the mods. Then also need to update the version stamp in the copied node. Finally we have to fix the pointers. We have to reestablish the correspondence between the copied node and its descendants in latest version. And we also have to update the pointers in the ancestors of the copied node.
-->

---
layout: default
---

# The Node-copying Method - Example

<div class="container flex justify-center mt-10">
  <img src="/images/pp-node-copying-example.png" class="block w-full"/>
</div>

---
layout: default
---

# Time and Space Complexity

### The Fat Node Method

<br>

- $O(1)$ space overhead per update step
- $O(\log n)$ multiplicative time overhead per access/update step (using a binary search tree to store mods)

<br>

### The Node-copying Method

<br>

- $O(1)$ **amortised** time and space cost per update step (can be done in worst case)
- $O(1)$ time cost per access step

<br>

**Question: Is it really worth it?**

---
layout: default
---

# Evaluation - Execution Time

A continuous sequence of insertions, deletions, searches and traversals. 

<div class="container flex justify-center mt-5">
  <img src="/images/benchmark_normal.png" class="block w-3/4"/>
</div>

<!--
Now let's look at the evaluation of the different implementation. I have conducted a series of benchmark tests on all three implementations. The first benchmark test consists of a continuous sequence of insertions, deletions, searches and traversals. Due to the huge gap between the naive method and the other two methods, I have to use a logarithmic scale for the y-axis on the left half of the test. The naive method behaves really badly in insertion and deletion. But for searching and traversing, it is very close to the standard implementation. The fat node method has the second worst performance. The node-copying method is the best among the three.
-->

---
layout: default
---

# Evaluation - Execution Time II

Mixed operations (insert, delete, search)

<div class="container flex justify-center mt-10">
  <img src="/images/benchmark_pp_mixed.png" class="block w-full"/>
</div>

<!--
The second benchmark test consists of arbitrarily mixed calls to the search, insert, and delete methods on the partially persistent binary search tree implementation in order to simulate a real-world scenario. We continued
to use the logarithmic scale on the y-axis when testing the naive approach. As expected, the node-copying method is the best among the three. The fat node method is the second best. The naive method is the worst.
-->

---
layout: default
---

# Evaluation - Memory Usage

Garbage collection is disabled.

<div class="container flex justify-center mt-10">
  <img src="/images/benchmark_pp_memory.png" class="block w-full"/>
</div>

<!--
Besides the execution time, the memory usage is also an important factor. The third benchmark test measures the memory usage of the three implementations. We disabled the garbage collection in order to get a more accurate result. The naive method uses an enormous amount of memory. The fat node method uses the second most amount of memory. The node-copying method uses a moderate amount of memory. As usual, we use the logarithmic scale on the y-axis.
-->

---
layout: center
---

# Thank you!

---
layout: center
---

# Application - Solving the Planar Point Location Problem

- Using the slab decomposition method
- Build the slabs using a persistent binary search tree
- Locate the query point using only two binary searches
- Bang! Only $O(n)$ space cost and $O(\log n)$ query time!

## See the live demo!


---
layout: default
---

# Application - Planar Point Location

Planar point location is a problem in computational geometry.

### A Plane Graph

Euler's formula gives us: $n$ vertices and $O(n)$ edges and $O(n)$ faces.

Plane graphs are typically sparse.

<div class="container flex justify-center mt-5">
  <img src="/images/planar-graph.png" class="block w-sm"/>
</div>

---
layout: default
---

# Planar Subdivision

A planar subdivision is a plane graph where each edge only borders two different faces.

<div class="container flex justify-center mt-10">
  <img src="/images/planar-subdivision.png" class="block w-xs"/>
</div>

## The Problem

Given a planar subdivision and a query point $x$, find the face containing $x$.

---
layout: default
---

# Slab Decomposition

Vertical lines through each vertex divide the plane into slabs.

<div class="container flex justify-center">
  <img src="/images/slab-decompo.png" class="block w-xs"/>
</div>

---
layout: default
---

# Two Binary Searches

Locate the query point using only two binary searches.

<div class="container flex justify-center">
  <img src="/images/slab-two-bs.png" class="block w-1/2"/>
</div>

---
layout: default
---

# Slab Decomposition in Worst Case

$O(n)$ line segments may be cut into $O(n^2)$ fragments.

$O(n^2)$ **space cost for storing the fragments in the slabs !!!**

<br>

<div class="container flex justify-center">
  <img src="/images/slab-worst-case.png" class="block w-xs"/>
</div>


---
layout: default
---

# Build the slabs in an efficient way.

We need to save the space!

<div class="container flex justify-center">
  <img src="/images/slab-con-1.png" class="block w-1/2"/>
</div>

---
layout: default
---

## Observation

- Each segment is first inserted into some slab and then later deleted from some slab.
- The total number of edits is $O(n)$.

<div class="container flex justify-center mt-5">
  <img src="/images/slab-con-2.png" class="block w-sm"/>
</div>

**Can we only use $O(n)$ space to store the slabs?**

---
layout: default
---

# Solution: Using a Partially Persistent Binary Search Tree

- Line segments are ordered.
- Treat the slabs as different versions of one slab.
- $v_0 \dots v_n$ represents the slabs at different versions.
- $O(n)$ updates require $O(n)$ space using the node-copying method.

## Summary

- Preprocessing time: $O(n \log n)$, sort the nodes and line segments
- Space cost: $O(n)$
- Query time: $O(\log n)$ per query with 2 binary searches


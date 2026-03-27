export class TreeNode<T, K> {
  left: TreeNode<T, K> | null = null;
  right: TreeNode<T, K> | null = null;
  parent: TreeNode<T, K> | null = null;

  constructor(
    public value: T,
    public key: K
  ) {}
}

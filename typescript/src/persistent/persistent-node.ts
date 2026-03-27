import type { ModificationRecord, PersistentField } from "./modification-record.js";

export class PersistentNode<T, K> {
  private static nextNodeId = 0;

  left: PersistentNode<T, K> | null = null;
  right: PersistentNode<T, K> | null = null;
  parent: PersistentNode<T, K> | null = null;
  mods: [ModificationRecord<T, K> | null, ModificationRecord<T, K> | null] = [null, null];
  copy: PersistentNode<T, K> | null = null;
  readonly nodeId: number;
  copiedFromNodeId: number | null = null;

  constructor(
    public value: T,
    public key: K,
    public version: number
  ) {
    this.nodeId = PersistentNode.nextNodeId;
    PersistentNode.nextNodeId += 1;
  }

  cloneForVersion(version: number): PersistentNode<T, K> {
    const cloned = new PersistentNode(this.value, this.key, version);
    cloned.left = this.left;
    cloned.right = this.right;
    cloned.parent = this.parent;
    cloned.copiedFromNodeId = this.nodeId;
    return cloned;
  }

  static getLiveNode<T, K>(node: PersistentNode<T, K> | null): PersistentNode<T, K> | null {
    let current = node;
    while (current && current.copy) {
      current = current.copy;
    }
    return current;
  }

  get(field: PersistentField, version: number): PersistentNode<T, K> | null {
    if (version === this.version) {
      return this[field];
    }
    if (version < this.version) {
      return null;
    }
    const record = this.getMod(field, version);
    if (!record) {
      return this.get(field, this.version);
    }
    return record.value;
  }

  getMod(field: PersistentField, version: number): ModificationRecord<T, K> | null {
    const [mod1, mod2] = this.mods;
    let record: ModificationRecord<T, K> | null = null;
    if (mod1 && mod1.field === field && mod1.version <= version) {
      record = mod1;
    }
    if (mod2 && mod2.field === field && mod2.version <= version) {
      if (!record || mod2.version >= record.version) {
        record = mod2;
      }
    }
    return record;
  }

  getSlotIndex(field: PersistentField, version: number): number {
    const [mod1, mod2] = this.mods;
    if (!mod1 && !mod2) {
      return 0;
    }
    if (mod1 && mod1.field === field && mod1.version === version) {
      return 0;
    }
    if (!mod2) {
      return 1;
    }
    if (mod2.field === field && mod2.version === version) {
      return 1;
    }
    return -1;
  }
}

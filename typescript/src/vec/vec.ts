const EPSILON = 1e-7;

export class Vec3 {
  x: number;
  y: number;
  z: number;

  constructor(x = 0, y = 0, z = 0) {
    this.x = x;
    this.y = y;
    this.z = z;
  }

  clone(): Vec3 {
    return new Vec3(this.x, this.y, this.z);
  }

  set(x: number, y: number, z: number): this {
    this.x = x;
    this.y = y;
    this.z = z;
    return this;
  }

  setX(x: number): this {
    this.x = x;
    return this;
  }

  setY(y: number): this {
    this.y = y;
    return this;
  }

  setZ(z: number): this {
    this.z = z;
    return this;
  }

  add(other: Vec3): Vec3 {
    return new Vec3(this.x + other.x, this.y + other.y, this.z + other.z);
  }

  subtract(other: Vec3): Vec3 {
    return new Vec3(this.x - other.x, this.y - other.y, this.z - other.z);
  }

  scale(factor: number): Vec3 {
    return new Vec3(this.x * factor, this.y * factor, this.z * factor);
  }

  dot(other: Vec3): number {
    return this.x * other.x + this.y * other.y + this.z * other.z;
  }

  norm(): number {
    return Math.hypot(this.x, this.y, this.z);
  }

  normalized(): Vec3 {
    const length = this.norm();
    if (Math.abs(length) < EPSILON) {
      return this.clone();
    }
    return this.scale(1 / length);
  }

  toArray(): [number, number, number] {
    return [this.x, this.y, this.z];
  }

  equals(other: Vec3): boolean {
    return this.x === other.x && this.y === other.y && this.z === other.z;
  }

  almostEquals(other: Vec3, epsilon = EPSILON): boolean {
    return (
      Math.abs(this.x - other.x) <= epsilon &&
      Math.abs(this.y - other.y) <= epsilon &&
      Math.abs(this.z - other.z) <= epsilon
    );
  }
}

export { EPSILON as VEC3_EPSILON };

import { describe, expect, it } from "vitest";
import { VEC3_EPSILON, Vec3 } from "../src/vec/vec.js";

describe("Vec3", () => {
  it("constructs with defaults", () => {
    const v = new Vec3();
    expect(v.toArray()).toEqual([0, 0, 0]);
  });

  it("supports setters and clone independence", () => {
    const v = new Vec3(1, 2, 3);
    const c = v.clone();
    v.set(4, 5, 6).setX(7).setY(8).setZ(9);

    expect(v.toArray()).toEqual([7, 8, 9]);
    expect(c.toArray()).toEqual([1, 2, 3]);
  });

  it("supports arithmetic operations", () => {
    const a = new Vec3(2, -1, 0.5);
    const b = new Vec3(1, 3, 2);

    expect(a.add(b).toArray()).toEqual([3, 2, 2.5]);
    expect(a.subtract(b).toArray()).toEqual([1, -4, -1.5]);
    expect(a.scale(2).toArray()).toEqual([4, -2, 1]);
    expect(a.dot(b)).toBeCloseTo(0);
  });

  it("normalizes and keeps zero vectors stable", () => {
    const v = new Vec3(3, 4, 0);
    const n = v.normalized();
    expect(n.norm()).toBeCloseTo(1);

    const zero = new Vec3(0, 0, 0);
    expect(zero.normalized().equals(zero)).toBe(true);
  });

  it("supports exact and approximate equality", () => {
    const a = new Vec3(1, 2, 3);
    const b = new Vec3(1, 2, 3);
    const c = new Vec3(1 + VEC3_EPSILON / 2, 2, 3);
    expect(a.equals(b)).toBe(true);
    expect(a.equals(c)).toBe(false);
    expect(a.almostEquals(c)).toBe(true);
  });
});

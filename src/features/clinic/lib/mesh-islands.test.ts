import { describe, expect, it } from "vitest";
import { findMeshIslands } from "./mesh-islands";

describe("findMeshIslands", () => {
  it("groups a single triangle's vertices into one island", () => {
    const islands = findMeshIslands(3, [0, 1, 2]);
    expect(islands).toHaveLength(1);
    expect(islands[0].sort()).toEqual([0, 1, 2]);
  });

  it("keeps two triangles that don't share a vertex as separate islands", () => {
    const islands = findMeshIslands(6, [0, 1, 2, 3, 4, 5]);
    expect(islands).toHaveLength(2);
    const sizes = islands.map((i) => i.length).sort();
    expect(sizes).toEqual([3, 3]);
  });

  it("merges two triangles that share a vertex into one island", () => {
    // Triangle A: 0,1,2. Triangle B: 2,3,4 — shares vertex 2.
    const islands = findMeshIslands(5, [0, 1, 2, 2, 3, 4]);
    expect(islands).toHaveLength(1);
    expect(islands[0].sort()).toEqual([0, 1, 2, 3, 4]);
  });

  it("includes an unreferenced vertex as its own singleton island", () => {
    const islands = findMeshIslands(4, [0, 1, 2]); // vertex 3 unused
    expect(islands).toHaveLength(2);
    const sizes = islands.map((i) => i.length).sort();
    expect(sizes).toEqual([1, 3]);
  });

  it("finds exactly N separate islands for N disjoint triangles", () => {
    const n = 16;
    const indices: number[] = [];
    for (let i = 0; i < n; i++) {
      const base = i * 3;
      indices.push(base, base + 1, base + 2);
    }
    const islands = findMeshIslands(n * 3, indices);
    expect(islands).toHaveLength(n);
    for (const island of islands) expect(island).toHaveLength(3);
  });
});

/**
 * Groups a mesh's vertices into disconnected "islands" by flood-filling
 * shared triangle edges (union-find) — used to split the odontogram's
 * combined arch mesh (the "Teeth" GLB doesn't ship each tooth as its own
 * object) into one shape per tooth. Pure array math, no Three.js
 * dependency, so it's testable without a renderer: a mesh's geometry is
 * just its vertex count and its triangle index list.
 */
export function findMeshIslands(
  vertexCount: number,
  triangleIndices: ArrayLike<number>,
): number[][] {
  const parent = new Int32Array(vertexCount);
  for (let i = 0; i < vertexCount; i++) parent[i] = i;

  function find(x: number): number {
    while (parent[x] !== x) {
      parent[x] = parent[parent[x]];
      x = parent[x];
    }
    return x;
  }

  function union(a: number, b: number) {
    const ra = find(a);
    const rb = find(b);
    if (ra !== rb) parent[ra] = rb;
  }

  for (let i = 0; i < triangleIndices.length; i += 3) {
    union(triangleIndices[i], triangleIndices[i + 1]);
    union(triangleIndices[i + 1], triangleIndices[i + 2]);
  }

  const groups = new Map<number, number[]>();
  for (let i = 0; i < vertexCount; i++) {
    const root = find(i);
    (groups.get(root) ?? groups.set(root, []).get(root)!).push(i);
  }
  return [...groups.values()];
}

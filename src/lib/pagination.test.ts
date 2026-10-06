import { describe, expect, it } from "vitest";
import { pageCountFor, paginate } from "./pagination";

describe("pageCountFor", () => {
  it("divides evenly when the item count is a multiple of the page size", () => {
    expect(pageCountFor(40, 20)).toBe(2);
  });

  it("rounds up a partial last page", () => {
    expect(pageCountFor(41, 20)).toBe(3);
  });

  it("is 1 for an empty list, not 0", () => {
    expect(pageCountFor(0, 20)).toBe(1);
  });

  it("is 1 when everything fits on one page", () => {
    expect(pageCountFor(5, 20)).toBe(1);
  });
});

describe("paginate", () => {
  const items = Array.from({ length: 45 }, (_, i) => i + 1); // [1..45]

  it("returns the first page", () => {
    expect(paginate(items, 1, 20)).toEqual(
      Array.from({ length: 20 }, (_, i) => i + 1),
    );
  });

  it("returns a middle page", () => {
    expect(paginate(items, 2, 20)).toEqual(
      Array.from({ length: 20 }, (_, i) => i + 21),
    );
  });

  it("returns the shorter final page", () => {
    expect(paginate(items, 3, 20)).toEqual([41, 42, 43, 44, 45]);
  });

  it("returns an empty array for a page past the end", () => {
    expect(paginate(items, 4, 20)).toEqual([]);
  });
});

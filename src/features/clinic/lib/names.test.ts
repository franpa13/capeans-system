import { describe, expect, it } from "vitest";
import { fullName, splitFullName } from "@/features/clinic/lib/names";

describe("patient names", () => {
  it("joins first and last name, ignoring extra spaces", () => {
    expect(fullName(" María José ", " López ")).toBe("María José López");
    expect(fullName("Ana", "")).toBe("Ana");
  });

  it("splits a full name taking the last word as the apellido", () => {
    expect(splitFullName("María José López")).toEqual({ firstName: "María José", lastName: "López" });
    expect(splitFullName("  Ana   Gómez ")).toEqual({ firstName: "Ana", lastName: "Gómez" });
  });

  it("keeps a single word as the nombre", () => {
    expect(splitFullName("Cher")).toEqual({ firstName: "Cher", lastName: "" });
  });
});

import { describe, expect, it } from "vitest";
import { Prisma } from "@prisma/client";
import { GENERIC_ACTION_ERROR, runAction, unwrap } from "@/lib/action-result";

describe("runAction", () => {
  it("returns the value on success", async () => {
    await expect(runAction(async () => 42)).resolves.toEqual({ ok: true, data: 42 });
  });

  it("returns our own validation message instead of throwing it", async () => {
    const result = await runAction(async () => {
      throw new Error("Ya existe un insumo con ese nombre");
    });
    expect(result).toEqual({ ok: false, error: "Ya existe un insumo con ese nombre" });
  });

  it("hides a database error's internals behind a generic message", async () => {
    const result = await runAction(async () => {
      throw new Prisma.PrismaClientKnownRequestError("Unique constraint failed on (clinicId,name)", {
        code: "P2002",
        clientVersion: "6",
      });
    });
    expect(result).toEqual({ ok: false, error: GENERIC_ACTION_ERROR });
  });

  it("hides a non-Error throw behind a generic message", async () => {
    const result = await runAction(async () => {
      throw "boom";
    });
    expect(result).toEqual({ ok: false, error: GENERIC_ACTION_ERROR });
  });
});

describe("unwrap", () => {
  it("returns the data of a successful result", async () => {
    await expect(unwrap(Promise.resolve({ ok: true as const, data: "x" }))).resolves.toBe("x");
  });

  it("throws the result's message on the client, where it isn't redacted", async () => {
    await expect(
      unwrap(Promise.resolve({ ok: false as const, error: "Ya hay un turno agendado en ese horario" })),
    ).rejects.toThrow("Ya hay un turno agendado en ese horario");
  });
});

# Stock de Insumos Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let the dentist keep a catalog of consumable insumos (name, unit, price, stock quantity, low-stock threshold), restock them manually, optionally log which insumos (and how much) were used in a consultation, and see a visual low-stock warning — all in a dedicated "Stock" sidebar module, separate from Configuración.

**Architecture:** Two new tables — `Supply` (the catalog, with a single running `quantity` column, no movement ledger) and `ConsultationSupply` (a join row per insumo used in a consultation, recording `quantityUsed`). Every mutation that touches `Supply.quantity` together with `ConsultationSupply` rows (creating/editing/deleting a consultation with insumos) runs inside one Prisma transaction, so stock and usage rows can never drift apart. Restocking is a separate, simpler direct increment with no transaction needed (single row).

**Tech Stack:** Next.js 16 (App Router, Server Components + Server Actions), Prisma 6 / PostgreSQL, react-hook-form + zod (for the rest of the consultation form; the new insumos list is plain local state, not an RHF field — see Task 9), Vitest (data-layer unit tests against a real Postgres test DB), Playwright Test (E2E).

**Spec:** `docs/superpowers/specs/2026-10-14-stock-insumos-design.md`

**Deviation from the spec's Prisma sketch:** the spec's draft `Supply` model includes an `order Int @default(0)` field (copied from `ClinicOption`'s pattern). There is no reordering UI anywhere in this feature — insumos are listed alphabetically — so this plan omits `order` entirely rather than ship an inert column. If a future reorder feature needs it, it's an additive migration, same as adding any other column.

## Global Constraints

- Every read/write to `Supply` or `ConsultationSupply` goes through `src/features/clinic/data/supplies.ts` (for `Supply`) or `src/features/clinic/data/consultations.ts` (for the `ConsultationSupply` rows tied to a consultation) — no direct Prisma calls from components, actions, or pages.
- Money (`Supply.price`) is a whole peso `Int`, never `Float`/`Decimal` — same rule as every other price in this app.
- `Supply.quantity` can legitimately go negative (explicit product decision) — never clamp it to 0, never reject a usage because it would exceed available stock.
- Every mutation that changes both `Supply.quantity` and `ConsultationSupply` rows together (create/update/delete a consultation with insumos) runs inside a single `prisma.$transaction` — partial application (stock decremented but the usage row never created, or vice versa) is not acceptable.
- `quantityUsed` and the amount by which stock is restocked are both whole positive integers — reuse the existing "reject `.`/`,` and non-integers" validation pattern already used for prices and consultation amounts (see `assertValidAmounts` in `consultations.ts` and `parsePrice` in `option-list-manager.tsx`).
- The "Insumos utilizados" section in the consultation dialogs is entirely optional — a consultation with no insumos attached saves exactly as it does today, with no behavior change for anyone who ignores the new section.
- Configuración is not touched by this feature at all — the new catalog lives under its own "Stock" sidebar item.

## Review Focus

- Editing a consultation to change its insumos (add one, remove one, change a quantity) must leave `Supply.quantity` exactly where it would be if the net change had been applied directly — not double-counted, not left stale from the old list. This is the one place a bug silently corrupts a number nobody is watching in real time.
- Deleting a consultation that had insumos attached must restore their quantities before the row (and its `ConsultationSupply` children) are gone — a bug here permanently under-counts stock with no way to notice except a manual recount.
- A typed quantity (restock amount, or quantity used in a consultation) with a thousands separator or decimal (e.g. "1.000") must be rejected the same way the Precios y Cobros amount fields now are — this exact mistake was found and fixed there already; the same input shape exists here.
- Deleting an insumo that has at least one `ConsultationSupply` row must be rejected with a clear message, not a raw Prisma foreign-key constraint error.
- Two insumos with the same name in the same clinic must be rejected the same way a duplicate treatment/obra social label already is — the unique constraint exists, but the data layer needs to turn it into a friendly message before it reaches the UI as a raw Prisma error.

---

## Task 1: Schema migration — Supply and ConsultationSupply

**Files:**
- Modify: `prisma/schema.prisma`

**Interfaces:**
- Produces: `Supply` and `ConsultationSupply` Prisma Client models, consumed by every later task.

- [ ] **Step 1: Add the models**

In `prisma/schema.prisma`, add `supplyUsages` to the existing `Consultation` model's relation list (find the model and add the one line, right after the existing `amountPaid` field):

```prisma
model Consultation {
  id        String    @id @default(cuid())
  clinicId  String
  clinic    Clinic    @relation(fields: [clinicId], references: [id], onDelete: Cascade)
  patientId String?
  patient   Patient?  @relation(fields: [patientId], references: [id], onDelete: SetNull)

  date      DateTime
  treatment String
  teeth     String[] @default([])
  notes     String?

  amountCharged Int?            // monto acordado para esta visita (snapshot, no referencia viva al precio de lista)
  amountPaid    Int  @default(0) // cuánto se pagó hasta ahora

  supplyUsages ConsultationSupply[]

  @@index([clinicId])
  @@index([patientId])
}
```

Add `supplies` to the `Clinic` model's relation list:

```prisma
model Clinic {
  id         String   @id @default(cuid())
  clerkOrgId String   @unique
  name       String
  createdAt  DateTime @default(now())

  patients      Patient[]
  consultations Consultation[]
  appointments  Appointment[]
  options       ClinicOption[]
  businessHours BusinessHours[]
  supplies      Supply[]
}
```

Add the two new models at the end of the file:

```prisma
model Supply {
  id       String @id @default(cuid())
  clinicId String
  clinic   Clinic @relation(fields: [clinicId], references: [id], onDelete: Cascade)

  name       String
  unit       String  // "unidad", "caja", "ml", etc. — texto libre
  price      Int?    // costo por unidad, pesos enteros (opcional)
  quantity   Int     @default(0)  // stock actual; puede quedar negativo
  lowStockAt Int?    // umbral de aviso, en la misma unidad (opcional)

  usages ConsultationSupply[]

  @@unique([clinicId, name])
  @@index([clinicId])
}

model ConsultationSupply {
  id             String       @id @default(cuid())
  consultationId String
  consultation   Consultation @relation(fields: [consultationId], references: [id], onDelete: Cascade)
  supplyId       String
  supply         Supply       @relation(fields: [supplyId], references: [id], onDelete: Restrict)

  quantityUsed Int   // cuánto se usó en ESTA consulta

  @@index([consultationId])
  @@index([supplyId])
}
```

- [ ] **Step 2: Generate and apply the migration**

Run: `npx prisma migrate dev --name add_stock_insumos`
Expected: a new folder under `prisma/migrations/` is created, the migration applies to the dev DB, and Prisma Client regenerates with no errors. If this reports drift against the dev DB (an earlier abandoned attempt left orphaned state — this happened once already during Precios y Cobros), do **not** run `prisma migrate reset` — that wipes real data. Instead inspect `npx prisma migrate status` and reconcile by hand (recreate the migration folder to match what's already applied, then `prisma migrate resolve --applied <name>`), the same recovery used last time.

- [ ] **Step 3: Confirm nothing else broke**

Run: `npm test`
Expected: all existing tests still pass (this migration only adds two new tables; it touches no existing column).

- [ ] **Step 4: Commit**

```bash
git add prisma/schema.prisma prisma/migrations
git commit -m "feat: add Supply and ConsultationSupply tables for Stock de Insumos"
```

---

## Task 2: Stock domain logic (`stock.ts`)

**Files:**
- Create: `src/features/clinic/lib/stock.ts`
- Create: `src/features/clinic/lib/stock.test.ts`

**Interfaces:**
- Consumes: nothing (pure function, no Prisma import).
- Produces: `StockLevel` type, `isLowStock(quantity, lowStockAt)` — imported by the Stock page's UI (Task 6) and its own tests.

- [ ] **Step 1: Write the failing tests**

Create `src/features/clinic/lib/stock.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { isLowStock } from "./stock";

describe("isLowStock", () => {
  it("is 'out' when quantity is exactly 0", () => {
    expect(isLowStock(0, null)).toBe("out");
  });

  it("is 'out' when quantity is negative", () => {
    expect(isLowStock(-3, null)).toBe("out");
  });

  it("is 'ok' when quantity is positive and no threshold is set", () => {
    expect(isLowStock(50, null)).toBe("ok");
  });

  it("is 'low' when quantity is at the threshold", () => {
    expect(isLowStock(5, 5)).toBe("low");
  });

  it("is 'low' when quantity is below the threshold but still positive", () => {
    expect(isLowStock(3, 5)).toBe("low");
  });

  it("is 'ok' when quantity is above the threshold", () => {
    expect(isLowStock(10, 5)).toBe("ok");
  });

  it("is 'out', not 'low', when quantity is 0 even with a threshold set", () => {
    expect(isLowStock(0, 5)).toBe("out");
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/features/clinic/lib/stock.test.ts`
Expected: FAIL — `Cannot find module './stock'`.

- [ ] **Step 3: Implement**

Create `src/features/clinic/lib/stock.ts`:

```ts
export type StockLevel = "out" | "low" | "ok";

/** "out" takes priority over "low": zero or negative stock is always the
 * most severe state regardless of what threshold is configured, since
 * there's nothing left to use at all. */
export function isLowStock(quantity: number, lowStockAt: number | null): StockLevel {
  if (quantity <= 0) return "out";
  if (lowStockAt != null && quantity <= lowStockAt) return "low";
  return "ok";
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run src/features/clinic/lib/stock.test.ts`
Expected: PASS, all 7 tests.

- [ ] **Step 5: Commit**

```bash
git add src/features/clinic/lib/stock.ts src/features/clinic/lib/stock.test.ts
git commit -m "feat: add stock-level domain logic"
```

---

## Task 3: Supply data layer

**Files:**
- Create: `src/features/clinic/data/supplies.ts`
- Create: `src/features/clinic/data/supplies.test.ts`

**Interfaces:**
- Consumes: nothing new.
- Produces: `NewSupplyInput`, `UpdateSupplyInput`, `getSupplies`, `createSupply`, `updateSupply`, `restockSupply`, `deleteSupply` — consumed by Task 5 (actions) and Task 10 (seed).

- [ ] **Step 1: Write the failing tests**

Create `src/features/clinic/data/supplies.test.ts`:

```ts
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import { createPatient } from "@/features/clinic/data/patients";
import { createConsultation } from "@/features/clinic/data/consultations";
import {
  createSupply,
  deleteSupply,
  getSupplies,
  restockSupply,
  updateSupply,
} from "@/features/clinic/data/supplies";

let clinicA: { id: string };
let clinicB: { id: string };

beforeEach(async () => {
  clinicA = await prisma.clinic.create({
    data: { clerkOrgId: `org_a_${Date.now()}`, name: "Clínica A" },
  });
  clinicB = await prisma.clinic.create({
    data: { clerkOrgId: `org_b_${Date.now()}`, name: "Clínica B" },
  });
});

afterEach(async () => {
  await prisma.consultationSupply.deleteMany({});
  await prisma.consultation.deleteMany({});
  await prisma.patient.deleteMany({});
  await prisma.supply.deleteMany({});
  await prisma.clinic.deleteMany({});
});

describe("supplies data layer", () => {
  it("creates a supply with the given fields", async () => {
    const supply = await createSupply(clinicA.id, {
      name: "Gomillas de ortodoncia",
      unit: "unidad",
      price: 50,
      quantity: 200,
      lowStockAt: 20,
    });
    expect(supply.clinicId).toBe(clinicA.id);
    expect(supply.name).toBe("Gomillas de ortodoncia");
    expect(supply.unit).toBe("unidad");
    expect(supply.price).toBe(50);
    expect(supply.quantity).toBe(200);
    expect(supply.lowStockAt).toBe(20);
  });

  it("defaults quantity to 0 and price/lowStockAt to null when not given", async () => {
    const supply = await createSupply(clinicA.id, { name: "Anestesia", unit: "ampolla" });
    expect(supply.quantity).toBe(0);
    expect(supply.price).toBeNull();
    expect(supply.lowStockAt).toBeNull();
  });

  it("refuses an empty name", async () => {
    await expect(createSupply(clinicA.id, { name: "  ", unit: "unidad" })).rejects.toThrow(
      "El nombre no puede estar vacío",
    );
  });

  it("refuses a duplicate name within the same clinic", async () => {
    await createSupply(clinicA.id, { name: "Guantes", unit: "caja" });
    await expect(createSupply(clinicA.id, { name: "Guantes", unit: "caja" })).rejects.toThrow(
      "Ya existe un insumo con ese nombre",
    );
  });

  it("allows the same name in different clinics", async () => {
    await createSupply(clinicA.id, { name: "Guantes", unit: "caja" });
    await expect(createSupply(clinicB.id, { name: "Guantes", unit: "caja" })).resolves.toBeTruthy();
  });

  it("refuses a negative price", async () => {
    await expect(
      createSupply(clinicA.id, { name: "Composite", unit: "ml", price: -10 }),
    ).rejects.toThrow("El precio no puede ser negativo");
  });

  it("refuses a non-integer price", async () => {
    await expect(
      createSupply(clinicA.id, { name: "Composite", unit: "ml", price: 10.5 }),
    ).rejects.toThrow("El precio tiene que ser un número entero");
  });

  it("refuses a negative initial quantity", async () => {
    await expect(
      createSupply(clinicA.id, { name: "Composite", unit: "ml", quantity: -5 }),
    ).rejects.toThrow("El stock inicial no puede ser negativo");
  });

  it("refuses a negative lowStockAt", async () => {
    await expect(
      createSupply(clinicA.id, { name: "Composite", unit: "ml", lowStockAt: -1 }),
    ).rejects.toThrow("El umbral no puede ser negativo");
  });

  it("does not return a clinic A supply when queried with clinic B's id", async () => {
    await createSupply(clinicA.id, { name: "Solo A", unit: "unidad" });
    expect(await getSupplies(clinicB.id)).toHaveLength(0);
  });

  it("updates a supply's name, unit, price, and lowStockAt without touching quantity", async () => {
    const supply = await createSupply(clinicA.id, {
      name: "Guantes",
      unit: "caja",
      price: 500,
      quantity: 30,
    });
    const updated = await updateSupply(clinicA.id, supply.id, {
      name: "Guantes de nitrilo",
      unit: "caja",
      price: 600,
      lowStockAt: 5,
    });
    expect(updated.name).toBe("Guantes de nitrilo");
    expect(updated.price).toBe(600);
    expect(updated.lowStockAt).toBe(5);
    expect(updated.quantity).toBe(30);
  });

  it("refuses updating to a duplicate name within the same clinic", async () => {
    await createSupply(clinicA.id, { name: "Guantes", unit: "caja" });
    const other = await createSupply(clinicA.id, { name: "Mascarillas", unit: "caja" });
    await expect(
      updateSupply(clinicA.id, other.id, { name: "Guantes", unit: "caja" }),
    ).rejects.toThrow("Ya existe un insumo con ese nombre");
  });

  it("refuses updating an option belonging to another clinic", async () => {
    const supply = await createSupply(clinicB.id, { name: "De B", unit: "unidad" });
    await expect(
      updateSupply(clinicA.id, supply.id, { name: "Robado", unit: "unidad" }),
    ).rejects.toThrow("Supply not found for this clinic");
  });

  it("restocks by adding to the current quantity", async () => {
    const supply = await createSupply(clinicA.id, { name: "Guantes", unit: "caja", quantity: 10 });
    const restocked = await restockSupply(clinicA.id, supply.id, 15);
    expect(restocked.quantity).toBe(25);
  });

  it("refuses restocking with a zero or negative amount", async () => {
    const supply = await createSupply(clinicA.id, { name: "Guantes", unit: "caja" });
    await expect(restockSupply(clinicA.id, supply.id, 0)).rejects.toThrow(
      "La cantidad a reponer tiene que ser mayor a 0",
    );
    await expect(restockSupply(clinicA.id, supply.id, -5)).rejects.toThrow(
      "La cantidad a reponer tiene que ser mayor a 0",
    );
  });

  it("refuses restocking with a non-integer amount", async () => {
    const supply = await createSupply(clinicA.id, { name: "Guantes", unit: "caja" });
    await expect(restockSupply(clinicA.id, supply.id, 1.5)).rejects.toThrow(
      "La cantidad a reponer tiene que ser un número entero",
    );
  });

  it("deletes a supply that has never been used", async () => {
    const supply = await createSupply(clinicA.id, { name: "Guantes", unit: "caja" });
    await deleteSupply(clinicA.id, supply.id);
    expect(await getSupplies(clinicA.id)).toHaveLength(0);
  });

  it("refuses deleting a supply that has at least one consultation using it", async () => {
    const patient = await createPatient(clinicA.id, { name: "Paciente A", phone: "111" });
    const supply = await createSupply(clinicA.id, { name: "Gomillas", unit: "unidad", quantity: 100 });
    await createConsultation(clinicA.id, {
      patientId: patient.id,
      date: new Date("2026-01-01"),
      treatment: "Ortodoncia",
      supplies: [{ supplyId: supply.id, quantityUsed: 5 }],
    });
    await expect(deleteSupply(clinicA.id, supply.id)).rejects.toThrow(
      "No se puede eliminar un insumo que ya fue usado en alguna consulta",
    );
  });
});
```

- [ ] **Step 2: Run to verify they fail**

Run: `npx vitest run src/features/clinic/data/supplies.test.ts`
Expected: FAIL — `Cannot find module '@/features/clinic/data/supplies'` (and the `supplies` field doesn't exist yet on `NewConsultationInput`, which Task 4 adds — the last test in this file depends on Task 4's work landing first in practice, but is written here since it's a supplies-focused scenario; if Task 4 isn't done yet when this task runs, that one test fails for a different reason (`supplies` not a valid key) until Task 4 lands — that's expected and resolves once Task 4 is complete).

- [ ] **Step 3: Implement**

Create `src/features/clinic/data/supplies.ts`:

```ts
import { prisma } from "@/lib/prisma";
import type { Supply } from "@prisma/client";

export type NewSupplyInput = {
  name: string;
  unit: string;
  price?: number;
  quantity?: number;
  lowStockAt?: number;
};

export type UpdateSupplyInput = {
  name: string;
  unit: string;
  price?: number;
  lowStockAt?: number;
};

function assertValidPrice(price: number | undefined) {
  if (price == null) return;
  if (!Number.isInteger(price)) {
    throw new Error("El precio tiene que ser un número entero");
  }
  if (price < 0) {
    throw new Error("El precio no puede ser negativo");
  }
}

function assertValidInitialQuantity(quantity: number | undefined) {
  if (quantity == null) return;
  if (!Number.isInteger(quantity)) {
    throw new Error("El stock inicial tiene que ser un número entero");
  }
  if (quantity < 0) {
    throw new Error("El stock inicial no puede ser negativo");
  }
}

function assertValidLowStockAt(lowStockAt: number | undefined) {
  if (lowStockAt == null) return;
  if (!Number.isInteger(lowStockAt)) {
    throw new Error("El umbral tiene que ser un número entero");
  }
  if (lowStockAt < 0) {
    throw new Error("El umbral no puede ser negativo");
  }
}

export async function getSupplies(clinicId: string): Promise<Supply[]> {
  return prisma.supply.findMany({
    where: { clinicId },
    orderBy: { name: "asc" },
  });
}

export async function createSupply(clinicId: string, input: NewSupplyInput): Promise<Supply> {
  const trimmed = input.name.trim();
  if (!trimmed) {
    throw new Error("El nombre no puede estar vacío");
  }
  assertValidPrice(input.price);
  assertValidInitialQuantity(input.quantity);
  assertValidLowStockAt(input.lowStockAt);

  const existing = await prisma.supply.findFirst({ where: { clinicId, name: trimmed } });
  if (existing) {
    throw new Error("Ya existe un insumo con ese nombre");
  }

  return prisma.supply.create({
    data: {
      clinicId,
      name: trimmed,
      unit: input.unit.trim(),
      price: input.price ?? null,
      quantity: input.quantity ?? 0,
      lowStockAt: input.lowStockAt ?? null,
    },
  });
}

export async function updateSupply(
  clinicId: string,
  id: string,
  input: UpdateSupplyInput,
): Promise<Supply> {
  const trimmed = input.name.trim();
  if (!trimmed) {
    throw new Error("El nombre no puede estar vacío");
  }
  assertValidPrice(input.price);
  assertValidLowStockAt(input.lowStockAt);

  const supply = await prisma.supply.findFirst({ where: { id, clinicId } });
  if (!supply) {
    throw new Error("Supply not found for this clinic");
  }

  const duplicate = await prisma.supply.findFirst({
    where: { clinicId, name: trimmed, id: { not: id } },
  });
  if (duplicate) {
    throw new Error("Ya existe un insumo con ese nombre");
  }

  return prisma.supply.update({
    where: { id },
    data: {
      name: trimmed,
      unit: input.unit.trim(),
      price: input.price ?? null,
      lowStockAt: input.lowStockAt ?? null,
    },
  });
}

export async function restockSupply(
  clinicId: string,
  id: string,
  amount: number,
): Promise<Supply> {
  if (!Number.isInteger(amount)) {
    throw new Error("La cantidad a reponer tiene que ser un número entero");
  }
  if (amount <= 0) {
    throw new Error("La cantidad a reponer tiene que ser mayor a 0");
  }

  const result = await prisma.supply.updateMany({
    where: { id, clinicId },
    data: { quantity: { increment: amount } },
  });
  if (result.count === 0) {
    throw new Error("Supply not found for this clinic");
  }
  return (await prisma.supply.findFirst({ where: { id, clinicId } }))!;
}

export async function deleteSupply(clinicId: string, id: string): Promise<void> {
  const usageCount = await prisma.consultationSupply.count({ where: { supplyId: id } });
  if (usageCount > 0) {
    throw new Error("No se puede eliminar un insumo que ya fue usado en alguna consulta");
  }
  await prisma.supply.deleteMany({ where: { id, clinicId } });
}
```

- [ ] **Step 4: Run to verify they pass**

Run: `npx vitest run src/features/clinic/data/supplies.test.ts`
Expected: all but the "refuses deleting a supply that has at least one consultation using it" test PASS. That one fails until Task 4 adds `supplies` to `NewConsultationInput` — leave it failing for now, it will go green once Task 4 lands. Confirm the failure is specifically about the `supplies` key not being recognized (a TS/runtime shape mismatch), not about anything else in this task's own code.

- [ ] **Step 5: Commit**

```bash
git add src/features/clinic/data/supplies.ts src/features/clinic/data/supplies.test.ts
git commit -m "feat: add Supply data layer (catalog, restock, delete)"
```

---

## Task 4: Consultation data layer — supply usage with transactional stock reconciliation

**Files:**
- Modify: `src/features/clinic/data/consultations.ts`
- Modify: `src/features/clinic/data/consultations.test.ts`

**Interfaces:**
- Consumes: nothing new from other tasks (writes directly to `Supply`/`ConsultationSupply` via `prisma`, same as `supplies.ts` does, since both live in the same data-layer area and this is the one place both tables are touched together).
- Produces: `NewConsultationInput.supplies?`, `UpdateConsultationInput.supplies?`, both `{ supplyId: string; quantityUsed: number }[]` — consumed by Task 7 (actions) and Task 9 (dialog UI). Also finally makes Task 3's last test pass.

- [ ] **Step 1: Write the failing tests**

Add this import to the top of `src/features/clinic/data/consultations.test.ts`, alongside the existing ones:

```ts
import { createSupply } from "@/features/clinic/data/supplies";
```

Add `consultationSupply` cleanup to the existing `afterEach` — it currently is:

```ts
afterEach(async () => {
  await prisma.consultation.deleteMany({});
  await prisma.patient.deleteMany({});
  await prisma.clinic.deleteMany({});
});
```

Replace it with:

```ts
afterEach(async () => {
  await prisma.consultationSupply.deleteMany({});
  await prisma.consultation.deleteMany({});
  await prisma.supply.deleteMany({});
  await prisma.patient.deleteMany({});
  await prisma.clinic.deleteMany({});
});
```

Add these tests inside the existing `describe("consultations data layer", ...)` block, anywhere after the existing amount-related tests:

```ts
  it("creating a consultation with supplies used decrements their stock", async () => {
    const patient = await createPatient(clinicA.id, { name: "Paciente A", phone: "111" });
    const supply = await createSupply(clinicA.id, { name: "Gomillas", unit: "unidad", quantity: 100 });

    await createConsultation(clinicA.id, {
      patientId: patient.id,
      date: new Date("2026-01-01"),
      treatment: "Ortodoncia",
      supplies: [{ supplyId: supply.id, quantityUsed: 12 }],
    });

    const reloaded = await prisma.supply.findUniqueOrThrow({ where: { id: supply.id } });
    expect(reloaded.quantity).toBe(88);
  });

  it("creating a consultation with supplies used creates the usage rows", async () => {
    const patient = await createPatient(clinicA.id, { name: "Paciente A", phone: "111" });
    const supply = await createSupply(clinicA.id, { name: "Gomillas", unit: "unidad", quantity: 100 });

    const consultation = await createConsultation(clinicA.id, {
      patientId: patient.id,
      date: new Date("2026-01-01"),
      treatment: "Ortodoncia",
      supplies: [{ supplyId: supply.id, quantityUsed: 12 }],
    });

    const usages = await prisma.consultationSupply.findMany({
      where: { consultationId: consultation.id },
    });
    expect(usages).toHaveLength(1);
    expect(usages[0].supplyId).toBe(supply.id);
    expect(usages[0].quantityUsed).toBe(12);
  });

  it("allows stock to go negative when more is used than is available", async () => {
    const patient = await createPatient(clinicA.id, { name: "Paciente A", phone: "111" });
    const supply = await createSupply(clinicA.id, { name: "Gomillas", unit: "unidad", quantity: 5 });

    await createConsultation(clinicA.id, {
      patientId: patient.id,
      date: new Date("2026-01-01"),
      treatment: "Ortodoncia",
      supplies: [{ supplyId: supply.id, quantityUsed: 8 }],
    });

    const reloaded = await prisma.supply.findUniqueOrThrow({ where: { id: supply.id } });
    expect(reloaded.quantity).toBe(-3);
  });

  it("refuses a non-positive quantityUsed", async () => {
    const patient = await createPatient(clinicA.id, { name: "Paciente A", phone: "111" });
    const supply = await createSupply(clinicA.id, { name: "Gomillas", unit: "unidad", quantity: 100 });

    await expect(
      createConsultation(clinicA.id, {
        patientId: patient.id,
        date: new Date("2026-01-01"),
        treatment: "Ortodoncia",
        supplies: [{ supplyId: supply.id, quantityUsed: 0 }],
      }),
    ).rejects.toThrow("La cantidad usada tiene que ser un número entero mayor a 0");
  });

  it("refuses a non-integer quantityUsed", async () => {
    const patient = await createPatient(clinicA.id, { name: "Paciente A", phone: "111" });
    const supply = await createSupply(clinicA.id, { name: "Gomillas", unit: "unidad", quantity: 100 });

    await expect(
      createConsultation(clinicA.id, {
        patientId: patient.id,
        date: new Date("2026-01-01"),
        treatment: "Ortodoncia",
        supplies: [{ supplyId: supply.id, quantityUsed: 2.5 }],
      }),
    ).rejects.toThrow("La cantidad usada tiene que ser un número entero mayor a 0");
  });

  it("editing a consultation's supplies reconciles stock: restores the old usage and applies the new one", async () => {
    const patient = await createPatient(clinicA.id, { name: "Paciente A", phone: "111" });
    const supplyA = await createSupply(clinicA.id, { name: "Gomillas", unit: "unidad", quantity: 100 });
    const supplyB = await createSupply(clinicA.id, { name: "Anestesia", unit: "ampolla", quantity: 50 });

    const consultation = await createConsultation(clinicA.id, {
      patientId: patient.id,
      date: new Date("2026-01-01"),
      treatment: "Ortodoncia",
      supplies: [{ supplyId: supplyA.id, quantityUsed: 10 }],
    });

    await updateConsultation(clinicA.id, consultation.id, {
      date: consultation.date,
      treatment: consultation.treatment,
      supplies: [{ supplyId: supplyB.id, quantityUsed: 3 }],
    });

    const reloadedA = await prisma.supply.findUniqueOrThrow({ where: { id: supplyA.id } });
    const reloadedB = await prisma.supply.findUniqueOrThrow({ where: { id: supplyB.id } });
    expect(reloadedA.quantity).toBe(100); // restored — no longer used
    expect(reloadedB.quantity).toBe(47); // 50 - 3

    const usages = await prisma.consultationSupply.findMany({
      where: { consultationId: consultation.id },
    });
    expect(usages).toHaveLength(1);
    expect(usages[0].supplyId).toBe(supplyB.id);
  });

  it("editing a consultation to remove its supplies entirely restores the stock", async () => {
    const patient = await createPatient(clinicA.id, { name: "Paciente A", phone: "111" });
    const supply = await createSupply(clinicA.id, { name: "Gomillas", unit: "unidad", quantity: 100 });

    const consultation = await createConsultation(clinicA.id, {
      patientId: patient.id,
      date: new Date("2026-01-01"),
      treatment: "Ortodoncia",
      supplies: [{ supplyId: supply.id, quantityUsed: 10 }],
    });

    await updateConsultation(clinicA.id, consultation.id, {
      date: consultation.date,
      treatment: consultation.treatment,
    });

    const reloaded = await prisma.supply.findUniqueOrThrow({ where: { id: supply.id } });
    expect(reloaded.quantity).toBe(100);
    expect(
      await prisma.consultationSupply.findMany({ where: { consultationId: consultation.id } }),
    ).toHaveLength(0);
  });

  it("deleting a consultation with supplies restores their stock", async () => {
    const patient = await createPatient(clinicA.id, { name: "Paciente A", phone: "111" });
    const supply = await createSupply(clinicA.id, { name: "Gomillas", unit: "unidad", quantity: 100 });

    const consultation = await createConsultation(clinicA.id, {
      patientId: patient.id,
      date: new Date("2026-01-01"),
      treatment: "Ortodoncia",
      supplies: [{ supplyId: supply.id, quantityUsed: 10 }],
    });

    await deleteConsultation(clinicA.id, consultation.id);

    const reloaded = await prisma.supply.findUniqueOrThrow({ where: { id: supply.id } });
    expect(reloaded.quantity).toBe(100);
  });
```

- [ ] **Step 2: Run to verify they fail**

Run: `npx vitest run src/features/clinic/data/consultations.test.ts`
Expected: FAIL — `supplies` isn't a recognized field on `NewConsultationInput`/`UpdateConsultationInput` yet, and nothing decrements/restores stock.

- [ ] **Step 3: Implement**

In `src/features/clinic/data/consultations.ts`, add the import:

```ts
import { prisma } from "@/lib/prisma";
import type { Consultation, Prisma } from "@prisma/client";
import { OTHER_TREATMENT } from "@/features/clinic/lib/treatments";
import { paymentStatus, type PaymentStatus } from "@/features/clinic/lib/billing";
```

becomes:

```ts
import { prisma } from "@/lib/prisma";
import type { Consultation, Prisma } from "@prisma/client";
import { OTHER_TREATMENT } from "@/features/clinic/lib/treatments";
import { paymentStatus, type PaymentStatus } from "@/features/clinic/lib/billing";

export type SupplyUsageInput = { supplyId: string; quantityUsed: number };

function assertValidSupplyUsages(supplies: SupplyUsageInput[] | undefined) {
  for (const usage of supplies ?? []) {
    if (!Number.isInteger(usage.quantityUsed) || usage.quantityUsed <= 0) {
      throw new Error("La cantidad usada tiene que ser un número entero mayor a 0");
    }
  }
}

/** Decrements each used supply's stock and records the usage row — shared
 * by create (against a brand-new consultation) and update (against the
 * freshly-cleared list, see applySupplyUsages's caller in updateConsultation).
 * Runs inside the caller's transaction, never on its own. */
async function applySupplyUsages(
  tx: Prisma.TransactionClient,
  consultationId: string,
  supplies: SupplyUsageInput[] | undefined,
) {
  for (const usage of supplies ?? []) {
    await tx.supply.update({
      where: { id: usage.supplyId },
      data: { quantity: { decrement: usage.quantityUsed } },
    });
    await tx.consultationSupply.create({
      data: { consultationId, supplyId: usage.supplyId, quantityUsed: usage.quantityUsed },
    });
  }
}

/** Restores stock for every supply usage currently attached to a
 * consultation, then removes those usage rows — the first half of
 * "reconcile": undo the old state before applying the new one. */
async function reverseSupplyUsages(tx: Prisma.TransactionClient, consultationId: string) {
  const existing = await tx.consultationSupply.findMany({ where: { consultationId } });
  for (const usage of existing) {
    await tx.supply.update({
      where: { id: usage.supplyId },
      data: { quantity: { increment: usage.quantityUsed } },
    });
  }
  await tx.consultationSupply.deleteMany({ where: { consultationId } });
}
```

Add `supplies?: SupplyUsageInput[];` to `NewConsultationInput` — it currently is:

```ts
export type NewConsultationInput = {
  patientId: string;
  date: Date;
  treatment: string;
  teeth?: string[];
  notes?: string;
  amountCharged?: number;
  amountPaid?: number;
};
```

Replace it with:

```ts
export type NewConsultationInput = {
  patientId: string;
  date: Date;
  treatment: string;
  teeth?: string[];
  notes?: string;
  amountCharged?: number;
  amountPaid?: number;
  supplies?: SupplyUsageInput[];
};
```

Replace `createConsultation` — it currently is:

```ts
export async function createConsultation(
  clinicId: string,
  input: NewConsultationInput,
): Promise<Consultation> {
  const patient = await prisma.patient.findFirst({
    where: { id: input.patientId, clinicId },
  });
  if (!patient) {
    throw new Error("Patient not found for this clinic");
  }
  assertValidAmounts(input.amountCharged, input.amountPaid);

  return prisma.consultation.create({
    data: {
      patientId: input.patientId,
      date: input.date,
      treatment: input.treatment,
      teeth: input.teeth ?? [],
      notes: input.notes ?? null,
      amountCharged: input.amountCharged ?? null,
      amountPaid: input.amountPaid ?? 0,
      clinicId,
    },
  });
}
```

Replace it with:

```ts
export async function createConsultation(
  clinicId: string,
  input: NewConsultationInput,
): Promise<Consultation> {
  const patient = await prisma.patient.findFirst({
    where: { id: input.patientId, clinicId },
  });
  if (!patient) {
    throw new Error("Patient not found for this clinic");
  }
  assertValidAmounts(input.amountCharged, input.amountPaid);
  assertValidSupplyUsages(input.supplies);

  return prisma.$transaction(async (tx) => {
    const consultation = await tx.consultation.create({
      data: {
        patientId: input.patientId,
        date: input.date,
        treatment: input.treatment,
        teeth: input.teeth ?? [],
        notes: input.notes ?? null,
        amountCharged: input.amountCharged ?? null,
        amountPaid: input.amountPaid ?? 0,
        clinicId,
      },
    });
    await applySupplyUsages(tx, consultation.id, input.supplies);
    return consultation;
  });
}
```

Add `supplies?: SupplyUsageInput[];` to `UpdateConsultationInput` — it currently is:

```ts
export type UpdateConsultationInput = {
  date: Date;
  treatment: string;
  teeth?: string[];
  notes?: string;
  amountCharged?: number;
  amountPaid?: number;
};
```

Replace it with:

```ts
export type UpdateConsultationInput = {
  date: Date;
  treatment: string;
  teeth?: string[];
  notes?: string;
  amountCharged?: number;
  amountPaid?: number;
  supplies?: SupplyUsageInput[];
};
```

Replace `updateConsultation` — it currently is:

```ts
export async function updateConsultation(
  clinicId: string,
  id: string,
  input: UpdateConsultationInput,
): Promise<Consultation> {
  assertValidAmounts(input.amountCharged, input.amountPaid);

  const result = await prisma.consultation.updateMany({
    where: { id, clinicId },
    data: {
      date: input.date,
      treatment: input.treatment,
      teeth: input.teeth ?? [],
      notes: input.notes ?? null,
      amountCharged: input.amountCharged ?? null,
      amountPaid: input.amountPaid ?? 0,
    },
  });
  if (result.count === 0) {
    throw new Error("Consultation not found for this clinic");
  }
  return (await getConsultation(clinicId, id))!;
}
```

Replace it with:

```ts
export async function updateConsultation(
  clinicId: string,
  id: string,
  input: UpdateConsultationInput,
): Promise<Consultation> {
  assertValidAmounts(input.amountCharged, input.amountPaid);
  assertValidSupplyUsages(input.supplies);

  return prisma.$transaction(async (tx) => {
    const existing = await tx.consultation.findFirst({ where: { id, clinicId } });
    if (!existing) {
      throw new Error("Consultation not found for this clinic");
    }

    await reverseSupplyUsages(tx, id);

    const updated = await tx.consultation.update({
      where: { id },
      data: {
        date: input.date,
        treatment: input.treatment,
        teeth: input.teeth ?? [],
        notes: input.notes ?? null,
        amountCharged: input.amountCharged ?? null,
        amountPaid: input.amountPaid ?? 0,
      },
    });

    await applySupplyUsages(tx, id, input.supplies);
    return updated;
  });
}
```

Replace `deleteConsultation` — it currently is:

```ts
export async function deleteConsultation(clinicId: string, id: string): Promise<void> {
  await prisma.consultation.deleteMany({ where: { id, clinicId } });
}
```

Replace it with:

```ts
export async function deleteConsultation(clinicId: string, id: string): Promise<void> {
  await prisma.$transaction(async (tx) => {
    const consultation = await tx.consultation.findFirst({ where: { id, clinicId } });
    if (!consultation) return;
    await reverseSupplyUsages(tx, id);
    await tx.consultation.delete({ where: { id } });
  });
}
```

- [ ] **Step 4: Run to verify they pass**

Run: `npx vitest run src/features/clinic/data/consultations.test.ts`
Expected: PASS, all tests (existing + new).

- [ ] **Step 5: Confirm Task 3's deferred test now passes too**

Run: `npx vitest run src/features/clinic/data/supplies.test.ts`
Expected: PASS, all tests — including "refuses deleting a supply that has at least one consultation using it", which needed this task's `supplies` field to exist.

- [ ] **Step 6: Run the full unit suite**

Run: `npm test`
Expected: all test files pass.

- [ ] **Step 7: Commit**

```bash
git add src/features/clinic/data/consultations.ts src/features/clinic/data/consultations.test.ts
git commit -m "feat: reconcile supply stock transactionally with consultation create/update/delete"
```

---

## Task 5: Stock feature actions

**Files:**
- Create: `src/features/stock/actions.ts`

**Interfaces:**
- Consumes: `createSupply`/`updateSupply`/`restockSupply`/`deleteSupply` (Task 3).
- Produces: `createSupplyAction`, `updateSupplyAction`, `restockSupplyAction`, `deleteSupplyAction` — consumed by Task 6 (Stock page UI).

- [ ] **Step 1: Create the actions file**

Create `src/features/stock/actions.ts`:

```ts
"use server";

import { revalidatePath } from "next/cache";
import { getCurrentClinic } from "@/features/clinic/data/current-clinic";
import {
  createSupply,
  deleteSupply,
  restockSupply,
  updateSupply,
  type NewSupplyInput,
  type UpdateSupplyInput,
} from "@/features/clinic/data/supplies";

async function requireClinicId(): Promise<string> {
  const clinic = await getCurrentClinic();
  if (!clinic) throw new Error("No hay un consultorio activo para este usuario");
  return clinic.id;
}

export async function createSupplyAction(input: NewSupplyInput) {
  const clinicId = await requireClinicId();
  const supply = await createSupply(clinicId, input);
  revalidatePath("/dashboard/stock");
  return supply;
}

export async function updateSupplyAction(id: string, input: UpdateSupplyInput) {
  const clinicId = await requireClinicId();
  const supply = await updateSupply(clinicId, id, input);
  revalidatePath("/dashboard/stock");
  return supply;
}

export async function restockSupplyAction(id: string, amount: number) {
  const clinicId = await requireClinicId();
  const supply = await restockSupply(clinicId, id, amount);
  revalidatePath("/dashboard/stock");
  return supply;
}

export async function deleteSupplyAction(id: string) {
  const clinicId = await requireClinicId();
  await deleteSupply(clinicId, id);
  revalidatePath("/dashboard/stock");
}
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit -p .`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/features/stock/actions.ts
git commit -m "feat: add Stock server actions"
```

---

## Task 6: Sidebar nav item, Stock page, and the Supplies table UI

**Files:**
- Modify: `src/features/dashboard/components/app-sidebar.tsx`
- Create: `src/app/dashboard/stock/page.tsx`
- Create: `src/features/stock/components/supplies-table.tsx`

**Interfaces:**
- Consumes: `getSupplies` (Task 3), `createSupplyAction`/`updateSupplyAction`/`restockSupplyAction`/`deleteSupplyAction` (Task 5), `isLowStock` (Task 2), `formatCurrency` (existing, `src/features/clinic/lib/format.ts`).
- Produces: a working `/dashboard/stock` page, reachable from the sidebar.

- [ ] **Step 1: Add the sidebar item**

In `src/features/dashboard/components/app-sidebar.tsx`, add `Boxes` to the lucide-react import — it currently is:

```ts
import {
  CalendarDays,
  ClipboardList,
  LayoutDashboard,
  LogOut,
  Settings,
  Users,
} from "lucide-react";
```

Replace it with:

```ts
import {
  Boxes,
  CalendarDays,
  ClipboardList,
  LayoutDashboard,
  LogOut,
  Settings,
  Users,
} from "lucide-react";
```

Add the Stock entry to `navItems`, between Turnos and Configuración — it currently is:

```ts
const navItems = [
  { title: "Inicio", url: "/dashboard", icon: LayoutDashboard },
  { title: "Pacientes", url: "/dashboard/pacientes", icon: Users },
  { title: "Consultas/Tratamientos", url: "/dashboard/consultas", icon: ClipboardList },
  { title: "Turnos", url: "/dashboard/turnos", icon: CalendarDays },
  { title: "Configuración", url: "/dashboard/configuracion", icon: Settings },
];
```

Replace it with:

```ts
const navItems = [
  { title: "Inicio", url: "/dashboard", icon: LayoutDashboard },
  { title: "Pacientes", url: "/dashboard/pacientes", icon: Users },
  { title: "Consultas/Tratamientos", url: "/dashboard/consultas", icon: ClipboardList },
  { title: "Turnos", url: "/dashboard/turnos", icon: CalendarDays },
  { title: "Stock", url: "/dashboard/stock", icon: Boxes },
  { title: "Configuración", url: "/dashboard/configuracion", icon: Settings },
];
```

- [ ] **Step 2: Create the Stock page**

Create `src/app/dashboard/stock/page.tsx`:

```tsx
import { Boxes } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { SuppliesTable } from "@/features/stock/components/supplies-table";
import { getCurrentClinic } from "@/features/clinic/data/current-clinic";
import { getSupplies } from "@/features/clinic/data/supplies";

export default async function StockPage() {
  const clinic = await getCurrentClinic();
  const supplies = clinic ? await getSupplies(clinic.id) : [];

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Stock"
        description="Insumos del consultorio: precio, unidad y cantidad disponible."
        icon={Boxes}
      />
      <SuppliesTable supplies={supplies} />
    </div>
  );
}
```

- [ ] **Step 3: Create the Supplies table component**

Create `src/features/stock/components/supplies-table.tsx`. This follows the same shape as `OptionListManager` (`src/features/settings/components/option-list-manager.tsx`) — search, pagination, inline add/edit, delete confirmation — with extra fields (unit, quantity, low-stock coloring, a restock control) that `OptionListManager` doesn't need:

```tsx
"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Pencil, Plus, Search, Trash2, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { PaginationNavigation } from "@/components/pagination-navigation";
import { usePagination } from "@/hooks/use-pagination";
import { formatCurrency } from "@/features/clinic/lib/format";
import { isLowStock } from "@/features/clinic/lib/stock";
import {
  createSupplyAction,
  deleteSupplyAction,
  restockSupplyAction,
  updateSupplyAction,
} from "@/features/stock/actions";
import type { Supply } from "@prisma/client";

const PAGE_SIZE = 10;

const QUANTITY_ERROR = "Tiene que ser un número entero, sin puntos ni comas (ej: 15000)";

/** Same reasoning as the treatment price field: a bare Number() parse
 * isn't enough because the displayed quantity/price can have thousands
 * separators the user might re-type verbatim. */
function parseWholeNumber(raw: string): { value: number | undefined } | { error: string } {
  const trimmed = raw.trim();
  if (!trimmed) return { value: undefined };
  if (trimmed.includes(".") || trimmed.includes(",")) return { error: QUANTITY_ERROR };
  const value = Number(trimmed);
  if (!Number.isInteger(value) || value < 0) return { error: QUANTITY_ERROR };
  return { value };
}

const STOCK_STYLES: Record<"out" | "low", string> = {
  out: "text-destructive",
  low: "text-amber-600 dark:text-amber-400",
};

export function SuppliesTable({ supplies }: { supplies: Supply[] }) {
  const router = useRouter();

  const [newName, setNewName] = useState("");
  const [newUnit, setNewUnit] = useState("");
  const [newPrice, setNewPrice] = useState("");
  const [newQuantity, setNewQuantity] = useState("");
  const [adding, setAdding] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editUnit, setEditUnit] = useState("");
  const [editPrice, setEditPrice] = useState("");
  const [editLowStockAt, setEditLowStockAt] = useState("");
  const [editError, setEditError] = useState<string | null>(null);

  const [restockingId, setRestockingId] = useState<string | null>(null);
  const [restockAmount, setRestockAmount] = useState("");
  const [restockError, setRestockError] = useState<string | null>(null);

  const [deleteTarget, setDeleteTarget] = useState<Supply | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const [query, setQuery] = useState("");
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? supplies.filter((s) => s.name.toLowerCase().includes(q)) : supplies;
  }, [supplies, query]);
  const { page, setPage, pageCount, pageItems } = usePagination(filtered, PAGE_SIZE);

  async function handleAdd() {
    if (!newName.trim() || !newUnit.trim()) return;
    const parsedPrice = parseWholeNumber(newPrice);
    if ("error" in parsedPrice) return setAddError(parsedPrice.error);
    const parsedQuantity = parseWholeNumber(newQuantity);
    if ("error" in parsedQuantity) return setAddError(parsedQuantity.error);

    setAdding(true);
    setAddError(null);
    try {
      await createSupplyAction({
        name: newName,
        unit: newUnit,
        price: parsedPrice.value,
        quantity: parsedQuantity.value,
      });
      setNewName("");
      setNewUnit("");
      setNewPrice("");
      setNewQuantity("");
      router.refresh();
    } catch (error) {
      setAddError(error instanceof Error ? error.message : "No se pudo agregar");
    } finally {
      setAdding(false);
    }
  }

  function startEdit(supply: Supply) {
    setEditingId(supply.id);
    setEditName(supply.name);
    setEditUnit(supply.unit);
    setEditPrice(supply.price != null ? String(supply.price) : "");
    setEditLowStockAt(supply.lowStockAt != null ? String(supply.lowStockAt) : "");
    setEditError(null);
  }

  async function handleSaveEdit(id: string) {
    if (!editName.trim() || !editUnit.trim()) return;
    const parsedPrice = parseWholeNumber(editPrice);
    if ("error" in parsedPrice) return setEditError(parsedPrice.error);
    const parsedLowStockAt = parseWholeNumber(editLowStockAt);
    if ("error" in parsedLowStockAt) return setEditError(parsedLowStockAt.error);

    setEditError(null);
    try {
      await updateSupplyAction(id, {
        name: editName,
        unit: editUnit,
        price: parsedPrice.value,
        lowStockAt: parsedLowStockAt.value,
      });
      setEditingId(null);
      router.refresh();
    } catch (error) {
      setEditError(error instanceof Error ? error.message : "No se pudo guardar");
    }
  }

  async function handleRestock(id: string) {
    const parsed = parseWholeNumber(restockAmount);
    if ("error" in parsed) return setRestockError(parsed.error);
    if (!parsed.value) return setRestockError("Ingresá cuánto repusiste");

    setRestockError(null);
    try {
      await restockSupplyAction(id, parsed.value);
      setRestockingId(null);
      setRestockAmount("");
      router.refresh();
    } catch (error) {
      setRestockError(error instanceof Error ? error.message : "No se pudo reponer");
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    try {
      await deleteSupplyAction(deleteTarget.id);
      setDeleteTarget(null);
      setDeleteError(null);
      router.refresh();
    } catch (error) {
      setDeleteError(error instanceof Error ? error.message : "No se pudo eliminar");
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Insumos</CardTitle>
        <CardDescription>
          Stock disponible de cada insumo. Se resta solo cuando lo marcás como usado en una consulta.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <div className="flex flex-col gap-2 sm:flex-row">
          <Input
            placeholder="Agregar nuevo..."
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
          />
          <Input
            placeholder="Unidad (ej: unidad, caja, ml)"
            className="sm:w-48"
            value={newUnit}
            onChange={(e) => setNewUnit(e.target.value)}
          />
          <Input
            type="number"
            min={0}
            placeholder="Precio (opcional)"
            className="sm:w-36"
            value={newPrice}
            onChange={(e) => setNewPrice(e.target.value)}
          />
          <Input
            type="number"
            min={0}
            placeholder="Stock inicial"
            className="sm:w-32"
            value={newQuantity}
            onChange={(e) => setNewQuantity(e.target.value)}
          />
          <Button type="button" onClick={handleAdd} disabled={adding}>
            <Plus />
            Agregar
          </Button>
        </div>
        {addError && <p className="text-sm text-destructive">{addError}</p>}

        {supplies.length > 0 && (
          <div className="relative w-full sm:max-w-xs">
            <Search className="absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Buscar..."
              className="pl-8"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
        )}

        {supplies.length === 0 ? (
          <p className="text-sm text-muted-foreground">Todavía no hay insumos cargados.</p>
        ) : filtered.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Ningún insumo coincide con &quot;{query}&quot;.
          </p>
        ) : (
          <ul className="divide-y rounded-md border">
            {pageItems.map((supply) => {
              const level = isLowStock(supply.quantity, supply.lowStockAt);
              return (
                <li key={supply.id} className="flex flex-col gap-2 px-3 py-2">
                  {editingId === supply.id ? (
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                      <Input
                        autoFocus
                        aria-label="Editar nombre"
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                      />
                      <Input
                        aria-label={`Unidad de ${supply.name}`}
                        className="sm:w-40"
                        value={editUnit}
                        onChange={(e) => setEditUnit(e.target.value)}
                      />
                      <Input
                        type="number"
                        min={0}
                        aria-label={`Precio de ${supply.name}`}
                        className="sm:w-32"
                        value={editPrice}
                        onChange={(e) => setEditPrice(e.target.value)}
                      />
                      <Input
                        type="number"
                        min={0}
                        aria-label={`Umbral de stock bajo de ${supply.name}`}
                        placeholder="Umbral"
                        className="sm:w-28"
                        value={editLowStockAt}
                        onChange={(e) => setEditLowStockAt(e.target.value)}
                      />
                      <div className="flex items-center gap-1">
                        <Button
                          type="button"
                          size="icon"
                          variant="ghost"
                          aria-label="Guardar"
                          onClick={() => handleSaveEdit(supply.id)}
                        >
                          <Check />
                        </Button>
                        <Button
                          type="button"
                          size="icon"
                          variant="ghost"
                          aria-label="Cancelar"
                          onClick={() => setEditingId(null)}
                        >
                          <X />
                        </Button>
                      </div>
                    </div>
                  ) : restockingId === supply.id ? (
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                      <span className="text-sm font-medium">{supply.name}</span>
                      <Input
                        autoFocus
                        type="number"
                        min={1}
                        aria-label={`Cantidad a reponer de ${supply.name}`}
                        placeholder="Cantidad repuesta"
                        className="sm:w-40"
                        value={restockAmount}
                        onChange={(e) => setRestockAmount(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            handleRestock(supply.id);
                          }
                        }}
                      />
                      <div className="flex items-center gap-1">
                        <Button
                          type="button"
                          size="icon"
                          variant="ghost"
                          aria-label="Confirmar reposición"
                          onClick={() => handleRestock(supply.id)}
                        >
                          <Check />
                        </Button>
                        <Button
                          type="button"
                          size="icon"
                          variant="ghost"
                          aria-label="Cancelar reposición"
                          onClick={() => {
                            setRestockingId(null);
                            setRestockError(null);
                          }}
                        >
                          <X />
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex flex-wrap items-center gap-3">
                        <span className="text-sm font-medium">{supply.name}</span>
                        <span className="text-sm text-muted-foreground">{supply.unit}</span>
                        <span className="text-sm text-muted-foreground">
                          {supply.price != null ? formatCurrency(supply.price) : "Sin precio"}
                        </span>
                        <span
                          className={`text-sm font-medium ${level !== "ok" ? STOCK_STYLES[level] : ""}`}
                        >
                          {supply.quantity} {supply.unit}
                        </span>
                      </div>
                      <div className="flex items-center gap-1">
                        <Button
                          type="button"
                          size="icon"
                          variant="ghost"
                          aria-label={`Reponer ${supply.name}`}
                          onClick={() => {
                            setRestockingId(supply.id);
                            setRestockAmount("");
                            setRestockError(null);
                          }}
                        >
                          <Plus />
                        </Button>
                        <Button
                          type="button"
                          size="icon"
                          variant="ghost"
                          aria-label={`Editar ${supply.name}`}
                          onClick={() => startEdit(supply)}
                        >
                          <Pencil />
                        </Button>
                        <Button
                          type="button"
                          size="icon"
                          variant="ghost"
                          aria-label={`Eliminar ${supply.name}`}
                          onClick={() => {
                            setDeleteTarget(supply);
                            setDeleteError(null);
                          }}
                        >
                          <Trash2 />
                        </Button>
                      </div>
                    </div>
                  )}
                  {restockingId === supply.id && restockError && (
                    <p className="text-sm text-destructive">{restockError}</p>
                  )}
                </li>
              );
            })}
          </ul>
        )}
        <PaginationNavigation page={page} pageCount={pageCount} onPageChange={setPage} />
        {editError && <p className="text-sm text-destructive">{editError}</p>}
      </CardContent>

      <AlertDialog
        open={!!deleteTarget}
        onOpenChange={(open) => {
          if (!open) {
            setDeleteTarget(null);
            setDeleteError(null);
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <Trash2 className="size-4 text-destructive" />
              ¿Eliminar &quot;{deleteTarget?.name}&quot;?
            </AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción no se puede deshacer. Si este insumo ya se usó en alguna consulta, no se va a
              poder eliminar.
            </AlertDialogDescription>
          </AlertDialogHeader>
          {deleteError && <p className="text-sm text-destructive">{deleteError}</p>}
          <AlertDialogFooter>
            <AlertDialogCancel>
              <X />
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive! text-white! hover:bg-destructive/90!"
            >
              <Trash2 />
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}
```

- [ ] **Step 4: Type-check**

Run: `npx tsc --noEmit -p .`
Expected: no errors.

- [ ] **Step 5: Manual smoke-check**

Run: `npm run dev`, then in a browser:
1. Confirm "Stock" appears in the sidebar between Turnos and Configuración, and `/dashboard/stock` loads.
2. Add an insumo: name "Gomillas", unidad "unidad", precio `50`, stock inicial `100`. Confirm it appears as "Gomillas — unidad — $50 — 100 unidad".
3. Click the "+" (reponer) icon, type `20`, confirm. Confirm it now shows `120 unidad`.
4. Edit it, set umbral de stock bajo to `150`. Confirm the quantity (120) now renders in the amber/low-stock color, since 120 ≤ 150.
5. Edit it again, remove the umbral. Confirm the color goes back to normal (no threshold = only "out" at 0 or below is colored).
6. Try adding a second insumo with the exact same name "Gomillas" — confirm it's rejected with "Ya existe un insumo con ese nombre".
7. Delete the test insumo (cleanup).

- [ ] **Step 6: Commit**

```bash
git add src/features/dashboard/components/app-sidebar.tsx src/app/dashboard/stock/page.tsx src/features/stock/components/supplies-table.tsx
git commit -m "feat: add Stock sidebar module with the insumos table"
```

---

## Task 7: Consultation schema + actions — thread supplies through

**Files:**
- Modify: `src/features/consultations/lib/schema.ts`
- Modify: `src/features/consultations/actions.ts`

**Interfaces:**
- Consumes: `NewConsultationInput`/`UpdateConsultationInput` with `supplies?` (Task 4).
- Produces: nothing new exported — this task only confirms the existing pass-through already works and adds the one validation note below. Consumed implicitly by Task 9 (the dialogs call the actions directly with a `supplies` array, bypassing react-hook-form for that field — see Task 9's own design note).

- [ ] **Step 1: Verify the actions already forward `supplies`**

Open `src/features/consultations/actions.ts`. `createConsultationAction` and `updateConsultationAction` already spread their whole input object through to `createConsultation`/`updateConsultation` (`{ ...consultationInput, patientId }` and `input` respectively) — since `NewConsultationInput`/`UpdateConsultationInput` now include `supplies?` (Task 4), nothing here needs to change. This step is a verification, not a code change — open the file and confirm by inspection.

- [ ] **Step 2: Decide why this bypasses zod entirely**

The "Insumos utilizados" list (Task 9) is **not** a zod-validated react-hook-form field like `amountCharged` — it's a separate piece of local component state in the dialog (an array the dentist builds by repeatedly picking an insumo + quantity and clicking "Agregar"), validated at the point of adding an entry to that list (quantity must be a positive integer — enforced in Task 9's own component, same spirit as `parsePrice`) and again, redundantly, at the data layer (`assertValidSupplyUsages`, Task 4). `consultationSchema`/`editConsultationSchema` therefore need **no changes** in this task — there's no new string field to parse the way `amountCharged` is a string in the RHF form. This is a deliberate scope note, not a gap: adding a third parallel validation path (zod) for a value that's never actually typed into an `<input>` registered with RHF would be validation for its own sake.

- [ ] **Step 3: Type-check**

Run: `npx tsc --noEmit -p .`
Expected: no errors.

- [ ] **Step 4: Commit**

Nothing to commit — this task made no code changes, only confirmed Task 4's types already flow through cleanly. Skip the commit step.

---

## Task 8: "Insumos utilizados" field component

**Files:**
- Create: `src/features/consultations/components/supplies-used-field.tsx`

**Interfaces:**
- Consumes: `SupplyUsageInput` (Task 4, `src/features/clinic/data/consultations.ts`) — re-exported, not redefined, so the UI's list and the server action's input are provably the same shape rather than two structurally-identical types that happen to match.
- Produces: `<SuppliesUsedField>`, `type SupplyOption` — consumed by Task 9 (wiring into the two consultation dialogs).

- [ ] **Step 1: Create the component**

Create `src/features/consultations/components/supplies-used-field.tsx`:

```tsx
"use client";

import { useState } from "react";
import { Plus, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { SupplyUsageInput } from "@/features/clinic/data/consultations";

export type SupplyOption = { id: string; name: string; unit: string };

/** A plain controlled list, not a react-hook-form field: there's no typed
 * string to validate the way amountCharged needs — just "pick one, pick a
 * quantity, add it to the list" repeated as many times as needed. The
 * parent dialog owns `value` and reads it directly at submit time. */
export function SuppliesUsedField({
  idPrefix = "",
  supplies,
  value,
  onChange,
}: {
  idPrefix?: string;
  supplies: SupplyOption[];
  value: SupplyUsageInput[];
  onChange: (next: SupplyUsageInput[]) => void;
}) {
  const [selectedSupplyId, setSelectedSupplyId] = useState("");
  const [quantity, setQuantity] = useState("");
  const [error, setError] = useState<string | null>(null);

  function supplyFor(id: string) {
    return supplies.find((s) => s.id === id);
  }

  function handleAdd() {
    if (!selectedSupplyId) {
      setError("Elegí un insumo");
      return;
    }
    const trimmedQuantity = quantity.trim();
    // Same fix as the treatment price field and the consultation amount
    // fields: reject "." / "," outright rather than let Number() parse
    // "10.000" down to 10.
    if (trimmedQuantity.includes(".") || trimmedQuantity.includes(",")) {
      setError("La cantidad tiene que ser un número entero, sin puntos ni comas");
      return;
    }
    const qty = Number(trimmedQuantity);
    if (!trimmedQuantity || !Number.isInteger(qty) || qty <= 0) {
      setError("Ingresá una cantidad entera mayor a 0");
      return;
    }
    setError(null);

    const existingIndex = value.findIndex((v) => v.supplyId === selectedSupplyId);
    if (existingIndex >= 0) {
      const next = [...value];
      next[existingIndex] = { ...next[existingIndex], quantityUsed: next[existingIndex].quantityUsed + qty };
      onChange(next);
    } else {
      onChange([...value, { supplyId: selectedSupplyId, quantityUsed: qty }]);
    }
    setSelectedSupplyId("");
    setQuantity("");
  }

  function handleRemove(supplyId: string) {
    onChange(value.filter((v) => v.supplyId !== supplyId));
  }

  return (
    <div className="space-y-2">
      <Label>Insumos utilizados (opcional)</Label>
      <div className="flex flex-col gap-2 sm:flex-row">
        <Select value={selectedSupplyId} onValueChange={setSelectedSupplyId}>
          <SelectTrigger className="w-full" id={`${idPrefix}supplySelect`}>
            <SelectValue placeholder="Elegí un insumo" />
          </SelectTrigger>
          <SelectContent>
            {supplies.map((s) => (
              <SelectItem key={s.id} value={s.id}>
                {s.name} ({s.unit})
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Input
          type="number"
          min={1}
          placeholder="Cantidad"
          className="sm:w-28"
          id={`${idPrefix}supplyQuantity`}
          value={quantity}
          onChange={(e) => setQuantity(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              handleAdd();
            }
          }}
        />
        <Button type="button" variant="secondary" onClick={handleAdd}>
          <Plus />
          Agregar
        </Button>
      </div>
      {error && <p className="text-sm text-destructive">{error}</p>}

      {value.length > 0 && (
        <ul className="divide-y rounded-md border">
          {value.map((entry) => {
            const supply = supplyFor(entry.supplyId);
            return (
              <li
                key={entry.supplyId}
                className="flex items-center justify-between gap-2 px-3 py-2 text-sm"
              >
                <span>
                  {supply?.name ?? "Insumo eliminado"} × {entry.quantityUsed}
                  {supply ? ` ${supply.unit}` : ""}
                </span>
                <Button
                  type="button"
                  size="icon-sm"
                  variant="ghost"
                  aria-label={`Quitar ${supply?.name ?? "insumo"}`}
                  onClick={() => handleRemove(entry.supplyId)}
                >
                  <X />
                </Button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit -p .`
Expected: no errors (nothing uses this component yet, so this only confirms the file itself compiles).

- [ ] **Step 3: Commit**

```bash
git add src/features/consultations/components/supplies-used-field.tsx
git commit -m "feat: add the shared Insumos utilizados field component"
```

---

## Task 9: Wire supplies into the consultation dialogs, pages, and data fetch

**Files:**
- Modify: `src/features/consultations/components/new-consultation-dialog.tsx`
- Modify: `src/features/consultations/components/edit-consultation-dialog.tsx`
- Modify: `src/features/consultations/components/consultations-table.tsx`
- Modify: `src/features/consultations/components/consultations-view.tsx`
- Modify: `src/features/consultations/components/consultations-list.tsx`
- Modify: `src/features/patients/components/patient-detail-view.tsx`
- Modify: `src/app/dashboard/consultas/page.tsx`
- Modify: `src/app/dashboard/pacientes/[id]/page.tsx`
- Modify: `src/features/clinic/data/consultations.ts`
- Modify: `src/features/consultations/actions.ts`

**Interfaces:**
- Consumes: `<SuppliesUsedField>` (Task 8), `getSupplies` (Task 3).
- Produces: a `supplyOptions: SupplyOption[]` prop threaded from both consultation pages down to both dialogs (same shape as how `treatmentPrices` was threaded during Precios y Cobros); a new `getConsultationUsages` data-layer function and `getConsultationUsagesAction` server action (kept separate from `getConsultation`, see Step 1) so the Edit dialog can fetch and prefill a consultation's existing supply usages.

- [ ] **Step 1: Make `getConsultation` return existing usages**

In `src/features/clinic/data/consultations.ts`, add this type (anywhere near the top, after the existing type exports) and change `getConsultation`'s return type and query:

```ts
export type ConsultationUsage = { supplyId: string; supplyName: string; unit: string; quantityUsed: number };
```

Replace `getConsultation` — it currently is:

```ts
export async function getConsultation(
  clinicId: string,
  id: string,
): Promise<Consultation | null> {
  return prisma.consultation.findFirst({ where: { id, clinicId } });
}
```

Replace it with:

```ts
export async function getConsultation(
  clinicId: string,
  id: string,
): Promise<Consultation | null> {
  return prisma.consultation.findFirst({ where: { id, clinicId } });
}

/** Separate from getConsultation on purpose: the Edit dialog is the only
 * place that needs a consultation's existing supply usages (to prefill
 * "Insumos utilizados"), and every other consultation query (the lists,
 * the view-only dialog) has no use for them — adding the relation to
 * every fetch would mean joining a table almost nothing reads. */
export async function getConsultationUsages(
  clinicId: string,
  consultationId: string,
): Promise<ConsultationUsage[]> {
  const consultation = await prisma.consultation.findFirst({ where: { id: consultationId, clinicId } });
  if (!consultation) return [];
  const usages = await prisma.consultationSupply.findMany({
    where: { consultationId },
    include: { supply: true },
  });
  return usages.map((u) => ({
    supplyId: u.supplyId,
    supplyName: u.supply.name,
    unit: u.supply.unit,
    quantityUsed: u.quantityUsed,
  }));
}
```

- [ ] **Step 2: Build `supplyOptions` at both page call sites**

In `src/app/dashboard/consultas/page.tsx`, add the import:

```ts
import { getSupplies } from "@/features/clinic/data/supplies";
```

Add `getSupplies(clinic.id)` to the existing `Promise.all` — it currently is:

```ts
  const [patients, treatmentOptions, insuranceOptions] = clinic
    ? await Promise.all([
        getPatients(clinic.id),
        getClinicOptions(clinic.id, "treatment"),
        getClinicOptions(clinic.id, "insurance"),
      ])
    : [[], [], []];
```

Replace it with:

```ts
  const [patients, treatmentOptions, insuranceOptions, supplies] = clinic
    ? await Promise.all([
        getPatients(clinic.id),
        getClinicOptions(clinic.id, "treatment"),
        getClinicOptions(clinic.id, "insurance"),
        getSupplies(clinic.id),
      ])
    : [[], [], [], []];
```

Build `supplyOptions` right after the existing `treatmentPrices` line, and pass it to both `NewConsultationDialog` and `ConsultationsView`:

```ts
  const supplyOptions = supplies.map((s) => ({ id: s.id, name: s.name, unit: s.unit }));
```

```tsx
      <PageHeader
        title="Consultas/Tratamientos"
        description="Historial de todo lo realizado a los pacientes."
        icon={ClipboardList}
        action={
          <NewConsultationDialog
            patients={patients}
            treatmentOptions={treatmentLabels}
            treatmentPrices={treatmentPrices}
            insuranceOptions={insuranceLabels}
            supplyOptions={supplyOptions}
          />
        }
      />

      <ConsultationsView
        consultations={consultations}
        patients={patients}
        treatmentOptions={treatmentLabels}
        treatmentPrices={treatmentPrices}
        supplyOptions={supplyOptions}
      />
```

In `src/app/dashboard/pacientes/[id]/page.tsx`, add the import:

```ts
import { getSupplies } from "@/features/clinic/data/supplies";
```

Add the fetch and build `supplyOptions`, then pass it down — the relevant part currently is:

```tsx
  const treatmentOptions = clinic ? await getClinicOptions(clinic.id, "treatment") : [];
  const treatmentPrices = Object.fromEntries(
    treatmentOptions.filter((o) => o.price != null).map((o) => [o.label, o.price!]),
  );
  const balance = outstandingBalance(consultations);

  return (
    <PatientDetailView
      patient={patient}
      consultations={consultations}
      treatmentOptions={treatmentOptions.map((o) => o.label)}
      treatmentPrices={treatmentPrices}
      balance={balance}
    />
  );
}
```

Replace it with:

```tsx
  const treatmentOptions = clinic ? await getClinicOptions(clinic.id, "treatment") : [];
  const treatmentPrices = Object.fromEntries(
    treatmentOptions.filter((o) => o.price != null).map((o) => [o.label, o.price!]),
  );
  const supplies = clinic ? await getSupplies(clinic.id) : [];
  const supplyOptions = supplies.map((s) => ({ id: s.id, name: s.name, unit: s.unit }));
  const balance = outstandingBalance(consultations);

  return (
    <PatientDetailView
      patient={patient}
      consultations={consultations}
      treatmentOptions={treatmentOptions.map((o) => o.label)}
      treatmentPrices={treatmentPrices}
      supplyOptions={supplyOptions}
      balance={balance}
    />
  );
}
```

- [ ] **Step 3: Thread `supplyOptions` through `PatientDetailView` → `ConsultationsList`/`NewConsultationDialog`**

In `src/features/patients/components/patient-detail-view.tsx`, add the import:

```ts
import type { SupplyOption } from "@/features/consultations/components/supplies-used-field";
```

Add the `supplyOptions` prop — the signature currently is:

```tsx
export function PatientDetailView({
  patient,
  consultations,
  treatmentOptions,
  treatmentPrices,
  balance,
}: {
  patient: Patient | null;
  consultations: Consultation[];
  treatmentOptions: string[];
  treatmentPrices: Record<string, number>;
  balance: number;
}) {
```

Replace it with:

```tsx
export function PatientDetailView({
  patient,
  consultations,
  treatmentOptions,
  treatmentPrices,
  supplyOptions,
  balance,
}: {
  patient: Patient | null;
  consultations: Consultation[];
  treatmentOptions: string[];
  treatmentPrices: Record<string, number>;
  supplyOptions: SupplyOption[];
  balance: number;
}) {
```

Update the `NewConsultationDialog` usage:

```tsx
            <NewConsultationDialog
              fixedPatientId={patient.id}
              fixedPatientName={patient.name}
              treatmentOptions={treatmentOptions}
              treatmentPrices={treatmentPrices}
              supplyOptions={supplyOptions}
              toothHistory={toothHistory}
            />
```

Update the `ConsultationsList` usage:

```tsx
        <ConsultationsList
          consultations={consultations}
          showPatient={false}
          fixedPatientName={patient.name}
          emptyMessage="Todavía no hay consultas registradas para este paciente."
          treatmentOptions={treatmentOptions}
          treatmentPrices={treatmentPrices}
          supplyOptions={supplyOptions}
        />
```

- [ ] **Step 4: Thread `supplyOptions` through `ConsultationsView`/`ConsultationsList` → `ConsultationsTable`**

In `src/features/consultations/components/consultations-view.tsx`, add the import:

```ts
import type { SupplyOption } from "@/features/consultations/components/supplies-used-field";
```

Add the prop to the component signature — it currently is:

```tsx
export function ConsultationsView({
  consultations,
  patients,
  treatmentOptions,
  treatmentPrices,
}: {
  consultations: Consultation[];
  patients: Patient[];
  treatmentOptions: string[];
  treatmentPrices: Record<string, number>;
}) {
```

Replace it with:

```tsx
export function ConsultationsView({
  consultations,
  patients,
  treatmentOptions,
  treatmentPrices,
  supplyOptions,
}: {
  consultations: Consultation[];
  patients: Patient[];
  treatmentOptions: string[];
  treatmentPrices: Record<string, number>;
  supplyOptions: SupplyOption[];
}) {
```

Add it to the `<ConsultationsTable>` call:

```tsx
      <ConsultationsTable
        consultations={pageItems}
        patients={patients}
        showPatient
        treatmentOptions={treatmentOptions}
        treatmentPrices={treatmentPrices}
        supplyOptions={supplyOptions}
        emptyMessage={
```

Do the same in `src/features/consultations/components/consultations-list.tsx` — add the import, add `supplyOptions: SupplyOption[]` to the component signature, and add `supplyOptions={supplyOptions}` to its own `<ConsultationsTable>` call.

- [ ] **Step 5: Thread `supplyOptions` through `ConsultationsTable` → the dialogs**

In `src/features/consultations/components/consultations-table.tsx`, add the import:

```ts
import type { SupplyOption } from "@/features/consultations/components/supplies-used-field";
```

Add the prop to the component signature — it currently is:

```tsx
export function ConsultationsTable({
  consultations,
  patients,
  treatmentOptions,
  treatmentPrices,
  showPatient = true,
  fixedPatientName,
  emptyMessage = "Todavía no hay consultas registradas.",
}: {
  consultations: Consultation[];
  patients?: Patient[];
  treatmentOptions: string[];
  treatmentPrices: Record<string, number>;
  showPatient?: boolean;
  fixedPatientName?: string;
  emptyMessage?: string;
}) {
```

Replace it with:

```tsx
export function ConsultationsTable({
  consultations,
  patients,
  treatmentOptions,
  treatmentPrices,
  supplyOptions,
  showPatient = true,
  fixedPatientName,
  emptyMessage = "Todavía no hay consultas registradas.",
}: {
  consultations: Consultation[];
  patients?: Patient[];
  treatmentOptions: string[];
  treatmentPrices: Record<string, number>;
  supplyOptions: SupplyOption[];
  showPatient?: boolean;
  fixedPatientName?: string;
  emptyMessage?: string;
}) {
```

Add it to the `<EditConsultationDialog>` call:

```tsx
        <EditConsultationDialog
          key={`edit-${editing.id}`}
          consultation={editing}
          patientName={nameFor(editing)}
          treatmentOptions={treatmentOptions}
          treatmentPrices={treatmentPrices}
          supplyOptions={supplyOptions}
          open
```

- [ ] **Step 6: Add the field to `NewConsultationDialog`**

In `src/features/consultations/components/new-consultation-dialog.tsx`, add the imports:

```ts
import {
  SuppliesUsedField,
  type SupplyOption,
} from "@/features/consultations/components/supplies-used-field";
import type { SupplyUsageInput } from "@/features/clinic/data/consultations";
```

Add the `supplyOptions` prop — the signature currently is:

```tsx
export function NewConsultationDialog({
  patients = [],
  fixedPatientId,
  fixedPatientName,
  treatmentOptions,
  treatmentPrices = {},
  insuranceOptions = [],
  toothHistory = {},
  open: openProp,
  onOpenChange: onOpenChangeProp,
}: {
  patients?: PatientOption[];
  fixedPatientId?: string;
  fixedPatientName?: string;
  treatmentOptions: string[];
  treatmentPrices?: Record<string, number>;
  insuranceOptions?: string[];
  toothHistory?: ToothHistory;
  /** Controlled mode, for opening this programmatically (e.g. right
   * after marking a turno completed) instead of from its own trigger
   * button — omit both to keep the default self-contained behavior. */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}) {
```

Replace it with:

```tsx
export function NewConsultationDialog({
  patients = [],
  fixedPatientId,
  fixedPatientName,
  treatmentOptions,
  treatmentPrices = {},
  insuranceOptions = [],
  supplyOptions = [],
  toothHistory = {},
  open: openProp,
  onOpenChange: onOpenChangeProp,
}: {
  patients?: PatientOption[];
  fixedPatientId?: string;
  fixedPatientName?: string;
  treatmentOptions: string[];
  treatmentPrices?: Record<string, number>;
  insuranceOptions?: string[];
  supplyOptions?: SupplyOption[];
  toothHistory?: ToothHistory;
  /** Controlled mode, for opening this programmatically (e.g. right
   * after marking a turno completed) instead of from its own trigger
   * button — omit both to keep the default self-contained behavior. */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}) {
```

(`supplyOptions` defaults to `[]`, same reasoning as `treatmentPrices` defaulting to `{}` — the two call sites inside the appointments feature that render this dialog, found during Precios y Cobros, don't have supply data piped to them either, and shouldn't need to for this feature to work everywhere else.)

Add local state for the list, right after the existing `amountTouched` state:

```ts
  const [supplyUsages, setSupplyUsages] = useState<SupplyUsageInput[]>([]);
```

In `onSubmit`, add `supplies: supplyUsages.length ? supplyUsages : undefined,` to the `createConsultationAction` call — it currently is:

```ts
    await createConsultationAction({
      patientId: finalPatientId,
      date: combineDateAndTime(values.date, values.time),
      treatment:
        values.treatment === OTHER_TREATMENT
          ? values.treatmentOther!.trim()
          : values.treatment,
      teeth: values.teeth?.length ? values.teeth : undefined,
      notes: values.notes || undefined,
      amountCharged: chargedNum,
      amountPaid: paidNum,
      newPatient: isNewPatient
```

Replace it with:

```ts
    await createConsultationAction({
      patientId: finalPatientId,
      date: combineDateAndTime(values.date, values.time),
      treatment:
        values.treatment === OTHER_TREATMENT
          ? values.treatmentOther!.trim()
          : values.treatment,
      teeth: values.teeth?.length ? values.teeth : undefined,
      notes: values.notes || undefined,
      amountCharged: chargedNum,
      amountPaid: paidNum,
      supplies: supplyUsages.length ? supplyUsages : undefined,
      newPatient: isNewPatient
```

Reset the list after a successful save — right after the existing `setAmountTouched(false);` line in `onSubmit`, add:

```ts
    setSupplyUsages([]);
```

Add the field to the JSX, right after the "Observaciones" block (at the end of the form, before the closing `</div>` of `className="grid gap-4 py-4"`) — it currently ends with:

```tsx
            <div className="space-y-2">
              <Label htmlFor="notes">Observaciones (opcional)</Label>
              <Textarea
                id="notes"
                placeholder="Diagnóstico, indicaciones, próxima cita..."
                rows={3}
                {...register("notes")}
              />
            </div>
          </div>
```

Replace it with:

```tsx
            <div className="space-y-2">
              <Label htmlFor="notes">Observaciones (opcional)</Label>
              <Textarea
                id="notes"
                placeholder="Diagnóstico, indicaciones, próxima cita..."
                rows={3}
                {...register("notes")}
              />
            </div>

            {supplyOptions.length > 0 && (
              <SuppliesUsedField
                supplies={supplyOptions}
                value={supplyUsages}
                onChange={setSupplyUsages}
              />
            )}
          </div>
```

- [ ] **Step 7: Add the field to `EditConsultationDialog`, prefilled from existing usages**

In `src/features/consultations/components/edit-consultation-dialog.tsx`, add the imports:

```ts
import { getConsultationUsages } from "@/features/clinic/data/consultations";
```

Wait — this is a client component (`"use client"` at the top of the file) calling a data-layer function directly would break (data-layer functions use Prisma, server-only). Instead, fetch the existing usages via a new server action. Add this action to `src/features/consultations/actions.ts`, right after the existing imports and `requireClinicId`:

```ts
export async function getConsultationUsagesAction(consultationId: string) {
  const clinicId = await requireClinicId();
  return getConsultationUsages(clinicId, consultationId);
}
```

(add `getConsultationUsages` to the existing `@/features/clinic/data/consultations` import in `actions.ts`.)

Now in `edit-consultation-dialog.tsx`, add the imports:

```ts
import { getConsultationUsagesAction, updateConsultationAction } from "@/features/consultations/actions";
import {
  SuppliesUsedField,
  type SupplyOption,
} from "@/features/consultations/components/supplies-used-field";
import type { SupplyUsageInput } from "@/features/clinic/data/consultations";
```

(this replaces the existing single-line `import { updateConsultationAction } from "@/features/consultations/actions";`.)

Add the `supplyOptions` prop — the signature currently is:

```tsx
export function EditConsultationDialog({
  consultation,
  patientName,
  treatmentOptions,
  treatmentPrices,
  open,
  onOpenChange,
}: {
  consultation: Consultation;
  patientName: string;
  treatmentOptions: string[];
  treatmentPrices: Record<string, number>;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
```

Replace it with:

```tsx
export function EditConsultationDialog({
  consultation,
  patientName,
  treatmentOptions,
  treatmentPrices,
  supplyOptions = [],
  open,
  onOpenChange,
}: {
  consultation: Consultation;
  patientName: string;
  treatmentOptions: string[];
  treatmentPrices: Record<string, number>;
  supplyOptions?: SupplyOption[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
```

Add local state, right after the existing `amountTouched` state:

```ts
  const [supplyUsages, setSupplyUsages] = useState<SupplyUsageInput[]>([]);
```

Extend the existing `open`-triggered `useEffect` to also fetch and prefill the usages — it currently is:

```ts
  useEffect(() => {
    if (open) {
      reset(toFormValues(consultation, treatmentOptions));
      setDentitionMode("adulto");
      setDiscountPercent("");
      setAmountTouched(consultation.amountCharged != null);
    }
  }, [open, consultation, treatmentOptions, reset]);
```

Replace it with:

```ts
  useEffect(() => {
    if (!open) return;
    reset(toFormValues(consultation, treatmentOptions));
    setDentitionMode("adulto");
    setDiscountPercent("");
    setAmountTouched(consultation.amountCharged != null);
    setSupplyUsages([]);
    getConsultationUsagesAction(consultation.id).then((usages) => {
      setSupplyUsages(usages.map((u) => ({ supplyId: u.supplyId, quantityUsed: u.quantityUsed })));
    });
  }, [open, consultation, treatmentOptions, reset]);
```

In `onSubmit`, add `supplies: supplyUsages.length ? supplyUsages : undefined,` to the `updateConsultationAction` call — it currently is:

```ts
    await updateConsultationAction(consultation.id, {
      date: combineDateAndTime(values.date, values.time),
      treatment: values.treatment === OTHER_TREATMENT ? values.treatmentOther!.trim() : values.treatment,
      teeth: values.teeth?.length ? values.teeth : undefined,
      notes: values.notes || undefined,
      amountCharged: chargedNum,
      amountPaid: paidNum,
    });
    onOpenChange(false);
  };
```

Replace it with:

```ts
    await updateConsultationAction(consultation.id, {
      date: combineDateAndTime(values.date, values.time),
      treatment: values.treatment === OTHER_TREATMENT ? values.treatmentOther!.trim() : values.treatment,
      teeth: values.teeth?.length ? values.teeth : undefined,
      notes: values.notes || undefined,
      amountCharged: chargedNum,
      amountPaid: paidNum,
      supplies: supplyUsages.length ? supplyUsages : undefined,
    });
    onOpenChange(false);
  };
```

Add the field to the JSX, right after the "Observaciones" block, same placement as Step 6 — it currently ends with:

```tsx
            <div className="space-y-2">
              <Label htmlFor="edit-notes">Observaciones (opcional)</Label>
              <Textarea
                id="edit-notes"
                placeholder="Diagnóstico, indicaciones, próxima cita..."
                rows={3}
                {...register("notes")}
              />
            </div>
          </div>
```

Replace it with:

```tsx
            <div className="space-y-2">
              <Label htmlFor="edit-notes">Observaciones (opcional)</Label>
              <Textarea
                id="edit-notes"
                placeholder="Diagnóstico, indicaciones, próxima cita..."
                rows={3}
                {...register("notes")}
              />
            </div>

            {supplyOptions.length > 0 && (
              <SuppliesUsedField
                idPrefix="edit-"
                supplies={supplyOptions}
                value={supplyUsages}
                onChange={setSupplyUsages}
              />
            )}
          </div>
```

- [ ] **Step 8: Type-check**

Run: `npx tsc --noEmit -p .`
Expected: no errors. If `supplyOptions` is reported missing anywhere, search the codebase for every `<NewConsultationDialog`, `<ConsultationsView`, `<ConsultationsList`, `<ConsultationsTable`, `<EditConsultationDialog` usage (the same five that `treatmentPrices` touched during Precios y Cobros) and confirm each one now passes it where required.

- [ ] **Step 9: Run the full unit suite**

Run: `npm test`
Expected: all tests still pass (this task touched no data-layer validation logic, only plumbing and UI).

- [ ] **Step 10: Manual smoke-check**

Run: `npm run dev`, then in a browser:
1. In Stock, create an insumo "Gomillas" with unidad "unidad" and stock `100` (if not already done from Task 6's smoke-check).
2. Go to `/dashboard/consultas`, "Nueva consulta", pick a patient and a treatment. Scroll down — confirm "Insumos utilizados (opcional)" appears below Observaciones.
3. Pick "Gomillas", type `10`, click Agregar. Confirm it appears in the list as "Gomillas × 10 unidad".
4. Save the consultation. Go to Stock — confirm "Gomillas" now shows `90 unidad`.
5. Edit that same consultation. Confirm "Insumos utilizados" is prefilled with "Gomillas × 10 unidad". Change the quantity: remove it, re-add "Gomillas" with `5`. Save.
6. Go to Stock — confirm it now shows `95 unidad` (100 - 5, not 100 - 10 - 5 — the old usage was restored before the new one applied).
7. Delete that consultation. Go to Stock — confirm "Gomillas" is back to `100 unidad`.

- [ ] **Step 11: Commit**

```bash
git add src/features/consultations/components/new-consultation-dialog.tsx src/features/consultations/components/edit-consultation-dialog.tsx src/features/consultations/components/consultations-table.tsx src/features/consultations/components/consultations-view.tsx src/features/consultations/components/consultations-list.tsx src/features/patients/components/patient-detail-view.tsx src/app/dashboard/consultas/page.tsx src/app/dashboard/pacientes/\[id\]/page.tsx src/features/consultations/actions.ts src/features/clinic/data/consultations.ts
git commit -m "feat: add Insumos utilizados to the consultation dialogs, wired to stock"
```

---

## Task 10: Seed data — supplies and a realistic usage mix

**Files:**
- Modify: `prisma/seed.ts`

- [ ] **Step 1: Seed a handful of supplies**

In `prisma/seed.ts`, add a new constant near the other `DEFAULT_*` constants:

```ts
const DEFAULT_SUPPLIES = [
  { name: "Gomillas de ortodoncia", unit: "unidad", price: 50, quantity: 300, lowStockAt: 50 },
  { name: "Anestesia", unit: "ampolla", price: 800, quantity: 40, lowStockAt: 10 },
  { name: "Guantes de nitrilo", unit: "caja", price: 4500, quantity: 8, lowStockAt: 3 },
  { name: "Composite (resina)", unit: "ml", price: 1200, quantity: 150, lowStockAt: 30 },
  { name: "Gutapercha", unit: "unidad", price: 300, quantity: 60, lowStockAt: 15 },
];
```

Add a new function, right after `ensureClinicOptions`:

```ts
async function ensureSupplies(clinicId: string) {
  const existing = await prisma.supply.findFirst({ where: { clinicId } });
  if (existing) return;
  await prisma.supply.createMany({
    data: DEFAULT_SUPPLIES.map((s) => ({ clinicId, ...s })),
  });
}
```

- [ ] **Step 2: Attach a realistic usage mix to a couple of seeded consultations**

In `seedConsultations`, after the `rows` array is defined and the `for (const row of rows)` loop finishes creating consultations, add supply usage to a couple of them. Find where `seedConsultations` is called from `main()` and change the call site to also receive the clinic's seeded supplies, then thread one or two usages into two of the rows.

Change `seedConsultations`'s signature to accept the created supplies, and change two of its existing rows to carry a `supplies` field — the function currently starts:

```ts
async function seedConsultations(clinicId: string, patients: Awaited<ReturnType<typeof seedPatients>>) {
  const now = new Date();
  const daysAgo = (n: number) => new Date(now.getTime() - n * 24 * 60 * 60 * 1000);

  const rows = [
    { patient: 0, daysAgo: 45, treatment: "Consulta / diagnóstico", teeth: [], notes: "Primera consulta, sin urgencias.", amountCharged: 8000, amountPaid: 8000 },
    { patient: 0, daysAgo: 10, treatment: "Limpieza", teeth: [], amountCharged: 15000, amountPaid: 0 },
```

Replace the signature and the first two rows with:

```ts
async function seedConsultations(
  clinicId: string,
  patients: Awaited<ReturnType<typeof seedPatients>>,
  supplies: Awaited<ReturnType<typeof prisma.supply.findMany>>,
) {
  const now = new Date();
  const daysAgo = (n: number) => new Date(now.getTime() - n * 24 * 60 * 60 * 1000);
  const supplyByName = (name: string) => supplies.find((s) => s.name === name)!;

  const rows = [
    { patient: 0, daysAgo: 45, treatment: "Consulta / diagnóstico", teeth: [], notes: "Primera consulta, sin urgencias.", amountCharged: 8000, amountPaid: 8000 },
    {
      patient: 10,
      daysAgo: 12,
      treatment: "Ortodoncia",
      teeth: [],
      notes: "Control mensual de brackets.",
      amountCharged: 35000,
      amountPaid: 35000,
      supplies: [{ supplyId: supplyByName("Gomillas de ortodoncia").id, quantityUsed: 12 }],
    },
    { patient: 0, daysAgo: 10, treatment: "Limpieza", teeth: [], amountCharged: 15000, amountPaid: 0 },
```

Remove the now-duplicated original "Ortodoncia" row further down the list (it previously read `{ patient: 10, daysAgo: 12, treatment: "Ortodoncia", teeth: [], notes: "Control mensual de brackets.", amountCharged: 35000, amountPaid: 35000 },`) since it's now the second row above — delete that later duplicate line entirely so patient 10 doesn't get two identical Ortodoncia rows.

Update the `for (const row of rows)` loop to pass `supplies` through — it currently is:

```ts
  for (const row of rows) {
    await prisma.consultation.create({
      data: {
        clinicId,
        patientId: patients[row.patient].id,
        date: daysAgo(row.daysAgo),
        treatment: row.treatment,
        teeth: row.teeth,
        notes: row.notes ?? null,
        amountCharged: row.amountCharged ?? null,
        amountPaid: row.amountPaid ?? 0,
      },
    });
  }
}
```

Replace it with:

```ts
  for (const row of rows) {
    const consultation = await prisma.consultation.create({
      data: {
        clinicId,
        patientId: patients[row.patient].id,
        date: daysAgo(row.daysAgo),
        treatment: row.treatment,
        teeth: row.teeth,
        notes: row.notes ?? null,
        amountCharged: row.amountCharged ?? null,
        amountPaid: row.amountPaid ?? 0,
      },
    });
    for (const usage of row.supplies ?? []) {
      await prisma.supply.update({
        where: { id: usage.supplyId },
        data: { quantity: { decrement: usage.quantityUsed } },
      });
      await prisma.consultationSupply.create({
        data: { consultationId: consultation.id, supplyId: usage.supplyId, quantityUsed: usage.quantityUsed },
      });
    }
  }
}
```

- [ ] **Step 3: Wire it into `main()`**

In `prisma/seed.ts`, `main()` currently reads:

```ts
  await ensureBusinessHours(clinic.id);
  await ensureClinicOptions(clinic.id);

  const patients = await seedPatients(clinic.id);
  console.log(`  ${patients.length} pacientes creados`);

  await seedConsultations(clinic.id, patients);
  console.log(`  consultas creadas`);
```

Replace it with:

```ts
  await ensureBusinessHours(clinic.id);
  await ensureClinicOptions(clinic.id);
  await ensureSupplies(clinic.id);
  const supplies = await prisma.supply.findMany({ where: { clinicId: clinic.id } });

  const patients = await seedPatients(clinic.id);
  console.log(`  ${patients.length} pacientes creados`);

  await seedConsultations(clinic.id, patients, supplies);
  console.log(`  consultas creadas`);
```

The rest of `main()` (the appointments seeding below this, and `assertNotProduction()` above it) is unchanged.

- [ ] **Step 4: Run it against a scratch clinic to confirm it works**

Run: `CLINIC_ID=<a non-production clinic id> npm run db:seed`
Expected: completes with no errors; the printed summary still reads as before. Do **not** run this against the real "Capeans" clinic — `seedPatients`/`seedConsultations` have no idempotency guard (pre-existing, documented during Precios y Cobros), so re-running against live data duplicates fake patients. Use one of the dedicated E2E scratch clinics instead.

- [ ] **Step 5: Commit**

```bash
git add prisma/seed.ts
git commit -m "feat: seed default supplies and a sample consultation usage"
```

---

## Task 11: E2E — Stock page

**Files:**
- Create: `e2e/stock.spec.ts`

- [ ] **Step 1: Write the tests**

Create `e2e/stock.spec.ts`:

```ts
import { test, expect } from "@playwright/test";
import { clerk } from "@clerk/testing/playwright";

test("an insumo can be added, restocked, and shows a low-stock color at its threshold", async ({
  page,
}) => {
  await page.goto("/sign-in");
  await clerk.signIn({ page, emailAddress: process.env.E2E_TEST_EMAIL! });

  await page.goto("/dashboard/stock");

  const name = `Insumo E2E ${Date.now()}`;
  await page.getByPlaceholder("Agregar nuevo...").fill(name);
  await page.getByPlaceholder("Unidad (ej: unidad, caja, ml)").fill("unidad");
  await page.getByPlaceholder("Precio (opcional)").fill("50");
  await page.getByPlaceholder("Stock inicial").fill("100");
  await page.getByRole("button", { name: "Agregar" }).click();
  await page.getByPlaceholder("Buscar...").fill(name);
  await expect(page.getByText(name, { exact: true })).toBeVisible();
  await expect(page.getByText("100 unidad", { exact: false })).toBeVisible();

  await page.getByRole("button", { name: `Reponer ${name}` }).click();
  // A thousands separator must be rejected, not silently parsed down
  // (Number("1.000") === 1) — same mistake already found and fixed for
  // consultation amounts.
  await page.getByRole("spinbutton", { name: `Cantidad a reponer de ${name}` }).fill("1.000");
  await page.getByRole("button", { name: "Confirmar reposición" }).click();
  await expect(page.getByText("sin puntos ni comas", { exact: false })).toBeVisible();
  await expect(page.getByText("100 unidad", { exact: false })).toBeVisible(); // unchanged

  await page.getByRole("spinbutton", { name: `Cantidad a reponer de ${name}` }).fill("20");
  await page.getByRole("button", { name: "Confirmar reposición" }).click();
  await expect(page.getByText("120 unidad", { exact: false })).toBeVisible();

  await page.getByRole("button", { name: `Editar ${name}` }).click();
  await page.getByRole("spinbutton", { name: `Umbral de stock bajo de ${name}` }).fill("150");
  await page.getByRole("button", { name: "Guardar" }).click();
  // 120 <= 150 → "low" styling; just confirm the quantity text is still
  // there and rendered (color itself isn't practical to assert via text).
  await expect(page.getByText("120 unidad", { exact: false })).toBeVisible();

  // Cleanup.
  await page.getByRole("button", { name: `Eliminar ${name}` }).click();
  await page.getByRole("button", { name: "Eliminar", exact: true }).click();
  await expect(page.getByText(name, { exact: true })).toHaveCount(0);
});

test("a duplicate insumo name is rejected, and an insumo in use can't be deleted", async ({ page }) => {
  await page.goto("/sign-in");
  await clerk.signIn({ page, emailAddress: process.env.E2E_TEST_EMAIL! });

  const name = `Insumo Dup E2E ${Date.now()}`;
  await page.goto("/dashboard/stock");
  await page.getByPlaceholder("Agregar nuevo...").fill(name);
  await page.getByPlaceholder("Unidad (ej: unidad, caja, ml)").fill("unidad");
  await page.getByRole("button", { name: "Agregar" }).click();
  await page.getByPlaceholder("Buscar...").fill(name);
  await expect(page.getByText(name, { exact: true })).toBeVisible();

  await page.getByPlaceholder("Buscar...").fill("");
  await page.getByPlaceholder("Agregar nuevo...").fill(name);
  await page.getByPlaceholder("Unidad (ej: unidad, caja, ml)").fill("unidad");
  await page.getByRole("button", { name: "Agregar" }).click();
  await expect(page.getByText("Ya existe un insumo con ese nombre")).toBeVisible();

  // Use it in a consultation, then confirm deletion is blocked.
  await page.goto("/dashboard/consultas");
  await page.getByRole("button", { name: "Nueva consulta" }).click();
  await page.getByRole("combobox").first().click();
  await page.getByRole("option").first().click();
  await page.getByText("Elegí un tratamiento").click();
  await page.getByRole("option", { name: "Limpieza" }).click();
  await page.locator('[id$="supplySelect"]').first().click();
  await page.getByRole("option", { name: new RegExp(name) }).click();
  await page.locator('[id$="supplyQuantity"]').first().fill("1");
  await page.getByRole("button", { name: "Agregar" }).click();
  await page.getByRole("button", { name: "Guardar", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Nueva consulta" })).toHaveCount(0);

  await page.goto("/dashboard/stock");
  await page.getByPlaceholder("Buscar...").fill(name);
  await page.getByRole("button", { name: `Eliminar ${name}` }).click();
  await page.getByRole("button", { name: "Eliminar", exact: true }).click();
  await expect(
    page.getByText("No se puede eliminar un insumo que ya fue usado en alguna consulta"),
  ).toBeVisible();
});
```

- [ ] **Step 2: Run them**

Run: `npx playwright test e2e/stock.spec.ts`
Expected: both PASS. The second test creates a consultation it never cleans up (its insumo can't be deleted, so neither can the consultation referencing it be trivially un-done without also deleting the consultation first) — if cleanup turns out to matter for later test runs sharing the same scratch clinic, add a consultation-deletion step before the final insumo-deletion attempt, but note that would make the "can't delete" assertion impossible to reach; leave the insumo and its one consultation behind deliberately, named uniquely by timestamp so it never collides with a later run.

- [ ] **Step 3: Commit**

```bash
git add e2e/stock.spec.ts
git commit -m "test: add E2E coverage for the Stock page"
```

---

## Task 12: E2E — consultation and stock interaction

**Files:**
- Modify: `e2e/consultations.spec.ts`

- [ ] **Step 1: Write the test**

Add this test to `e2e/consultations.spec.ts`, after the last existing test:

```ts
test("adding, editing, and removing insumos on a consultation reconciles stock correctly", async ({
  page,
}) => {
  await page.goto("/sign-in");
  await clerk.signIn({ page, emailAddress: process.env.E2E_TEST_EMAIL! });

  const supplyName = `Insumo Reconcile E2E ${Date.now()}`;
  await page.goto("/dashboard/stock");
  await page.getByPlaceholder("Agregar nuevo...").fill(supplyName);
  await page.getByPlaceholder("Unidad (ej: unidad, caja, ml)").fill("unidad");
  await page.getByPlaceholder("Stock inicial").fill("100");
  await page.getByRole("button", { name: "Agregar" }).click();
  await page.getByPlaceholder("Buscar...").fill(supplyName);
  await expect(page.getByText("100 unidad", { exact: false })).toBeVisible();

  const patientName = `Paciente Stock E2E ${Date.now()}`;
  await page.goto("/dashboard/consultas");
  await page.getByRole("button", { name: "Nueva consulta" }).click();
  await page.getByRole("combobox").first().click();
  await page.getByRole("option", { name: "Agregar paciente nuevo" }).click();
  await page.fill("#newPatientName", patientName);
  await page.fill("#newPatientPhone", "11 2222-3333");
  await page.getByText("Elegí un tratamiento").click();
  await page.getByRole("option", { name: "Limpieza" }).click();
  await page.locator('[id$="supplySelect"]').first().click();
  await page.getByRole("option", { name: new RegExp(supplyName) }).click();
  await page.locator('[id$="supplyQuantity"]').first().fill("10");
  await page.getByRole("button", { name: "Agregar" }).click();
  await expect(page.getByText(`${supplyName} × 10`, { exact: false })).toBeVisible();
  await page.getByRole("button", { name: "Guardar", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Nueva consulta" })).toHaveCount(0);

  await page.goto("/dashboard/stock");
  await page.getByPlaceholder("Buscar...").fill(supplyName);
  await expect(page.getByText("90 unidad", { exact: false })).toBeVisible();

  // Edit the consultation: change the quantity used from 10 to 5.
  await page.goto("/dashboard/consultas");
  await page.locator("#filter-patient").fill(patientName);
  const row = page.locator("tbody tr", { hasText: patientName });
  await row.getByRole("button", { name: "Editar consulta" }).click();
  await expect(page.getByText(`${supplyName} × 10`, { exact: false })).toBeVisible();
  await page.getByRole("button", { name: `Quitar ${supplyName}` }).click();
  await page.locator('[id$="supplySelect"]').first().click();
  await page.getByRole("option", { name: new RegExp(supplyName) }).click();
  await page.locator('[id$="supplyQuantity"]').first().fill("5");
  await page.getByRole("button", { name: "Agregar" }).click();
  await page.getByRole("button", { name: "Guardar cambios" }).click();
  await expect(page.getByText("Editar consulta")).toHaveCount(0);

  await page.goto("/dashboard/stock");
  await page.getByPlaceholder("Buscar...").fill(supplyName);
  await expect(page.getByText("95 unidad", { exact: false })).toBeVisible(); // 100 - 5, not 100 - 10 - 5

  // Delete the consultation entirely — stock fully restores.
  await page.goto("/dashboard/consultas");
  await page.locator("#filter-patient").fill(patientName);
  await row.getByRole("button", { name: "Eliminar consulta" }).click();
  await page.getByRole("button", { name: "Eliminar", exact: true }).last().click();
  await expect(page.locator("tbody").getByText(patientName)).toHaveCount(0);

  await page.goto("/dashboard/stock");
  await page.getByPlaceholder("Buscar...").fill(supplyName);
  await expect(page.getByText("100 unidad", { exact: false })).toBeVisible();

  // Cleanup the insumo.
  await page.getByRole("button", { name: `Eliminar ${supplyName}` }).click();
  await page.getByRole("button", { name: "Eliminar", exact: true }).click();
  await expect(page.getByText(supplyName, { exact: true })).toHaveCount(0);
});
```

- [ ] **Step 2: Run it**

Run: `npx playwright test e2e/consultations.spec.ts -g "reconciles stock correctly"`
Expected: PASS. The `'[id$="supplySelect"]'` / `'[id$="supplyQuantity"]'` CSS selectors target the `SuppliesUsedField`'s ids regardless of the `idPrefix` each dialog uses ("" for new, "edit-" for edit) — if `.first()` turns out ambiguous once other same-shaped ids exist elsewhere on the page, scope it further (e.g. wrap `SuppliesUsedField` in a container with a stable test id and query within that), but don't change the component's markup just to satisfy the test selector.

- [ ] **Step 3: Run the full E2E suite**

Run: `npx playwright test`
Expected: all specs pass, including everything from earlier sessions. If a single, unrelated test fails and passes again when re-run alone, that's the known environmental flakiness under full-suite load documented repeatedly during Precios y Cobros (not a regression from this feature) — confirm by re-running that one test alone before concluding anything.

- [ ] **Step 4: Commit**

```bash
git add e2e/consultations.spec.ts
git commit -m "test: add E2E coverage for consultation/stock reconciliation"
```

---

## Final Verification

- [ ] Run `npx tsc --noEmit -p .` — no errors.
- [ ] Run `npm run lint` — no new warnings/errors beyond the three pre-existing React Hook Form ones.
- [ ] Run `npm test` — all unit tests pass.
- [ ] Run `npx playwright test` — all E2E specs pass.
- [ ] Manually re-read the spec's Review Focus items against the running app one more time: edit a consultation's insumos twice in a row and confirm stock never drifts; delete a consultation with insumos and confirm stock restores; type "1.000" into a restock/quantity field and confirm it's rejected; try deleting an insumo in use and confirm the friendly message; try creating two insumos with the same name and confirm the friendly message (not a raw Prisma error).

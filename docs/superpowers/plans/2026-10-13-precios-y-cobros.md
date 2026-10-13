# Precios y Cobros Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a treatment carry a list price, let each consultation record what was actually charged and paid (with a manual discount-% calculator), surface payment status everywhere a consultation shows up, and roll it up into a patient balance and a clinic-wide "Por cobrar" dashboard figure.

**Architecture:** Two nullable/defaulted columns (`ClinicOption.price`, `Consultation.amountCharged`, `Consultation.amountPaid`) — no new tables. Payment status (Pendiente/Parcial/Cobrado/Sin monto) is a pure function of those two numbers, computed on read, never stored. A discount-% field lives only in the consultation form's local state, as a calculator for `amountCharged` — it is never sent to the server.

**Tech Stack:** Next.js 16 (App Router, Server Components + Server Actions), Prisma 6 / PostgreSQL, react-hook-form + zod, Vitest (data-layer unit tests against a real Postgres test DB), Playwright Test (E2E).

**Spec:** `docs/superpowers/specs/2026-10-13-precios-y-cobros-design.md`

## Global Constraints

- Every read/write to `Patient`/`Consultation`/`ClinicOption` goes through `src/features/clinic/data/*.ts` — no direct Prisma calls from components, actions, or pages.
- Money is whole pesos (`Int`), never a `Float`/`Decimal` — no centavos anywhere in this feature.
- `price`, `amountCharged` are nullable and optional everywhere (DB, types, forms) — nothing in this feature may require a price to save a treatment or a consultation.
- The discount-% typed into the consultation form is never persisted — only the resulting `amountCharged` is.
- Payment status (`SIN_MONTO`/`PENDIENTE`/`PARCIAL`/`COBRADO`) is always derived from `amountCharged`/`amountPaid` via `paymentStatus()` in `src/features/clinic/lib/billing.ts` — never stored as its own column, never recomputed with different logic in two places.
- All money amounts render through `formatCurrency()` (`src/features/clinic/lib/format.ts`), `es-AR` locale, no decimals.
- Existing consultations keep `amountCharged = null` — no retroactive migration/backfill.

## Review Focus

- A negative or non-numeric amount/price/discount typed by hand (client validation AND the data-layer function both reject it, not just one) — most users will hit this before anything else.
- "Pagado hasta ahora" (Parcial) greater than "Monto a cobrar" — must be rejected, not silently saved as an overpayment.
- A treatment priced at exactly `$0` (a courtesy consultation the dentist deliberately tasa at zero) must read as **Cobrado**, not Pendiente or Sin monto — `paymentStatus()`'s check order matters here.
- The Estado de cobro filter combined with Tratamiento/Paciente/Pieza/Fecha at the same time must narrow by all of them together, not silently drop the others.
- Changing a treatment's list price in Configuración after consultations already used it must NOT change those past consultations' `amountCharged` — it's a snapshot taken at save time, not a live reference.

---

## Task 1: Schema migration — price and payment columns

**Files:**
- Modify: `prisma/schema.prisma`

**Interfaces:**
- Produces: `ClinicOption.price: number | null`, `Consultation.amountCharged: number | null`, `Consultation.amountPaid: number` (default `0`) on the generated Prisma Client, consumed by every later task.

- [ ] **Step 1: Add the columns**

In `prisma/schema.prisma`, find the `ClinicOption` model and add `price`:

```prisma
model ClinicOption {
  id       String @id @default(cuid())
  clinicId String
  clinic   Clinic @relation(fields: [clinicId], references: [id], onDelete: Cascade)

  category String
  label    String
  order    Int    @default(0)
  price    Int?   // precio de lista, pesos enteros. Solo aplica a category == "treatment".

  @@unique([clinicId, category, label])
  @@index([clinicId, category])
}
```

Find the `Consultation` model and add `amountCharged`/`amountPaid`:

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

  @@index([clinicId])
  @@index([patientId])
}
```

- [ ] **Step 2: Generate and apply the migration**

Run: `npx prisma migrate dev --name add_pricing_and_payments`
Expected: a new folder under `prisma/migrations/` is created, the migration applies to the dev DB, and Prisma Client regenerates with no errors.

- [ ] **Step 3: Confirm nothing else broke**

Run: `npm test`
Expected: all existing tests still pass (the new columns are nullable/defaulted, so every existing insert still works unchanged).

- [ ] **Step 4: Commit**

```bash
git add prisma/schema.prisma prisma/migrations
git commit -m "feat: add price and payment columns for Precios y Cobros"
```

---

## Task 2: Billing domain logic (`billing.ts`)

**Files:**
- Create: `src/features/clinic/lib/billing.ts`
- Create: `src/features/clinic/lib/billing.test.ts`

**Interfaces:**
- Consumes: nothing (pure functions, no Prisma import).
- Produces: `PaymentStatus` type, `paymentStatus(amountCharged, amountPaid)`, `PAYMENT_STATUS_LABELS`, `outstandingBalance(consultations)` — imported by every later data-layer and UI task.

- [ ] **Step 1: Write the failing tests**

Create `src/features/clinic/lib/billing.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { outstandingBalance, paymentStatus, PAYMENT_STATUS_LABELS } from "./billing";

describe("paymentStatus", () => {
  it("is SIN_MONTO when no amount was ever charged", () => {
    expect(paymentStatus(null, 0)).toBe("SIN_MONTO");
  });

  it("is PENDIENTE when nothing has been paid yet", () => {
    expect(paymentStatus(15000, 0)).toBe("PENDIENTE");
  });

  it("is PARCIAL when something was paid but not the full amount", () => {
    expect(paymentStatus(15000, 5000)).toBe("PARCIAL");
  });

  it("is COBRADO when the full amount was paid", () => {
    expect(paymentStatus(15000, 15000)).toBe("COBRADO");
  });

  it("is COBRADO (not PENDIENTE) for a treatment explicitly priced at $0", () => {
    // A courtesy consultation the dentist deliberately charges nothing for
    // — amountPaid (0) >= amountCharged (0) is true, so there's no debt,
    // which reads as "settled", not "awaiting payment".
    expect(paymentStatus(0, 0)).toBe("COBRADO");
  });

  it("is COBRADO even if amountPaid somehow exceeds amountCharged", () => {
    expect(paymentStatus(15000, 20000)).toBe("COBRADO");
  });
});

describe("outstandingBalance", () => {
  it("sums (charged - paid) across consultations with an amount", () => {
    const balance = outstandingBalance([
      { amountCharged: 15000, amountPaid: 5000 },
      { amountCharged: 10000, amountPaid: 10000 },
    ]);
    expect(balance).toBe(10000);
  });

  it("ignores consultations with no amount charged", () => {
    const balance = outstandingBalance([
      { amountCharged: null, amountPaid: 0 },
      { amountCharged: 5000, amountPaid: 0 },
    ]);
    expect(balance).toBe(5000);
  });

  it("never lets one overpaid consultation make the total negative", () => {
    const balance = outstandingBalance([
      { amountCharged: 10000, amountPaid: 15000 },
      { amountCharged: 5000, amountPaid: 0 },
    ]);
    expect(balance).toBe(5000);
  });

  it("is 0 for an empty list", () => {
    expect(outstandingBalance([])).toBe(0);
  });
});

describe("PAYMENT_STATUS_LABELS", () => {
  it("has a label for every status", () => {
    expect(PAYMENT_STATUS_LABELS.SIN_MONTO).toBeTruthy();
    expect(PAYMENT_STATUS_LABELS.PENDIENTE).toBeTruthy();
    expect(PAYMENT_STATUS_LABELS.PARCIAL).toBeTruthy();
    expect(PAYMENT_STATUS_LABELS.COBRADO).toBeTruthy();
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/features/clinic/lib/billing.test.ts`
Expected: FAIL — `Cannot find module './billing'`.

- [ ] **Step 3: Implement**

Create `src/features/clinic/lib/billing.ts`:

```ts
export type PaymentStatus = "SIN_MONTO" | "PENDIENTE" | "PARCIAL" | "COBRADO";

/** Derived, never stored: a consultation's payment status is always
 * computed from amountCharged/amountPaid, so it can never drift out of
 * sync with them the way a separately-saved status column could.
 *
 * COBRADO is checked before PENDIENTE on purpose: a treatment priced at
 * exactly $0 has amountPaid (0) >= amountCharged (0), which should read
 * as settled, not as "nothing paid yet". */
export function paymentStatus(
  amountCharged: number | null,
  amountPaid: number,
): PaymentStatus {
  if (amountCharged == null) return "SIN_MONTO";
  if (amountPaid >= amountCharged) return "COBRADO";
  if (amountPaid <= 0) return "PENDIENTE";
  return "PARCIAL";
}

export const PAYMENT_STATUS_LABELS: Record<PaymentStatus, string> = {
  SIN_MONTO: "Sin monto",
  PENDIENTE: "Pendiente",
  PARCIAL: "Parcial",
  COBRADO: "Cobrado",
};

/** Total still owed across a set of consultations — a patient's balance
 * (their own consultations) or the clinic's "Por cobrar" figure (every
 * consultation). Consultations with no amountCharged don't contribute
 * (never priced, not a debt). Math.max(0, …) means one accidentally
 * overpaid consultation can't offset what's owed on another. */
export function outstandingBalance(
  consultations: { amountCharged: number | null; amountPaid: number }[],
): number {
  return consultations.reduce((sum, c) => {
    if (c.amountCharged == null) return sum;
    return sum + Math.max(0, c.amountCharged - c.amountPaid);
  }, 0);
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run src/features/clinic/lib/billing.test.ts`
Expected: PASS, all 10 tests.

- [ ] **Step 5: Commit**

```bash
git add src/features/clinic/lib/billing.ts src/features/clinic/lib/billing.test.ts
git commit -m "feat: add payment-status and balance domain logic"
```

---

## Task 3: `formatCurrency` helper

**Files:**
- Modify: `src/features/clinic/lib/format.ts`
- Modify: `src/features/clinic/lib/format.test.ts`

**Interfaces:**
- Produces: `formatCurrency(amount: number): string`, used by every UI task from here on.

- [ ] **Step 1: Write the failing test**

Add to `src/features/clinic/lib/format.test.ts` (new `describe` block, alongside the existing ones):

```ts
import { formatCurrency } from "./format";
```

Add this import to the existing `import { ... } from "./format";` line at the top instead of a second import statement — the file already has one; extend it to:

```ts
import {
  combineDateAndTime,
  formatCurrency,
  formatTime,
  splitDateAndTime,
  toLocalDateString,
} from "./format";
```

Then add this block anywhere after the existing `describe` blocks:

```ts
describe("formatCurrency", () => {
  it("formats a whole-peso amount with thousands separators and no decimals", () => {
    expect(formatCurrency(1500000)).toBe("$1.500.000");
  });

  it("formats a small amount", () => {
    expect(formatCurrency(500)).toBe("$500");
  });

  it("formats zero", () => {
    expect(formatCurrency(0)).toBe("$0");
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run src/features/clinic/lib/format.test.ts`
Expected: FAIL — `formatCurrency` is not exported from `./format`.

- [ ] **Step 3: Implement**

Add to `src/features/clinic/lib/format.ts` (end of file):

```ts
/** Whole pesos only (no centavos — see the Global Constraints in the
 * Precios y Cobros plan) in Argentine thousands-separator notation. */
export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    maximumFractionDigits: 0,
  }).format(amount);
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run src/features/clinic/lib/format.test.ts`
Expected: PASS.

If the exact separator/symbol Node's `Intl` produces differs slightly from `"$1.500.000"` (ICU data can vary by Node version), adjust the test's expected string to match what actually prints — don't change the implementation to chase a specific string if the real output reads correctly as Argentine pesos.

- [ ] **Step 5: Commit**

```bash
git add src/features/clinic/lib/format.ts src/features/clinic/lib/format.test.ts
git commit -m "feat: add formatCurrency helper"
```

---

## Task 4: `ClinicOption.price` in the data layer

**Files:**
- Modify: `src/features/clinic/data/clinic-options.ts`
- Modify: `src/features/clinic/data/clinic-options.test.ts`

**Interfaces:**
- Consumes: nothing new.
- Produces: `createClinicOption(clinicId, category, label, price?)`, `updateClinicOption(clinicId, id, label, price?)` — both now price-aware; consumed by Task 6 (actions) and Task 15 (seed).

- [ ] **Step 1: Write the failing tests**

Add to `src/features/clinic/data/clinic-options.test.ts`, inside the existing `describe("clinic options data layer", ...)` block (anywhere after the other `createClinicOption` tests):

```ts
  it("creates a treatment option with a price", async () => {
    const option = await createClinicOption(clinicA.id, "treatment", "Limpieza", 15000);
    expect(option.price).toBe(15000);
  });

  it("creates an option with no price when none is given", async () => {
    const option = await createClinicOption(clinicA.id, "treatment", "Consulta");
    expect(option.price).toBeNull();
  });

  it("refuses a negative price on create", async () => {
    await expect(
      createClinicOption(clinicA.id, "treatment", "Inválido", -100),
    ).rejects.toThrow("El precio no puede ser negativo");
  });

  it("updates an option's price", async () => {
    const option = await createClinicOption(clinicA.id, "treatment", "Endodoncia", 20000);
    const updated = await updateClinicOption(clinicA.id, option.id, "Endodoncia", 25000);
    expect(updated.price).toBe(25000);
  });

  it("clears a price back to null when updated with none", async () => {
    const option = await createClinicOption(clinicA.id, "treatment", "Ortodoncia", 30000);
    const updated = await updateClinicOption(clinicA.id, option.id, "Ortodoncia");
    expect(updated.price).toBeNull();
  });

  it("refuses a negative price on update", async () => {
    const option = await createClinicOption(clinicA.id, "treatment", "Corona", 10000);
    await expect(
      updateClinicOption(clinicA.id, option.id, "Corona", -5),
    ).rejects.toThrow("El precio no puede ser negativo");
  });
```

- [ ] **Step 2: Run to verify they fail**

Run: `npx vitest run src/features/clinic/data/clinic-options.test.ts`
Expected: FAIL — `createClinicOption`/`updateClinicOption` don't yet accept a 4th argument, so the price-asserting tests fail (TypeScript may even refuse to compile this file until Step 3 is done — that's an acceptable "fails" state too).

- [ ] **Step 3: Implement**

In `src/features/clinic/data/clinic-options.ts`, replace `createClinicOption`:

```ts
export async function createClinicOption(
  clinicId: string,
  category: OptionCategory,
  label: string,
  price?: number,
): Promise<ClinicOption> {
  const trimmed = label.trim();
  if (!trimmed) {
    throw new Error("El nombre no puede estar vacío");
  }
  if (price != null && price < 0) {
    throw new Error("El precio no puede ser negativo");
  }

  const existing = await prisma.clinicOption.findFirst({
    where: { clinicId, category, label: trimmed },
  });
  if (existing) {
    throw new Error("Ya existe una opción con ese nombre");
  }

  const last = await prisma.clinicOption.findFirst({
    where: { clinicId, category },
    orderBy: { order: "desc" },
  });

  return prisma.clinicOption.create({
    data: {
      clinicId,
      category,
      label: trimmed,
      order: (last?.order ?? -1) + 1,
      price: price ?? null,
    },
  });
}
```

Replace `updateClinicOption`:

```ts
export async function updateClinicOption(
  clinicId: string,
  id: string,
  label: string,
  price?: number,
): Promise<ClinicOption> {
  const trimmed = label.trim();
  if (!trimmed) {
    throw new Error("El nombre no puede estar vacío");
  }
  if (price != null && price < 0) {
    throw new Error("El precio no puede ser negativo");
  }

  const option = await prisma.clinicOption.findFirst({ where: { id, clinicId } });
  if (!option) {
    throw new Error("Option not found for this clinic");
  }

  const duplicate = await prisma.clinicOption.findFirst({
    where: {
      clinicId,
      category: option.category,
      label: trimmed,
      id: { not: id },
    },
  });
  if (duplicate) {
    throw new Error("Ya existe una opción con ese nombre");
  }

  return prisma.clinicOption.update({
    where: { id },
    data: { label: trimmed, price: price ?? null },
  });
}
```

- [ ] **Step 4: Run to verify they pass**

Run: `npx vitest run src/features/clinic/data/clinic-options.test.ts`
Expected: PASS, all tests (existing + new).

- [ ] **Step 5: Commit**

```bash
git add src/features/clinic/data/clinic-options.ts src/features/clinic/data/clinic-options.test.ts
git commit -m "feat: add optional price to ClinicOption create/update"
```

---

## Task 5: `Consultation` amount fields + payment-status filter in the data layer

**Files:**
- Modify: `src/features/clinic/data/consultations.ts`
- Modify: `src/features/clinic/data/consultations.test.ts`

**Interfaces:**
- Consumes: `paymentStatus`, `PaymentStatus` from `src/features/clinic/lib/billing.ts` (Task 2).
- Produces: `NewConsultationInput.amountCharged?/amountPaid?`, `UpdateConsultationInput.amountCharged?/amountPaid?`, `ConsultationListFilters.paymentStatus?: PaymentStatus | PaymentStatus[]` — consumed by Task 7 (actions), Task 8 (dialogs), Task 9 (filter UI).

- [ ] **Step 1: Write the failing tests**

First, add an import the new "changing a treatment's list price" test needs — at the top of `src/features/clinic/data/consultations.test.ts`, add:

```ts
import { createClinicOption, updateClinicOption } from "@/features/clinic/data/clinic-options";
```

Then add these tests inside the existing `describe("consultations data layer", ...)` block:

```ts
  it("creates a consultation with an amount charged and paid", async () => {
    const patient = await createPatient(clinicA.id, { name: "Paciente A", phone: "111" });
    const consultation = await createConsultation(clinicA.id, {
      patientId: patient.id,
      date: new Date("2026-01-01"),
      treatment: "Limpieza",
      amountCharged: 15000,
      amountPaid: 15000,
    });
    expect(consultation.amountCharged).toBe(15000);
    expect(consultation.amountPaid).toBe(15000);
  });

  it("defaults amountCharged to null and amountPaid to 0 when neither is given", async () => {
    const patient = await createPatient(clinicA.id, { name: "Paciente A", phone: "111" });
    const consultation = await createConsultation(clinicA.id, {
      patientId: patient.id,
      date: new Date("2026-01-01"),
      treatment: "Limpieza",
    });
    expect(consultation.amountCharged).toBeNull();
    expect(consultation.amountPaid).toBe(0);
  });

  it("refuses a negative amountCharged on create", async () => {
    const patient = await createPatient(clinicA.id, { name: "Paciente A", phone: "111" });
    await expect(
      createConsultation(clinicA.id, {
        patientId: patient.id,
        date: new Date("2026-01-01"),
        treatment: "Limpieza",
        amountCharged: -100,
      }),
    ).rejects.toThrow("El monto no puede ser negativo");
  });

  it("refuses amountPaid greater than amountCharged on create", async () => {
    const patient = await createPatient(clinicA.id, { name: "Paciente A", phone: "111" });
    await expect(
      createConsultation(clinicA.id, {
        patientId: patient.id,
        date: new Date("2026-01-01"),
        treatment: "Limpieza",
        amountCharged: 10000,
        amountPaid: 15000,
      }),
    ).rejects.toThrow("Lo pagado no puede superar el monto a cobrar");
  });

  it("updates a consultation's amount and payment", async () => {
    const patient = await createPatient(clinicA.id, { name: "Paciente A", phone: "111" });
    const consultation = await createConsultation(clinicA.id, {
      patientId: patient.id,
      date: new Date("2026-01-01"),
      treatment: "Limpieza",
      amountCharged: 15000,
      amountPaid: 0,
    });

    const updated = await updateConsultation(clinicA.id, consultation.id, {
      date: consultation.date,
      treatment: consultation.treatment,
      amountCharged: 15000,
      amountPaid: 15000,
    });

    expect(updated.amountPaid).toBe(15000);
  });

  it("refuses amountPaid greater than amountCharged on update", async () => {
    const patient = await createPatient(clinicA.id, { name: "Paciente A", phone: "111" });
    const consultation = await createConsultation(clinicA.id, {
      patientId: patient.id,
      date: new Date("2026-01-01"),
      treatment: "Limpieza",
      amountCharged: 10000,
    });

    await expect(
      updateConsultation(clinicA.id, consultation.id, {
        date: consultation.date,
        treatment: consultation.treatment,
        amountCharged: 10000,
        amountPaid: 50000,
      }),
    ).rejects.toThrow("Lo pagado no puede superar el monto a cobrar");
  });

  it("changing a treatment's list price later does not change a past consultation's amountCharged", async () => {
    // amountCharged is a snapshot taken at save time, not a live lookup —
    // there's no FK to ClinicOption at all. This test proves it by
    // actually moving the price after the fact, not just by construction:
    // a weaker version of this test that never touches the option's price
    // again would pass even if a bug introduced a live join somewhere.
    const patient = await createPatient(clinicA.id, { name: "Paciente A", phone: "111" });
    const treatmentOption = await createClinicOption(clinicA.id, "treatment", "Limpieza", 15000);
    const consultation = await createConsultation(clinicA.id, {
      patientId: patient.id,
      date: new Date("2026-01-01"),
      treatment: "Limpieza",
      amountCharged: treatmentOption.price!,
    });

    await updateClinicOption(clinicA.id, treatmentOption.id, "Limpieza", 25000);

    const reloaded = await getConsultation(clinicA.id, consultation.id);
    expect(reloaded?.amountCharged).toBe(15000);
  });

  it("filters consultations by a single payment status", async () => {
    const patient = await createPatient(clinicA.id, { name: "Paciente A", phone: "111" });
    await createConsultation(clinicA.id, {
      patientId: patient.id,
      date: new Date("2026-01-01"),
      treatment: "Limpieza",
      amountCharged: 15000,
      amountPaid: 15000,
    });
    await createConsultation(clinicA.id, {
      patientId: patient.id,
      date: new Date("2026-01-02"),
      treatment: "Extracción",
      amountCharged: 20000,
      amountPaid: 0,
    });

    const paid = await getConsultations(clinicA.id, { paymentStatus: "COBRADO" });
    expect(paid).toHaveLength(1);
    expect(paid[0].treatment).toBe("Limpieza");
  });

  it("filters consultations by multiple payment statuses at once", async () => {
    const patient = await createPatient(clinicA.id, { name: "Paciente A", phone: "111" });
    await createConsultation(clinicA.id, {
      patientId: patient.id,
      date: new Date("2026-01-01"),
      treatment: "Limpieza",
      amountCharged: 15000,
      amountPaid: 0,
    });
    await createConsultation(clinicA.id, {
      patientId: patient.id,
      date: new Date("2026-01-02"),
      treatment: "Extracción",
      amountCharged: 20000,
      amountPaid: 10000,
    });
    await createConsultation(clinicA.id, {
      patientId: patient.id,
      date: new Date("2026-01-03"),
      treatment: "Endodoncia",
      amountCharged: 25000,
      amountPaid: 25000,
    });

    const owed = await getConsultations(clinicA.id, {
      paymentStatus: ["PENDIENTE", "PARCIAL"],
    });
    expect(owed).toHaveLength(2);
    expect(owed.map((c) => c.treatment).sort()).toEqual(["Extracción", "Limpieza"]);
  });

  it("combines the payment-status filter with an existing filter (treatment) instead of replacing it", async () => {
    const patient = await createPatient(clinicA.id, { name: "Paciente A", phone: "111" });
    await createConsultation(clinicA.id, {
      patientId: patient.id,
      date: new Date("2026-01-01"),
      treatment: "Limpieza",
      amountCharged: 15000,
      amountPaid: 0,
    });
    await createConsultation(clinicA.id, {
      patientId: patient.id,
      date: new Date("2026-01-02"),
      treatment: "Extracción",
      amountCharged: 20000,
      amountPaid: 0,
    });

    const result = await getConsultations(clinicA.id, {
      treatment: "Limpieza",
      paymentStatus: "PENDIENTE",
    });
    expect(result).toHaveLength(1);
    expect(result[0].treatment).toBe("Limpieza");
  });
```

- [ ] **Step 2: Run to verify they fail**

Run: `npx vitest run src/features/clinic/data/consultations.test.ts`
Expected: FAIL (new fields/filter don't exist yet).

- [ ] **Step 3: Implement**

In `src/features/clinic/data/consultations.ts`, add the import and update the types + functions:

```ts
import { prisma } from "@/lib/prisma";
import type { Consultation, Prisma } from "@prisma/client";
import { OTHER_TREATMENT } from "@/features/clinic/lib/treatments";
import { paymentStatus, type PaymentStatus } from "@/features/clinic/lib/billing";

export type NewConsultationInput = {
  patientId: string;
  date: Date;
  treatment: string;
  teeth?: string[];
  notes?: string;
  amountCharged?: number;
  amountPaid?: number;
};

export type ConsultationListFilters = {
  /** An exact treatment label, or the OTHER_TREATMENT sentinel — undefined
   * means no treatment filter at all. */
  treatment?: string;
  /** "YYYY-MM-DD", inclusive, compared in local time to match how the date
   * inputs and the stored visit time are read elsewhere (see format.ts). */
  from?: string;
  to?: string;
  patientQuery?: string;
  /** A tooth number, matched exactly against entries in `teeth`. */
  tooth?: string;
  /** One status, or several (e.g. the dashboard's "Por cobrar" link wants
   * PENDIENTE and PARCIAL together) — undefined means no filter at all.
   * Applied in memory after the Prisma query: amountPaid vs amountCharged
   * is a per-row comparison between two columns, which Prisma's filter
   * DSL can't express directly, and a raw SQL expression isn't worth it
   * at this app's scale (a single clinic's consultations, not millions
   * of rows). */
  paymentStatus?: PaymentStatus | PaymentStatus[];
};
```

Replace the body of `getConsultations` (keep its existing `where`-building code unchanged, add the payment-status step at the end):

```ts
export async function getConsultations(
  clinicId: string,
  filters: ConsultationListFilters = {},
  treatmentOptions: string[] = [],
): Promise<Consultation[]> {
  const where: Prisma.ConsultationWhereInput = { clinicId };

  if (filters.treatment === OTHER_TREATMENT) {
    where.treatment = { notIn: treatmentOptions };
  } else if (filters.treatment) {
    where.treatment = filters.treatment;
  }

  if (filters.from || filters.to) {
    where.date = {
      ...(filters.from ? { gte: new Date(`${filters.from}T00:00:00`) } : {}),
      ...(filters.to ? { lte: new Date(`${filters.to}T23:59:59.999`) } : {}),
    };
  }

  if (filters.patientQuery) {
    where.patient = { name: { contains: filters.patientQuery, mode: "insensitive" } };
  }

  if (filters.tooth) {
    where.teeth = { has: filters.tooth };
  }

  const results = await prisma.consultation.findMany({
    where,
    orderBy: { date: "desc" },
  });

  if (!filters.paymentStatus) return results;
  const wanted = Array.isArray(filters.paymentStatus)
    ? filters.paymentStatus
    : [filters.paymentStatus];
  return results.filter((c) => wanted.includes(paymentStatus(c.amountCharged, c.amountPaid)));
}
```

Add a shared validator above `createConsultation` (used by both create and update):

```ts
function assertValidAmounts(amountCharged: number | undefined, amountPaid: number | undefined) {
  if (amountCharged != null && amountCharged < 0) {
    throw new Error("El monto no puede ser negativo");
  }
  if (amountPaid != null && amountPaid < 0) {
    throw new Error("El monto no puede ser negativo");
  }
  if (amountPaid != null && amountCharged != null && amountPaid > amountCharged) {
    throw new Error("Lo pagado no puede superar el monto a cobrar");
  }
}
```

Replace `createConsultation`:

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

Replace `UpdateConsultationInput` and `updateConsultation`:

```ts
export type UpdateConsultationInput = {
  date: Date;
  treatment: string;
  teeth?: string[];
  notes?: string;
  amountCharged?: number;
  amountPaid?: number;
};

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

- [ ] **Step 4: Run to verify they pass**

Run: `npx vitest run src/features/clinic/data/consultations.test.ts`
Expected: PASS, all tests.

- [ ] **Step 5: Run the full unit suite**

Run: `npm test`
Expected: all test files pass (this file is shared by other suites' imports — confirm nothing else regressed).

- [ ] **Step 6: Commit**

```bash
git add src/features/clinic/data/consultations.ts src/features/clinic/data/consultations.test.ts
git commit -m "feat: add amount/payment fields and payment-status filter to consultations"
```

---

## Task 6: Tratamientos price field in Configuración

**Files:**
- Modify: `src/features/settings/actions.ts`
- Modify: `src/features/settings/components/option-list-manager.tsx`
- Modify: `src/app/dashboard/configuracion/page.tsx`

**Interfaces:**
- Consumes: `createClinicOption`/`updateClinicOption` with `price` (Task 4), `formatCurrency` (Task 3).
- Produces: a working "Precio" field on the Tratamientos tab, visually absent from Obras sociales.

- [ ] **Step 1: Thread `price` through the server actions**

In `src/features/settings/actions.ts`, replace `createClinicOptionAction` and `updateClinicOptionAction`:

```ts
export async function createClinicOptionAction(
  category: OptionCategory,
  label: string,
  price?: number,
) {
  const clinicId = await requireClinicId();
  const option = await createClinicOption(clinicId, category, label, price);
  revalidatePath("/dashboard/configuracion");
  return option;
}

export async function updateClinicOptionAction(id: string, label: string, price?: number) {
  const clinicId = await requireClinicId();
  const option = await updateClinicOption(clinicId, id, label, price);
  revalidatePath("/dashboard/configuracion");
  return option;
}
```

- [ ] **Step 2: Add the price field to `OptionListManager`**

In `src/features/settings/components/option-list-manager.tsx`:

Change the `Option` type and add the `formatCurrency` import:

```ts
import { formatCurrency } from "@/features/clinic/lib/format";

type Option = { id: string; label: string; price?: number | null };
```

Inside `OptionListManager`, right after `const router = useRouter();`, compute whether this list shows pricing and add price-related state:

```ts
  const router = useRouter();
  const showPrice = category === "treatment";
  const [newLabel, setNewLabel] = useState("");
  const [newPrice, setNewPrice] = useState("");
  const [adding, setAdding] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editLabel, setEditLabel] = useState("");
  const [editPrice, setEditPrice] = useState("");
  const [editError, setEditError] = useState<string | null>(null);
```

Replace `handleAdd`:

```ts
  async function handleAdd() {
    if (!newLabel.trim()) return;
    setAdding(true);
    setAddError(null);
    try {
      await createClinicOptionAction(
        category,
        newLabel,
        showPrice && newPrice ? Number(newPrice) : undefined,
      );
      setNewLabel("");
      setNewPrice("");
      router.refresh();
    } catch (error) {
      setAddError(error instanceof Error ? error.message : "No se pudo agregar");
    } finally {
      setAdding(false);
    }
  }
```

Replace `startEdit` and `handleSaveEdit`:

```ts
  function startEdit(option: Option) {
    setEditingId(option.id);
    setEditLabel(option.label);
    setEditPrice(option.price != null ? String(option.price) : "");
    setEditError(null);
  }

  async function handleSaveEdit(id: string) {
    if (!editLabel.trim()) return;
    setEditError(null);
    try {
      await updateClinicOptionAction(
        id,
        editLabel,
        showPrice && editPrice ? Number(editPrice) : undefined,
      );
      setEditingId(null);
      router.refresh();
    } catch (error) {
      setEditError(error instanceof Error ? error.message : "No se pudo guardar");
    }
  }
```

In the JSX, the "add new" row currently is:

```tsx
        <div className="flex flex-col gap-2 sm:flex-row">
          <Input
            placeholder="Agregar nuevo..."
            value={newLabel}
            onChange={(e) => setNewLabel(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                handleAdd();
              }
            }}
          />
          <Button type="button" onClick={handleAdd} disabled={adding}>
            <Plus />
            Agregar
          </Button>
        </div>
```

Replace it with:

```tsx
        <div className="flex flex-col gap-2 sm:flex-row">
          <Input
            placeholder="Agregar nuevo..."
            value={newLabel}
            onChange={(e) => setNewLabel(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                handleAdd();
              }
            }}
          />
          {showPrice && (
            <Input
              type="number"
              min={0}
              placeholder="Precio (opcional)"
              className="sm:w-40"
              value={newPrice}
              onChange={(e) => setNewPrice(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  handleAdd();
                }
              }}
            />
          )}
          <Button type="button" onClick={handleAdd} disabled={adding}>
            <Plus />
            Agregar
          </Button>
        </div>
```

The list item currently renders (editing branch first, then the display branch):

```tsx
                {editingId === option.id ? (
                  <div className="flex flex-1 items-center gap-2">
                    <Input
                      autoFocus
                      aria-label="Editar valor"
                      value={editLabel}
                      onChange={(e) => setEditLabel(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          handleSaveEdit(option.id);
                        }
                        if (e.key === "Escape") setEditingId(null);
                      }}
                    />
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      aria-label="Guardar"
                      onClick={() => handleSaveEdit(option.id)}
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
                ) : (
                  <>
                    <span className="text-sm">{option.label}</span>
                    <div className="flex items-center gap-1">
                      <Button
                        type="button"
                        size="icon"
                        variant="ghost"
                        aria-label={`Editar ${option.label}`}
                        onClick={() => startEdit(option)}
                      >
                        <Pencil />
                      </Button>
                      <Button
                        type="button"
                        size="icon"
                        variant="ghost"
                        aria-label={`Eliminar ${option.label}`}
                        onClick={() => setDeleteTarget(option)}
                      >
                        <Trash2 />
                      </Button>
                    </div>
                  </>
                )}
```

Replace it with:

```tsx
                {editingId === option.id ? (
                  <div className="flex flex-1 items-center gap-2">
                    <Input
                      autoFocus
                      aria-label="Editar valor"
                      value={editLabel}
                      onChange={(e) => setEditLabel(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          handleSaveEdit(option.id);
                        }
                        if (e.key === "Escape") setEditingId(null);
                      }}
                    />
                    {showPrice && (
                      <Input
                        type="number"
                        min={0}
                        aria-label={`Precio de ${option.label}`}
                        className="w-32"
                        value={editPrice}
                        onChange={(e) => setEditPrice(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            handleSaveEdit(option.id);
                          }
                          if (e.key === "Escape") setEditingId(null);
                        }}
                      />
                    )}
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      aria-label="Guardar"
                      onClick={() => handleSaveEdit(option.id)}
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
                ) : (
                  <>
                    <div className="flex items-center gap-3">
                      <span className="text-sm">{option.label}</span>
                      {showPrice && (
                        <span className="text-sm text-muted-foreground">
                          {option.price != null ? formatCurrency(option.price) : "Sin precio"}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-1">
                      <Button
                        type="button"
                        size="icon"
                        variant="ghost"
                        aria-label={`Editar ${option.label}`}
                        onClick={() => startEdit(option)}
                      >
                        <Pencil />
                      </Button>
                      <Button
                        type="button"
                        size="icon"
                        variant="ghost"
                        aria-label={`Eliminar ${option.label}`}
                        onClick={() => setDeleteTarget(option)}
                      >
                        <Trash2 />
                      </Button>
                    </div>
                  </>
                )}
```

- [ ] **Step 3: Confirm `ClinicOption[]` still satisfies `Option[]`**

`src/app/dashboard/configuracion/page.tsx` already passes `options={insuranceOptions}` / `options={treatmentOptions}` straight from `getClinicOptions`, which now return rows with a `price` field — no change needed there, since `ClinicOption[]` (with `price`) structurally satisfies the updated `Option[]` type. Open the file and confirm visually that nothing else needs to change.

- [ ] **Step 4: Type-check**

Run: `npx tsc --noEmit -p .`
Expected: no errors.

- [ ] **Step 5: Manual smoke-check**

Run: `npm run dev`, then in a browser:
1. Go to `/dashboard/configuracion` → Tratamientos tab. Confirm the "Agregar nuevo..." row now also shows a "Precio (opcional)" input, and the Obras sociales tab does NOT show one.
2. Add a treatment with a price (e.g. "Prueba", `12000`). Confirm it appears in the list as "Prueba — $12.000".
3. Edit it, change the price to `18000`, save. Confirm it now shows "$18.000".
4. Edit it again, clear the price field, save. Confirm it shows "Sin precio".
5. Delete it (cleanup).

- [ ] **Step 6: Commit**

```bash
git add src/features/settings/actions.ts src/features/settings/components/option-list-manager.tsx
git commit -m "feat: add price field to Tratamientos in Configuración"
```

---

## Task 7: Consultation schema + actions — amount/payment fields

**Files:**
- Modify: `src/features/consultations/lib/schema.ts`
- Modify: `src/features/consultations/actions.ts`

**Interfaces:**
- Consumes: `NewConsultationInput`/`UpdateConsultationInput` with `amountCharged`/`amountPaid` (Task 5).
- Produces: `ConsultationValues`/`EditConsultationValues` with `amountCharged`, `paymentChoice`, `partialAmountPaid` — consumed by Task 8 (dialogs).

- [ ] **Step 1: Extend the zod schemas**

In `src/features/consultations/lib/schema.ts`, add this shared helper above `consultationSchema`:

```ts
/** Shared by both the new- and edit-consultation schemas: amountCharged
 * must be a non-negative number if present, and when paymentChoice is
 * PARCIAL, partialAmountPaid must be a non-negative number that doesn't
 * exceed amountCharged. */
function refineAmounts(
  data: {
    amountCharged?: string;
    paymentChoice?: string;
    partialAmountPaid?: string;
  },
  ctx: z.RefinementCtx,
) {
  if (data.amountCharged) {
    const n = Number(data.amountCharged);
    if (Number.isNaN(n) || n < 0) {
      ctx.addIssue({
        path: ["amountCharged"],
        code: z.ZodIssueCode.custom,
        message: "Ingresá un monto válido, mayor o igual a 0",
      });
    }
  }
  if (data.paymentChoice === "PARCIAL") {
    const paid = Number(data.partialAmountPaid);
    if (!data.partialAmountPaid || Number.isNaN(paid) || paid < 0) {
      ctx.addIssue({
        path: ["partialAmountPaid"],
        code: z.ZodIssueCode.custom,
        message: "Ingresá cuánto se pagó hasta ahora",
      });
    } else {
      const charged = Number(data.amountCharged);
      if (!Number.isNaN(charged) && paid > charged) {
        ctx.addIssue({
          path: ["partialAmountPaid"],
          code: z.ZodIssueCode.custom,
          message: "Lo pagado no puede superar el monto a cobrar",
        });
      }
    }
  }
}
```

In `consultationSchema`'s `.object({...})`, add three fields (anywhere among the existing ones, e.g. right after `notes`):

```ts
    notes: z.string().optional(),
    amountCharged: z.string().optional(),
    paymentChoice: z.enum(["PENDIENTE", "PARCIAL", "COBRADO"]).optional(),
    partialAmountPaid: z.string().optional(),
```

In `consultationSchema`'s `.superRefine((data, ctx) => { ... })`, add a call to the shared helper at the end of the existing function body (after the three existing `if` blocks, still inside the same arrow function):

```ts
    refineAmounts(data, ctx);
```

Do the same for `editConsultationSchema`: add the three fields to its `.object({...})`:

```ts
    notes: z.string().optional(),
    amountCharged: z.string().optional(),
    paymentChoice: z.enum(["PENDIENTE", "PARCIAL", "COBRADO"]).optional(),
    partialAmountPaid: z.string().optional(),
```

And add `refineAmounts(data, ctx);` at the end of its `.superRefine` body too.

- [ ] **Step 2: Thread amounts through the server actions**

In `src/features/consultations/actions.ts`, no signature change is needed — `createConsultationAction` and `updateConsultationAction` already forward their whole `input`/`UpdateConsultationInput` object (which now includes `amountCharged`/`amountPaid` per Task 5) straight to `createConsultation`/`updateConsultation`. Open the file and confirm this by inspection — nothing to edit here, this step is a verification, not a code change.

- [ ] **Step 3: Type-check**

Run: `npx tsc --noEmit -p .`
Expected: no errors (nothing yet constructs `ConsultationValues`/`EditConsultationValues` with the new fields populated, since Task 8 hasn't touched the dialogs — the new fields are all optional, so this compiles fine on its own).

- [ ] **Step 4: Commit**

```bash
git add src/features/consultations/lib/schema.ts
git commit -m "feat: add amount/payment fields to consultation form schemas"
```

---

## Task 8: Price, discount %, and payment UI in the consultation dialogs

**Files:**
- Modify: `src/features/consultations/components/new-consultation-dialog.tsx`
- Modify: `src/features/consultations/components/edit-consultation-dialog.tsx`
- Modify: `src/features/consultations/components/consultations-table.tsx`
- Modify: `src/features/consultations/components/consultations-view.tsx`
- Modify: `src/features/consultations/components/consultations-list.tsx`
- Modify: `src/app/dashboard/consultas/page.tsx`
- Modify: `src/app/dashboard/pacientes/[id]/page.tsx`
- Modify: `src/features/patients/components/patient-detail-view.tsx`

**Interfaces:**
- Consumes: `formatCurrency` (Task 3), `paymentStatus`/`PAYMENT_STATUS_LABELS` (Task 2), the extended schemas (Task 7).
- Produces: a `treatmentPrices: Record<string, number>` prop threaded from both pages down to both dialogs — consumed by Task 9 for the badge/filter work, which touches the same files again.

This task only adds the input fields and the data plumbing to carry a treatment's price into the dialogs. The payment-status **badge** shown elsewhere (table rows, cards, view dialog) is Task 9 — keep this task to the two edit/create forms.

- [ ] **Step 1: Build `treatmentPrices` at both page call sites**

In `src/app/dashboard/consultas/page.tsx`, after the existing:

```ts
  const treatmentLabels = treatmentOptions.map((o) => o.label);
```

add:

```ts
  const treatmentPrices = Object.fromEntries(
    treatmentOptions.filter((o) => o.price != null).map((o) => [o.label, o.price!]),
  );
```

Pass it to both `NewConsultationDialog` and `ConsultationsView`:

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
          />
        }
      />

      <ConsultationsView
        consultations={consultations}
        patients={patients}
        treatmentOptions={treatmentLabels}
        treatmentPrices={treatmentPrices}
      />
```

In `src/app/dashboard/pacientes/[id]/page.tsx`, replace the body to also fetch full `ClinicOption` rows (not just labels) and build the same map:

```tsx
import { PatientDetailView } from "@/features/patients/components/patient-detail-view";
import { getCurrentClinic } from "@/features/clinic/data/current-clinic";
import { getPatient } from "@/features/clinic/data/patients";
import { getConsultationsForPatient } from "@/features/clinic/data/consultations";
import { getClinicOptions } from "@/features/clinic/data/clinic-options";

export default async function PacienteDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const clinic = await getCurrentClinic();
  const patient = clinic ? await getPatient(clinic.id, id) : null;
  const consultations = clinic ? await getConsultationsForPatient(clinic.id, id) : [];
  const treatmentOptions = clinic ? await getClinicOptions(clinic.id, "treatment") : [];
  const treatmentPrices = Object.fromEntries(
    treatmentOptions.filter((o) => o.price != null).map((o) => [o.label, o.price!]),
  );

  return (
    <PatientDetailView
      patient={patient}
      consultations={consultations}
      treatmentOptions={treatmentOptions.map((o) => o.label)}
      treatmentPrices={treatmentPrices}
    />
  );
}
```

- [ ] **Step 2: Thread `treatmentPrices` through `PatientDetailView` → `ConsultationsList`/`NewConsultationDialog`**

In `src/features/patients/components/patient-detail-view.tsx`, add the prop and forward it to both dialogs it renders:

```tsx
export function PatientDetailView({
  patient,
  consultations,
  treatmentOptions,
  treatmentPrices,
}: {
  patient: Patient | null;
  consultations: Consultation[];
  treatmentOptions: string[];
  treatmentPrices: Record<string, number>;
}) {
```

Update the `NewConsultationDialog` usage:

```tsx
            <NewConsultationDialog
              fixedPatientId={patient.id}
              fixedPatientName={patient.name}
              treatmentOptions={treatmentOptions}
              treatmentPrices={treatmentPrices}
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
        />
```

- [ ] **Step 3: Thread `treatmentPrices` through `ConsultationsView`/`ConsultationsList` → `ConsultationsTable`**

In `src/features/consultations/components/consultations-view.tsx`, add the prop to the component signature and forward it:

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

And in its JSX, add the prop to `<ConsultationsTable ...>`:

```tsx
      <ConsultationsTable
        consultations={pageItems}
        patients={patients}
        showPatient
        treatmentOptions={treatmentOptions}
        treatmentPrices={treatmentPrices}
        emptyMessage={
          hasFilters
            ? "No hay consultas que coincidan con los filtros."
            : "Todavía no hay consultas registradas."
        }
      />
```

Do the equivalent in `src/features/consultations/components/consultations-list.tsx`:

```tsx
export function ConsultationsList({
  consultations,
  patients,
  showPatient = true,
  fixedPatientName,
  emptyMessage = "Todavía no hay consultas registradas.",
  treatmentOptions,
  treatmentPrices,
}: {
  consultations: Consultation[];
  patients?: Patient[];
  showPatient?: boolean;
  fixedPatientName?: string;
  emptyMessage?: string;
  treatmentOptions: string[];
  treatmentPrices: Record<string, number>;
}) {
```

And its `<ConsultationsTable ...>` call:

```tsx
      <ConsultationsTable
        consultations={pageItems}
        patients={patients}
        showPatient={showPatient}
        fixedPatientName={fixedPatientName}
        treatmentOptions={treatmentOptions}
        treatmentPrices={treatmentPrices}
        emptyMessage={
          hasFilters
            ? "No hay consultas que coincidan con los filtros."
            : emptyMessage
        }
      />
```

- [ ] **Step 4: Thread `treatmentPrices` through `ConsultationsTable` → `EditConsultationDialog`**

In `src/features/consultations/components/consultations-table.tsx`, add the prop to the component signature:

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

Find both places `<EditConsultationDialog ...>` is rendered (there's one, inside the `{editing && (...)}` block) and add `treatmentPrices={treatmentPrices}`:

```tsx
      {editing && (
        <EditConsultationDialog
          key={`edit-${editing.id}`}
          consultation={editing}
          patientName={nameFor(editing)}
          treatmentOptions={treatmentOptions}
          treatmentPrices={treatmentPrices}
          open
          onOpenChange={(next) => {
            if (!next) setEditing(null);
          }}
        />
      )}
```

- [ ] **Step 5: Add the price/discount/payment UI to `NewConsultationDialog`**

In `src/features/consultations/components/new-consultation-dialog.tsx`:

Change the React import to include `useEffect`:

```ts
import { useEffect, useState } from "react";
```

Add the `formatCurrency` and `PAYMENT_STATUS_LABELS` imports:

```ts
import { formatCurrency } from "@/features/clinic/lib/format";
import { PAYMENT_STATUS_LABELS } from "@/features/clinic/lib/billing";
```

Add the `treatmentPrices` prop:

```tsx
export function NewConsultationDialog({
  patients = [],
  fixedPatientId,
  fixedPatientName,
  treatmentOptions,
  treatmentPrices,
  insuranceOptions = [],
  toothHistory = {},
  open: openProp,
  onOpenChange: onOpenChangeProp,
}: {
  patients?: PatientOption[];
  fixedPatientId?: string;
  fixedPatientName?: string;
  treatmentOptions: string[];
  treatmentPrices: Record<string, number>;
  insuranceOptions?: string[];
  toothHistory?: ToothHistory;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}) {
```

Add `setValue` to the `useForm` destructure (it already destructures `register, handleSubmit, reset, control, watch, formState`):

```ts
  const {
    register,
    handleSubmit,
    reset,
    control,
    watch,
    setValue,
    formState: { errors },
  } = useForm<ConsultationValues>({
```

Add `amountCharged`, `paymentChoice`, `partialAmountPaid` to the `defaultValues` object (alongside the existing `notes: ""`):

```ts
      notes: "",
      amountCharged: "",
      paymentChoice: "PENDIENTE",
      partialAmountPaid: "",
```

After the existing `const teeth = watch("teeth") ?? [];` line, add:

```ts
  const amountCharged = watch("amountCharged");
  const paymentChoice = watch("paymentChoice");
  const listPrice = treatmentPrices[treatment];
  const [discountPercent, setDiscountPercent] = useState("");
  const [amountTouched, setAmountTouched] = useState(false);

  /** Prefills "Monto a cobrar" from the treatment's list price (minus
   * whatever discount % is already typed) the first time a priced
   * treatment is picked — but only while the dentist hasn't touched the
   * amount or the discount themselves, so switching treatments later
   * never clobbers a monto they already set by hand. */
  useEffect(() => {
    if (amountTouched || listPrice == null) return;
    const pct = Number(discountPercent) || 0;
    setValue("amountCharged", String(Math.round(listPrice * (1 - pct / 100))));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [treatment]);
```

Find the `onSubmit` function and extend what it sends to `createConsultationAction` — replace:

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
      newPatient: isNewPatient
```

with:

```ts
    const chargedNum = values.amountCharged ? Number(values.amountCharged) : undefined;
    const paidNum =
      values.paymentChoice === "COBRADO"
        ? chargedNum
        : values.paymentChoice === "PARCIAL"
          ? Number(values.partialAmountPaid)
          : undefined;

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

Find the `reset({...})` call right after `await createConsultationAction(...)` (inside `onSubmit`) and add the three new fields to it, matching the `defaultValues` shape:

```ts
      notes: "",
      amountCharged: "",
      paymentChoice: "PENDIENTE",
      partialAmountPaid: "",
```

Also reset the two local-state pieces right after that `reset({...})` call:

```ts
    setDiscountPercent("");
    setAmountTouched(false);
```

Finally, add the UI block itself. In the JSX, right after the closing `</div>` of the `{treatment === OTHER_TREATMENT && (...)}` block and before the `<div className="space-y-2">` that holds "Observaciones", insert:

```tsx
            {listPrice != null && (
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>Precio de lista</Label>
                  <div className="rounded-md border bg-muted/40 px-3 py-2 text-sm font-medium">
                    {formatCurrency(listPrice)}
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="discountPercent">Descuento %</Label>
                  <Input
                    id="discountPercent"
                    type="number"
                    min={0}
                    max={100}
                    placeholder="0"
                    value={discountPercent}
                    onChange={(e) => {
                      const pct = e.target.value;
                      setDiscountPercent(pct);
                      setAmountTouched(true);
                      const pctNum = Number(pct) || 0;
                      setValue("amountCharged", String(Math.round(listPrice * (1 - pctNum / 100))));
                    }}
                  />
                </div>
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="amountCharged">Monto a cobrar (opcional)</Label>
              <Input
                id="amountCharged"
                type="number"
                min={0}
                placeholder="0"
                aria-invalid={!!errors.amountCharged}
                {...register("amountCharged", { onChange: () => setAmountTouched(true) })}
              />
              {errors.amountCharged && (
                <p className="text-sm text-destructive">{errors.amountCharged.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label>Estado del cobro</Label>
              <div className="flex w-fit gap-1 rounded-md border p-1">
                {(["PENDIENTE", "PARCIAL", "COBRADO"] as const).map((choice) => (
                  <Button
                    key={choice}
                    type="button"
                    size="sm"
                    variant={paymentChoice === choice ? "secondary" : "ghost"}
                    onClick={() => setValue("paymentChoice", choice)}
                  >
                    {PAYMENT_STATUS_LABELS[choice]}
                  </Button>
                ))}
              </div>
            </div>

            {paymentChoice === "PARCIAL" && (
              <div className="space-y-2">
                <Label htmlFor="partialAmountPaid">Pagado hasta ahora</Label>
                <Input
                  id="partialAmountPaid"
                  type="number"
                  min={0}
                  aria-invalid={!!errors.partialAmountPaid}
                  {...register("partialAmountPaid")}
                />
                {errors.partialAmountPaid && (
                  <p className="text-sm text-destructive">{errors.partialAmountPaid.message}</p>
                )}
              </div>
            )}
```

- [ ] **Step 6: Add the same UI to `EditConsultationDialog`**

In `src/features/consultations/components/edit-consultation-dialog.tsx`:

Add the `formatCurrency`, `paymentStatus`, and `PAYMENT_STATUS_LABELS` imports:

```ts
import { formatCurrency } from "@/features/clinic/lib/format";
import { paymentStatus, PAYMENT_STATUS_LABELS } from "@/features/clinic/lib/billing";
```

Add the `treatmentPrices` prop:

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

Replace `toFormValues` to seed the new fields from the consultation's current amounts:

```ts
function toFormValues(consultation: Consultation, treatmentOptions: string[]): EditConsultationValues {
  const knownTreatment = treatmentOptions.includes(consultation.treatment);
  const status = paymentStatus(consultation.amountCharged, consultation.amountPaid);
  return {
    ...splitDateAndTime(consultation.date),
    treatment: knownTreatment ? consultation.treatment : OTHER_TREATMENT,
    treatmentOther: knownTreatment ? "" : consultation.treatment,
    teeth: consultation.teeth,
    notes: consultation.notes ?? "",
    amountCharged: consultation.amountCharged != null ? String(consultation.amountCharged) : "",
    paymentChoice: status === "SIN_MONTO" ? "PENDIENTE" : status,
    partialAmountPaid: status === "PARCIAL" ? String(consultation.amountPaid) : "",
  };
}
```

Add `setValue` to the `useForm` destructure:

```ts
  const {
    register,
    handleSubmit,
    reset,
    control,
    watch,
    setValue,
    formState: { errors },
  } = useForm<EditConsultationValues>({
```

Replace the `[dentitionMode, setDentitionMode]` line and the lines right after it (`const { register, ... }`) by also adding, right after the `useForm` call, the discount/touched state — `amountTouched` starts `true` whenever the consultation already has a real amount (don't let a treatment-change silently overwrite real historical data):

```ts
  const [dentitionMode, setDentitionMode] = useState<DentitionMode>("adulto");
  const [discountPercent, setDiscountPercent] = useState("");
  const [amountTouched, setAmountTouched] = useState(consultation.amountCharged != null);
```

Update the `useEffect` that resets the form on `open` — it currently is:

```ts
  useEffect(() => {
    if (open) {
      reset(toFormValues(consultation, treatmentOptions));
      setDentitionMode("adulto");
    }
  }, [open, consultation, treatmentOptions, reset]);
```

Replace it with:

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

After the existing `const teeth = watch("teeth") ?? [];` line, add:

```ts
  const amountCharged = watch("amountCharged");
  const paymentChoice = watch("paymentChoice");
  const listPrice = treatmentPrices[treatment];

  useEffect(() => {
    if (amountTouched || listPrice == null) return;
    const pct = Number(discountPercent) || 0;
    setValue("amountCharged", String(Math.round(listPrice * (1 - pct / 100))));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [treatment]);
```

Find `onSubmit` and extend the call to `updateConsultationAction` — replace:

```ts
  const onSubmit = async (values: EditConsultationValues) => {
    await updateConsultationAction(consultation.id, {
      date: combineDateAndTime(values.date, values.time),
      treatment: values.treatment === OTHER_TREATMENT ? values.treatmentOther!.trim() : values.treatment,
      teeth: values.teeth?.length ? values.teeth : undefined,
      notes: values.notes || undefined,
    });
    onOpenChange(false);
  };
```

with:

```ts
  const onSubmit = async (values: EditConsultationValues) => {
    const chargedNum = values.amountCharged ? Number(values.amountCharged) : undefined;
    const paidNum =
      values.paymentChoice === "COBRADO"
        ? chargedNum
        : values.paymentChoice === "PARCIAL"
          ? Number(values.partialAmountPaid)
          : undefined;

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

Add the same UI block used in Step 5 to the JSX, right after the `{treatment === OTHER_TREATMENT && (...)}` block and before "Observaciones" — identical markup, only the `id`/`htmlFor` values get an `edit-` prefix to stay unique on the page alongside `NewConsultationDialog`'s:

```tsx
            {listPrice != null && (
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>Precio de lista</Label>
                  <div className="rounded-md border bg-muted/40 px-3 py-2 text-sm font-medium">
                    {formatCurrency(listPrice)}
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-discountPercent">Descuento %</Label>
                  <Input
                    id="edit-discountPercent"
                    type="number"
                    min={0}
                    max={100}
                    placeholder="0"
                    value={discountPercent}
                    onChange={(e) => {
                      const pct = e.target.value;
                      setDiscountPercent(pct);
                      setAmountTouched(true);
                      const pctNum = Number(pct) || 0;
                      setValue("amountCharged", String(Math.round(listPrice * (1 - pctNum / 100))));
                    }}
                  />
                </div>
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="edit-amountCharged">Monto a cobrar (opcional)</Label>
              <Input
                id="edit-amountCharged"
                type="number"
                min={0}
                placeholder="0"
                aria-invalid={!!errors.amountCharged}
                {...register("amountCharged", { onChange: () => setAmountTouched(true) })}
              />
              {errors.amountCharged && (
                <p className="text-sm text-destructive">{errors.amountCharged.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label>Estado del cobro</Label>
              <div className="flex w-fit gap-1 rounded-md border p-1">
                {(["PENDIENTE", "PARCIAL", "COBRADO"] as const).map((choice) => (
                  <Button
                    key={choice}
                    type="button"
                    size="sm"
                    variant={paymentChoice === choice ? "secondary" : "ghost"}
                    onClick={() => setValue("paymentChoice", choice)}
                  >
                    {PAYMENT_STATUS_LABELS[choice]}
                  </Button>
                ))}
              </div>
            </div>

            {paymentChoice === "PARCIAL" && (
              <div className="space-y-2">
                <Label htmlFor="edit-partialAmountPaid">Pagado hasta ahora</Label>
                <Input
                  id="edit-partialAmountPaid"
                  type="number"
                  min={0}
                  aria-invalid={!!errors.partialAmountPaid}
                  {...register("partialAmountPaid")}
                />
                {errors.partialAmountPaid && (
                  <p className="text-sm text-destructive">{errors.partialAmountPaid.message}</p>
                )}
              </div>
            )}
```

- [ ] **Step 7: Type-check**

Run: `npx tsc --noEmit -p .`
Expected: no errors. If `treatmentPrices` is reported missing anywhere, it means a call site in Steps 1-4 was missed — search the codebase for every `<NewConsultationDialog`, `<ConsultationsView`, `<ConsultationsList`, `<ConsultationsTable`, `<EditConsultationDialog` usage and confirm each one now passes `treatmentPrices`.

- [ ] **Step 8: Run the full unit suite**

Run: `npm test`
Expected: all tests still pass (this task touched no data-layer code, only components).

- [ ] **Step 9: Manual smoke-check**

Run: `npm run dev`, then in a browser:
1. In Configuración → Tratamientos, make sure "Limpieza" has a price (e.g. `15000` — from Task 6's testing, or set it now).
2. Go to `/dashboard/consultas`, click "Nueva consulta", pick an existing patient and the "Limpieza" treatment. Confirm "Precio de lista" shows `$15.000` and "Monto a cobrar" auto-fills to `15000`.
3. Type `30` into "Descuento %". Confirm "Monto a cobrar" updates to `10500` (15000 × 0.7).
4. Click "Cobrado". Save. Confirm the consultation saves with no errors (badge/amount display is Task 9 — just confirm no error toast/validation blocks the save).
5. Open "Nueva consulta" again, pick a treatment with NO price configured. Confirm "Precio de lista"/"Descuento %" don't appear, and "Monto a cobrar" can still be typed directly.
6. Edit the consultation created in step 4 (via the table's edit icon once Task 9 adds it, or directly navigate — for now just confirm the Edit dialog opens with "Monto a cobrar" pre-filled to `10500` and "Cobrado" selected).

- [ ] **Step 10: Commit**

```bash
git add src/features/consultations/components/new-consultation-dialog.tsx src/features/consultations/components/edit-consultation-dialog.tsx src/features/consultations/components/consultations-table.tsx src/features/consultations/components/consultations-view.tsx src/features/consultations/components/consultations-list.tsx src/app/dashboard/consultas/page.tsx src/app/dashboard/pacientes/\[id\]/page.tsx src/features/patients/components/patient-detail-view.tsx
git commit -m "feat: add price, discount %, and payment fields to consultation dialogs"
```

---

## Task 9: Payment-status badge + Estado de cobro filter

**Files:**
- Create: `src/features/consultations/components/payment-status-badge.tsx`
- Modify: `src/features/consultations/components/consultations-table.tsx`
- Modify: `src/features/consultations/components/consultation-filter-bar.tsx`
- Modify: `src/features/consultations/components/consultations-view.tsx`
- Modify: `src/features/consultations/components/consultations-list.tsx`
- Modify: `src/app/dashboard/consultas/page.tsx`
- Modify: `src/features/consultations/components/view-consultation-dialog.tsx`

**Interfaces:**
- Consumes: `paymentStatus`, `PAYMENT_STATUS_LABELS`, `PaymentStatus` (Task 2), `formatCurrency` (Task 3).
- Produces: `<PaymentStatusBadge amountCharged amountPaid />`, used by the table, cards, and view dialog; a working "Estado de cobro" filter on both the main Consultas list and the patient-detail list.

- [ ] **Step 1: Create the shared badge component**

Create `src/features/consultations/components/payment-status-badge.tsx`:

```tsx
import { Badge } from "@/components/ui/badge";
import { formatCurrency } from "@/features/clinic/lib/format";
import { paymentStatus, PAYMENT_STATUS_LABELS, type PaymentStatus } from "@/features/clinic/lib/billing";

const STYLES: Record<Exclude<PaymentStatus, "SIN_MONTO">, string> = {
  PENDIENTE: "bg-destructive/10 text-destructive border-destructive/20",
  PARCIAL:
    "bg-amber-500/10 text-amber-700 border-amber-500/30 dark:bg-amber-500/15 dark:text-amber-400",
  COBRADO:
    "bg-emerald-500/10 text-emerald-700 border-emerald-500/30 dark:bg-emerald-500/15 dark:text-emerald-400",
};

/** Renders nothing for SIN_MONTO — a consultation nobody priced isn't a
 * debt, so it shouldn't visually compete with the ones that are. */
export function PaymentStatusBadge({
  amountCharged,
  amountPaid,
}: {
  amountCharged: number | null;
  amountPaid: number;
}) {
  const status = paymentStatus(amountCharged, amountPaid);
  if (status === "SIN_MONTO") return null;

  return (
    <Badge variant="outline" className={STYLES[status]}>
      {PAYMENT_STATUS_LABELS[status]} · {formatCurrency(amountCharged!)}
    </Badge>
  );
}
```

- [ ] **Step 2: Add the badge to the Consultas table and mobile cards**

In `src/features/consultations/components/consultations-table.tsx`, add the import:

```ts
import { PaymentStatusBadge } from "@/features/consultations/components/payment-status-badge";
```

In the desktop `<Table>` body, the `Tratamiento` cell currently is:

```tsx
                    <TableCell>
                      <Badge variant="secondary" className="font-normal">
                        {c.treatment}
                      </Badge>
                    </TableCell>
```

Replace it with:

```tsx
                    <TableCell>
                      <div className="flex flex-wrap items-center gap-1.5">
                        <Badge variant="secondary" className="font-normal">
                          {c.treatment}
                        </Badge>
                        <PaymentStatusBadge amountCharged={c.amountCharged} amountPaid={c.amountPaid} />
                      </div>
                    </TableCell>
```

In the mobile card block, the top row currently ends with:

```tsx
                    <Badge variant="secondary" className="shrink-0 font-normal">
                      {c.treatment}
                    </Badge>
                  </div>
```

Replace it with:

```tsx
                    <div className="flex shrink-0 flex-col items-end gap-1">
                      <Badge variant="secondary" className="font-normal">
                        {c.treatment}
                      </Badge>
                      <PaymentStatusBadge amountCharged={c.amountCharged} amountPaid={c.amountPaid} />
                    </div>
                  </div>
```

- [ ] **Step 3: Add the filter to `ConsultationFilterBar`**

In `src/features/consultations/components/consultation-filter-bar.tsx`, add the sentinel and the status list near the existing `ALL_TREATMENTS`:

Also add the import this needs:

```ts
import { PAYMENT_STATUS_LABELS } from "@/features/clinic/lib/billing";
```

```ts
export const ALL_TREATMENTS = "__all__";
export const ALL_PAYMENT_STATUSES = "__all__";

// Built from PAYMENT_STATUS_LABELS (billing.ts) rather than its own
// hardcoded strings, so this dropdown's wording can never drift from the
// badge's (payment-status-badge.tsx, Step 1) — SIN_MONTO deliberately
// included here even though the badge never renders for it: filtering by
// "Sin monto" is exactly how a dentist finds consultations to go price.
const PAYMENT_STATUS_OPTIONS = (
  ["COBRADO", "PENDIENTE", "PARCIAL", "SIN_MONTO"] as const
).map((value) => ({ value, label: PAYMENT_STATUS_LABELS[value] }));
```

Add two new props to the component signature:

```tsx
export function ConsultationFilterBar({
  treatment,
  onTreatmentChange,
  treatmentOptions,
  paymentStatus,
  onPaymentStatusChange,
  showPatient,
  patientQuery,
  onPatientQueryChange,
  toothQuery,
  onToothQueryChange,
  from,
  to,
  onRangeChange,
  hasFilters,
  onClear,
}: {
  treatment: string;
  onTreatmentChange: (value: string) => void;
  treatmentOptions: string[];
  paymentStatus: string;
  onPaymentStatusChange: (value: string) => void;
  showPatient: boolean;
  patientQuery: string;
  onPatientQueryChange: (value: string) => void;
  toothQuery: string;
  onToothQueryChange: (value: string) => void;
  from: string;
  to: string;
  onRangeChange: (range: { from: string; to: string }) => void;
  hasFilters: boolean;
  onClear: () => void;
}) {
```

In the JSX, right after the closing `</div>` of the Tratamiento `<Select>` block, add:

```tsx
      <div className="space-y-1.5">
        <Label className="text-xs text-muted-foreground">Estado de cobro</Label>
        <Select value={paymentStatus} onValueChange={onPaymentStatusChange}>
          <SelectTrigger className="w-full sm:w-44">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL_PAYMENT_STATUSES}>Todos</SelectItem>
            {PAYMENT_STATUS_OPTIONS.map((o) => (
              <SelectItem key={o.value} value={o.value}>
                {o.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
```

- [ ] **Step 4: Wire the filter into the main Consultas list (URL-driven)**

In `src/features/consultations/components/consultations-view.tsx`, update imports and param keys:

```ts
import {
  ALL_PAYMENT_STATUSES,
  ALL_TREATMENTS,
  ConsultationFilterBar,
} from "@/features/consultations/components/consultation-filter-bar";
import { PAYMENT_STATUS_LABELS } from "@/features/clinic/lib/billing";

const PAGE_SIZE = 10;
const PARAM_KEYS = ["tratamiento", "cobro", "desde", "hasta", "paciente", "pieza"] as const;
```

After the existing `const treatment = values.tratamiento || ALL_TREATMENTS;`, add:

```ts
  const paymentStatusFilter = values.cobro || ALL_PAYMENT_STATUSES;
```

Update `hasFilters`:

```ts
  const hasFilters =
    treatment !== ALL_TREATMENTS ||
    paymentStatusFilter !== ALL_PAYMENT_STATUSES ||
    !!values.desde ||
    !!values.hasta ||
    !!values.paciente ||
    !!values.pieza;
```

In the `chips` array, add a chip for the cobro filter right after the Tratamiento one — the raw `values.cobro` can be a comma-separated pair (set only by the dashboard card's link, never by this dropdown), so label it accordingly:

```ts
  const chips: FilterChip[] = [
    treatment !== ALL_TREATMENTS && {
      key: "tratamiento",
      label: `Tratamiento: ${treatment}`,
      onRemove: () => setValue("tratamiento", ""),
    },
    paymentStatusFilter !== ALL_PAYMENT_STATUSES && {
      key: "cobro",
      label: `Estado de cobro: ${
        values.cobro.includes(",") ? "Pendiente o parcial" : PAYMENT_STATUS_LABELS[values.cobro as keyof typeof PAYMENT_STATUS_LABELS]
      }`,
      onRemove: () => setValue("cobro", ""),
    },
    !!values.paciente && {
```

Pass the new props to `<ConsultationFilterBar>`:

```tsx
      <ConsultationFilterBar
        treatment={treatment}
        onTreatmentChange={(v) => setValue("tratamiento", v === ALL_TREATMENTS ? "" : v)}
        treatmentOptions={treatmentOptions}
        paymentStatus={paymentStatusFilter}
        onPaymentStatusChange={(v) => setValue("cobro", v === ALL_PAYMENT_STATUSES ? "" : v)}
        showPatient
        patientQuery={values.paciente}
        onPatientQueryChange={(v) => setValue("paciente", v)}
        toothQuery={values.pieza}
        onToothQueryChange={(v) => setValue("pieza", v)}
        from={values.desde}
        to={values.hasta}
        onRangeChange={(r) => setMany({ desde: r.from, hasta: r.to })}
        hasFilters={hasFilters}
        onClear={clear}
      />
```

- [ ] **Step 5: Apply the filter server-side**

In `src/app/dashboard/consultas/page.tsx`, add the import and read the new param:

```ts
import type { PaymentStatus } from "@/features/clinic/lib/billing";
```

Replace the `filters` object:

```ts
  const cobroParam = asString(params.cobro);
  const filters = {
    treatment: asString(params.tratamiento),
    from: asString(params.desde),
    to: asString(params.hasta),
    patientQuery: asString(params.paciente),
    tooth: asString(params.pieza),
    paymentStatus: cobroParam ? (cobroParam.split(",") as PaymentStatus[]) : undefined,
  };
```

- [ ] **Step 6: Wire the filter into the patient-detail (in-memory) list**

In `src/features/consultations/components/consultations-list.tsx`, update the imports:

```ts
import {
  ALL_PAYMENT_STATUSES,
  ALL_TREATMENTS,
  ConsultationFilterBar,
} from "@/features/consultations/components/consultation-filter-bar";
import { paymentStatus } from "@/features/clinic/lib/billing";
```

Add state and extend the filter predicate — the function and hook currently are:

```ts
  const [treatment, setTreatment] = useState(ALL_TREATMENTS);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [patientQuery, setPatientQuery] = useState("");
  const [toothQuery, setToothQuery] = useState("");
```

add a line:

```ts
  const [paymentStatusFilter, setPaymentStatusFilter] = useState(ALL_PAYMENT_STATUSES);
```

In the `useMemo` filter body, add a check (right after the existing `if (!matchesTreatment(...)) return false;` line):

```ts
      if (
        paymentStatusFilter !== ALL_PAYMENT_STATUSES &&
        paymentStatus(c.amountCharged, c.amountPaid) !== paymentStatusFilter
      ) {
        return false;
      }
```

Add `paymentStatusFilter` to the `useMemo`'s dependency array (the existing array ends with `...patients]` — add it there):

```ts
  }, [consultations, treatment, paymentStatusFilter, from, to, treatmentOptions, patientQuery, toothQuery, patients]);
```

Update `hasFilters`:

```ts
  const hasFilters =
    treatment !== ALL_TREATMENTS ||
    paymentStatusFilter !== ALL_PAYMENT_STATUSES ||
    !!from ||
    !!to ||
    !!patientQuery ||
    !!toothQuery;
```

Update `clearFilters`:

```ts
  const clearFilters = () => {
    setTreatment(ALL_TREATMENTS);
    setPaymentStatusFilter(ALL_PAYMENT_STATUSES);
    setFrom("");
    setTo("");
    setPatientQuery("");
    setToothQuery("");
  };
```

Pass the new props to `<ConsultationFilterBar>`:

```tsx
      <ConsultationFilterBar
        treatment={treatment}
        onTreatmentChange={setTreatment}
        treatmentOptions={treatmentOptions}
        paymentStatus={paymentStatusFilter}
        onPaymentStatusChange={setPaymentStatusFilter}
        showPatient={showPatient}
        patientQuery={patientQuery}
        onPatientQueryChange={setPatientQuery}
        toothQuery={toothQuery}
        onToothQueryChange={setToothQuery}
        from={from}
        to={to}
        onRangeChange={(r) => {
          setFrom(r.from);
          setTo(r.to);
        }}
        hasFilters={hasFilters}
        onClear={clearFilters}
      />
```

- [ ] **Step 7: Show the amount/status in the read-only view dialog**

In `src/features/consultations/components/view-consultation-dialog.tsx`, add the import:

```ts
import { PaymentStatusBadge } from "@/features/consultations/components/payment-status-badge";
import { formatCurrency } from "@/features/clinic/lib/format";
```

Add a new `<Field>` right after the "Tratamiento" one:

```tsx
          <Field label="Tratamiento">
            <Badge variant="secondary" className="font-normal">
              {consultation.treatment}
            </Badge>
          </Field>

          <Field label="Cobro">
            {consultation.amountCharged != null ? (
              <div className="flex items-center gap-2">
                <PaymentStatusBadge
                  amountCharged={consultation.amountCharged}
                  amountPaid={consultation.amountPaid}
                />
                <span className="text-muted-foreground">
                  {formatCurrency(consultation.amountPaid)} / {formatCurrency(consultation.amountCharged)}
                </span>
              </div>
            ) : (
              <span className="text-muted-foreground">Sin monto registrado</span>
            )}
          </Field>
```

- [ ] **Step 8: Type-check**

Run: `npx tsc --noEmit -p .`
Expected: no errors.

- [ ] **Step 9: Run the full unit suite**

Run: `npm test`
Expected: all tests pass.

- [ ] **Step 10: Manual smoke-check**

Run: `npm run dev`, then in a browser at `/dashboard/consultas`:
1. Confirm the consultation created in Task 8's smoke-check now shows a green "Cobrado · $10.500" badge next to its Tratamiento badge, both in the table and (resize the window below `sm`) in the mobile card.
2. Open its "Ver consulta" dialog, confirm the "Cobro" field shows the same badge and "$10.500 / $10.500".
3. Use the new "Estado de cobro" filter: pick "Cobrado", confirm this consultation stays visible; pick "Pendiente", confirm it disappears; pick "Todos" to reset.
4. Combine "Estado de cobro: Cobrado" with a Tratamiento filter at the same time; confirm the list only shows rows matching both.
5. On a patient's own page, repeat the filter check in the patient-detail Historial de consultas list.

- [ ] **Step 11: Commit**

```bash
git add src/features/consultations/components/payment-status-badge.tsx src/features/consultations/components/consultations-table.tsx src/features/consultations/components/consultation-filter-bar.tsx src/features/consultations/components/consultations-view.tsx src/features/consultations/components/consultations-list.tsx src/app/dashboard/consultas/page.tsx src/features/consultations/components/view-consultation-dialog.tsx
git commit -m "feat: add payment-status badge and Estado de cobro filter"
```

---

## Task 10: Patient balance on the ficha

**Files:**
- Modify: `src/app/dashboard/pacientes/[id]/page.tsx`
- Modify: `src/features/patients/components/patient-detail-view.tsx`

**Interfaces:**
- Consumes: `outstandingBalance` (Task 2), `formatCurrency` (Task 3).

- [ ] **Step 1: Compute the balance and pass it down**

In `src/app/dashboard/pacientes/[id]/page.tsx`, add the import:

```ts
import { outstandingBalance } from "@/features/clinic/lib/billing";
```

After the existing `const consultations = clinic ? await getConsultationsForPatient(clinic.id, id) : [];`, add:

```ts
  const balance = outstandingBalance(consultations);
```

Pass it to `<PatientDetailView>`:

```tsx
  return (
    <PatientDetailView
      patient={patient}
      consultations={consultations}
      treatmentOptions={treatmentOptions.map((o) => o.label)}
      treatmentPrices={treatmentPrices}
      balance={balance}
    />
  );
```

- [ ] **Step 2: Render "Debe: $X" on the ficha**

In `src/features/patients/components/patient-detail-view.tsx`, add the import:

```ts
import { formatCurrency } from "@/features/clinic/lib/format";
```

Add the `balance` prop:

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

In the JSX, the header block currently is:

```tsx
      <div className="flex flex-col gap-3">
        <Link
          href="/dashboard/pacientes"
          className="flex w-fit items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-4" />
          Volver a pacientes
        </Link>
        <PageHeader
          title={patient.name}
          description={patient.phone}
          icon={User}
          action={
            <NewConsultationDialog
              fixedPatientId={patient.id}
              fixedPatientName={patient.name}
              treatmentOptions={treatmentOptions}
              treatmentPrices={treatmentPrices}
              toothHistory={toothHistory}
            />
          }
        />
      </div>
```

Add the balance line right after `<PageHeader ... />`, still inside the same wrapping `<div>`:

```tsx
      <div className="flex flex-col gap-3">
        <Link
          href="/dashboard/pacientes"
          className="flex w-fit items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-4" />
          Volver a pacientes
        </Link>
        <PageHeader
          title={patient.name}
          description={patient.phone}
          icon={User}
          action={
            <NewConsultationDialog
              fixedPatientId={patient.id}
              fixedPatientName={patient.name}
              treatmentOptions={treatmentOptions}
              treatmentPrices={treatmentPrices}
              toothHistory={toothHistory}
            />
          }
        />
        {balance > 0 && (
          <p className="text-sm font-medium text-destructive">Debe: {formatCurrency(balance)}</p>
        )}
      </div>
```

- [ ] **Step 3: Type-check**

Run: `npx tsc --noEmit -p .`
Expected: no errors.

- [ ] **Step 4: Manual smoke-check**

Run: `npm run dev`, navigate to the patient whose consultation you marked "Cobrado" in Task 9 — confirm no "Debe" line shows (balance is 0). Create a second consultation for them with a monto and leave it "Pendiente"; confirm "Debe: $X" now appears with the right amount, in red, right below their phone number.

- [ ] **Step 5: Commit**

```bash
git add src/app/dashboard/pacientes/\[id\]/page.tsx src/features/patients/components/patient-detail-view.tsx
git commit -m "feat: show outstanding balance on the patient detail page"
```

---

## Task 11: "Por cobrar" card on Inicio

**Files:**
- Modify: `src/app/dashboard/page.tsx`
- Modify: `src/features/dashboard/components/dashboard-summary.tsx`

**Interfaces:**
- Consumes: `outstandingBalance` (Task 2), `formatCurrency` (Task 3).

- [ ] **Step 1: Compute the clinic-wide pending amount**

In `src/app/dashboard/page.tsx`, add the import:

```ts
import { outstandingBalance } from "@/features/clinic/lib/billing";
```

After the existing `const [patients, consultations, appointments] = ...`, add:

```ts
  const pendingAmount = outstandingBalance(consultations);
```

Pass it to `<DashboardSummary>`:

```tsx
      <DashboardSummary
        patientCount={patients.length}
        consultationCount={consultations.length}
        upcomingAppointmentCount={appointments.length}
        pendingAmount={pendingAmount}
      />
```

- [ ] **Step 2: Add the 4th card**

In `src/features/dashboard/components/dashboard-summary.tsx`, add imports:

```ts
import { Wallet } from "lucide-react";
import { formatCurrency } from "@/features/clinic/lib/format";
```

Add the `pendingAmount` prop and widen the grid from 3 to 4 columns:

```tsx
export function DashboardSummary({
  patientCount,
  consultationCount,
  upcomingAppointmentCount,
  pendingAmount,
}: {
  patientCount: number;
  consultationCount: number;
  upcomingAppointmentCount: number;
  pendingAmount: number;
}) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
```

Add the 4th card right after the Turnos one, before the closing `</div>`:

```tsx
      <Link href="/dashboard/consultas?cobro=PENDIENTE,PARCIAL">
        <Card className="h-full transition-colors hover:border-primary/50">
          <CardHeader>
            <div className="flex items-center gap-2">
              <Wallet className="size-4 text-muted-foreground" />
              <CardTitle className="text-base">Por cobrar</CardTitle>
            </div>
            <CardDescription>{formatCurrency(pendingAmount)}</CardDescription>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            Consultas pendientes o parcialmente cobradas.
          </CardContent>
        </Card>
      </Link>
```

- [ ] **Step 3: Type-check**

Run: `npx tsc --noEmit -p .`
Expected: no errors.

- [ ] **Step 4: Manual smoke-check**

Run: `npm run dev`, go to `/dashboard`. Confirm 4 cards now show, "Por cobrar" displaying the same total as what's actually owed (cross-check against the sum you'd expect from the patient balance in Task 10). Click the card, confirm it lands on `/dashboard/consultas` with the Estado de cobro filter chip reading "Estado de cobro: Pendiente o parcial" and the list narrowed accordingly.

- [ ] **Step 5: Commit**

```bash
git add src/app/dashboard/page.tsx src/features/dashboard/components/dashboard-summary.tsx
git commit -m "feat: add Por cobrar card to the dashboard"
```

---

## Task 12: Seed data — prices and a realistic payment mix

**Files:**
- Modify: `prisma/seed.ts`

- [ ] **Step 1: Give the default treatments a price**

In `prisma/seed.ts`, replace the flat `DEFAULT_TREATMENT_OPTIONS` array with a priced version, and update `ensureClinicOptions` to use it:

```ts
const DEFAULT_TREATMENTS = [
  { label: "Consulta / diagnóstico", price: 8000 },
  { label: "Limpieza", price: 15000 },
  { label: "Obturación (caries)", price: 20000 },
  { label: "Extracción", price: 25000 },
  { label: "Endodoncia", price: 45000 },
  { label: "Corona / prótesis", price: 60000 },
  { label: "Ortodoncia", price: 35000 },
];
```

Remove the now-unused `DEFAULT_TREATMENT_OPTIONS` constant it replaces, and update `ensureClinicOptions`:

```ts
async function ensureClinicOptions(clinicId: string) {
  const existing = await prisma.clinicOption.findFirst({ where: { clinicId } });
  if (existing) return;
  await prisma.clinicOption.createMany({
    data: [
      ...DEFAULT_INSURANCE_OPTIONS.map((label, order) => ({
        clinicId,
        category: "insurance",
        label,
        order,
      })),
      ...DEFAULT_TREATMENTS.map(({ label, price }, order) => ({
        clinicId,
        category: "treatment",
        label,
        order,
        price,
      })),
    ],
  });
}
```

- [ ] **Step 2: Give seeded consultations a realistic payment mix**

In `seedConsultations`, each row currently looks like `{ patient: 0, daysAgo: 45, treatment: "Consulta / diagnóstico", teeth: [], notes: "..." }`. Add `amountCharged`/`amountPaid` to each row, covering all four states (a couple left with no amount at all, to exercise "Sin monto" too):

```ts
  const rows = [
    { patient: 0, daysAgo: 45, treatment: "Consulta / diagnóstico", teeth: [], notes: "Primera consulta, sin urgencias.", amountCharged: 8000, amountPaid: 8000 },
    { patient: 0, daysAgo: 10, treatment: "Limpieza", teeth: [], amountCharged: 15000, amountPaid: 0 },
    { patient: 1, daysAgo: 30, treatment: "Obturación (caries)", teeth: ["16"], amountCharged: 20000, amountPaid: 20000 },
    { patient: 3, daysAgo: 20, treatment: "Extracción", teeth: ["38"], notes: "Muela del juicio, extracción sin complicaciones.", amountCharged: 25000, amountPaid: 10000 },
    { patient: 4, daysAgo: 15, treatment: "Endodoncia", teeth: ["21"], amountCharged: 45000, amountPaid: 45000 },
    { patient: 4, daysAgo: 60, treatment: "Consulta / diagnóstico", teeth: [] },
    { patient: 6, daysAgo: 5, treatment: "Corona / prótesis", teeth: ["46"], amountCharged: 60000, amountPaid: 0 },
    { patient: 8, daysAgo: 25, treatment: "Limpieza", teeth: [], amountCharged: 15000, amountPaid: 15000 },
    { patient: 8, daysAgo: 3, treatment: "Obturación (caries)", teeth: ["24", "25"], amountCharged: 20000, amountPaid: 8000 },
    { patient: 10, daysAgo: 12, treatment: "Ortodoncia", teeth: [], notes: "Control mensual de brackets.", amountCharged: 35000, amountPaid: 35000 },
    { patient: 11, daysAgo: 40, treatment: "Consulta / diagnóstico", teeth: [] },
    { patient: 11, daysAgo: 7, treatment: "Obturación (caries)", teeth: ["36"], amountCharged: 20000, amountPaid: 0 },
  ];
```

Update the `for (const row of rows)` loop's `data` to include the new fields:

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
```

- [ ] **Step 2: Run it against a scratch clinic to confirm it works**

Run: `npm run db:seed` (or `CLINIC_ID=<id> npm run db:seed` if there's more than one clinic in the dev DB — the script will print the available ids if so).
Expected: completes with no errors; the printed summary still reads `N pacientes creados`, `consultas creadas`, etc.

- [ ] **Step 3: Commit**

```bash
git add prisma/seed.ts
git commit -m "feat: seed treatment prices and a realistic payment mix"
```

---

## Task 13: E2E — Configuración price field

**Files:**
- Modify: `e2e/settings.spec.ts`

- [ ] **Step 1: Write the test**

Add a new `test(...)` to `e2e/settings.spec.ts`, after the existing "a long list of tratamientos..." test:

```ts
test("a treatment's price can be set, edited, and cleared", async ({ page }) => {
  await page.goto("/sign-in");
  await clerk.signIn({ page, emailAddress: process.env.E2E_TEST_EMAIL! });

  await page.goto("/dashboard/configuracion");
  await page.getByRole("tab", { name: "Tratamientos" }).click();

  const label = `Tratamiento Precio E2E ${Date.now()}`;

  await page.getByPlaceholder("Agregar nuevo...").fill(label);
  await page.getByPlaceholder("Precio (opcional)").fill("15000");
  await page.getByRole("button", { name: "Agregar" }).click();
  await page.getByPlaceholder("Buscar...").fill(label);
  await expect(page.getByText(`${label} $15.000`, { exact: false })).toBeVisible();

  await page.getByRole("button", { name: `Editar ${label}` }).click();
  await page.getByRole("spinbutton", { name: `Precio de ${label}` }).fill("20000");
  await page.getByRole("button", { name: "Guardar" }).click();
  await expect(page.getByText("$20.000")).toBeVisible();

  await page.getByRole("button", { name: `Editar ${label}` }).click();
  await page.getByRole("spinbutton", { name: `Precio de ${label}` }).fill("");
  await page.getByRole("button", { name: "Guardar" }).click();
  await expect(page.getByText("Sin precio")).toBeVisible();

  // Cleanup.
  await page.getByRole("button", { name: `Eliminar ${label}` }).click();
  await page.getByRole("button", { name: "Eliminar", exact: true }).click();
  await expect(page.getByText(label, { exact: true })).toHaveCount(0);
});
```

- [ ] **Step 2: Run it**

Run: `npx playwright test e2e/settings.spec.ts -g "price can be set"`
Expected: PASS. If the exact text match on `${label} $15.000` fails because of how the label and price actually render (e.g. extra whitespace between them), loosen the assertion to two separate `getByText` checks instead of one combined string — don't change the component's markup just to satisfy the test string.

- [ ] **Step 3: Commit**

```bash
git add e2e/settings.spec.ts
git commit -m "test: add E2E coverage for treatment pricing"
```

---

## Task 14: E2E — consultation payment flow, filter, balance, and dashboard card

**Files:**
- Modify: `e2e/consultations.spec.ts`

- [ ] **Step 1: Write the test**

Add a new `test(...)` to `e2e/consultations.spec.ts`, after the last existing test. It relies on "Limpieza" already having a price from the seed data (Task 12) or from Task 13's E2E run leaving a priced treatment behind — to stay independent of both, this test creates its own priced treatment first:

```ts
test("a consultation's amount, discount, and payment status work end to end", async ({ page }) => {
  await page.goto("/sign-in");
  await clerk.signIn({ page, emailAddress: process.env.E2E_TEST_EMAIL! });

  const treatmentLabel = `Cobro E2E ${Date.now()}`;
  await page.goto("/dashboard/configuracion");
  await page.getByRole("tab", { name: "Tratamientos" }).click();
  await page.getByPlaceholder("Agregar nuevo...").fill(treatmentLabel);
  await page.getByPlaceholder("Precio (opcional)").fill("10000");
  await page.getByRole("button", { name: "Agregar" }).click();
  await page.getByPlaceholder("Buscar...").fill(treatmentLabel);
  await expect(page.getByText(treatmentLabel, { exact: true })).toBeVisible();

  await page.goto("/dashboard/consultas");
  await page.getByRole("button", { name: "Nueva consulta" }).click();
  await page.getByRole("combobox").first().click();
  await page.getByRole("option", { name: "Agregar paciente nuevo" }).click();
  const patientName = `Paciente Cobro E2E ${Date.now()}`;
  await page.fill("#newPatientName", patientName);
  await page.fill("#newPatientPhone", "11 8888-8888");
  await page.getByRole("combobox").nth(3).click();
  await page.getByRole("option", { name: treatmentLabel }).click();

  // Precio de lista prefilled, discount recalculates it.
  await expect(page.getByText("$10.000")).toBeVisible();
  await page.fill("#discountPercent", "20");
  await expect(page.locator("#amountCharged")).toHaveValue("8000");

  await page.getByRole("button", { name: "Parcial" }).click();
  await page.fill("#partialAmountPaid", "3000");
  await page.getByRole("button", { name: "Guardar" }).click();
  await createConsultationAndFindIt(page, patientName);

  const row = page.locator("tbody tr", { hasText: patientName });
  await expect(row.getByText("Parcial · $8.000")).toBeVisible();

  // Patient balance reflects the $5.000 still owed.
  await row.getByText(patientName).click();
  await expect(page.getByText("Debe: $5.000")).toBeVisible();

  // Mark it fully paid from the Editar dialog and confirm the balance clears.
  await page.goto("/dashboard/consultas");
  await page.locator("#filter-patient").fill(patientName);
  const editRow = page.locator("tbody tr", { hasText: patientName });
  await editRow.getByRole("button", { name: "Editar consulta" }).click();
  await page.getByRole("button", { name: "Cobrado", exact: true }).click();
  await page.getByRole("button", { name: "Guardar cambios" }).click();
  await expect(page.getByText("Editar consulta")).toHaveCount(0);
  await expect(editRow.getByText("Cobrado · $8.000")).toBeVisible();

  // The Estado de cobro filter narrows to just this consultation.
  await page.locator("#filter-patient").fill(patientName);
  const filterSelect = page.locator("button", { hasText: "Todos" }).last();
  await filterSelect.click();
  await page.getByRole("option", { name: "Cobrado", exact: true }).click();
  await expect(page.locator("tbody").getByText(patientName)).toBeVisible();
  await page.getByRole("button", { name: "Limpiar filtros" }).click();

  // Cleanup: delete the consultation and the treatment option.
  await page.locator("#filter-patient").fill(patientName);
  await editRow.getByRole("button", { name: "Eliminar consulta" }).click();
  await page.getByText("¿Eliminar esta consulta?").waitFor();
  await page.getByRole("button", { name: "Eliminar", exact: true }).last().click();
  await expect(page.locator("tbody").getByText(patientName)).toHaveCount(0);

  await page.goto("/dashboard/configuracion");
  await page.getByRole("tab", { name: "Tratamientos" }).click();
  await page.getByPlaceholder("Buscar...").fill(treatmentLabel);
  await page.getByRole("button", { name: `Eliminar ${treatmentLabel}` }).click();
  await page.getByRole("button", { name: "Eliminar", exact: true }).click();
});
```

- [ ] **Step 2: Run it**

Run: `npx playwright test e2e/consultations.spec.ts -g "amount, discount, and payment status"`
Expected: PASS. Payment-status filter `<Select>` locator strategy note: if `page.locator("button", { hasText: "Todos" }).last()` turns out ambiguous once the extra filter is on the page (multiple elements can contain the word "Todos" — e.g. "Todos los tratamientos"), replace it with a scoped locator anchored on the "Estado de cobro" label instead, e.g. `page.locator('div:has(> label:text("Estado de cobro")) button')`. Adjust to whatever actually resolves uniquely — don't force the original selector if the rendered DOM doesn't support it.

- [ ] **Step 3: Run the full E2E suite**

Run: `npx playwright test`
Expected: all specs pass, including everything from earlier sessions (patients, appointments, odontogram, tenant isolation, branding, auth, settings, consultations).

- [ ] **Step 4: Commit**

```bash
git add e2e/consultations.spec.ts
git commit -m "test: add E2E coverage for the consultation payment flow"
```

---

## Final Verification

- [ ] Run `npx tsc --noEmit -p .` — no errors.
- [ ] Run `npm run lint` — no new warnings/errors beyond the three pre-existing React Hook Form ones.
- [ ] Run `npm test` — all unit tests pass.
- [ ] Run `npx playwright test` — all E2E specs pass.
- [ ] Manually re-read the spec's Review Focus items against the running app one more time: a negative amount, an overpayment, a `$0` treatment reading as Cobrado, the combined filter, and a treatment's price change not touching past consultations.

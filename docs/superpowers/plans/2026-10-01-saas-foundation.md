# Dentia — Fase 1: Base Multi-Tenant Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the mock, in-memory, single-tenant prototype with a real Postgres-backed, multi-tenant foundation (Clerk auth + Organizations as tenants, Prisma data layer enforcing tenant isolation), packaged entirely in Docker and deployable to Railway.

**Architecture:** Clerk owns identity (users + Organizations = clinics). A Postgres database holds only domain data (`Clinic`, `Patient`, `Consultation`), every row scoped by `clinicId`. All reads/writes to tenant data go through a dedicated data-access layer whose functions require `clinicId` as their first argument, sourced only from the server-side Clerk session — never from client input. Existing Server Component / Server Action patterns (already used for the mock auth actions) carry over; only the data source changes.

**Tech Stack:** Next.js 16 (App Router, existing), PostgreSQL, Prisma, Clerk (`@clerk/nextjs`), Vitest (data-layer unit tests), Playwright Test (E2E), Docker + Docker Compose, Railway.

**Spec:** `docs/superpowers/specs/2026-10-01-saas-foundation-design.md`

**Note on Clerk APIs:** this repo's own `AGENTS.md` warns that framework APIs may differ from training data for this Next.js version. The same caution applies to Clerk — its SDK has changed shape across versions. Before implementing Tasks 4-5-6, check current method/import names against https://clerk.com/docs rather than trusting the snippets below verbatim if they look stale.

## Global Constraints

- Every read or write to `Patient` or `Consultation` MUST go through `src/features/clinic/data/*.ts` — no Prisma calls against these models anywhere else in the codebase.
- `clinicId` is never accepted from client input (URL params, form fields, request bodies). It is always derived server-side from the authenticated Clerk session via `getCurrentClinic()`.
- Target market is Argentina — not a code constraint in this phase, but do not add billing, a public landing/signup page, custom roles beyond Clerk Organizations' defaults, or a Turnos module. Those are explicitly out of scope for this plan.
- Package manager is npm (matches the existing `package-lock.json`).
- Keep the existing feature-based folder structure (`src/features/<domain>/...`) already established in this codebase.

## Review Focus

- A Server Action receiving a `clinicId`-shaped value in its form payload and trusting it instead of deriving it from `auth()` — must always re-derive server-side. (Task 7, Task 8)
- Deleting a patient that has existing consultations — consultations must survive with `patientId` set to `null`, not be deleted or throw a foreign-key error. (Task 1, Task 3)
- The Clerk webhook for `organization.created` arriving twice (Clerk retries on timeout) — must not create two `Clinic` rows for the same `clerkOrgId`. (Task 5)
- A signed-in user whose Clerk session has no active organization yet (`orgId` is `null`) hitting `/dashboard` — must get a clear prompt, not a crash. (Task 6)
- A user's very first login landing before the `organization.created` webhook has been delivered (webhooks are asynchronous) — `getCurrentClinic()` must handle "no matching Clinic row yet" without an unhandled exception. (Task 6)

---

## Task 1: Database schema, migration, and local Postgres via Docker Compose

**Files:**
- Create: `docker-compose.yml`
- Create: `prisma/schema.prisma`
- Create: `.env.example`
- Create: `src/lib/prisma.ts`
- Create: `vitest.config.ts`
- Create: `vitest.setup.ts`
- Create: `src/lib/prisma.test.ts`
- Modify: `package.json` (add `prisma`, `@prisma/client`, `vitest` + scripts)

**Interfaces:**
- Produces: `prisma` (singleton `PrismaClient` instance) exported from `src/lib/prisma.ts`, imported by every file in the data-access layer (Tasks 2-3).
- Produces: `Clinic`, `Patient`, `Consultation` Prisma models, matching the spec's boceto with one deviation: `Consultation.patientId` is nullable (`String?`) with `onDelete: SetNull`, so deleting a patient orphans their consultations instead of deleting or blocking (matches the existing UI copy: "Las consultas ya registradas para este paciente van a quedar sin paciente asociado").

- [ ] **Step 1: Write `docker-compose.yml` with a Postgres service**

```yaml
services:
  postgres:
    image: postgres:16-alpine
    restart: unless-stopped
    environment:
      POSTGRES_USER: dentia
      POSTGRES_PASSWORD: dentia_dev_password
      POSTGRES_DB: dentia
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data

volumes:
  postgres_data:
```

- [ ] **Step 2: Start it and confirm it's healthy**

Run: `docker compose up -d postgres`
Expected: container starts; `docker compose ps` shows `postgres` as `running`/`healthy`.

- [ ] **Step 3: Write `.env.example`**

```bash
DATABASE_URL="postgresql://dentia:dentia_dev_password@localhost:5432/dentia"
DATABASE_URL_TEST="postgresql://dentia:dentia_dev_password@localhost:5432/dentia_test"

NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=""
CLERK_SECRET_KEY=""
CLERK_WEBHOOK_SECRET=""
```

Copy it to `.env` (git-ignored) and fill in real values as later tasks need them.

- [ ] **Step 4: Install Prisma and initialize**

Run: `npm install prisma @prisma/client`
Run: `npx prisma init --datasource-provider postgresql` (if it scaffolds its own `schema.prisma`, replace its contents in the next step rather than keeping the default)

- [ ] **Step 5: Write `prisma/schema.prisma`**

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

model Clinic {
  id         String   @id @default(cuid())
  clerkOrgId String   @unique
  name       String
  createdAt  DateTime @default(now())

  patients      Patient[]
  consultations Consultation[]
}

model Patient {
  id        String    @id @default(cuid())
  clinicId  String
  clinic    Clinic    @relation(fields: [clinicId], references: [id], onDelete: Cascade)

  name      String
  phone     String
  email     String?
  dni       String?
  birthDate DateTime?
  address   String?
  insurance String?
  allergies String?

  consultations Consultation[]

  @@index([clinicId])
}

model Consultation {
  id        String    @id @default(cuid())
  clinicId  String
  clinic    Clinic    @relation(fields: [clinicId], references: [id], onDelete: Cascade)
  patientId String?
  patient   Patient?  @relation(fields: [patientId], references: [id], onDelete: SetNull)

  date      DateTime
  treatment String
  tooth     String?
  notes     String?

  @@index([clinicId])
  @@index([patientId])
}
```

- [ ] **Step 6: Create the two databases (dev + test) and run the first migration**

Run: `docker exec -it $(docker compose ps -q postgres) psql -U dentia -c "CREATE DATABASE dentia_test;"`
Run: `npx prisma migrate dev --name init`
Expected: migration applies cleanly against `dentia`; `prisma/migrations/<timestamp>_init/` is created.

- [ ] **Step 7: Write the Prisma client singleton**

```ts
// src/lib/prisma.ts
import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma = globalForPrisma.prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
```

- [ ] **Step 8: Install Vitest and write its config**

Run: `npm install -D vitest dotenv`

```ts
// vitest.config.ts
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    setupFiles: ["./vitest.setup.ts"],
  },
});
```

```ts
// vitest.setup.ts
import { config } from "dotenv";

config({ path: ".env" });
process.env.DATABASE_URL = process.env.DATABASE_URL_TEST;
```

Add to `package.json` `scripts`: `"test": "vitest run"`.

- [ ] **Step 9: Apply the migration to the test database too**

Run: `DATABASE_URL="$DATABASE_URL_TEST" npx prisma migrate deploy` (or re-run `prisma migrate dev` pointed at the test URL — either way, `dentia_test` needs the same schema as `dentia`)

- [ ] **Step 10: Write the failing test — schema round-trip and the orphan-on-delete behavior**

```ts
// src/lib/prisma.test.ts
import { afterEach, describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";

afterEach(async () => {
  await prisma.consultation.deleteMany({});
  await prisma.patient.deleteMany({});
  await prisma.clinic.deleteMany({});
});

describe("prisma schema", () => {
  it("creates a clinic, a patient under it, and a consultation under the patient", async () => {
    const clinic = await prisma.clinic.create({
      data: { clerkOrgId: "org_test_1", name: "Clínica de prueba" },
    });
    const patient = await prisma.patient.create({
      data: { clinicId: clinic.id, name: "Paciente Test", phone: "111" },
    });
    const consultation = await prisma.consultation.create({
      data: {
        clinicId: clinic.id,
        patientId: patient.id,
        date: new Date("2026-01-01"),
        treatment: "Limpieza",
      },
    });

    expect(consultation.patientId).toBe(patient.id);
  });

  it("sets consultation.patientId to null (not a delete or an error) when the patient is deleted", async () => {
    const clinic = await prisma.clinic.create({
      data: { clerkOrgId: "org_test_2", name: "Clínica de prueba 2" },
    });
    const patient = await prisma.patient.create({
      data: { clinicId: clinic.id, name: "Paciente Test", phone: "111" },
    });
    const consultation = await prisma.consultation.create({
      data: {
        clinicId: clinic.id,
        patientId: patient.id,
        date: new Date("2026-01-01"),
        treatment: "Limpieza",
      },
    });

    await prisma.patient.delete({ where: { id: patient.id } });

    const result = await prisma.consultation.findUniqueOrThrow({
      where: { id: consultation.id },
    });
    expect(result.patientId).toBeNull();
  });
});
```

- [ ] **Step 11: Run it to verify it fails first**

Run: `npm test -- prisma.test.ts`
Expected: FAIL if `dentia_test` doesn't have the migration applied yet, or PASS if Steps 1-9 were done correctly (if it already passes, that's fine — Prisma schema work doesn't have a meaningful "red" state the way application logic does; confirm instead that it fails if you temporarily remove `onDelete: SetNull` from the schema and re-migrate, then restore it).

- [ ] **Step 12: Confirm it passes with the real schema**

Run: `npm test -- prisma.test.ts`
Expected: PASS (2 tests)

- [ ] **Step 13: Commit**

```bash
git add docker-compose.yml .env.example prisma/ src/lib/prisma.ts src/lib/prisma.test.ts vitest.config.ts vitest.setup.ts package.json package-lock.json
git commit -m "feat: add Postgres + Prisma schema with tenant-scoped models"
```

---

## Task 2: Patients data-access layer with tenant isolation

**Files:**
- Create: `src/features/clinic/data/patients.ts`
- Test: `src/features/clinic/data/patients.test.ts`

**Interfaces:**
- Consumes: `prisma` from `src/lib/prisma.ts` (Task 1).
- Produces: `getPatients(clinicId: string)`, `getPatient(clinicId: string, id: string)`, `createPatient(clinicId: string, input: NewPatientInput)`, `updatePatient(clinicId: string, id: string, input: NewPatientInput)`, `deletePatient(clinicId: string, id: string)`, and the `NewPatientInput` type — all consumed by Task 7 (Server Actions for the Pacientes page).

- [ ] **Step 1: Write the failing tests**

```ts
// src/features/clinic/data/patients.test.ts
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import {
  createPatient,
  deletePatient,
  getPatient,
  getPatients,
  updatePatient,
} from "@/features/clinic/data/patients";

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
  await prisma.consultation.deleteMany({});
  await prisma.patient.deleteMany({});
  await prisma.clinic.deleteMany({});
});

describe("patients data layer", () => {
  it("creates a patient scoped to the given clinic", async () => {
    const patient = await createPatient(clinicA.id, {
      name: "Lucía Fernández",
      phone: "11 4455-2201",
    });
    expect(patient.clinicId).toBe(clinicA.id);
  });

  it("does not return a clinic A patient when queried with clinic B's id", async () => {
    const patient = await createPatient(clinicA.id, {
      name: "Lucía Fernández",
      phone: "11 4455-2201",
    });
    const result = await getPatient(clinicB.id, patient.id);
    expect(result).toBeNull();
  });

  it("lists only patients belonging to the requested clinic", async () => {
    await createPatient(clinicA.id, { name: "Paciente A", phone: "111" });
    await createPatient(clinicB.id, { name: "Paciente B", phone: "222" });

    const listA = await getPatients(clinicA.id);
    expect(listA).toHaveLength(1);
    expect(listA[0].name).toBe("Paciente A");
  });

  it("refuses to update a patient belonging to another clinic", async () => {
    const patient = await createPatient(clinicA.id, { name: "Paciente A", phone: "111" });

    await expect(
      updatePatient(clinicB.id, patient.id, { name: "Hackeado", phone: "000" }),
    ).rejects.toThrow("Patient not found for this clinic");

    const stillOriginal = await getPatient(clinicA.id, patient.id);
    expect(stillOriginal?.name).toBe("Paciente A");
  });

  it("refuses to delete a patient belonging to another clinic", async () => {
    const patient = await createPatient(clinicA.id, { name: "Paciente A", phone: "111" });

    await deletePatient(clinicB.id, patient.id);

    const stillThere = await getPatient(clinicA.id, patient.id);
    expect(stillThere).not.toBeNull();
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm test -- patients.test.ts`
Expected: FAIL — `Cannot find module '@/features/clinic/data/patients'`

- [ ] **Step 3: Write the minimal implementation**

```ts
// src/features/clinic/data/patients.ts
import { prisma } from "@/lib/prisma";
import type { Patient } from "@prisma/client";

export type NewPatientInput = {
  name: string;
  phone: string;
  email?: string;
  dni?: string;
  birthDate?: Date;
  address?: string;
  insurance?: string;
  allergies?: string;
};

export async function getPatients(clinicId: string): Promise<Patient[]> {
  return prisma.patient.findMany({
    where: { clinicId },
    orderBy: { name: "asc" },
  });
}

export async function getPatient(clinicId: string, id: string): Promise<Patient | null> {
  return prisma.patient.findFirst({ where: { id, clinicId } });
}

export async function createPatient(
  clinicId: string,
  input: NewPatientInput,
): Promise<Patient> {
  return prisma.patient.create({ data: { ...input, clinicId } });
}

export async function updatePatient(
  clinicId: string,
  id: string,
  input: NewPatientInput,
): Promise<Patient> {
  const result = await prisma.patient.updateMany({
    where: { id, clinicId },
    data: input,
  });
  if (result.count === 0) {
    throw new Error("Patient not found for this clinic");
  }
  return (await getPatient(clinicId, id))!;
}

export async function deletePatient(clinicId: string, id: string): Promise<void> {
  await prisma.patient.deleteMany({ where: { id, clinicId } });
}
```

The tenant-safety property comes from using `findFirst`/`updateMany`/`deleteMany` with `clinicId` baked into the `where` clause on every call — not from a separate permission check. It is structurally impossible to touch another clinic's row through these functions, even by guessing a valid patient `id`.

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npm test -- patients.test.ts`
Expected: PASS (5 tests)

- [ ] **Step 5: Commit**

```bash
git add src/features/clinic/data/patients.ts src/features/clinic/data/patients.test.ts
git commit -m "feat: add tenant-scoped patients data access layer"
```

---

## Task 3: Consultations data-access layer with tenant isolation

**Files:**
- Create: `src/features/clinic/data/consultations.ts`
- Test: `src/features/clinic/data/consultations.test.ts`

**Interfaces:**
- Consumes: `prisma` from `src/lib/prisma.ts` (Task 1), `createPatient` from `src/features/clinic/data/patients.ts` (Task 2) for test fixtures.
- Produces: `getConsultations(clinicId: string)`, `getConsultation(clinicId: string, id: string)`, `getConsultationsForPatient(clinicId: string, patientId: string)`, `createConsultation(clinicId: string, input: NewConsultationInput)`, and `NewConsultationInput` — consumed by Task 8.

- [ ] **Step 1: Write the failing tests**

```ts
// src/features/clinic/data/consultations.test.ts
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import { createPatient } from "@/features/clinic/data/patients";
import {
  createConsultation,
  getConsultation,
  getConsultations,
  getConsultationsForPatient,
} from "@/features/clinic/data/consultations";

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
  await prisma.consultation.deleteMany({});
  await prisma.patient.deleteMany({});
  await prisma.clinic.deleteMany({});
});

describe("consultations data layer", () => {
  it("creates a consultation scoped to the given clinic", async () => {
    const patient = await createPatient(clinicA.id, { name: "Paciente A", phone: "111" });
    const consultation = await createConsultation(clinicA.id, {
      patientId: patient.id,
      date: new Date("2026-01-01"),
      treatment: "Limpieza",
    });
    expect(consultation.clinicId).toBe(clinicA.id);
  });

  it("does not return a clinic A consultation when queried with clinic B's id", async () => {
    const patient = await createPatient(clinicA.id, { name: "Paciente A", phone: "111" });
    const consultation = await createConsultation(clinicA.id, {
      patientId: patient.id,
      date: new Date("2026-01-01"),
      treatment: "Limpieza",
    });
    const result = await getConsultation(clinicB.id, consultation.id);
    expect(result).toBeNull();
  });

  it("lists only consultations belonging to the requested clinic", async () => {
    const patientA = await createPatient(clinicA.id, { name: "Paciente A", phone: "111" });
    const patientB = await createPatient(clinicB.id, { name: "Paciente B", phone: "222" });
    await createConsultation(clinicA.id, {
      patientId: patientA.id,
      date: new Date("2026-01-01"),
      treatment: "Limpieza",
    });
    await createConsultation(clinicB.id, {
      patientId: patientB.id,
      date: new Date("2026-01-02"),
      treatment: "Extracción",
    });

    const listA = await getConsultations(clinicA.id);
    expect(listA).toHaveLength(1);
    expect(listA[0].treatment).toBe("Limpieza");
  });

  it("returns only the given patient's consultations, scoped to the clinic", async () => {
    const patient = await createPatient(clinicA.id, { name: "Paciente A", phone: "111" });
    const otherPatient = await createPatient(clinicA.id, { name: "Paciente B", phone: "222" });
    await createConsultation(clinicA.id, {
      patientId: patient.id,
      date: new Date("2026-01-01"),
      treatment: "Limpieza",
    });
    await createConsultation(clinicA.id, {
      patientId: otherPatient.id,
      date: new Date("2026-01-02"),
      treatment: "Extracción",
    });

    const result = await getConsultationsForPatient(clinicA.id, patient.id);
    expect(result).toHaveLength(1);
    expect(result[0].treatment).toBe("Limpieza");
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm test -- consultations.test.ts`
Expected: FAIL — `Cannot find module '@/features/clinic/data/consultations'`

- [ ] **Step 3: Write the minimal implementation**

```ts
// src/features/clinic/data/consultations.ts
import { prisma } from "@/lib/prisma";
import type { Consultation } from "@prisma/client";

export type NewConsultationInput = {
  patientId: string;
  date: Date;
  treatment: string;
  tooth?: string;
  notes?: string;
};

export async function getConsultations(clinicId: string): Promise<Consultation[]> {
  return prisma.consultation.findMany({
    where: { clinicId },
    orderBy: { date: "desc" },
  });
}

export async function getConsultation(
  clinicId: string,
  id: string,
): Promise<Consultation | null> {
  return prisma.consultation.findFirst({ where: { id, clinicId } });
}

export async function getConsultationsForPatient(
  clinicId: string,
  patientId: string,
): Promise<Consultation[]> {
  return prisma.consultation.findMany({
    where: { clinicId, patientId },
    orderBy: { date: "desc" },
  });
}

export async function createConsultation(
  clinicId: string,
  input: NewConsultationInput,
): Promise<Consultation> {
  return prisma.consultation.create({ data: { ...input, clinicId } });
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npm test -- consultations.test.ts`
Expected: PASS (4 tests)

- [ ] **Step 5: Commit**

```bash
git add src/features/clinic/data/consultations.ts src/features/clinic/data/consultations.test.ts
git commit -m "feat: add tenant-scoped consultations data access layer"
```

---

## Task 4: Install Clerk and replace mock auth

**Files:**
- Modify: `src/app/layout.tsx` (wrap with `<ClerkProvider>`)
- Create: `src/middleware.ts` (replaces `src/proxy.ts`)
- Delete: `src/proxy.ts`, `src/features/auth/` (entire directory: `lib/session.ts`, `lib/actions.ts`, `lib/schema.ts`, `lib/constants.ts`, `components/login-form.tsx`)
- Delete: `src/app/(auth)/` (entire directory: `layout.tsx`, `login/page.tsx`)
- Modify: `src/app/page.tsx` (root redirect, now driven by Clerk's auth state instead of the removed cookie check)
- Modify: `src/app/dashboard/layout.tsx` (read the signed-in user from Clerk instead of `getSession()`)
- Test: `e2e/auth.spec.ts`

**Interfaces:**
- Consumes: nothing from earlier tasks.
- Produces: Clerk's `auth()` helper (from `@clerk/nextjs/server`) becomes the only source of "who is signed in" for the rest of the plan — Task 6's `getCurrentClinic()` calls it directly.

- [ ] **Step 1: Install Clerk and Playwright Test**

Run: `npm install @clerk/nextjs`
Run: `npm install -D @playwright/test @clerk/testing`
Run: `npx playwright install chromium`

- [ ] **Step 2: Create a Clerk application and fill in the keys**

In the Clerk dashboard, create an application, enable "Email address" as the sign-in strategy (password or email code — either works with the test in Step 7). Copy the publishable and secret keys into `.env`:

```bash
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY="pk_test_..."
CLERK_SECRET_KEY="sk_test_..."
```

- [ ] **Step 3: Write the failing E2E test**

```ts
// e2e/auth.spec.ts
import { test, expect } from "@playwright/test";

test("unauthenticated user is redirected to sign-in when visiting the dashboard", async ({
  page,
}) => {
  await page.goto("/dashboard");
  await expect(page).toHaveURL(/sign-in/);
});
```

- [ ] **Step 4: Run it to verify it fails**

Run: `npx playwright test e2e/auth.spec.ts`
Expected: FAIL — today `/dashboard` redirects to `/login` (the mock route), not `/sign-in`, or the old mock middleware behaves differently.

- [ ] **Step 5: Remove the mock auth code**

Delete these paths entirely:
- `src/proxy.ts`
- `src/features/auth/`
- `src/app/(auth)/`

- [ ] **Step 6: Wrap the root layout with `ClerkProvider` and add the Clerk middleware**

```tsx
// src/app/layout.tsx (relevant excerpt — keep the existing fonts/ThemeProvider/TooltipProvider wrapping from the current file, add ClerkProvider as the outermost wrapper)
import { ClerkProvider } from "@clerk/nextjs";
// ...existing imports...

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <ClerkProvider>
      <html lang="en" className={/* existing className */} suppressHydrationWarning>
        <body className="min-h-full flex flex-col">
          {/* existing ThemeProvider > TooltipProvider wrapping stays, now nested inside ClerkProvider */}
          {children}
        </body>
      </html>
    </ClerkProvider>
  );
}
```

```ts
// src/middleware.ts
import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";

const isProtectedRoute = createRouteMatcher(["/dashboard(.*)"]);

export default clerkMiddleware(async (auth, req) => {
  if (isProtectedRoute(req)) {
    await auth.protect();
  }
});

export const config = {
  matcher: ["/((?!_next|.*\\..*).*)"],
};
```

Verify against current Clerk docs that `clerkMiddleware`/`auth.protect()` are still the right names — this is exactly the kind of API this repo's `AGENTS.md` warns about.

- [ ] **Step 7: Add the sign-in page using Clerk's prebuilt component**

```tsx
// src/app/sign-in/[[...sign-in]]/page.tsx
import { SignIn } from "@clerk/nextjs";

export default function SignInPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/40 px-4">
      <SignIn />
    </div>
  );
}
```

In the Clerk dashboard, set the sign-in URL to `/sign-in` (Clerk's default redirect target for `auth.protect()`).

- [ ] **Step 8: Update the root page and dashboard layout to use Clerk**

```tsx
// src/app/page.tsx
import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";

export default async function RootPage() {
  const { userId } = await auth();
  redirect(userId ? "/dashboard" : "/sign-in");
}
```

```tsx
// src/app/dashboard/layout.tsx (relevant excerpt)
import { auth, currentUser } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
// ...existing imports, minus getSession...

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");
  const user = await currentUser();
  // pass user's display name/email to UserMenu instead of the removed session object
  // ...rest of existing layout JSX, unchanged...
}
```

`UserMenu`'s logout button (`src/features/dashboard/components/user-menu.tsx`) and the sidebar's logout item (`src/features/dashboard/components/app-sidebar.tsx`) both currently call the deleted `logoutAction` — replace both with Clerk's `<SignOutButton>` wrapping the existing button markup.

- [ ] **Step 9: Run the test to verify it passes**

Run: `npx playwright test e2e/auth.spec.ts`
Expected: PASS

- [ ] **Step 10: Commit**

```bash
git add -A
git commit -m "feat: replace mock auth with Clerk"
```

---

## Task 5: Sync Clerk Organizations to `Clinic` rows via webhook

**Files:**
- Create: `src/app/api/webhooks/clerk/route.ts`
- Test: `src/app/api/webhooks/clerk/route.test.ts`

**Interfaces:**
- Consumes: `prisma` from `src/lib/prisma.ts` (Task 1).
- Produces: a `Clinic` row with `clerkOrgId` matching the Clerk Organization's id, for every organization created — consumed by Task 6's `getCurrentClinic()`.

- [ ] **Step 1: Install the webhook signature verification library**

Run: `npm install svix`

- [ ] **Step 2: Write the failing test**

```ts
// src/app/api/webhooks/clerk/route.test.ts
import { afterEach, describe, expect, it, vi } from "vitest";
import { prisma } from "@/lib/prisma";

vi.mock("svix", () => ({
  Webhook: class {
    verify() {
      return {
        type: "organization.created",
        data: { id: "org_abc123", name: "Clínica de prueba" },
      };
    }
  },
}));

afterEach(async () => {
  await prisma.clinic.deleteMany({});
});

describe("POST /api/webhooks/clerk", () => {
  it("creates a Clinic row on organization.created", async () => {
    const { POST } = await import("@/app/api/webhooks/clerk/route");
    const request = new Request("http://localhost/api/webhooks/clerk", {
      method: "POST",
      headers: {
        "svix-id": "msg_1",
        "svix-timestamp": "123",
        "svix-signature": "v1,fake",
      },
      body: JSON.stringify({}),
    });

    const response = await POST(request);
    expect(response.status).toBe(200);

    const clinic = await prisma.clinic.findUnique({ where: { clerkOrgId: "org_abc123" } });
    expect(clinic?.name).toBe("Clínica de prueba");
  });

  it("does not create a second Clinic row if the webhook is delivered twice", async () => {
    const { POST } = await import("@/app/api/webhooks/clerk/route");
    const request = () =>
      new Request("http://localhost/api/webhooks/clerk", {
        method: "POST",
        headers: {
          "svix-id": "msg_1",
          "svix-timestamp": "123",
          "svix-signature": "v1,fake",
        },
        body: JSON.stringify({}),
      });

    await POST(request());
    await POST(request());

    const clinics = await prisma.clinic.findMany({ where: { clerkOrgId: "org_abc123" } });
    expect(clinics).toHaveLength(1);
  });
});
```

- [ ] **Step 3: Run it to verify it fails**

Run: `npm test -- route.test.ts`
Expected: FAIL — `Cannot find module '@/app/api/webhooks/clerk/route'`

- [ ] **Step 4: Write the minimal implementation**

```ts
// src/app/api/webhooks/clerk/route.ts
import { Webhook } from "svix";
import { prisma } from "@/lib/prisma";

export async function POST(request: Request) {
  const payload = await request.text();
  const headers = {
    "svix-id": request.headers.get("svix-id")!,
    "svix-timestamp": request.headers.get("svix-timestamp")!,
    "svix-signature": request.headers.get("svix-signature")!,
  };

  const webhook = new Webhook(process.env.CLERK_WEBHOOK_SECRET!);
  const event = webhook.verify(payload, headers) as {
    type: string;
    data: { id: string; name: string };
  };

  if (event.type === "organization.created") {
    await prisma.clinic.upsert({
      where: { clerkOrgId: event.data.id },
      update: {},
      create: { clerkOrgId: event.data.id, name: event.data.name },
    });
  }

  return new Response(null, { status: 200 });
}
```

`upsert` (rather than `create`) is what makes retried webhook deliveries safe — a second delivery for the same `clerkOrgId` updates nothing instead of throwing a unique-constraint error or creating a duplicate.

- [ ] **Step 5: Run the test to verify it passes**

Run: `npm test -- route.test.ts`
Expected: PASS (2 tests)

- [ ] **Step 6: Register the webhook in the Clerk dashboard**

Point it at `https://<your-domain>/api/webhooks/clerk`, subscribed to the `organization.created` event, and copy the signing secret into `.env` as `CLERK_WEBHOOK_SECRET`. (Requires a public URL — use the Clerk CLI's local tunnel or `ngrok` for local testing; document whichever you use in `.env.example`'s comments.)

- [ ] **Step 7: Commit**

```bash
git add src/app/api/webhooks/clerk/ package.json package-lock.json
git commit -m "feat: sync Clerk Organizations to Clinic rows via webhook"
```

---

## Task 6: `getCurrentClinic()` — resolve the signed-in user's tenant

**Files:**
- Create: `src/features/clinic/data/current-clinic.ts`
- Test: `src/features/clinic/data/current-clinic.test.ts`

**Interfaces:**
- Consumes: `auth()` from `@clerk/nextjs/server` (Task 4), `prisma` from `src/lib/prisma.ts` (Task 1).
- Produces: `getCurrentClinic(): Promise<Clinic | null>` — consumed by every Server Component/Action in Tasks 7-8. Returns `null` (never throws) when there's no signed-in user, no active organization, or the webhook hasn't created the `Clinic` row yet — callers decide what to render for that case.

- [ ] **Step 1: Write the failing tests**

```ts
// src/features/clinic/data/current-clinic.test.ts
import { afterEach, describe, expect, it, vi } from "vitest";
import { prisma } from "@/lib/prisma";

vi.mock("@clerk/nextjs/server", () => ({
  auth: vi.fn(),
}));

afterEach(async () => {
  await prisma.clinic.deleteMany({});
  vi.clearAllMocks();
});

describe("getCurrentClinic", () => {
  it("returns null when there is no active organization", async () => {
    const { auth } = await import("@clerk/nextjs/server");
    vi.mocked(auth).mockResolvedValue({ orgId: null } as never);

    const { getCurrentClinic } = await import("@/features/clinic/data/current-clinic");
    expect(await getCurrentClinic()).toBeNull();
  });

  it("returns null when the organization has no matching Clinic row yet (webhook not delivered)", async () => {
    const { auth } = await import("@clerk/nextjs/server");
    vi.mocked(auth).mockResolvedValue({ orgId: "org_not_synced_yet" } as never);

    const { getCurrentClinic } = await import("@/features/clinic/data/current-clinic");
    expect(await getCurrentClinic()).toBeNull();
  });

  it("returns the matching Clinic when one exists for the active organization", async () => {
    const clinic = await prisma.clinic.create({
      data: { clerkOrgId: "org_synced", name: "Clínica sincronizada" },
    });
    const { auth } = await import("@clerk/nextjs/server");
    vi.mocked(auth).mockResolvedValue({ orgId: "org_synced" } as never);

    const { getCurrentClinic } = await import("@/features/clinic/data/current-clinic");
    const result = await getCurrentClinic();
    expect(result?.id).toBe(clinic.id);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm test -- current-clinic.test.ts`
Expected: FAIL — `Cannot find module '@/features/clinic/data/current-clinic'`

- [ ] **Step 3: Write the minimal implementation**

```ts
// src/features/clinic/data/current-clinic.ts
import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";
import type { Clinic } from "@prisma/client";

export async function getCurrentClinic(): Promise<Clinic | null> {
  const { orgId } = await auth();
  if (!orgId) return null;

  return prisma.clinic.findUnique({ where: { clerkOrgId: orgId } });
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npm test -- current-clinic.test.ts`
Expected: PASS (3 tests)

- [ ] **Step 5: Use it in the dashboard layout to handle the "no clinic yet" state**

In `src/app/dashboard/layout.tsx` (already touched in Task 4), call `getCurrentClinic()` after confirming `userId` exists. If it returns `null`, render a short "Todavía estamos configurando tu consultorio, probá de nuevo en un minuto" message instead of the dashboard shell — this is the user-facing side of the race condition called out in Review Focus.

- [ ] **Step 6: Commit**

```bash
git add src/features/clinic/data/current-clinic.ts src/features/clinic/data/current-clinic.test.ts src/app/dashboard/layout.tsx
git commit -m "feat: resolve signed-in user's clinic from their active Clerk organization"
```

---

## Task 7: Wire the Pacientes module to real data

**Files:**
- Create: `src/features/patients/actions.ts`
- Modify: `src/app/dashboard/pacientes/page.tsx`
- Modify: `src/app/dashboard/pacientes/[id]/page.tsx`
- Modify: `src/features/patients/components/patients-view.tsx` (accept `patients: Patient[]` as a prop instead of reading `useClinicData()`)
- Modify: `src/features/patients/components/new-patient-dialog.tsx`, `edit-patient-dialog.tsx`, `patient-actions.tsx`, `patient-detail-view.tsx` (call the new Server Actions instead of `useClinicData()`'s `addPatient`/`editPatient`/`deletePatient`)
- Test: `e2e/patients.spec.ts`

**Interfaces:**
- Consumes: `getCurrentClinic()` (Task 6), `getPatients`/`getPatient`/`createPatient`/`updatePatient`/`deletePatient` (Task 2).
- Produces: `createPatientAction`, `updatePatientAction`, `deletePatientAction` Server Actions, each deriving `clinicId` from `getCurrentClinic()` internally — never accepting it as a parameter from the caller.

- [ ] **Step 1: Write the failing E2E test**

```ts
// e2e/patients.spec.ts
import { test, expect } from "@playwright/test";
import { setupClerkTestingToken } from "@clerk/testing/playwright";

test("a created patient survives a full page reload", async ({ page }) => {
  await setupClerkTestingToken({ page });
  // Sign-in steps depend on the test Clerk instance's configured strategy —
  // verify against @clerk/testing's current docs; this assumes a test user
  // already exists and password sign-in is enabled.
  await page.goto("/sign-in");
  await page.fill('input[name="identifier"]', process.env.E2E_TEST_EMAIL!);
  await page.click('button[type="submit"]');
  await page.fill('input[name="password"]', process.env.E2E_TEST_PASSWORD!);
  await page.click('button[type="submit"]');
  await page.waitForURL("**/dashboard");

  await page.goto("/dashboard/pacientes");
  await page.getByRole("button", { name: "Nuevo paciente" }).click();
  await page.fill("#name", "Paciente E2E");
  await page.fill("#phone", "11 0000-0000");
  await page.getByRole("button", { name: "Guardar" }).click();
  await expect(page.getByRole("link", { name: "Paciente E2E" })).toBeVisible();

  await page.reload();
  await expect(page.getByRole("link", { name: "Paciente E2E" })).toBeVisible();
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx playwright test e2e/patients.spec.ts`
Expected: FAIL — the page still reads from the in-memory `ClinicDataProvider`, so this test is really checking today's mock still "works" by coincidence within one session; confirm the intended failure mode instead by temporarily stopping here and noting that persistence-across-reload cannot be properly red/green until Steps 3-7 land. Treat this step as establishing the target behavior, and move on.

- [ ] **Step 3: Write the Server Actions**

```ts
// src/features/patients/actions.ts
"use server";

import { revalidatePath } from "next/cache";
import { getCurrentClinic } from "@/features/clinic/data/current-clinic";
import {
  createPatient,
  deletePatient,
  updatePatient,
  type NewPatientInput,
} from "@/features/clinic/data/patients";

async function requireClinicId(): Promise<string> {
  const clinic = await getCurrentClinic();
  if (!clinic) throw new Error("No hay un consultorio activo para este usuario");
  return clinic.id;
}

export async function createPatientAction(input: NewPatientInput) {
  const clinicId = await requireClinicId();
  const patient = await createPatient(clinicId, input);
  revalidatePath("/dashboard/pacientes");
  return patient;
}

export async function updatePatientAction(id: string, input: NewPatientInput) {
  const clinicId = await requireClinicId();
  const patient = await updatePatient(clinicId, id, input);
  revalidatePath("/dashboard/pacientes");
  revalidatePath(`/dashboard/pacientes/${id}`);
  return patient;
}

export async function deletePatientAction(id: string) {
  const clinicId = await requireClinicId();
  await deletePatient(clinicId, id);
  revalidatePath("/dashboard/pacientes");
}
```

`requireClinicId()` is the only place `clinicId` is produced for this feature — every action re-derives it from the signed-in session on every call, so a forged or stale id in a form payload is never trusted (the Review Focus item this task owns).

- [ ] **Step 4: Make the Pacientes page a Server Component that fetches real data**

```tsx
// src/app/dashboard/pacientes/page.tsx
import { PageHeader } from "@/components/page-header";
import { PatientsView } from "@/features/patients/components/patients-view";
import { NewPatientDialog } from "@/features/patients/components/new-patient-dialog";
import { getCurrentClinic } from "@/features/clinic/data/current-clinic";
import { getPatients } from "@/features/clinic/data/patients";

export default async function PacientesPage() {
  const clinic = await getCurrentClinic();
  const patients = clinic ? await getPatients(clinic.id) : [];

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Pacientes"
        description="Buscá pacientes existentes o cargá uno nuevo."
        action={<NewPatientDialog />}
      />
      <PatientsView patients={patients} />
    </div>
  );
}
```

- [ ] **Step 5: Update `PatientsView` and the dialogs to use props + Server Actions instead of `useClinicData()`**

In `src/features/patients/components/patients-view.tsx`: change the signature to `export function PatientsView({ patients }: { patients: Patient[] })`, remove the `useClinicData()` call and its `patients`/`getLastVisit` destructuring (the "última visita" column can read straight from the passed-in list's related consultations once Task 8 does the same for consultations — for this task, keep the column but source it from a `lastVisit` field the page computes server-side and includes per patient, or simplify to omit the column until Task 8 lands, whichever keeps this task's tests green without depending on Task 8's work being done first).

In `new-patient-dialog.tsx` and `edit-patient-dialog.tsx`: replace the `useClinicData()` `addPatient`/`editPatient` calls with `createPatientAction`/`updatePatientAction` imported from `src/features/patients/actions.ts`, awaited inside the existing `onSubmit` handlers (both are already async).

In `patient-actions.tsx`: replace the `useClinicData()` `deletePatient` call with `deletePatientAction`.

In `patient-detail-view.tsx` and `src/app/dashboard/pacientes/[id]/page.tsx`: fetch the single patient and their consultations server-side via `getCurrentClinic()` + `getPatient(clinicId, id)` (Task 2) instead of `useClinicData()`'s `getPatient`/`getConsultationsForPatient`; pass them down as props.

- [ ] **Step 6: Run the E2E test to verify it passes**

Run: `npx playwright test e2e/patients.spec.ts`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat: wire Pacientes module to real tenant-scoped data"
```

---

## Task 8: Wire the Consultas/Tratamientos module and patient detail history to real data

**Files:**
- Create: `src/features/consultations/actions.ts`
- Modify: `src/app/dashboard/consultas/page.tsx`
- Modify: `src/features/consultations/components/consultations-view.tsx`, `new-consultation-dialog.tsx` (props + Server Actions instead of `useClinicData()`)
- Modify: `src/features/patients/components/patient-detail-view.tsx` (pass real consultations list as a prop, from Task 7's Step 5 fetch)
- Test: `e2e/consultations.spec.ts`

**Interfaces:**
- Consumes: `getCurrentClinic()` (Task 6), `createConsultation`/`getConsultations` (Task 3), `createPatientAction` (Task 7, for the "add patient inline" flow inside the consultation dialog).
- Produces: `createConsultationAction` Server Action.

- [ ] **Step 1: Write the failing E2E test**

```ts
// e2e/consultations.spec.ts
import { test, expect } from "@playwright/test";
import { setupClerkTestingToken } from "@clerk/testing/playwright";

test("a created consultation survives a full page reload", async ({ page }) => {
  await setupClerkTestingToken({ page });
  await page.goto("/sign-in");
  await page.fill('input[name="identifier"]', process.env.E2E_TEST_EMAIL!);
  await page.click('button[type="submit"]');
  await page.fill('input[name="password"]', process.env.E2E_TEST_PASSWORD!);
  await page.click('button[type="submit"]');
  await page.waitForURL("**/dashboard");

  await page.goto("/dashboard/consultas");
  await page.getByRole("button", { name: "Nueva consulta" }).click();
  await page.getByRole("combobox").first().click();
  await page.getByRole("option", { name: "Agregar paciente nuevo" }).click();
  await page.fill("#newPatientName", "Paciente Consulta E2E");
  await page.fill("#newPatientPhone", "11 1111-1111");
  const treatmentCombo = page.getByRole("combobox").nth(1);
  await treatmentCombo.click();
  await page.getByRole("option", { name: "Limpieza" }).click();
  await page.getByRole("button", { name: "Guardar" }).click();
  await expect(page.getByText("Paciente Consulta E2E")).toBeVisible();

  await page.reload();
  await expect(page.getByText("Paciente Consulta E2E")).toBeVisible();
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx playwright test e2e/consultations.spec.ts`
Expected: FAIL — same reasoning as Task 7 Step 2; this establishes the target, actual red/green comes from Steps 3-6.

- [ ] **Step 3: Write the Server Action**

```ts
// src/features/consultations/actions.ts
"use server";

import { revalidatePath } from "next/cache";
import { getCurrentClinic } from "@/features/clinic/data/current-clinic";
import { createConsultation, type NewConsultationInput } from "@/features/clinic/data/consultations";
import { createPatient, type NewPatientInput } from "@/features/clinic/data/patients";

export async function createConsultationAction(
  input: NewConsultationInput & { newPatient?: NewPatientInput },
) {
  const clinic = await getCurrentClinic();
  if (!clinic) throw new Error("No hay un consultorio activo para este usuario");

  let patientId = input.patientId;
  if (input.newPatient) {
    const patient = await createPatient(clinic.id, input.newPatient);
    patientId = patient.id;
  }

  const consultation = await createConsultation(clinic.id, { ...input, patientId });
  revalidatePath("/dashboard/consultas");
  revalidatePath(`/dashboard/pacientes/${patientId}`);
  return consultation;
}
```

- [ ] **Step 4: Make the Consultas page a Server Component**

```tsx
// src/app/dashboard/consultas/page.tsx
import { PageHeader } from "@/components/page-header";
import { ConsultationsView } from "@/features/consultations/components/consultations-view";
import { NewConsultationDialog } from "@/features/consultations/components/new-consultation-dialog";
import { getCurrentClinic } from "@/features/clinic/data/current-clinic";
import { getConsultations } from "@/features/clinic/data/consultations";
import { getPatients } from "@/features/clinic/data/patients";

export default async function ConsultasPage() {
  const clinic = await getCurrentClinic();
  const [consultations, patients] = clinic
    ? await Promise.all([getConsultations(clinic.id), getPatients(clinic.id)])
    : [[], []];

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Consultas/Tratamientos"
        description="Historial de todo lo realizado a los pacientes."
        action={<NewConsultationDialog patients={patients} />}
      />
      <ConsultationsView consultations={consultations} patients={patients} />
    </div>
  );
}
```

- [ ] **Step 5: Update `ConsultationsView` and `NewConsultationDialog` to use props + the Server Action**

`ConsultationsView` drops its `useClinicData()` call, takes `consultations`/`patients` as props instead. `NewConsultationDialog` drops `useClinicData()`'s `patients`/`addPatient`/`addConsultation`, takes `patients` as a prop, and on submit calls `createConsultationAction` with `{ patientId, date, treatment, tooth, notes, newPatient }` (building `newPatient` from the form's inline-add fields when present, same shape the component already assembles today for the in-memory version). Apply the same prop-based change to wherever `NewConsultationDialog` is rendered with a fixed patient (`patient-detail-view.tsx`, from Task 7).

- [ ] **Step 6: Run the E2E test to verify it passes**

Run: `npx playwright test e2e/consultations.spec.ts`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat: wire Consultas/Tratamientos module to real tenant-scoped data"
```

---

## Task 9: Remove the in-memory `ClinicDataProvider` and mock data

**Files:**
- Delete: `src/features/clinic/context/clinic-provider.tsx`, `src/features/clinic/lib/mock-data.ts`
- Modify: `src/app/dashboard/layout.tsx` (remove `<ClinicDataProvider>` wrapper, already touched in Tasks 4/6)
- Modify: `src/features/dashboard/components/dashboard-summary.tsx` (take counts as props or fetch server-side, instead of `useClinicData()`)
- Modify: `src/app/dashboard/page.tsx` (pass real counts from `getPatients`/`getConsultations`)

**Interfaces:**
- Consumes: `getCurrentClinic()`, `getPatients`, `getConsultations` (Tasks 2-3-6).
- Produces: nothing new — this task only removes dead code and the last `useClinicData()` call site.

- [ ] **Step 1: Confirm nothing still imports `useClinicData` or `ClinicDataProvider`**

Run: `grep -rn "useClinicData\|ClinicDataProvider" src/`
Expected: no matches once this task is done; if any appear now, note them before deleting the provider.

- [ ] **Step 2: Update `DashboardSummary` to take data as props**

```tsx
// src/features/dashboard/components/dashboard-summary.tsx (signature change)
export function DashboardSummary({
  patientCount,
  consultationCount,
}: {
  patientCount: number;
  consultationCount: number;
}) {
  // same JSX as today, replacing `patients.length` / `consultations.length`
  // with the `patientCount` / `consultationCount` props
}
```

```tsx
// src/app/dashboard/page.tsx
import { PageHeader } from "@/components/page-header";
import { DashboardSummary } from "@/features/dashboard/components/dashboard-summary";
import { getCurrentClinic } from "@/features/clinic/data/current-clinic";
import { getPatients } from "@/features/clinic/data/patients";
import { getConsultations } from "@/features/clinic/data/consultations";
import { currentUser } from "@clerk/nextjs/server";

export default async function DashboardPage() {
  const user = await currentUser();
  const clinic = await getCurrentClinic();
  const [patients, consultations] = clinic
    ? await Promise.all([getPatients(clinic.id), getConsultations(clinic.id)])
    : [[], []];

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={`Hola, ${user?.firstName ?? ""}`}
        description="Este es el panel del consultorio. Las secciones se van a ir agregando en los próximos pasos."
      />
      <DashboardSummary patientCount={patients.length} consultationCount={consultations.length} />
    </div>
  );
}
```

- [ ] **Step 3: Delete the provider and mock data files**

```bash
rm -rf src/features/clinic/context src/features/clinic/lib/mock-data.ts
```

Remove the now-unused `<ClinicDataProvider>` wrapper from `src/app/dashboard/layout.tsx`.

- [ ] **Step 4: Verify the full test suite and the build are green**

Run: `npm test`
Expected: all Vitest tests PASS
Run: `npx playwright test`
Expected: all Playwright tests PASS
Run: `npm run build`
Expected: builds with no errors

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "chore: remove in-memory ClinicDataProvider and mock data"
```

---

## Task 10: Rebrand "Capeans" → "Dentia" in the UI

**Files:**
- Modify: `src/app/layout.tsx` (`<title>`/metadata)
- Modify: `src/features/dashboard/components/app-sidebar.tsx` (sidebar header text)
- Test: `e2e/branding.spec.ts`

**Interfaces:** none — text-only change.

- [ ] **Step 1: Write the failing test**

```ts
// e2e/branding.spec.ts
import { test, expect } from "@playwright/test";

test("the app is branded as Dentia, not Capeans", async ({ page }) => {
  await page.goto("/sign-in");
  await expect(page).toHaveTitle(/Dentia/);
  const bodyText = await page.textContent("body");
  expect(bodyText).not.toContain("Capeans");
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx playwright test e2e/branding.spec.ts`
Expected: FAIL — title and sidebar still say "Capeans"

- [ ] **Step 3: Update the metadata and sidebar text**

In `src/app/layout.tsx`, change the `metadata` export's `title` from `"Capeans | Consultorio Dental"` to `"Dentia"` (drop the "| Consultorio Dental" suffix — that described one clinic, not the product).

In `src/features/dashboard/components/app-sidebar.tsx`, change the sidebar header's `"Capeans"` / `"Consultorio Dental"` text to `"Dentia"` as the product name; if the signed-in clinic's name (from `getCurrentClinic()`, threaded down as a prop from the dashboard layout) is available, show it as the subtitle instead of the hardcoded `"Consultorio Dental"`.

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx playwright test e2e/branding.spec.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "chore: rebrand UI from Capeans to Dentia"
```

---

## Task 11: Dockerize the app for local dev and production

**Files:**
- Modify: `next.config.ts` (add `output: "standalone"`)
- Create: `Dockerfile`
- Create: `.dockerignore`
- Modify: `docker-compose.yml` (add the `app` service alongside `postgres` from Task 1)

**Interfaces:** none — this task packages the existing app, it doesn't change application code.

- [ ] **Step 1: Add standalone output to `next.config.ts`**

```ts
// next.config.ts (add to the existing config object)
const nextConfig: NextConfig = {
  output: "standalone",
  // ...existing config...
};
```

- [ ] **Step 2: Write the `Dockerfile`**

```dockerfile
# Dockerfile
FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

FROM node:22-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npx prisma generate
RUN npm run build

FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/prisma ./prisma
EXPOSE 3000
CMD ["node", "server.js"]
```

- [ ] **Step 3: Write `.dockerignore`**

```
node_modules
.next
.git
docs
e2e
*.test.ts
.env
.env.local
```

- [ ] **Step 4: Add the `app` service to `docker-compose.yml`**

```yaml
# docker-compose.yml (add alongside the existing postgres service from Task 1)
services:
  postgres:
    # ...unchanged from Task 1...

  app:
    build: .
    restart: unless-stopped
    environment:
      DATABASE_URL: postgresql://dentia:dentia_dev_password@postgres:5432/dentia
      NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: ${NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY}
      CLERK_SECRET_KEY: ${CLERK_SECRET_KEY}
      CLERK_WEBHOOK_SECRET: ${CLERK_WEBHOOK_SECRET}
    ports:
      - "3000:3000"
    depends_on:
      - postgres
```

- [ ] **Step 5: Build and run the full stack, verify it serves the app**

Run: `docker compose up --build`
Expected: both containers start; `curl -I http://localhost:3000` returns a `307` or `200` (redirect to `/sign-in` for an unauthenticated request) rather than a connection error.

Note: the running container's Postgres starts empty — run `docker compose exec app npx prisma migrate deploy` once to apply the schema before this check.

- [ ] **Step 6: Commit**

```bash
git add next.config.ts Dockerfile .dockerignore docker-compose.yml
git commit -m "feat: dockerize app and database for local dev and production"
```

---

## Task 12: Deploy to Railway

**Files:**
- Create: `railway.json` (optional — only if Railway's auto-detection of the `Dockerfile` needs an explicit nudge; confirm against current Railway docs whether this file is still needed before adding it)

**Interfaces:** none — deployment configuration, not application code.

- [ ] **Step 1: Create the Railway project**

In the Railway dashboard: new project → "Deploy from GitHub repo" (or `railway up` from the CLI) → select this repository. Railway should detect the `Dockerfile` from Task 11 automatically.

- [ ] **Step 2: Add the managed Postgres plugin**

In the same Railway project, add a Postgres plugin/service. Railway injects a `DATABASE_URL` environment variable into the project automatically — reference it (not a hand-typed value) from the app service's environment.

- [ ] **Step 3: Set the remaining environment variables on the app service**

`NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`, `CLERK_SECRET_KEY`, `CLERK_WEBHOOK_SECRET` — same values as `.env`, but pointed at a production Clerk instance rather than the test one from Task 4, if you've set one up separately.

- [ ] **Step 4: Run the migration against the Railway database**

Run: `railway run npx prisma migrate deploy` (or equivalent — connect using the `DATABASE_URL` Railway provides)
Expected: migration applies with no errors.

- [ ] **Step 5: Point the Clerk webhook at the Railway URL**

Update the webhook endpoint configured in Task 5 Step 6 from the local tunnel URL to Railway's public URL (`https://<your-app>.up.railway.app/api/webhooks/clerk`).

- [ ] **Step 6: Verify the deployed app**

Visit the Railway URL, confirm it redirects to `/sign-in`, sign in, confirm the dashboard loads (even with zero patients/consultations for a brand-new clinic).

- [ ] **Step 7: Commit (if `railway.json` or any config file was added)**

```bash
git add railway.json
git commit -m "chore: add Railway deployment config"
```

---

## Task 13: Multi-tenant isolation end-to-end test

**Files:**
- Test: `e2e/tenant-isolation.spec.ts`

**Interfaces:** none — this is a regression test over everything built in Tasks 1-9, asserting the spec's core safety requirement directly through the UI rather than only at the data-layer level (Tasks 2-3 already cover this at the unit level; this task proves it end-to-end).

- [ ] **Step 1: Write the test**

```ts
// e2e/tenant-isolation.spec.ts
import { test, expect } from "@playwright/test";
import { setupClerkTestingToken } from "@clerk/testing/playwright";

// Requires two test users in Clerk, each the sole member of their own
// Organization, provided via env vars. Verify current @clerk/testing docs
// for the supported way to create/sign in as two distinct test identities
// in one spec file.
test("a user from clinic A cannot see a patient created by clinic B", async ({ browser }) => {
  const clinicAContext = await browser.newContext();
  const clinicAPage = await clinicAContext.newPage();
  await setupClerkTestingToken({ page: clinicAPage });
  await clinicAPage.goto("/sign-in");
  await clinicAPage.fill('input[name="identifier"]', process.env.E2E_CLINIC_A_EMAIL!);
  await clinicAPage.click('button[type="submit"]');
  await clinicAPage.fill('input[name="password"]', process.env.E2E_CLINIC_A_PASSWORD!);
  await clinicAPage.click('button[type="submit"]');
  await clinicAPage.waitForURL("**/dashboard");

  await clinicAPage.goto("/dashboard/pacientes");
  await clinicAPage.getByRole("button", { name: "Nuevo paciente" }).click();
  await clinicAPage.fill("#name", "Paciente Solo De Clinica A");
  await clinicAPage.fill("#phone", "11 2222-2222");
  await clinicAPage.getByRole("button", { name: "Guardar" }).click();
  await expect(clinicAPage.getByRole("link", { name: "Paciente Solo De Clinica A" })).toBeVisible();

  const clinicBContext = await browser.newContext();
  const clinicBPage = await clinicBContext.newPage();
  await setupClerkTestingToken({ page: clinicBPage });
  await clinicBPage.goto("/sign-in");
  await clinicBPage.fill('input[name="identifier"]', process.env.E2E_CLINIC_B_EMAIL!);
  await clinicBPage.click('button[type="submit"]');
  await clinicBPage.fill('input[name="password"]', process.env.E2E_CLINIC_B_PASSWORD!);
  await clinicBPage.click('button[type="submit"]');
  await clinicBPage.waitForURL("**/dashboard");

  await clinicBPage.goto("/dashboard/pacientes");
  await expect(clinicBPage.getByText("Paciente Solo De Clinica A")).not.toBeVisible();

  await clinicAContext.close();
  await clinicBContext.close();
});
```

- [ ] **Step 2: Run it**

Run: `npx playwright test e2e/tenant-isolation.spec.ts`
Expected: PASS. If it fails, that's a real cross-tenant data leak — stop and fix the data-access layer (Tasks 2/7) before doing anything else; do not weaken this test to make it pass.

- [ ] **Step 3: Commit**

```bash
git add e2e/tenant-isolation.spec.ts
git commit -m "test: add end-to-end multi-tenant isolation regression test"
```

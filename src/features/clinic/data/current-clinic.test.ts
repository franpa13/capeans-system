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

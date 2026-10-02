import { afterEach, describe, expect, it, vi } from "vitest";
import { prisma } from "@/lib/prisma";

vi.mock("svix", () => ({
  // The real Webhook.verify() only validates the signature and returns
  // undefined (it never parses the payload) — this mock matches that.
  Webhook: class {
    verify() {
      return undefined;
    }
  },
}));

afterEach(async () => {
  await prisma.clinicOption.deleteMany({});
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
      body: JSON.stringify({
        type: "organization.created",
        data: { id: "org_abc123", name: "Clínica de prueba" },
      }),
    });

    const response = await POST(request);
    expect(response.status).toBe(200);

    const clinic = await prisma.clinic.findUnique({ where: { clerkOrgId: "org_abc123" } });
    expect(clinic?.name).toBe("Clínica de prueba");
  });

  it("seeds default insurance and treatment options for the new clinic", async () => {
    const { POST } = await import("@/app/api/webhooks/clerk/route");
    const request = new Request("http://localhost/api/webhooks/clerk", {
      method: "POST",
      headers: {
        "svix-id": "msg_1",
        "svix-timestamp": "123",
        "svix-signature": "v1,fake",
      },
      body: JSON.stringify({
        type: "organization.created",
        data: { id: "org_abc123", name: "Clínica de prueba" },
      }),
    });

    await POST(request);

    const clinic = await prisma.clinic.findUnique({ where: { clerkOrgId: "org_abc123" } });
    const options = await prisma.clinicOption.findMany({ where: { clinicId: clinic!.id } });
    expect(options.length).toBeGreaterThan(0);
    expect(options.some((o) => o.category === "insurance")).toBe(true);
    expect(options.some((o) => o.category === "treatment")).toBe(true);
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
        body: JSON.stringify({
          type: "organization.created",
          data: { id: "org_abc123", name: "Clínica de prueba" },
        }),
      });

    await POST(request());
    await POST(request());

    const clinics = await prisma.clinic.findMany({ where: { clerkOrgId: "org_abc123" } });
    expect(clinics).toHaveLength(1);
  });
});

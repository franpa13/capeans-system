import { Webhook } from "svix";
import { prisma } from "@/lib/prisma";
import { seedDefaultClinicOptions } from "@/features/clinic/data/clinic-options";
import { removeMemberByClerkUser } from "@/features/clinic/data/members";

export async function POST(request: Request) {
  const payload = await request.text();
  const headers = {
    "svix-id": request.headers.get("svix-id")!,
    "svix-timestamp": request.headers.get("svix-timestamp")!,
    "svix-signature": request.headers.get("svix-signature")!,
  };

  const webhook = new Webhook(process.env.CLERK_WEBHOOK_SECRET!);
  webhook.verify(payload, headers);
  const event = JSON.parse(payload) as {
    type: string;
    data: {
      id: string;
      name: string;
      organization?: { id: string };
      public_user_data?: { user_id: string };
    };
  };

  if (event.type === "organization.created") {
    const clinic = await prisma.clinic.upsert({
      where: { clerkOrgId: event.data.id },
      update: {},
      create: { clerkOrgId: event.data.id, name: event.data.name },
    });
    await seedDefaultClinicOptions(clinic.id);
  }

  // Someone left the organization (or was removed in Clerk): off the team.
  if (event.type === "organizationMembership.deleted") {
    const orgId = event.data.organization?.id;
    const userId = event.data.public_user_data?.user_id;
    const clinic = orgId ? await prisma.clinic.findUnique({ where: { clerkOrgId: orgId } }) : null;
    if (clinic && userId) await removeMemberByClerkUser(clinic.id, userId);
  }

  return new Response(null, { status: 200 });
}

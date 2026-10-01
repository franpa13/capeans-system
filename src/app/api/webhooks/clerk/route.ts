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
  webhook.verify(payload, headers);
  const event = JSON.parse(payload) as {
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

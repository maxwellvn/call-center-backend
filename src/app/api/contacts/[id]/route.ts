import { UserRole } from "@prisma/client";

import { requireActor } from "@/lib/auth";
import { ApiError } from "@/lib/errors";
import { actorGroupIds } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { ok } from "@/lib/response";
import { runRoute } from "@/lib/route";
import { parseJson } from "@/lib/request";
import { contactSchema } from "@/lib/validators";

type Context = { params: Promise<{ id: string }> };

async function findAllowedContact(actorId: string, role: UserRole, id: string) {
  const groupIds = role === UserRole.MANAGER ? await actorGroupIds(actorId) : [];

  return prisma.contact.findFirst({
    where: {
      id,
      ...(role === UserRole.REP ? { repId: actorId } : {}),
      ...(role === UserRole.MANAGER
        ? {
            rep: {
              groupMemberships: {
                some: { groupId: { in: groupIds } },
              },
            },
          }
        : {}),
    },
  });
}

export async function GET(request: Request, context: Context) {
  return runRoute(async () => {
    const actor = await requireActor(request);
    const { id } = await context.params;
    const contact = await findAllowedContact(actor.id, actor.role, id);

    if (!contact) {
      throw new ApiError("Contact not found", 404);
    }

    return ok(contact);
  });
}

export async function PATCH(request: Request, context: Context) {
  return runRoute(async () => {
    const actor = await requireActor(request);
    const { id } = await context.params;
    const existing = await findAllowedContact(actor.id, actor.role, id);

    if (!existing) {
      throw new ApiError("Contact not found", 404);
    }

    const payload = await parseJson(request, contactSchema.partial());
    const contact = await prisma.contact.update({
      where: { id },
      data: payload,
    });

    return ok(contact);
  });
}

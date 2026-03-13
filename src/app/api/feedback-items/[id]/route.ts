import { UserRole } from "@prisma/client";

import { requireActor } from "@/lib/auth";
import { ApiError } from "@/lib/errors";
import { actorGroupIds } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { ok } from "@/lib/response";
import { runRoute } from "@/lib/route";
import { parseJson } from "@/lib/request";
import { feedbackSchema } from "@/lib/validators";

type Context = { params: Promise<{ id: string }> };

async function findAllowedItem(actorId: string, role: UserRole, id: string) {
  const groupIds = role === UserRole.MANAGER ? await actorGroupIds(actorId) : [];

  return prisma.feedbackItem.findFirst({
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
    const item = await findAllowedItem(actor.id, actor.role, id);

    if (!item) {
      throw new ApiError("Feedback item not found", 404);
    }

    return ok(item);
  });
}

export async function PATCH(request: Request, context: Context) {
  return runRoute(async () => {
    const actor = await requireActor(request);
    const { id } = await context.params;
    const existing = await findAllowedItem(actor.id, actor.role, id);

    if (!existing) {
      throw new ApiError("Feedback item not found", 404);
    }

    const payload = await parseJson(request, feedbackSchema.partial());
    const item = await prisma.feedbackItem.update({
      where: { id },
      data: payload,
      include: { rep: true, contact: true, report: true },
    });

    return ok(item);
  });
}

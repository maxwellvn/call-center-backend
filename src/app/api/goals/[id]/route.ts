import { UserRole } from "@prisma/client";

import { requireActor } from "@/lib/auth";
import { ApiError } from "@/lib/errors";
import { actorGroupIds, requireRole } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { ok } from "@/lib/response";
import { runRoute } from "@/lib/route";
import { parseJson } from "@/lib/request";
import { goalSchema } from "@/lib/validators";
import { enrichGoalsWithProgress } from "@/lib/goals";

type Context = { params: Promise<{ id: string }> };

async function findAllowedGoal(actorId: string, role: UserRole, id: string) {
  const groupIds = role === UserRole.MANAGER || role === UserRole.REP ? await actorGroupIds(actorId) : [];

  return prisma.weeklyGoal.findFirst({
    where: {
      id,
      ...(role === UserRole.REP
        ? {
            OR: [
              { assigneeId: actorId },
              { ownerGroupId: { in: groupIds } },
            ],
          }
        : {}),
      ...(role === UserRole.MANAGER
        ? {
            OR: [
              { ownerGroupId: { in: groupIds } },
              { assignee: { groupMemberships: { some: { groupId: { in: groupIds } } } } },
            ],
          }
        : {}),
    },
  });
}

export async function GET(request: Request, context: Context) {
  return runRoute(async () => {
    const actor = await requireActor(request);
    const { id } = await context.params;
    const goal = await findAllowedGoal(actor.id, actor.role, id);

    if (!goal) {
      throw new ApiError("Goal not found", 404);
    }

    const [enriched] = await enrichGoalsWithProgress(prisma, [goal]);

    return ok(enriched);
  });
}

export async function PATCH(request: Request, context: Context) {
  return runRoute(async () => {
    const actor = await requireActor(request);
    requireRole(actor, [UserRole.MANAGER, UserRole.ADMIN]);
    const { id } = await context.params;
    const existing = await findAllowedGoal(actor.id, actor.role, id);

    if (!existing) {
      throw new ApiError("Goal not found", 404);
    }

    const payload = await parseJson(request, goalSchema.partial());
    const goal = await prisma.weeklyGoal.update({
      where: { id },
      data: payload,
      include: { assignee: true, ownerGroup: true },
    });

    const [enriched] = await enrichGoalsWithProgress(prisma, [goal]);

    return ok(enriched);
  });
}

import { UserRole } from "@prisma/client";

import { requireActor } from "@/lib/auth";
import { ApiError } from "@/lib/errors";
import { actorGroupIds } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { ok } from "@/lib/response";
import { runRoute } from "@/lib/route";
import { parseJson } from "@/lib/request";
import { emitSocketEvent } from "@/lib/socket";
import { goalProgressSchema } from "@/lib/validators";
import { enrichGoalsWithProgress } from "@/lib/goals";

type Context = { params: Promise<{ id: string }> };

async function canUpdateGoal(actorId: string, role: UserRole, id: string) {
  if (role === UserRole.ADMIN) {
    return prisma.weeklyGoal.findUnique({ where: { id } });
  }

  const groupIds = await actorGroupIds(actorId);
  return prisma.weeklyGoal.findFirst({
    where: {
      id,
      OR: [
        { assigneeId: actorId },
        ...(role === UserRole.MANAGER ? [{ ownerGroupId: { in: groupIds } }] : []),
      ],
    },
  });
}

export async function POST(request: Request, context: Context) {
  return runRoute(async () => {
    const actor = await requireActor(request);
    const { id } = await context.params;
    const existing = await canUpdateGoal(actor.id, actor.role, id);

    if (!existing) {
      throw new ApiError("Goal not found", 404);
    }

    if (existing.ownerType === "TEAM") {
      throw new ApiError("Team goals are updated from member reports and cannot be set manually", 400);
    }

    const payload = await parseJson(request, goalProgressSchema);
    const goal = await prisma.weeklyGoal.update({
      where: { id },
      data: {
        achievedValue: payload.achievedValue,
        status: payload.status ?? undefined,
      },
      include: { assignee: true, ownerGroup: true },
    });
    const [enrichedGoal] = await enrichGoalsWithProgress(prisma, [goal]);

    const rooms = [
      "org",
      ...(goal.assigneeId ? [`user:${goal.assigneeId}`] : []),
      ...(goal.ownerGroupId ? [`group:${goal.ownerGroupId}`] : []),
    ];

    emitSocketEvent("goal.updated", { goal: enrichedGoal }, rooms);

    return ok(enrichedGoal);
  });
}

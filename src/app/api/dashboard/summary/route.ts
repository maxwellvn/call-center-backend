import { UserRole } from "@prisma/client";

import { requireActor } from "@/lib/auth";
import { actorGroupIds } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { currentWeekKey } from "@/lib/week";
import { ok } from "@/lib/response";
import { runRoute } from "@/lib/route";
import { enrichGoalsWithProgress, goalWhereForCurrentPeriods } from "@/lib/goals";

export async function GET(request: Request) {
  return runRoute(async () => {
    const actor = await requireActor(request);
    const weekKey = new URL(request.url).searchParams.get("week") ?? currentWeekKey();
    const groupIds = actor.role === UserRole.ADMIN ? [] : await actorGroupIds(actor.id);

    const [reportsThisWeek, openFeedback, currentScripts, goals] = await Promise.all([
      prisma.activityReport.count({
        where: actor.role === UserRole.REP ? { repId: actor.id } : undefined,
      }),
      prisma.feedbackItem.count({
        where: {
          status: { not: "RESOLVED" },
          ...(actor.role === UserRole.REP ? { repId: actor.id } : {}),
        },
      }),
      prisma.weeklyScript.findMany({
        where:
          actor.role === UserRole.ADMIN
            ? { weekKey, isActive: true }
            : {
                weekKey,
                isActive: true,
                OR: [{ isMain: true }, { groups: { some: { groupId: { in: groupIds } } } }],
              },
        include: { groups: { include: { group: true } } },
      }),
      prisma.weeklyGoal.findMany({
        where:
          actor.role === UserRole.ADMIN
            ? goalWhereForCurrentPeriods()
            : {
                AND: [
                  goalWhereForCurrentPeriods(),
                  {
                    OR: [
                      { ownerType: "TEAM", ownerGroupId: { in: groupIds } },
                      { assigneeId: actor.id },
                    ],
                  },
                ],
              },
      }),
    ]);

    const enrichedGoals = await enrichGoalsWithProgress(prisma, goals);

    return ok({
      actor,
      weekKey,
      reportsThisWeek,
      openFeedback,
      currentScripts,
      goals: enrichedGoals,
    });
  });
}

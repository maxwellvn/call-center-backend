import { type GoalMetricType, type GoalTimeline } from "@prisma/client";

import { requireActor } from "@/lib/auth";
import { isCountableActivity } from "@/lib/activityCounts";
import { GOAL_TIMELINES, currentPeriodKey, periodRangeFromKey } from "@/lib/period";
import { computeLeaderboard } from "@/lib/leaderboard";
import { enrichGoalsWithProgress } from "@/lib/goals";
import { prisma } from "@/lib/prisma";
import { ok } from "@/lib/response";
import { runRoute } from "@/lib/route";

const GOAL_METRIC_TYPES = {
  CALLS: "CALLS",
  TEXTS: "TEXTS",
  INCOME: "INCOME",
  ALL: "ALL",
} as const;

export async function GET(request: Request) {
  return runRoute(async () => {
    await requireActor(request);
    const url = new URL(request.url);
    const timeline = (url.searchParams.get("timeline") as GoalTimeline | null) ?? GOAL_TIMELINES.WEEKLY;
    const periodKey = url.searchParams.get("periodKey") ?? currentPeriodKey(timeline);
    const metricType = (url.searchParams.get("metricType") as GoalMetricType | null) ?? GOAL_METRIC_TYPES.ALL;
    const { start, end } = periodRangeFromKey(timeline, periodKey);

    const [goals, reports] = await Promise.all([
      prisma.weeklyGoal.findMany({
        where: {
          timeline,
          ...(timeline === GOAL_TIMELINES.WEEKLY
            ? { OR: [{ periodKey }, { weekKey: periodKey }] }
            : { periodKey }),
        },
      }),
      prisma.activityReport.findMany({
        where: {
          activityDate: {
            gte: start,
            lt: end,
          },
        },
        select: {
          repId: true,
          activityType: true,
          incomeAmount: true,
          outcome: true,
          communicationSession: {
            select: {
              status: true,
            },
          },
          rep: {
            select: {
              groupMemberships: {
                select: {
                  groupId: true,
                },
              },
            },
          },
        },
      }),
    ]);

    const enrichedGoals = await enrichGoalsWithProgress(prisma, goals);
    const entries = computeLeaderboard(
      enrichedGoals,
      reports.map((report) => ({
        repId: report.repId,
        activityType: isCountableActivity(report) ? report.activityType : null,
        incomeAmount: report.incomeAmount,
        groupIds: report.rep.groupMemberships.map((membership) => membership.groupId),
      })),
      metricType,
    );
    const userIds = [...new Set(entries.map((entry) => entry.userId))];
    const users =
      userIds.length > 0
        ? await prisma.user.findMany({
            where: { id: { in: userIds } },
            select: { id: true, fullName: true, role: true },
          })
        : [];

    const leaderboard = entries.map((entry, index) => ({
      rank: index + 1,
      ...entry,
      user: users.find((user) => user.id === entry.userId) ?? null,
    }));

    return ok(leaderboard, { timeline, periodKey, metricType });
  });
}

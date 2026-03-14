import { type GoalMetricType, type GoalStatus, type GoalTimeline, type Prisma } from "@prisma/client";

import { isCountableActivity } from "@/lib/activityCounts";
import { GOAL_TIMELINES, currentPeriodKey, currentPeriodKeys, periodRangeFromKey } from "@/lib/period";

const GOAL_METRIC_TYPES = {
  CALLS: "CALLS",
  TEXTS: "TEXTS",
  INCOME: "INCOME",
  ALL: "ALL",
} as const;

const GOAL_STATUSES = {
  ACTIVE: "ACTIVE",
  COMPLETED: "COMPLETED",
  MISSED: "MISSED",
} as const;

type GoalLike = {
  id: string;
  title: string;
  description: string | null;
  weekKey: string | null;
  timeline: GoalTimeline;
  periodKey: string | null;
  ownerType: string;
  metricType: GoalMetricType;
  targetValue: number;
  achievedValue: number;
  status: GoalStatus;
  assigneeId: string | null;
  ownerGroupId: string | null;
  createdById: string;
  createdAt: Date;
  updatedAt: Date;
};

type GoalWithRelations<T extends GoalLike> = T & {
  assignee?: unknown;
  ownerGroup?: unknown;
  createdBy?: unknown;
};

function reportValue(
  report: {
    activityType: string | null;
    incomeAmount: number | null;
    outcome?: string | null;
    communicationSession?: { status?: string | null } | null;
  },
  metricType: GoalMetricType,
) {
  const normalizedActivityType = isCountableActivity(report)
    ? report.activityType
    : null;

  switch (metricType) {
    case GOAL_METRIC_TYPES.CALLS:
      return normalizedActivityType === "CALL" ? 1 : 0;
    case GOAL_METRIC_TYPES.TEXTS:
      return normalizedActivityType === "MESSAGE" ? 1 : 0;
    case GOAL_METRIC_TYPES.INCOME:
      return normalizedActivityType === "INCOME" ? report.incomeAmount ?? 0 : 0;
    case GOAL_METRIC_TYPES.ALL:
    default:
      if (normalizedActivityType === "INCOME") {
        return report.incomeAmount ?? 0;
      }

      if (normalizedActivityType === "CALL" || normalizedActivityType === "MESSAGE") {
        return 1;
      }

      return 0;
  }
}

function normalizeGoalPeriod(goal: GoalLike) {
  const timeline = goal.timeline ?? GOAL_TIMELINES.WEEKLY;
  const periodKey = goal.periodKey ?? goal.weekKey ?? currentPeriodKey(timeline);
  return { timeline, periodKey };
}

export function goalWhereForCurrentPeriods(): Prisma.WeeklyGoalWhereInput {
  const keys = currentPeriodKeys();

  return {
    OR: [
      { timeline: GOAL_TIMELINES.DAILY, periodKey: keys.DAILY },
      { timeline: GOAL_TIMELINES.WEEKLY, OR: [{ periodKey: keys.WEEKLY }, { weekKey: keys.WEEKLY }] },
      { timeline: GOAL_TIMELINES.MONTHLY, periodKey: keys.MONTHLY },
      { timeline: GOAL_TIMELINES.ANNUAL, periodKey: keys.ANNUAL },
    ],
  };
}

export async function enrichGoalsWithProgress<T extends GoalLike>(
  prisma: Prisma.TransactionClient | Prisma.DefaultPrismaClient,
  goals: GoalWithRelations<T>[],
) {
  if (!goals.length) {
    return [];
  }

  const reports = await Promise.all(goals.map(async (goal) => {
    const { timeline, periodKey } = normalizeGoalPeriod(goal);
    const { start, end } = periodRangeFromKey(timeline, periodKey);
    const where: Prisma.ActivityReportWhereInput = {
      activityDate: {
        gte: start,
        lt: end,
      },
    };

    if (goal.ownerType === "TEAM" && goal.ownerGroupId) {
      where.rep = {
        groupMemberships: {
          some: {
            groupId: goal.ownerGroupId,
          },
        },
      };
    } else if (goal.assigneeId) {
      where.repId = goal.assigneeId;
    } else {
      where.id = "__none__";
    }

    const matchedReports = await prisma.activityReport.findMany({
      where,
      select: {
        activityType: true,
        incomeAmount: true,
        outcome: true,
        communicationSession: {
          select: {
            status: true,
          },
        },
      },
    });

    const achievedValue = matchedReports.reduce(
      (sum, report) => sum + reportValue(report, goal.metricType),
      0,
    );

    let status = goal.status;
    if (achievedValue >= goal.targetValue) {
      status = GOAL_STATUSES.COMPLETED;
    } else if (periodKey !== currentPeriodKey(timeline)) {
      status = GOAL_STATUSES.MISSED;
    } else {
      status = GOAL_STATUSES.ACTIVE;
    }

    return {
      ...goal,
      timeline,
      periodKey,
      achievedValue,
      status,
    };
  }));

  return reports;
}

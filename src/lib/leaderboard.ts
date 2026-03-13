import { type GoalMetricType } from "@prisma/client";

const GOAL_METRIC_TYPES = {
  CALLS: "CALLS",
  TEXTS: "TEXTS",
  INCOME: "INCOME",
  ALL: "ALL",
} as const;

type GoalInput = {
  assigneeId: string | null;
  ownerType?: string | null;
  ownerGroupId?: string | null;
  targetValue: number;
  achievedValue: number;
  metricType: GoalMetricType;
};

type ReportInput = {
  repId: string;
  activityType: string | null;
  incomeAmount?: number | null;
  groupIds?: string[];
};

function metricScore(metricType: GoalMetricType, callsLogged: number, messagesLogged: number, incomeValue: number, incomeCount: number) {
  switch (metricType) {
    case GOAL_METRIC_TYPES.CALLS:
      return callsLogged;
    case GOAL_METRIC_TYPES.TEXTS:
      return messagesLogged;
    case GOAL_METRIC_TYPES.INCOME:
      // For income goals, count the number of income reports submitted (not the amount)
      return incomeCount;
    case GOAL_METRIC_TYPES.ALL:
    default:
      return callsLogged + messagesLogged + incomeCount;
  }
}

export function computeLeaderboard(goals: GoalInput[], reports: ReportInput[], metricType: GoalMetricType = GOAL_METRIC_TYPES.ALL) {
  const callCountMap = new Map<string, number>();
  const messageCountMap = new Map<string, number>();
  const incomeValueMap = new Map<string, number>();
  const incomeCountMap = new Map<string, number>();
  const goalScoreMap = new Map<string, { achieved: number; target: number }>();
  const teamMemberships = new Map<string, Set<string>>();

  for (const report of reports) {
    if (!teamMemberships.has(report.repId)) {
      teamMemberships.set(report.repId, new Set());
    }

    if (report.groupIds?.length) {
      for (const groupId of report.groupIds) {
        const members = teamMemberships.get(report.repId) ?? new Set<string>();
        members.add(groupId);
        teamMemberships.set(report.repId, members);
      }
    }

    if (report.activityType === "MESSAGE") {
      messageCountMap.set(report.repId, (messageCountMap.get(report.repId) ?? 0) + 1);
      continue;
    }

    if (report.activityType === "INCOME") {
      incomeValueMap.set(report.repId, (incomeValueMap.get(report.repId) ?? 0) + (report.incomeAmount ?? 0));
      incomeCountMap.set(report.repId, (incomeCountMap.get(report.repId) ?? 0) + 1);
      continue;
    }

    callCountMap.set(report.repId, (callCountMap.get(report.repId) ?? 0) + 1);
  }

  for (const goal of goals) {
    if (metricType !== GOAL_METRIC_TYPES.ALL && goal.metricType !== metricType && goal.metricType !== GOAL_METRIC_TYPES.ALL) {
      continue;
    }

    if (goal.assigneeId) {
      const current = goalScoreMap.get(goal.assigneeId) ?? { achieved: 0, target: 0 };
      current.achieved += goal.achievedValue;
      current.target += goal.targetValue;
      goalScoreMap.set(goal.assigneeId, current);
      continue;
    }

    if (goal.ownerType === "TEAM" && goal.ownerGroupId) {
      for (const [userId, groupIds] of teamMemberships.entries()) {
        if (!groupIds.has(goal.ownerGroupId)) {
          continue;
        }

        const current = goalScoreMap.get(userId) ?? { achieved: 0, target: 0 };
        current.achieved += goal.achievedValue;
        current.target += goal.targetValue;
        goalScoreMap.set(userId, current);
      }
    }
  }

  const userIds = new Set<string>([
    ...callCountMap.keys(),
    ...messageCountMap.keys(),
    ...incomeValueMap.keys(),
    ...goalScoreMap.keys(),
  ]);
  const scoreValues = [...userIds].map((userId) =>
    metricScore(
      metricType,
      callCountMap.get(userId) ?? 0,
      messageCountMap.get(userId) ?? 0,
      incomeValueMap.get(userId) ?? 0,
      incomeCountMap.get(userId) ?? 0,
    ));
  const highestScoreValue = Math.max(...scoreValues, 1);

  return [...userIds].map((userId) => {
    const goalStats = goalScoreMap.get(userId) ?? { achieved: 0, target: 0 };
    const hasTrackedGoal = goalStats.target > 0;
    const goalRatio = goalStats.target > 0 ? Math.min(goalStats.achieved / goalStats.target, 1) : 0;
    const callsLogged = callCountMap.get(userId) ?? 0;
    const messagesLogged = messageCountMap.get(userId) ?? 0;
    const incomeValue = incomeValueMap.get(userId) ?? 0;
    const incomeReportsCount = incomeCountMap.get(userId) ?? 0;
    const totalActivities = callsLogged + messagesLogged + incomeReportsCount;
    const metricValue = metricScore(metricType, callsLogged, messagesLogged, incomeValue, incomeReportsCount);
    const activityRatio = metricValue / highestScoreValue;
    const score = metricValue;

    return {
      userId,
      score: Number(score.toFixed(2)),
      goalRatio: Number((goalRatio * 100).toFixed(2)),
      hasTrackedGoal,
      activityRatio: Number((activityRatio * 100).toFixed(2)),
      callsLogged,
      messagesLogged,
      incomeValue,
      totalActivities,
      marks: totalActivities * 5,
      incomeReportsCount,
      metricValue,
      metricType,
    };
  }).sort((left, right) => {
    if (right.hasTrackedGoal !== left.hasTrackedGoal) {
      return Number(right.hasTrackedGoal) - Number(left.hasTrackedGoal);
    }

    if (right.goalRatio !== left.goalRatio) {
      return right.goalRatio - left.goalRatio;
    }

    if (right.score !== left.score) {
      return right.score - left.score;
    }

    return right.callsLogged - left.callsLogged;
  });
}

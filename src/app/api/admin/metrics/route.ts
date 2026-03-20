import { UserRole } from "@prisma/client";

import { isCountableActivity } from "@/lib/activityCounts";
import { requireActor } from "@/lib/auth";
import { requireRole } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { currentWeekKey } from "@/lib/week";
import { ok } from "@/lib/response";
import { runRoute } from "@/lib/route";
import { enrichGoalsWithProgress, goalWhereForCurrentPeriods } from "@/lib/goals";

export async function GET(request: Request) {
  return runRoute(async () => {
    const actor = await requireActor(request);
    requireRole(actor, [UserRole.MANAGER, UserRole.ADMIN]);
    const weekKey = new URL(request.url).searchParams.get("week") ?? currentWeekKey();

    const [users, reports, feedback, goals, broadcasts, threads, groups] = await Promise.all([
      prisma.user.findMany({
        include: {
          groupMemberships: {
            include: { group: true },
          },
        },
      }),
      prisma.activityReport.findMany({
        include: {
          rep: true,
          communicationSession: {
            select: {
              status: true,
            },
          },
        },
      }),
      prisma.feedbackItem.groupBy({ by: ["category"], _count: true }),
      prisma.weeklyGoal.findMany({ where: goalWhereForCurrentPeriods() }),
      prisma.broadcast.count(),
      prisma.messageThread.count(),
      prisma.repGroup.findMany({
        include: {
          members: {
            include: {
              user: true,
            },
          },
        },
      }),
    ]);

    const enrichedGoals = await enrichGoalsWithProgress(prisma, goals);

    const goalTotals = enrichedGoals.reduce(
      (acc, goal) => {
        acc.target += goal.targetValue;
        acc.achieved += goal.achievedValue;
        return acc;
      },
      { target: 0, achieved: 0 },
    );

    const callsLogged = reports.filter((report) => report.activityType === "CALL" && isCountableActivity(report)).length;
    const messagesLogged = reports.filter((report) => report.activityType === "MESSAGE" && isCountableActivity(report)).length;
    const incomeLogged = reports.reduce((sum, report) => sum + (report.activityType === "INCOME" ? report.incomeAmount ?? 0 : 0), 0);
    const userStats = users.reduce(
      (acc, user) => {
        acc.total += 1;
        acc.active += user.status === "ACTIVE" ? 1 : 0;
        acc.inactive += user.status === "INACTIVE" ? 1 : 0;
        acc.byRole[user.role] += 1;
        return acc;
      },
      {
        total: 0,
        active: 0,
        inactive: 0,
        byRole: {
          REP: 0,
          MANAGER: 0,
          ADMIN: 0,
        },
      },
    );

    const regionMap = new Map<
      string,
      {
        regionName: string;
        users: number;
        callsLogged: number;
        messagesLogged: number;
        zones: Map<string, { zoneName: string; callsLogged: number; messagesLogged: number; groups: Map<string, number> }>;
      }
    >();

    for (const user of users) {
      const regionName = user.regionName ?? "Unassigned";
      const current = regionMap.get(regionName) ?? {
        regionName,
        users: 0,
        callsLogged: 0,
        messagesLogged: 0,
        zones: new Map(),
      };
      current.users += 1;
      regionMap.set(regionName, current);
    }

    for (const report of reports) {
      const regionName = report.regionName ?? report.rep.regionName ?? "Unassigned";
      const zoneName = report.zoneName ?? report.rep.zoneName ?? "Unassigned";
      const groupName = report.pastorGroup ?? report.rep.pastorGroupName ?? "Unassigned";
      const region = regionMap.get(regionName) ?? {
        regionName,
        users: 0,
        callsLogged: 0,
        messagesLogged: 0,
        zones: new Map(),
      };
      const zone = region.zones.get(zoneName) ?? {
        zoneName,
        callsLogged: 0,
        messagesLogged: 0,
        groups: new Map(),
      };

      if (report.activityType === "MESSAGE" && isCountableActivity(report)) {
        region.messagesLogged += 1;
        zone.messagesLogged += 1;
      } else if (report.activityType === "CALL" && isCountableActivity(report)) {
        region.callsLogged += 1;
        zone.callsLogged += 1;
      }

      zone.groups.set(groupName, (zone.groups.get(groupName) ?? 0) + 1);
      region.zones.set(zoneName, zone);
      regionMap.set(regionName, region);
    }

    const regionStats = [...regionMap.values()].map((region) => ({
      regionName: region.regionName,
      users: region.users,
      callsLogged: region.callsLogged,
      messagesLogged: region.messagesLogged,
      zones: [...region.zones.values()].map((zone) => ({
        zoneName: zone.zoneName,
        callsLogged: zone.callsLogged,
        messagesLogged: zone.messagesLogged,
        groups: [...zone.groups.entries()].map(([groupName, activityCount]) => ({
          groupName,
          activityCount,
        })),
      })),
    }));

    const groupStats = groups.map((group) => ({
      id: group.id,
      name: group.name,
      description: group.description,
      memberCount: group.members.length,
      managerId: group.managerId,
    }));

    return ok({
      weekKey,
      users: users.length,
      reports: reports.length,
      callsLogged,
      messagesLogged,
      incomeLogged,
      feedback,
      goals: {
        count: enrichedGoals.length,
        targetValue: goalTotals.target,
        achievedValue: goalTotals.achieved,
      },
      broadcasts,
      threads,
      userStats,
      regionStats,
      groupStats,
    });
  });
}

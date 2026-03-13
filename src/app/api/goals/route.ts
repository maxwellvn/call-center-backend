import { Prisma, UserRole } from "@prisma/client";

import { requireActor } from "@/lib/auth";
import { actorGroupIds, requireRole } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { parsePagination } from "@/lib/pagination";
import { created, ok } from "@/lib/response";
import { runRoute } from "@/lib/route";
import { parseJson } from "@/lib/request";
import { goalSchema } from "@/lib/validators";
import { enrichGoalsWithProgress, goalWhereForCurrentPeriods } from "@/lib/goals";

export async function GET(request: Request) {
  return runRoute(async () => {
    const actor = await requireActor(request);
    const url = new URL(request.url);
    const { page, perPage, skip, take } = parsePagination(url.searchParams);
    const weekKey = url.searchParams.get("week");
    const timeline = url.searchParams.get("timeline");
    const periodKey = url.searchParams.get("periodKey");
    const assigneeId = url.searchParams.get("assigneeId");
    const status = url.searchParams.get("status");
    const groupIds = actor.role === UserRole.MANAGER || actor.role === UserRole.REP ? await actorGroupIds(actor.id) : [];

    const andWhere: Prisma.WeeklyGoalWhereInput[] = [];
    const where: Prisma.WeeklyGoalWhereInput = {};

    if (timeline) {
      where.timeline = timeline as never;
    }

    if (periodKey) {
      where.periodKey = periodKey;
    } else if (weekKey) {
      andWhere.push({ OR: [{ periodKey: weekKey }, { weekKey }] });
    } else {
      andWhere.push(goalWhereForCurrentPeriods());
    }

    if (assigneeId) {
      where.assigneeId = assigneeId;
    }

    if (status) {
      where.status = status as "ACTIVE" | "COMPLETED" | "MISSED";
    }

    if (actor.role === UserRole.REP) {
      andWhere.push({
        OR: [
        { assigneeId: actor.id },
        { ownerType: "TEAM", ownerGroupId: { in: groupIds } },
        ],
      });
    }

    if (actor.role === UserRole.MANAGER) {
      andWhere.push({
        OR: [
        { ownerGroupId: { in: groupIds } },
        { assignee: { groupMemberships: { some: { groupId: { in: groupIds } } } } },
        ],
      });
    }

    const finalWhere = andWhere.length ? { ...where, AND: andWhere } : where;

    const [items, total] = await Promise.all([
      prisma.weeklyGoal.findMany({
        where: finalWhere,
        skip,
        take,
        include: { assignee: true, ownerGroup: true, createdBy: true },
        orderBy: [{ createdAt: "desc" }],
      }),
      prisma.weeklyGoal.count({ where: finalWhere }),
    ]);

    const enriched = await enrichGoalsWithProgress(prisma, items);

    return ok(enriched, { page, perPage, total });
  });
}

export async function POST(request: Request) {
  return runRoute(async () => {
    const actor = await requireActor(request);
    requireRole(actor, [UserRole.MANAGER, UserRole.ADMIN]);
    const payload = await parseJson(request, goalSchema);

    const goal = await prisma.weeklyGoal.create({
      data: {
        ...payload,
        weekKey: payload.timeline === "WEEKLY" ? payload.periodKey : payload.weekKey ?? null,
        createdById: actor.id,
        achievedValue: payload.achievedValue ?? 0,
      },
      include: { assignee: true, ownerGroup: true },
    });

    const [enriched] = await enrichGoalsWithProgress(prisma, [goal]);

    return created(enriched);
  });
}

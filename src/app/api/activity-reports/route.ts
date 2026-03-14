import { UserRole } from "@prisma/client";

import { requireActor } from "@/lib/auth";
import { actorGroupIds } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { parsePagination } from "@/lib/pagination";
import { created, ok } from "@/lib/response";
import { runRoute } from "@/lib/route";
import { parseJson } from "@/lib/request";
import { emitSocketEvent } from "@/lib/socket";
import { getCommunicationSessionStatusForReport } from "@/lib/activityCounts";
import { activityReportSchema } from "@/lib/validators";

export async function GET(request: Request) {
  return runRoute(async () => {
    const actor = await requireActor(request);
    const url = new URL(request.url);
    const { page, perPage, skip, take } = parsePagination(url.searchParams);
    const repId = url.searchParams.get("repId");
    const status = url.searchParams.get("status");
    const from = url.searchParams.get("from");
    const to = url.searchParams.get("to");
    const groupIds = actor.role === UserRole.MANAGER ? await actorGroupIds(actor.id) : [];

    const where = {
      ...(repId ? { repId } : {}),
      ...(status ? { status: status as "DRAFT" | "SUBMITTED" | "REVIEWED" } : {}),
      ...(from || to
        ? {
            activityDate: {
              ...(from ? { gte: new Date(from) } : {}),
              ...(to ? { lte: new Date(to) } : {}),
            },
          }
        : {}),
      ...(actor.role === UserRole.REP ? { repId: actor.id } : {}),
      ...(actor.role === UserRole.MANAGER
        ? {
            rep: {
              groupMemberships: {
                some: { groupId: { in: groupIds } },
              },
            },
          }
        : {}),
    };

    const [items, total] = await Promise.all([
      prisma.activityReport.findMany({
        where,
        skip,
        take,
        include: { rep: true, contact: true, feedbackItems: true, communicationSession: true },
        orderBy: { activityDate: "desc" },
      }),
      prisma.activityReport.count({ where }),
    ]);

    return ok(items, { page, perPage, total });
  });
}

export async function POST(request: Request) {
  return runRoute(async () => {
    const actor = await requireActor(request);
    const payload = await parseJson(request, activityReportSchema);

    const report = await prisma.activityReport.create({
      data: {
        ...payload,
        repId: actor.role === UserRole.REP ? actor.id : payload.repId,
        activityDate: new Date(payload.activityDate),
        followUpAt: payload.followUpAt ? new Date(payload.followUpAt) : null,
      },
      include: {
        rep: {
          include: {
            groupMemberships: true,
          },
        },
        contact: true,
        communicationSession: true,
      },
    });

    if (payload.communicationSessionId) {
      await prisma.communicationSession.update({
        where: { id: payload.communicationSessionId },
        data: {
          status: getCommunicationSessionStatusForReport(payload) ?? undefined,
        },
      });
    }

    emitSocketEvent(
      "report.created",
      { report },
      [
        "org",
        `user:${report.repId}`,
        ...report.rep.groupMemberships.map((membership) => `group:${membership.groupId}`),
      ],
    );

    return created(report);
  });
}

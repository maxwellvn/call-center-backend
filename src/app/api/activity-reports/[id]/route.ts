import { UserRole } from "@prisma/client";

import { requireActor } from "@/lib/auth";
import { ApiError } from "@/lib/errors";
import { actorGroupIds } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { ok } from "@/lib/response";
import { runRoute } from "@/lib/route";
import { parseJson } from "@/lib/request";
import { emitSocketEvent } from "@/lib/socket";
import { activityReportSchema } from "@/lib/validators";

type Context = { params: Promise<{ id: string }> };

async function findAllowedReport(actorId: string, role: UserRole, id: string) {
  const groupIds = role === UserRole.MANAGER ? await actorGroupIds(actorId) : [];

  return prisma.activityReport.findFirst({
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
    include: {
      rep: true,
      contact: true,
      feedbackItems: true,
    },
  });
}

export async function GET(request: Request, context: Context) {
  return runRoute(async () => {
    const actor = await requireActor(request);
    const { id } = await context.params;
    const report = await findAllowedReport(actor.id, actor.role, id);

    if (!report) {
      throw new ApiError("Report not found", 404);
    }

    return ok(report);
  });
}

export async function PATCH(request: Request, context: Context) {
  return runRoute(async () => {
    const actor = await requireActor(request);
    const { id } = await context.params;
    const existing = await findAllowedReport(actor.id, actor.role, id);

    if (!existing) {
      throw new ApiError("Report not found", 404);
    }

    const payload = await parseJson(request, activityReportSchema.partial());
    const report = await prisma.activityReport.update({
      where: { id },
      data: {
        ...payload,
        activityDate: payload.activityDate ? new Date(payload.activityDate) : undefined,
        followUpAt:
          payload.followUpAt === undefined ? undefined : payload.followUpAt ? new Date(payload.followUpAt) : null,
      },
      include: {
        rep: {
          include: {
            groupMemberships: true,
          },
        },
        contact: true,
        feedbackItems: true,
      },
    });

    emitSocketEvent(
      "report.updated",
      { report },
      [
        "org",
        `user:${report.repId}`,
        ...report.rep.groupMemberships.map((membership) => `group:${membership.groupId}`),
      ],
    );

    return ok(report);
  });
}

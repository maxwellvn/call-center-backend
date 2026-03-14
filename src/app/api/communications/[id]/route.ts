import { UserRole } from "@prisma/client";

import { requireActor } from "@/lib/auth";
import { ApiError } from "@/lib/errors";
import { actorGroupIds } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { ok } from "@/lib/response";
import { runRoute } from "@/lib/route";
import { parseJson } from "@/lib/request";
import { communicationSessionUpdateSchema } from "@/lib/validators";

type Context = { params: Promise<{ id: string }> };

async function findAllowedSession(actorId: string, role: UserRole, id: string) {
  const groupIds = role === UserRole.MANAGER ? await actorGroupIds(actorId) : [];

  return prisma.communicationSession.findFirst({
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
      report: true,
    },
  });
}

export async function GET(request: Request, context: Context) {
  return runRoute(async () => {
    const actor = await requireActor(request);
    const { id } = await context.params;
    const session = await findAllowedSession(actor.id, actor.role, id);

    if (!session) {
      throw new ApiError("Communication session not found", 404);
    }

    return ok(session);
  });
}

export async function PATCH(request: Request, context: Context) {
  return runRoute(async () => {
    const actor = await requireActor(request);
    const { id } = await context.params;
    const existing = await findAllowedSession(actor.id, actor.role, id);

    if (!existing) {
      throw new ApiError("Communication session not found", 404);
    }

    const payload = await parseJson(request, communicationSessionUpdateSchema);

    const session = await prisma.communicationSession.update({
      where: { id },
      data: {
        ...payload,
        endedAt:
          payload.endedAt === undefined
            ? undefined
            : payload.endedAt
              ? new Date(payload.endedAt)
              : null,
      },
      include: {
        rep: true,
        contact: true,
        report: true,
      },
    });

    return ok(session);
  });
}

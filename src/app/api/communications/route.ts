import { UserRole } from "@prisma/client";

import { requireActor } from "@/lib/auth";
import { ApiError } from "@/lib/errors";
import { actorGroupIds } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { parsePagination } from "@/lib/pagination";
import { created, ok } from "@/lib/response";
import { runRoute } from "@/lib/route";
import { parseJson } from "@/lib/request";
import { communicationSessionCreateSchema } from "@/lib/validators";

export async function GET(request: Request) {
  return runRoute(async () => {
    const actor = await requireActor(request);
    const url = new URL(request.url);
    const { page, perPage, skip, take } = parsePagination(url.searchParams);
    const status = url.searchParams.get("status");
    const channel = url.searchParams.get("channel");
    const groupIds = actor.role === UserRole.MANAGER ? await actorGroupIds(actor.id) : [];

    const where = {
      ...(status ? { status: status as "PENDING" | "COMPLETED" | "CANCELED" } : {}),
      ...(channel ? { channel: channel as "CALL" | "MESSAGE" } : {}),
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
      prisma.communicationSession.findMany({
        where,
        skip,
        take,
        include: {
          rep: true,
          contact: true,
          report: true,
        },
        orderBy: { startedAt: "desc" },
      }),
      prisma.communicationSession.count({ where }),
    ]);

    return ok(items, { page, perPage, total });
  });
}

export async function POST(request: Request) {
  return runRoute(async () => {
    const actor = await requireActor(request);
    const payload = await parseJson(request, communicationSessionCreateSchema);
    const repId = actor.role === UserRole.REP ? actor.id : payload.repId;

    if (actor.role === UserRole.REP && payload.repId !== actor.id) {
      throw new ApiError("You cannot create communication sessions for another rep", 403);
    }

    const session = await prisma.communicationSession.create({
      data: {
        ...payload,
        repId,
        startedAt: new Date(payload.startedAt),
        endedAt: payload.endedAt ? new Date(payload.endedAt) : null,
      },
      include: {
        rep: true,
        contact: true,
        report: true,
      },
    });

    return created(session);
  });
}

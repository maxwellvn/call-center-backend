import { UserRole } from "@prisma/client";

import { requireActor } from "@/lib/auth";
import { ApiError } from "@/lib/errors";
import { actorGroupIds, requireRole } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { parsePagination } from "@/lib/pagination";
import { created, ok } from "@/lib/response";
import { runRoute } from "@/lib/route";
import { parseJson } from "@/lib/request";
import { emitSocketEvent } from "@/lib/socket";
import { broadcastSchema } from "@/lib/validators";

export async function GET(request: Request) {
  return runRoute(async () => {
    const actor = await requireActor(request);
    const { page, perPage, skip, take } = parsePagination(new URL(request.url).searchParams);
    const groupIds = actor.role === UserRole.ADMIN ? [] : await actorGroupIds(actor.id);

    const where = actor.role === UserRole.ADMIN
      ? {}
      : {
          OR: [
            { audienceType: "ALL" as const },
            { targetGroupId: { in: groupIds } },
          ],
        };

    const [items, total] = await Promise.all([
      prisma.broadcast.findMany({
        where,
        skip,
        take,
        include: { createdBy: true, targetGroup: true },
        orderBy: { createdAt: "desc" },
      }),
      prisma.broadcast.count({ where }),
    ]);

    return ok(items, { page, perPage, total });
  });
}

export async function POST(request: Request) {
  return runRoute(async () => {
    const actor = await requireActor(request);
    requireRole(actor, [UserRole.MANAGER, UserRole.ADMIN]);
    const payload = await parseJson(request, broadcastSchema);

    const managerGroups = actor.role === UserRole.MANAGER ? await actorGroupIds(actor.id) : [];
    if (payload.audienceType === "GROUP" && !payload.targetGroupId) {
      throw new ApiError("targetGroupId is required for group broadcasts", 400);
    }
    if (payload.targetGroupId && actor.role === UserRole.MANAGER && !managerGroups.includes(payload.targetGroupId)) {
      throw new ApiError("Managers can only broadcast to their groups", 403);
    }

    const broadcast = await prisma.broadcast.create({
      data: {
        ...payload,
        createdById: actor.id,
      },
      include: { createdBy: true, targetGroup: true },
    });

    const rooms = payload.audienceType === "ALL" ? ["org"] : [`group:${payload.targetGroupId}`];
    emitSocketEvent("broadcast.created", { broadcast }, rooms);

    return created(broadcast);
  });
}

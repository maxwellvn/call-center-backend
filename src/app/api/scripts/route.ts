import { UserRole } from "@prisma/client";

import { requireActor } from "@/lib/auth";
import { actorGroupIds, requireRole } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { parsePagination } from "@/lib/pagination";
import { created, ok } from "@/lib/response";
import { runRoute } from "@/lib/route";
import { parseJson } from "@/lib/request";
import { scriptSchema } from "@/lib/validators";

export async function GET(request: Request) {
  return runRoute(async () => {
    const actor = await requireActor(request);
    const url = new URL(request.url);
    const { page, perPage, skip, take } = parsePagination(url.searchParams);
    const weekKey = url.searchParams.get("week");
    const active = url.searchParams.get("active");
    const groupIds = actor.role === UserRole.REP || actor.role === UserRole.MANAGER ? await actorGroupIds(actor.id) : [];

    const where = {
      ...(weekKey ? { weekKey } : {}),
      ...(active ? { isActive: active === "true" } : {}),
      ...(actor.role !== UserRole.ADMIN
        ? {
            OR: [
              { isMain: true },
              {
                groups: {
                  some: {
                    groupId: { in: groupIds },
                  },
                },
              },
            ],
          }
        : {}),
    };

    const [items, total] = await Promise.all([
      prisma.weeklyScript.findMany({
        where,
        skip,
        take,
        include: { groups: { include: { group: true } }, createdBy: true },
        orderBy: [{ weekKey: "desc" }, { createdAt: "desc" }],
      }),
      prisma.weeklyScript.count({ where }),
    ]);

    return ok(items, { page, perPage, total });
  });
}

export async function POST(request: Request) {
  return runRoute(async () => {
    const actor = await requireActor(request);
    requireRole(actor, [UserRole.MANAGER, UserRole.ADMIN]);
    const payload = await parseJson(request, scriptSchema);

    const script = await prisma.weeklyScript.create({
      data: {
        title: payload.title,
        content: payload.content,
        weekKey: payload.weekKey,
        isMain: payload.isMain ?? false,
        isActive: payload.isActive ?? false,
        createdById: actor.id,
        activatedAt: payload.isActive ? new Date() : null,
        groups: payload.groupIds?.length
          ? { create: payload.groupIds.map((groupId) => ({ groupId })) }
          : undefined,
      },
      include: { groups: true },
    });

    return created(script);
  });
}

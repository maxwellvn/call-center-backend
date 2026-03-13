import { UserRole } from "@prisma/client";

import { requireActor } from "@/lib/auth";
import { actorGroupIds, requireRole } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { parsePagination } from "@/lib/pagination";
import { created, ok } from "@/lib/response";
import { runRoute } from "@/lib/route";
import { parseJson } from "@/lib/request";
import { userCreateSchema } from "@/lib/validators";

export async function GET(request: Request) {
  return runRoute(async () => {
    const actor = await requireActor(request);
    const url = new URL(request.url);
    const { page, perPage, skip, take } = parsePagination(url.searchParams);
    const q = url.searchParams.get("q");
    const role = url.searchParams.get("role") as UserRole | null;
    const groupId = url.searchParams.get("groupId");

    const managerGroupIds = actor.role === UserRole.MANAGER ? await actorGroupIds(actor.id) : [];
    const effectiveGroupIds = groupId ? [groupId] : managerGroupIds;

    const where = {
      ...(q
        ? {
            OR: [
              { fullName: { contains: q, mode: "insensitive" as const } },
              { email: { contains: q, mode: "insensitive" as const } },
            ],
          }
        : {}),
      ...(role ? { role } : {}),
      ...(actor.role === UserRole.MANAGER || groupId
        ? {
            groupMemberships: {
              some: {
                groupId: {
                  in: effectiveGroupIds,
                },
              },
            },
          }
        : {}),
    };

    const [items, total] = await Promise.all([
      prisma.user.findMany({
        where,
        skip,
        take,
        include: {
          groupMemberships: {
            include: { group: true },
          },
        },
        orderBy: { createdAt: "desc" },
      }),
      prisma.user.count({ where }),
    ]);

    return ok(items, { page, perPage, total });
  });
}

export async function POST(request: Request) {
  return runRoute(async () => {
    const actor = await requireActor(request);
    requireRole(actor, [UserRole.ADMIN]);
    const payload = await parseJson(request, userCreateSchema);

    const user = await prisma.user.create({
      data: {
        fullName: payload.fullName,
        email: payload.email,
        phone: payload.phone,
        title: payload.title,
        role: payload.role,
        status: payload.status,
        regionName: payload.regionName,
        zoneName: payload.zoneName,
        pastorGroupId: payload.pastorGroupId,
        pastorGroupName: payload.pastorGroupName,
        groupMemberships: payload.groupIds?.length
          ? {
              create: payload.groupIds.map((groupId) => ({ groupId })),
            }
          : undefined,
      },
      include: {
        groupMemberships: true,
      },
    });

    return created(user);
  });
}

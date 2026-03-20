import { UserRole } from "@prisma/client";

import { requireActor } from "@/lib/auth";
import { requireRole } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { created, ok } from "@/lib/response";
import { runRoute } from "@/lib/route";
import { parseJson } from "@/lib/request";
import { groupSchema } from "@/lib/validators";

export async function GET(request: Request) {
  return runRoute(async () => {
    const actor = await requireActor(request);
    requireRole(actor, [UserRole.MANAGER, UserRole.ADMIN]);

    const isManagerSetupPending =
      actor.role === UserRole.MANAGER &&
      !actor.pastorGroupId &&
      !actor.pastorGroupName;

    const where =
      actor.role === UserRole.MANAGER && !isManagerSetupPending
        ? { managerId: actor.id }
        : {};

    const groups = await prisma.repGroup.findMany({
      where,
      include: {
        manager: true,
        members: {
          include: {
            user: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    return ok(groups);
  });
}

export async function POST(request: Request) {
  return runRoute(async () => {
    const actor = await requireActor(request);
    requireRole(actor, [UserRole.ADMIN]);
    const payload = await parseJson(request, groupSchema);

    const group = await prisma.repGroup.create({
      data: {
        name: payload.name,
        description: payload.description,
        managerId: payload.managerId,
        members: payload.memberIds?.length
          ? {
              create: payload.memberIds.map((userId) => ({ userId })),
            }
          : undefined,
      },
      include: {
        manager: true,
        members: {
          include: {
            user: true,
          },
        },
      },
    });

    return created(group);
  });
}

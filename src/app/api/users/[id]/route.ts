import { UserRole } from "@prisma/client";

import { requireActor } from "@/lib/auth";
import { ApiError } from "@/lib/errors";
import { assertCanAccessUser } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { ok } from "@/lib/response";
import { runRoute } from "@/lib/route";
import { parseJson } from "@/lib/request";
import { userUpdateSchema } from "@/lib/validators";

type Context = { params: Promise<{ id: string }> };

export async function GET(request: Request, context: Context) {
  return runRoute(async () => {
    const actor = await requireActor(request);
    const { id } = await context.params;
    await assertCanAccessUser(actor, id);

    const user = await prisma.user.findUnique({
      where: { id },
      include: {
        groupMemberships: {
          include: { group: true },
        },
        managedGroups: true,
      },
    });

    if (!user) {
      throw new ApiError("User not found", 404);
    }

    return ok(user);
  });
}

export async function PATCH(request: Request, context: Context) {
  return runRoute(async () => {
    const actor = await requireActor(request);
    const { id } = await context.params;
    if (actor.role !== UserRole.ADMIN && actor.id !== id) {
      throw new ApiError("You do not have permission to update this user", 403);
    }
    const payload = await parseJson(request, userUpdateSchema);

    const user = await prisma.user.update({
      where: { id },
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
        ...(payload.groupIds
          ? {
              groupMemberships: {
                deleteMany: {},
                create: payload.groupIds.map((groupId) => ({ groupId })),
              },
            }
          : {}),
      },
      include: {
        groupMemberships: true,
        managedGroups: true,
      },
    });

    return ok(user);
  });
}

export async function DELETE(request: Request, context: Context) {
  return runRoute(async () => {
    const actor = await requireActor(request);
    const { id } = await context.params;

    if (actor.role !== UserRole.ADMIN) {
      throw new ApiError("You do not have permission to delete this user", 403);
    }

    if (actor.id === id) {
      throw new ApiError("Admins cannot delete their own account", 400);
    }

    const existing = await prisma.user.findUnique({
      where: { id },
      select: { id: true },
    });

    if (!existing) {
      throw new ApiError("User not found", 404);
    }

    await prisma.user.delete({
      where: { id },
    });

    return ok({ deleted: true, id });
  });
}

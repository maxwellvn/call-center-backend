import { UserRole } from "@prisma/client";

import { requireActor } from "@/lib/auth";
import { ApiError } from "@/lib/errors";
import { requireRole } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { ok } from "@/lib/response";
import { runRoute } from "@/lib/route";

type Context = { params: Promise<{ id: string }> };

export async function POST(request: Request, context: Context) {
  return runRoute(async () => {
    const actor = await requireActor(request);
    requireRole(actor, [UserRole.MANAGER, UserRole.ADMIN]);
    const { id } = await context.params;

    const script = await prisma.weeklyScript.findUnique({
      where: { id },
      include: { groups: true },
    });

    if (!script) {
      throw new ApiError("Script not found", 404);
    }

    await prisma.$transaction(async (tx) => {
      if (script.isMain) {
        await tx.weeklyScript.updateMany({
          where: {
            weekKey: script.weekKey,
            isMain: true,
          },
          data: { isActive: false },
        });
      } else {
        const groupIds = script.groups.map((group) => group.groupId);
        await tx.weeklyScript.updateMany({
          where: {
            weekKey: script.weekKey,
            isMain: false,
            groups: {
              some: { groupId: { in: groupIds } },
            },
          },
          data: { isActive: false },
        });
      }

      await tx.weeklyScript.update({
        where: { id },
        data: {
          isActive: true,
          activatedAt: new Date(),
        },
      });
    });

    const refreshed = await prisma.weeklyScript.findUnique({
      where: { id },
      include: { groups: { include: { group: true } } },
    });

    return ok(refreshed);
  });
}

export async function DELETE(request: Request, context: Context) {
  return runRoute(async () => {
    const actor = await requireActor(request);
    requireRole(actor, [UserRole.ADMIN]);
    const { id } = await context.params;

    const script = await prisma.weeklyScript.findUnique({
      where: { id },
    });

    if (!script) {
      throw new ApiError("Script not found", 404);
    }

    // Delete the script groups first
    await prisma.weeklyScriptGroup.deleteMany({
      where: { scriptId: id },
    });

    // Delete the script
    await prisma.weeklyScript.delete({
      where: { id },
    });

    return ok({ deleted: true });
  });
}

import { UserRole } from "@prisma/client";

import { requireActor } from "@/lib/auth";
import { ApiError } from "@/lib/errors";
import { requireRole } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { ok } from "@/lib/response";
import { runRoute } from "@/lib/route";

type Context = { params: Promise<{ id: string }> };

export async function DELETE(request: Request, context: Context) {
  return runRoute(async () => {
    const actor = await requireActor(request);
    requireRole(actor, [UserRole.ADMIN]);

    const { id } = await context.params;
    const existing = await prisma.repGroup.findUnique({
      where: { id },
      select: { id: true, name: true },
    });

    if (!existing) {
      throw new ApiError("Group not found", 404);
    }

    await prisma.repGroup.delete({
      where: { id },
    });

    return ok({ id: existing.id, name: existing.name, deleted: true });
  });
}

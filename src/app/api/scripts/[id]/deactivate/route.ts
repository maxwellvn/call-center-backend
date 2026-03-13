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
        });

        if (!script) {
            throw new ApiError("Script not found", 404);
        }

        await prisma.weeklyScript.update({
            where: { id },
            data: {
                isActive: false,
                activatedAt: null,
            },
        });

        const refreshed = await prisma.weeklyScript.findUnique({
            where: { id },
            include: { groups: { include: { group: true } } },
        });

        return ok(refreshed);
    });
}

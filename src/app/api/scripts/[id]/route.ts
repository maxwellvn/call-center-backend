import { UserRole } from "@prisma/client";

import { requireActor } from "@/lib/auth";
import { ApiError } from "@/lib/errors";
import { requireRole } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { ok } from "@/lib/response";
import { runRoute } from "@/lib/route";
import { parseJson } from "@/lib/request";
import { scriptSchema } from "@/lib/validators";

type Context = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, context: Context) {
    return runRoute(async () => {
        const actor = await requireActor(request);
        requireRole(actor, [UserRole.MANAGER, UserRole.ADMIN]);
        const { id } = await context.params;
        const payload = await parseJson(request, scriptSchema.partial());

        const existing = await prisma.weeklyScript.findUnique({
            where: { id },
            include: { groups: true },
        });

        if (!existing) {
            throw new ApiError("Script not found", 404);
        }

        // Handle groupIds update
        let groupsUpdate = undefined;
        if (payload.groupIds !== undefined) {
            groupsUpdate = {
                deleteMany: {},
                create: payload.groupIds.map((groupId) => ({ groupId })),
            };
        }

        const script = await prisma.weeklyScript.update({
            where: { id },
            data: {
                ...(payload.title !== undefined && { title: payload.title }),
                ...(payload.content !== undefined && { content: payload.content }),
                ...(payload.weekKey !== undefined && { weekKey: payload.weekKey }),
                ...(payload.isMain !== undefined && { isMain: payload.isMain }),
                ...(payload.isActive !== undefined && {
                    isActive: payload.isActive,
                    activatedAt: payload.isActive ? new Date() : null,
                }),
                ...(groupsUpdate && { groups: groupsUpdate }),
            },
            include: { groups: true },
        });

        return ok(script);
    });
}

export async function DELETE(request: Request, context: Context) {
    return runRoute(async () => {
        const actor = await requireActor(request);
        requireRole(actor, [UserRole.ADMIN]);
        const { id } = await context.params;

        const existing = await prisma.weeklyScript.findUnique({
            where: { id },
        });

        if (!existing) {
            throw new ApiError("Script not found", 404);
        }

        // Delete the script groups first
        await prisma.weeklyScriptGroup.deleteMany({
            where: { scriptId: id },
        });

        await prisma.weeklyScript.delete({
            where: { id },
        });

        return ok({ deleted: true, id });
    });
}

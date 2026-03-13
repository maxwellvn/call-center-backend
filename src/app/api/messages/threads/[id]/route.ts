import { UserRole } from "@prisma/client";

import { requireActor } from "@/lib/auth";
import { ApiError } from "@/lib/errors";
import { prisma } from "@/lib/prisma";
import { ok } from "@/lib/response";
import { runRoute } from "@/lib/route";
import { emitSocketEvent } from "@/lib/socket";
import { listThreadTyping } from "@/lib/typing";

type Context = { params: Promise<{ id: string }> };

export async function GET(request: Request, context: Context) {
  return runRoute(async () => {
    const actor = await requireActor(request);
    const { id } = await context.params;

    const thread = await prisma.messageThread.findFirst({
      where: {
        id,
        participants: {
          some: { userId: actor.id },
        },
      },
      include: {
        participants: { include: { user: true } },
        messages: { include: { sender: true }, orderBy: { createdAt: "asc" } },
      },
    });

    if (!thread) {
      throw new ApiError("Thread not found", 404);
    }

    return ok({
      ...thread,
      typingUsers: listThreadTyping(id).filter((entry) => entry.userId !== actor.id),
    });
  });
}

export async function DELETE(request: Request, context: Context) {
  return runRoute(async () => {
    const actor = await requireActor(request);
    const { id } = await context.params;

    const thread = await prisma.messageThread.findFirst({
      where: {
        id,
        participants: {
          some: { userId: actor.id },
        },
      },
      include: {
        participants: true,
      },
    });

    if (!thread) {
      throw new ApiError("Thread not found", 404);
    }

    if (actor.role !== UserRole.ADMIN) {
      throw new ApiError("You do not have permission to delete this thread", 403);
    }

    const rooms = [
      ...thread.participants.map((participant) => `user:${participant.userId}`),
      `thread:${id}`,
      ...(thread.groupId ? [`group:${thread.groupId}`] : []),
    ];

    await prisma.messageThread.delete({
      where: { id },
    });

    emitSocketEvent("thread.deleted", { threadId: id }, rooms);

    return ok({ deleted: true, id });
  });
}

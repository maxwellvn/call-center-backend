import { UserRole } from "@prisma/client";

import { requireActor } from "@/lib/auth";
import { ApiError } from "@/lib/errors";
import { prisma } from "@/lib/prisma";
import { ok } from "@/lib/response";
import { runRoute } from "@/lib/route";
import { parseJson } from "@/lib/request";
import { emitSocketEvent } from "@/lib/socket";
import { messageSchema } from "@/lib/validators";

type Context = { params: Promise<{ id: string }> };

export async function POST(request: Request, context: Context) {
  return runRoute(async () => {
    const actor = await requireActor(request);
    const { id } = await context.params;

    const thread = await prisma.messageThread.findFirst({
      where: {
        id,
        participants: { some: { userId: actor.id } },
      },
      include: {
        participants: true,
      },
    });

    if (!thread) {
      throw new ApiError("Thread not found", 404);
    }

    const payload = await parseJson(request, messageSchema);
    const message = await prisma.message.create({
      data: {
        threadId: id,
        senderId: actor.id,
        body: payload.body,
      },
      include: { sender: true },
    });

    await prisma.messageThread.update({
      where: { id },
      data: { updatedAt: new Date() },
    });

    const rooms = [
      ...thread.participants.map((participant) => `user:${participant.userId}`),
      `thread:${id}`,
      ...(thread.groupId ? [`group:${thread.groupId}`] : []),
    ];

    emitSocketEvent("message.created", { threadId: id, message }, rooms);

    return ok(message);
  });
}

export async function DELETE(request: Request, context: Context) {
  return runRoute(async () => {
    const actor = await requireActor(request);
    const { id } = await context.params;
    const messageId = new URL(request.url).searchParams.get("messageId");

    if (!messageId) {
      throw new ApiError("messageId is required", 400);
    }

    const thread = await prisma.messageThread.findFirst({
      where: {
        id,
        participants: { some: { userId: actor.id } },
      },
      include: {
        participants: true,
      },
    });

    if (!thread) {
      throw new ApiError("Thread not found", 404);
    }

    const message = await prisma.message.findFirst({
      where: {
        id: messageId,
        threadId: id,
      },
      select: {
        id: true,
        senderId: true,
      },
    });

    if (!message) {
      throw new ApiError("Message not found", 404);
    }

    if (actor.role !== UserRole.ADMIN && actor.id !== message.senderId) {
      throw new ApiError("You do not have permission to delete this message", 403);
    }

    await prisma.message.delete({
      where: { id: messageId },
    });

    await prisma.messageThread.update({
      where: { id },
      data: { updatedAt: new Date() },
    });

    const rooms = [
      ...thread.participants.map((participant) => `user:${participant.userId}`),
      `thread:${id}`,
      ...(thread.groupId ? [`group:${thread.groupId}`] : []),
    ];

    emitSocketEvent("message.deleted", { threadId: id, messageId }, rooms);

    return ok({ deleted: true, id: messageId });
  });
}

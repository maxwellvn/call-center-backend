import { UserRole } from "@prisma/client";

import { requireActor } from "@/lib/auth";
import { ApiError } from "@/lib/errors";
import { actorGroupIds } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { parsePagination } from "@/lib/pagination";
import { created, ok } from "@/lib/response";
import { runRoute } from "@/lib/route";
import { parseJson } from "@/lib/request";
import { emitSocketEvent } from "@/lib/socket";
import { threadSchema } from "@/lib/validators";

export async function GET(request: Request) {
  return runRoute(async () => {
    const actor = await requireActor(request);
    const { page, perPage, skip, take } = parsePagination(new URL(request.url).searchParams);

    const items = await prisma.messageThread.findMany({
      where: {
        participants: {
          some: { userId: actor.id },
        },
      },
      skip,
      take,
      include: {
        participants: { include: { user: true } },
        messages: {
          include: { sender: true },
          orderBy: { createdAt: "desc" },
          take: 1,
        },
      },
      orderBy: { updatedAt: "desc" },
    });

    const total = await prisma.messageThread.count({
      where: {
        participants: {
          some: { userId: actor.id },
        },
      },
    });

    return ok(items, { page, perPage, total });
  });
}

export async function POST(request: Request) {
  return runRoute(async () => {
    const actor = await requireActor(request);
    const payload = await parseJson(request, threadSchema);

    if (payload.type === "GROUP" && actor.role === UserRole.REP) {
      throw new ApiError("Reps cannot create group threads", 403);
    }

    const targetParticipants = [...new Set([...payload.participantIds, actor.id])];
    const managerGroups = actor.role === UserRole.MANAGER ? await actorGroupIds(actor.id) : [];
    if (payload.groupId && actor.role === UserRole.MANAGER && !managerGroups.includes(payload.groupId)) {
      throw new ApiError("Managers can only create group threads for their groups", 403);
    }

    const initialMessage = payload.initialMessage?.trim() || null;

    const thread = await prisma.messageThread.create({
      data: {
        title: payload.title,
        type: payload.type,
        groupId: payload.groupId,
        createdById: actor.id,
        participants: {
          create: targetParticipants.map((userId) => ({ userId })),
        },
        ...(initialMessage
          ? {
              messages: {
                create: {
                  senderId: actor.id,
                  body: initialMessage,
                },
              },
            }
          : {}),
      },
      include: {
        participants: { include: { user: true } },
        messages: { include: { sender: true } },
      },
    });

    const rooms = [
      ...thread.participants.map((participant) => `user:${participant.userId}`),
      `thread:${thread.id}`,
      ...(thread.groupId ? [`group:${thread.groupId}`] : []),
    ];

    if (thread.messages[0]) {
      emitSocketEvent("message.created", { threadId: thread.id, message: thread.messages[0] }, rooms);
    }

    return created(thread);
  });
}

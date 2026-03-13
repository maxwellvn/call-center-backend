import { createServer } from "node:http";

import next from "next";
import { Server as SocketIOServer } from "socket.io";
import { prisma } from "./src/lib/prisma";

const dev = process.env.NODE_ENV !== "production";
const host = "0.0.0.0";
const port = Number(process.env.PORT ?? 3001);
const app = next({ dev, hostname: host, port });
const handle = app.getRequestHandler();

void app.prepare().then(() => {
  const httpServer = createServer((req, res) => handle(req, res));
  const io = new SocketIOServer(httpServer, {
    cors: {
      origin: "*",
    },
    path: "/socket.io",
  });

  io.on("connection", (socket) => {
    const authUserId = typeof socket.handshake.auth?.userId === "string" ? socket.handshake.auth.userId : "";

    socket.on("join", async (payload: { userId?: string; groupIds?: string[] }) => {
      const userId = authUserId || payload.userId;

      if (!userId) {
        return;
      }

      socket.data.userId = userId;
      socket.join(`user:${userId}`);

      const memberships = await prisma.userGroup.findMany({
        where: { userId },
        select: { groupId: true },
      });

      const roomGroupIds = new Set([
        ...memberships.map((membership) => membership.groupId),
        ...(payload.groupIds ?? []),
      ]);

      for (const groupId of roomGroupIds) {
        socket.join(`group:${groupId}`);
      }

      socket.join("org");
    });

    socket.on("thread:join", async (payload: { threadId?: string }) => {
      const userId = socket.data.userId as string | undefined;
      const threadId = payload.threadId;

      if (!userId || !threadId) {
        return;
      }

      const thread = await prisma.messageThread.findFirst({
        where: {
          id: threadId,
          participants: {
            some: { userId },
          },
        },
        select: { id: true },
      });

      if (!thread) {
        return;
      }

      socket.join(`thread:${threadId}`);
    });

    socket.on("thread:leave", (payload: { threadId?: string }) => {
      if (payload.threadId) {
        socket.leave(`thread:${payload.threadId}`);
      }
    });

    socket.on("thread:typing", async (payload: { threadId?: string; fullName?: string }) => {
      const userId = socket.data.userId as string | undefined;
      const threadId = payload.threadId;

      if (!userId || !threadId) {
        return;
      }

      const thread = await prisma.messageThread.findFirst({
        where: {
          id: threadId,
          participants: {
            some: { userId },
          },
        },
        select: { id: true },
      });

      if (!thread) {
        return;
      }

      socket.to(`thread:${threadId}`).emit("message.typing", {
        threadId,
        userId,
        fullName: payload.fullName || "User",
      });
    });
  });

  global.io = io;

  httpServer.listen(port, host, () => {
    console.log(`> Call center backend ready on http://${host}:${port}`);
  });
});

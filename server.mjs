import "dotenv/config";
import { createServer } from "node:http";

import { PrismaClient } from "@prisma/client";
import next from "next";
import { Server as SocketIOServer } from "socket.io";

const dev = process.env.NODE_ENV !== "production";
const host = "0.0.0.0";
const port = Number(process.env.PORT ?? 3001);

const prisma = new PrismaClient({
  log: process.env.NODE_ENV === "development" ? ["query", "warn", "error"] : ["error"],
});

function isDatabaseUnavailableError(error) {
  return (
    error instanceof Error &&
    error.name === "PrismaClientInitializationError" &&
    /can't reach database server|can't connect to database server|timed out fetching a new connection/i.test(
      error.message,
    )
  );
}

async function safeSocketQuery(callback) {
  try {
    return await callback();
  } catch (error) {
    if (isDatabaseUnavailableError(error)) {
      console.error("Socket event skipped because the database is unavailable", error);
      return null;
    }

    console.error("Socket event failed", error);
    return null;
  }
}

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

    socket.on("join", async (payload = {}) => {
      const userId = authUserId || payload.userId;

      if (!userId) {
        return;
      }

      socket.data.userId = userId;
      socket.join(`user:${userId}`);

      const memberships =
        (await safeSocketQuery(() =>
          prisma.userGroup.findMany({
            where: { userId },
            select: { groupId: true },
          }),
        )) ?? [];

      const roomGroupIds = new Set([
        ...memberships.map((membership) => membership.groupId),
        ...((payload.groupIds ?? []).filter((groupId) => typeof groupId === "string")),
      ]);

      for (const groupId of roomGroupIds) {
        socket.join(`group:${groupId}`);
      }

      socket.join("org");
    });

    socket.on("thread:join", async (payload = {}) => {
      const userId = socket.data.userId;
      const threadId = payload.threadId;

      if (typeof userId !== "string" || typeof threadId !== "string") {
        return;
      }

      const thread = await safeSocketQuery(() =>
        prisma.messageThread.findFirst({
          where: {
            id: threadId,
            participants: {
              some: { userId },
            },
          },
          select: { id: true },
        }),
      );

      if (!thread) {
        return;
      }

      socket.join(`thread:${threadId}`);
    });

    socket.on("thread:leave", (payload = {}) => {
      if (typeof payload.threadId === "string") {
        socket.leave(`thread:${payload.threadId}`);
      }
    });

    socket.on("thread:typing", async (payload = {}) => {
      const userId = socket.data.userId;
      const threadId = payload.threadId;

      if (typeof userId !== "string" || typeof threadId !== "string") {
        return;
      }

      const thread = await safeSocketQuery(() =>
        prisma.messageThread.findFirst({
          where: {
            id: threadId,
            participants: {
              some: { userId },
            },
          },
          select: { id: true },
        }),
      );

      if (!thread) {
        return;
      }

      socket.to(`thread:${threadId}`).emit("message.typing", {
        threadId,
        userId,
        fullName: typeof payload.fullName === "string" && payload.fullName ? payload.fullName : "User",
      });
    });
  });

  globalThis.io = io;

  httpServer.listen(port, host, () => {
    console.log(`> Call center backend ready on http://${host}:${port}`);
  });
});

import { requireActor } from "@/lib/auth";
import { ApiError } from "@/lib/errors";
import { prisma } from "@/lib/prisma";
import { ok } from "@/lib/response";
import { runRoute } from "@/lib/route";
import { markThreadTyping } from "@/lib/typing";

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
      select: { id: true },
    });

    if (!thread) {
      throw new ApiError("Thread not found", 404);
    }

    markThreadTyping(id, actor.id, actor.fullName);

    return ok({ threadId: id, typing: true });
  });
}

import { UserRole } from "@prisma/client";

import { requireActor } from "@/lib/auth";
import { actorGroupIds } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { parsePagination } from "@/lib/pagination";
import { created, ok } from "@/lib/response";
import { runRoute } from "@/lib/route";
import { parseJson } from "@/lib/request";
import { feedbackSchema } from "@/lib/validators";

export async function GET(request: Request) {
  return runRoute(async () => {
    const actor = await requireActor(request);
    const url = new URL(request.url);
    const { page, perPage, skip, take } = parsePagination(url.searchParams);
    const category = url.searchParams.get("category");
    const status = url.searchParams.get("status");
    const repId = url.searchParams.get("repId");
    const groupIds = actor.role === UserRole.MANAGER ? await actorGroupIds(actor.id) : [];

    const where = {
      ...(category ? { category: category as "FEEDBACK" | "COMPLAINT" | "SUGGESTION" } : {}),
      ...(status ? { status: status as "OPEN" | "IN_PROGRESS" | "RESOLVED" } : {}),
      ...(repId ? { repId } : {}),
      ...(actor.role === UserRole.REP ? { repId: actor.id } : {}),
      ...(actor.role === UserRole.MANAGER
        ? {
            rep: {
              groupMemberships: {
                some: { groupId: { in: groupIds } },
              },
            },
          }
        : {}),
    };

    const [items, total] = await Promise.all([
      prisma.feedbackItem.findMany({
        where,
        skip,
        take,
        include: { rep: true, contact: true, report: true },
        orderBy: { createdAt: "desc" },
      }),
      prisma.feedbackItem.count({ where }),
    ]);

    return ok(items, { page, perPage, total });
  });
}

export async function POST(request: Request) {
  return runRoute(async () => {
    const actor = await requireActor(request);
    const payload = await parseJson(request, feedbackSchema);

    const item = await prisma.feedbackItem.create({
      data: {
        ...payload,
        repId: actor.role === UserRole.REP ? actor.id : payload.repId,
      },
      include: { rep: true, contact: true, report: true },
    });

    return created(item);
  });
}

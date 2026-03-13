import { UserRole } from "@prisma/client";

import { requireActor } from "@/lib/auth";
import { actorGroupIds } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { currentWeekKey } from "@/lib/week";
import { ok } from "@/lib/response";
import { runRoute } from "@/lib/route";

export async function GET(request: Request) {
  return runRoute(async () => {
    const actor = await requireActor(request);
    const weekKey = new URL(request.url).searchParams.get("week") ?? currentWeekKey();
    const groupIds = actor.role === UserRole.REP || actor.role === UserRole.MANAGER ? await actorGroupIds(actor.id) : [];

    const scripts = await prisma.weeklyScript.findMany({
      where: {
        weekKey,
        isActive: true,
        OR: [
          { isMain: true },
          { groups: { some: { groupId: { in: groupIds } } } },
        ],
      },
      include: {
        groups: { include: { group: true } },
      },
    });

    return ok(scripts);
  });
}

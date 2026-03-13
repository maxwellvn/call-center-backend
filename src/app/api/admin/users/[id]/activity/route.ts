import { UserRole } from "@prisma/client";

import { requireActor } from "@/lib/auth";
import { assertCanAccessUser, requireRole } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { ok } from "@/lib/response";
import { runRoute } from "@/lib/route";

type Context = { params: Promise<{ id: string }> };

export async function GET(request: Request, context: Context) {
  return runRoute(async () => {
    const actor = await requireActor(request);
    requireRole(actor, [UserRole.MANAGER, UserRole.ADMIN]);
    const { id } = await context.params;
    await assertCanAccessUser(actor, id);

    const [reports, contacts, feedback, goals] = await Promise.all([
      prisma.activityReport.findMany({ where: { repId: id }, orderBy: { activityDate: "desc" } }),
      prisma.contact.findMany({ where: { repId: id }, orderBy: { createdAt: "desc" } }),
      prisma.feedbackItem.findMany({ where: { repId: id }, orderBy: { createdAt: "desc" } }),
      prisma.weeklyGoal.findMany({ where: { assigneeId: id }, orderBy: { createdAt: "desc" } }),
    ]);

    return ok({ reports, contacts, feedback, goals });
  });
}

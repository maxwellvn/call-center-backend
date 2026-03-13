import { UserRole } from "@prisma/client";

import { requireActor } from "@/lib/auth";
import { requireRole } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { ok } from "@/lib/response";
import { runRoute } from "@/lib/route";

export async function GET(request: Request) {
  return runRoute(async () => {
    const actor = await requireActor(request);
    requireRole(actor, [UserRole.MANAGER, UserRole.ADMIN]);
    const url = new URL(request.url);
    const from = url.searchParams.get("from");
    const to = url.searchParams.get("to");
    const region = url.searchParams.get("region");
    const zone = url.searchParams.get("zone");
    const q = url.searchParams.get("q");

    const where = {
      ...(from || to
        ? {
            activityDate: {
              ...(from ? { gte: new Date(from) } : {}),
              ...(to ? { lte: new Date(to) } : {}),
            },
          }
        : {}),
      ...(region
        ? {
            rep: {
              regionName: region,
            },
          }
        : {}),
      ...(zone
        ? {
            OR: [
              { zoneName: zone },
              { rep: { zoneName: zone } },
            ],
          }
        : {}),
      ...(q
        ? {
            AND: [
              {
                OR: [
                  { title: { contains: q, mode: "insensitive" as const } },
                  { summary: { contains: q, mode: "insensitive" as const } },
                  { actionsTaken: { contains: q, mode: "insensitive" as const } },
                  { notes: { contains: q, mode: "insensitive" as const } },
                  { zoneName: { contains: q, mode: "insensitive" as const } },
                  { pastorGroup: { contains: q, mode: "insensitive" as const } },
                  { rep: { fullName: { contains: q, mode: "insensitive" as const } } },
                  { rep: { email: { contains: q, mode: "insensitive" as const } } },
                  { contact: { fullName: { contains: q, mode: "insensitive" as const } } },
                  { contact: { company: { contains: q, mode: "insensitive" as const } } },
                ],
              },
            ],
          }
        : {}),
    };

    const reports = await prisma.activityReport.findMany({
      where,
      include: { rep: true, contact: true, feedbackItems: true },
      orderBy: { activityDate: "desc" },
      take: 100,
    });

    return ok(reports);
  });
}

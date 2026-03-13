import { UserRole } from "@prisma/client";

import { requireActor } from "@/lib/auth";
import { actorGroupIds } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { parsePagination } from "@/lib/pagination";
import { created, ok } from "@/lib/response";
import { runRoute } from "@/lib/route";
import { parseJson } from "@/lib/request";
import { contactSchema } from "@/lib/validators";

export async function GET(request: Request) {
  return runRoute(async () => {
    const actor = await requireActor(request);
    const url = new URL(request.url);
    const { page, perPage, skip, take } = parsePagination(url.searchParams);
    const q = url.searchParams.get("q");
    const repId = url.searchParams.get("repId");
    const groupIds = actor.role === UserRole.MANAGER ? await actorGroupIds(actor.id) : [];

    const where = {
      ...(q
        ? {
            OR: [
              { fullName: { contains: q, mode: "insensitive" as const } },
              { company: { contains: q, mode: "insensitive" as const } },
              { email: { contains: q, mode: "insensitive" as const } },
            ],
          }
        : {}),
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
      ...(repId ? { repId } : {}),
    };

    const [items, total] = await Promise.all([
      prisma.contact.findMany({
        where,
        skip,
        take,
        include: { rep: true },
        orderBy: { createdAt: "desc" },
      }),
      prisma.contact.count({ where }),
    ]);

    return ok(items, { page, perPage, total });
  });
}

export async function POST(request: Request) {
  return runRoute(async () => {
    const actor = await requireActor(request);
    const payload = await parseJson(request, contactSchema);

    const contact = await prisma.contact.create({
      data: {
        ...payload,
        repId: actor.role === UserRole.REP ? actor.id : payload.repId,
      },
    });

    return created(contact);
  });
}

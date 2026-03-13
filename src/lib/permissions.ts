import { UserRole, type User } from "@prisma/client";

import { ApiError } from "@/lib/errors";
import { prisma } from "@/lib/prisma";

export function requireRole(actor: User, roles: UserRole[]) {
  if (!roles.includes(actor.role)) {
    throw new ApiError("You do not have permission to perform this action", 403);
  }
}

export async function actorGroupIds(actorId: string) {
  const memberships = await prisma.userGroup.findMany({
    where: { userId: actorId },
    select: { groupId: true },
  });

  return memberships.map((membership) => membership.groupId);
}

export async function canAccessUser(actor: User, targetUserId: string) {
  if (actor.role === UserRole.ADMIN || actor.id === targetUserId) {
    return true;
  }

  if (actor.role !== UserRole.MANAGER) {
    return false;
  }

  const [actorGroups, targetGroups] = await Promise.all([
    actorGroupIds(actor.id),
    actorGroupIds(targetUserId),
  ]);

  return actorGroups.some((groupId) => targetGroups.includes(groupId));
}

export async function assertCanAccessUser(actor: User, targetUserId: string) {
  if (!(await canAccessUser(actor, targetUserId))) {
    throw new ApiError("You cannot access this user", 403);
  }
}

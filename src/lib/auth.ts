import type { User } from "@prisma/client";

import { ApiError } from "@/lib/errors";
import { prisma } from "@/lib/prisma";

export async function requireActor(request: Request): Promise<User> {
  const userId = request.headers.get("x-user-id");

  if (!userId) {
    throw new ApiError("Missing x-user-id header", 401);
  }

  const user = await prisma.user.findUnique({ where: { id: userId } });

  if (!user) {
    throw new ApiError("Unknown acting user", 401);
  }

  return user;
}

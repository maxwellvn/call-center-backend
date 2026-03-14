import { Prisma } from "@prisma/client";

import { ApiError } from "@/lib/errors";

const DATABASE_UNAVAILABLE_MESSAGE = "Database unavailable";

function hasConnectivityMessage(error: Error) {
  return /can't reach database server|can't connect to database server|timed out fetching a new connection/i.test(
    error.message,
  );
}

export function isPrismaDatabaseUnavailableError(error: unknown): error is Error {
  if (error instanceof Prisma.PrismaClientInitializationError) {
    return hasConnectivityMessage(error);
  }

  return error instanceof Error && error.name === "PrismaClientInitializationError" && hasConnectivityMessage(error);
}

export function toPrismaApiError(error: unknown) {
  if (!isPrismaDatabaseUnavailableError(error)) {
    return null;
  }

  return new ApiError(DATABASE_UNAVAILABLE_MESSAGE, 503, {
    code: "DATABASE_UNAVAILABLE",
  });
}

export function isPrismaMissingTableError(error: unknown) {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2021";
}

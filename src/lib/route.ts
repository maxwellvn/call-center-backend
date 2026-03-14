import { ApiError } from "@/lib/errors";
import { toPrismaApiError } from "@/lib/prisma-errors";
import { failure } from "@/lib/response";

export async function runRoute<T>(handler: () => Promise<T>) {
  try {
    return await handler();
  } catch (error) {
    const prismaError = toPrismaApiError(error);

    if (prismaError) {
      console.error(prismaError.message, error);
      return failure(prismaError.message, prismaError.status, prismaError.details);
    }

    if (error instanceof ApiError) {
      return failure(error.message, error.status, error.details);
    }

    console.error(error);
    return failure("Internal server error", 500);
  }
}

import { ApiError } from "@/lib/errors";
import { failure } from "@/lib/response";

export async function runRoute<T>(handler: () => Promise<T>) {
  try {
    return await handler();
  } catch (error) {
    if (error instanceof ApiError) {
      return failure(error.message, error.status, error.details);
    }

    console.error(error);
    return failure("Internal server error", 500);
  }
}

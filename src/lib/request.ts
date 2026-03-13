import { ZodSchema } from "zod";

import { ApiError } from "@/lib/errors";

export async function parseJson<T>(request: Request, schema: ZodSchema<T>) {
  const body = await request.json();
  const result = schema.safeParse(body);

  if (!result.success) {
    throw new ApiError("Invalid request payload", 400, result.error.flatten());
  }

  return result.data;
}

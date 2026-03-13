import { z } from "zod";

import { findOrCreateKingsChatUser } from "@/lib/kingschat";
import { failure, ok } from "@/lib/response";

const schema = z.object({
  accessToken: z.string().min(1),
});

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = schema.safeParse(body);

    if (!parsed.success) {
      return failure("Invalid request payload", 400, parsed.error.flatten());
    }

    const user = await findOrCreateKingsChatUser(parsed.data.accessToken);
    return ok(user);
  } catch (error) {
    const message = error instanceof Error ? error.message : "KingsChat login failed";
    return failure(message, 400);
  }
}

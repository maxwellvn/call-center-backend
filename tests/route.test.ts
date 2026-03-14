import { describe, expect, it } from "vitest";

import { runRoute } from "@/lib/route";

describe("runRoute", () => {
  it("maps Prisma connectivity failures to 503", async () => {
    const error = new Error("Can't reach database server at `102.219.189.97:5440`");
    error.name = "PrismaClientInitializationError";

    const response = await runRoute(async () => {
      throw error;
    });

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toMatchObject({
      data: null,
      error: {
        message: "Database unavailable",
        details: {
          code: "DATABASE_UNAVAILABLE",
        },
      },
    });
  });
});

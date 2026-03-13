import { ok, failure } from "@/lib/response";
import { prisma } from "@/lib/prisma";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const email = typeof body?.email === "string" ? body.email : "";

    if (!email) {
      return failure("Email is required", 400);
    }

    const user = await prisma.user.findUnique({
      where: { email },
      include: {
        groupMemberships: {
          include: { group: true },
        },
      },
    });

    if (!user) {
      return failure("User not found", 404);
    }

    return ok(user);
  } catch (error) {
    console.error(error);
    return failure("Internal server error", 500);
  }
}

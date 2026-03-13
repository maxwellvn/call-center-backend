import { ok } from "@/lib/response";

export async function GET() {
  return ok({
    path: "/socket.io",
    events: ["message.created", "broadcast.created", "goal.updated"],
  });
}

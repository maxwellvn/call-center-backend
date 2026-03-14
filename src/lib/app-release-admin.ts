import { ApiError } from "@/lib/errors";

export function assertAppReleaseAdminKey(adminKey: string) {
  const expectedKey = process.env.APP_RELEASE_ADMIN_KEY;

  if (!expectedKey) {
    throw new ApiError("APP_RELEASE_ADMIN_KEY is not configured", 500);
  }

  if (adminKey !== expectedKey) {
    throw new ApiError("Invalid app release admin key", 401);
  }
}

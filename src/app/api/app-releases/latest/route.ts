import { AppReleasePlatform, type AppRelease } from "@prisma/client";

import { isUpdateAvailable, sortAppReleasesDescending } from "@/lib/app-releases";
import { prisma } from "@/lib/prisma";
import { isPrismaMissingTableError } from "@/lib/prisma-errors";
import { ok } from "@/lib/response";
import { runRoute } from "@/lib/route";

export async function GET(request: Request) {
  return runRoute(async () => {
    const url = new URL(request.url);
    const rawPlatform = url.searchParams.get("platform")?.toUpperCase();
    const currentVersion = url.searchParams.get("currentVersion");
    const platform =
      rawPlatform && rawPlatform in AppReleasePlatform
        ? (rawPlatform as AppReleasePlatform)
        : AppReleasePlatform.ANDROID;

    let releases: AppRelease[] = [];

    try {
      releases = await prisma.appRelease.findMany({
        where: {
          platform,
          isActive: true,
        },
        orderBy: { createdAt: "desc" },
      });
    } catch (error) {
      if (!isPrismaMissingTableError(error)) {
        throw error;
      }
    }

    const latestRelease = sortAppReleasesDescending(releases)[0] ?? null;

    if (!latestRelease) {
      return ok({
        release: null,
        platform,
        currentVersion,
        updateAvailable: false,
        required: false,
      });
    }

    const updateAvailable = isUpdateAvailable(currentVersion, latestRelease.version);

    return ok({
      release: latestRelease,
      platform,
      currentVersion,
      updateAvailable,
      required: updateAvailable ? latestRelease.isRequired : false,
    });
  });
}

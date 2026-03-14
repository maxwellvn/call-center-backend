import { ApiError } from "@/lib/errors";
import { prisma } from "@/lib/prisma";
import { isPrismaMissingTableError } from "@/lib/prisma-errors";
import { created, ok } from "@/lib/response";
import { runRoute } from "@/lib/route";
import { parseJson } from "@/lib/request";
import { appReleaseDeleteSchema, appReleaseSchema, appReleaseUpdateSchema } from "@/lib/validators";
import { sortAppReleasesDescending } from "@/lib/app-releases";
import { assertAppReleaseAdminKey } from "@/lib/app-release-admin";

export async function GET() {
  return runRoute(async () => {
    try {
      const releases = await prisma.appRelease.findMany({
        orderBy: [{ isActive: "desc" }, { createdAt: "desc" }],
      });

      return ok(sortAppReleasesDescending(releases), { setupRequired: false });
    } catch (error) {
      if (isPrismaMissingTableError(error)) {
        return ok([], { setupRequired: true });
      }

      throw error;
    }
  });
}

export async function POST(request: Request) {
  return runRoute(async () => {
    const payload = await parseJson(request, appReleaseSchema);
    assertAppReleaseAdminKey(payload.adminKey);

    try {
      const release = await prisma.$transaction(async (transaction) => {
        if (payload.isActive ?? true) {
          await transaction.appRelease.updateMany({
            where: {
              platform: payload.platform,
              isActive: true,
            },
            data: {
              isActive: false,
            },
          });
        }

        return transaction.appRelease.create({
          data: {
            version: payload.version.trim(),
            platform: payload.platform,
            downloadUrl: payload.downloadUrl,
            releaseNotes: payload.releaseNotes?.trim() || null,
            isRequired: payload.isRequired ?? false,
            isActive: payload.isActive ?? true,
          },
        });
      });

      return created(release);
    } catch (error) {
      if (isPrismaMissingTableError(error)) {
        throw new ApiError("App release storage is not ready. Run the latest Prisma migration first.", 503);
      }

      throw error;
    }
  });
}

export async function DELETE(request: Request) {
  return runRoute(async () => {
    const payload = await parseJson(request, appReleaseDeleteSchema);
    assertAppReleaseAdminKey(payload.adminKey);

    try {
      await prisma.appRelease.delete({
        where: { id: payload.id },
      });

      return ok({ id: payload.id });
    } catch (error) {
      if (isPrismaMissingTableError(error)) {
        throw new ApiError("App release storage is not ready. Run the latest Prisma migration first.", 503);
      }

      throw error;
    }
  });
}

export async function PATCH(request: Request) {
  return runRoute(async () => {
    const payload = await parseJson(request, appReleaseUpdateSchema);
    assertAppReleaseAdminKey(payload.adminKey);

    try {
      const release = await prisma.$transaction(async (transaction) => {
        if (payload.isActive ?? true) {
          await transaction.appRelease.updateMany({
            where: {
              platform: payload.platform,
              isActive: true,
              id: { not: payload.id },
            },
            data: {
              isActive: false,
            },
          });
        }

        return transaction.appRelease.update({
          where: { id: payload.id },
          data: {
            version: payload.version.trim(),
            platform: payload.platform,
            downloadUrl: payload.downloadUrl,
            releaseNotes: payload.releaseNotes?.trim() || null,
            isRequired: payload.isRequired ?? false,
            isActive: payload.isActive ?? true,
          },
        });
      });

      return ok(release);
    } catch (error) {
      if (isPrismaMissingTableError(error)) {
        throw new ApiError("App release storage is not ready. Run the latest Prisma migration first.", 503);
      }

      throw error;
    }
  });
}

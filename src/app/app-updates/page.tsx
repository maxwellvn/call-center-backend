import type { AppRelease } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { isPrismaMissingTableError } from "@/lib/prisma-errors";
import { sortAppReleasesDescending } from "@/lib/app-releases";

import { AppReleaseManager } from "./AppReleaseManager";

export const dynamic = "force-dynamic";

export default async function AppUpdatesPage() {
  let releases: AppRelease[] = [];
  let setupRequired = false;

  try {
    releases = await prisma.appRelease.findMany({
      orderBy: [{ isActive: "desc" }, { createdAt: "desc" }],
    });
  } catch (error) {
    if (isPrismaMissingTableError(error)) {
      setupRequired = true;
    } else {
      throw error;
    }
  }

  return (
    <main
      style={{
        minHeight: "100vh",
        padding: "40px 20px 88px",
        background:
          "linear-gradient(180deg, #d9d9d9 0%, #7a99bc 28%, #10529b 76%, #0b3e78 100%)",
        color: "#1a202c",
        fontFamily:
          "\"Avenir Next\", \"Segoe UI\", ui-sans-serif, system-ui, sans-serif",
      }}
    >
      <div style={{ maxWidth: 980, margin: "0 auto", display: "grid", gap: 24 }}>
        <header
          style={{
            display: "grid",
            gap: 14,
            padding: "30px 28px",
            borderRadius: 28,
            background: "rgba(255,255,255,0.9)",
            border: "1px solid rgba(255,255,255,0.42)",
            boxShadow: "0 24px 60px rgba(11, 62, 120, 0.24)",
            backdropFilter: "blur(14px)",
          }}
        >
          <p style={{ margin: 0, letterSpacing: "0.18em", fontSize: 12, textTransform: "uppercase", color: "#10529b", fontWeight: 800 }}>
            Call Center App Releases
          </p>
          <h1 style={{ margin: 0, fontSize: "clamp(2.2rem, 5vw, 4rem)", lineHeight: 0.98 }}>App update control room</h1>
          <p style={{ margin: 0, maxWidth: 720, color: "#4a5568", lineHeight: 1.7 }}>
            Use this URL to publish a new app version and its download link. The mobile app will compare the installed
            version against the latest active release and guide users to install when needed.
          </p>
        </header>
        {setupRequired ? (
          <div
            style={{
              borderRadius: 24,
              padding: 18,
              background: "rgba(255,247,237,0.96)",
              color: "#9a3412",
              border: "1px solid rgba(154, 52, 18, 0.18)",
              boxShadow: "0 16px 40px rgba(11, 62, 120, 0.18)",
            }}
          >
            The app release table is not in the database yet. Run the latest Prisma migration, then refresh this page.
          </div>
        ) : null}
        <AppReleaseManager
          initialReleases={sortAppReleasesDescending(releases).map((release) => ({
            ...release,
            createdAt: release.createdAt.toISOString(),
          }))}
          adminKeyConfigured={Boolean(process.env.APP_RELEASE_ADMIN_KEY)}
        />
      </div>
    </main>
  );
}

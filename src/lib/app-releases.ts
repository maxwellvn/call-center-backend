import type { AppRelease } from "@prisma/client";

function parseVersion(version: string) {
  return version
    .split(".")
    .map((part) => Number.parseInt(part.replace(/[^\d].*$/, ""), 10))
    .map((part) => (Number.isFinite(part) ? part : 0));
}

export function compareVersions(left: string, right: string) {
  const leftParts = parseVersion(left);
  const rightParts = parseVersion(right);
  const length = Math.max(leftParts.length, rightParts.length);

  for (let index = 0; index < length; index += 1) {
    const leftPart = leftParts[index] ?? 0;
    const rightPart = rightParts[index] ?? 0;

    if (leftPart > rightPart) {
      return 1;
    }

    if (leftPart < rightPart) {
      return -1;
    }
  }

  return 0;
}

export function sortAppReleasesDescending<T extends Pick<AppRelease, "version" | "createdAt">>(releases: T[]) {
  return [...releases].sort((left, right) => {
    const versionComparison = compareVersions(right.version, left.version);

    if (versionComparison !== 0) {
      return versionComparison;
    }

    return new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime();
  });
}

export function isUpdateAvailable(currentVersion: string | null, latestVersion: string) {
  if (!currentVersion) {
    return true;
  }

  return compareVersions(latestVersion, currentVersion) > 0;
}

import { describe, expect, it } from "vitest";

import { compareVersions, isUpdateAvailable } from "@/lib/app-releases";

describe("app release helpers", () => {
  it("compares semantic-style versions numerically", () => {
    expect(compareVersions("1.0.10", "1.0.2")).toBeGreaterThan(0);
    expect(compareVersions("2.0.0", "2.0.0")).toBe(0);
    expect(compareVersions("1.0.0", "1.1.0")).toBeLessThan(0);
  });

  it("detects when an update should be shown", () => {
    expect(isUpdateAvailable("1.0.0", "1.0.1")).toBe(true);
    expect(isUpdateAvailable("1.0.1", "1.0.1")).toBe(false);
    expect(isUpdateAvailable(null, "1.0.1")).toBe(true);
  });
});

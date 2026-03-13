import { GoalMetricType } from "@prisma/client";

import { describe, expect, it } from "vitest";

import { computeLeaderboard } from "@/lib/leaderboard";

describe("business defaults", () => {
  it("caps goal fulfilment at 100 percent", () => {
    const leaderboard = computeLeaderboard(
      [{ assigneeId: "rep-1", targetValue: 10, achievedValue: 15, metricType: GoalMetricType.ALL }],
      [],
    );

    expect(leaderboard[0]?.goalRatio).toBe(100);
    expect(leaderboard[0]?.score).toBe(0);
  });
});

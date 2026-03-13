import { GoalMetricType } from "@prisma/client";

import { describe, expect, it } from "vitest";

import { computeLeaderboard } from "@/lib/leaderboard";

describe("computeLeaderboard", () => {
  it("awards 5 marks per weekly activity and ranks by marks", () => {
    const leaderboard = computeLeaderboard(
      [
        { assigneeId: "rep-1", targetValue: 10, achievedValue: 10, metricType: GoalMetricType.ALL },
        { assigneeId: "rep-2", targetValue: 10, achievedValue: 2, metricType: GoalMetricType.ALL },
      ],
      [
        { repId: "rep-1", activityType: "CALL" },
        { repId: "rep-2", activityType: "CALL" },
        { repId: "rep-2", activityType: "MESSAGE" },
        { repId: "rep-2", activityType: "CALL" },
      ],
    );

    expect(leaderboard[0]?.userId).toBe("rep-2");
    expect(leaderboard[0]?.marks).toBe(15);
    expect(leaderboard[0]?.callsLogged).toBe(2);
    expect(leaderboard[1]?.marks).toBe(5);
  });

  it("counts team goals toward every member in the assigned group", () => {
    const leaderboard = computeLeaderboard(
      [
        {
          assigneeId: null,
          ownerType: "TEAM",
          ownerGroupId: "group-a",
          targetValue: 10,
          achievedValue: 6,
          metricType: GoalMetricType.ALL,
        },
      ],
      [
        { repId: "rep-1", activityType: "CALL", groupIds: ["group-a"] },
        { repId: "rep-2", activityType: "MESSAGE", groupIds: ["group-a"] },
        { repId: "rep-3", activityType: "CALL", groupIds: ["group-b"] },
      ],
    );

    expect(leaderboard.find((entry) => entry.userId === "rep-1")?.goalRatio).toBe(60);
    expect(leaderboard.find((entry) => entry.userId === "rep-2")?.goalRatio).toBe(60);
    expect(leaderboard.find((entry) => entry.userId === "rep-3")?.goalRatio).toBe(0);
  });
});

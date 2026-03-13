import { GOAL_TIMELINES, currentPeriodKey, periodRangeFromKey, toWeekKey } from "@/lib/period";

export { toWeekKey };

export function currentWeekKey() {
  return currentPeriodKey(GOAL_TIMELINES.WEEKLY);
}

export function weekRangeFromKey(weekKey: string) {
  return periodRangeFromKey(GOAL_TIMELINES.WEEKLY, weekKey);
}

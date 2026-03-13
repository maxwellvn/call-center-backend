export const GOAL_TIMELINES = {
  DAILY: "DAILY",
  WEEKLY: "WEEKLY",
  MONTHLY: "MONTHLY",
  ANNUAL: "ANNUAL",
} as const;

export type GoalTimelineLike = typeof GOAL_TIMELINES[keyof typeof GOAL_TIMELINES];

export function toWeekKey(input: Date | string) {
  const date = typeof input === "string" ? new Date(input) : input;
  const temp = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const day = temp.getUTCDay() || 7;
  temp.setUTCDate(temp.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(temp.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil((((temp.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
  return `${temp.getUTCFullYear()}-W${String(weekNo).padStart(2, "0")}`;
}

export function toDayKey(input: Date | string) {
  const date = typeof input === "string" ? new Date(input) : input;
  return date.toISOString().slice(0, 10);
}

export function toMonthKey(input: Date | string) {
  const date = typeof input === "string" ? new Date(input) : input;
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}

export function toYearKey(input: Date | string) {
  const date = typeof input === "string" ? new Date(input) : input;
  return `${date.getUTCFullYear()}`;
}

export function currentPeriodKey(timeline: GoalTimelineLike) {
  const now = new Date();

  switch (timeline) {
    case GOAL_TIMELINES.DAILY:
      return toDayKey(now);
    case GOAL_TIMELINES.MONTHLY:
      return toMonthKey(now);
    case GOAL_TIMELINES.ANNUAL:
      return toYearKey(now);
    case GOAL_TIMELINES.WEEKLY:
    default:
      return toWeekKey(now);
  }
}

export function currentPeriodKeys() {
  return {
    DAILY: currentPeriodKey(GOAL_TIMELINES.DAILY),
    WEEKLY: currentPeriodKey(GOAL_TIMELINES.WEEKLY),
    MONTHLY: currentPeriodKey(GOAL_TIMELINES.MONTHLY),
    ANNUAL: currentPeriodKey(GOAL_TIMELINES.ANNUAL),
  };
}

export function periodRangeFromKey(timeline: GoalTimelineLike, periodKey: string) {
  switch (timeline) {
    case GOAL_TIMELINES.DAILY: {
      const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(periodKey);

      if (!match) {
        throw new Error(`Invalid day key: ${periodKey}`);
      }

      const start = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]), 0, 0, 0, 0));
      const end = new Date(start);
      end.setUTCDate(end.getUTCDate() + 1);
      return { start, end };
    }
    case GOAL_TIMELINES.MONTHLY: {
      const match = /^(\d{4})-(\d{2})$/.exec(periodKey);

      if (!match) {
        throw new Error(`Invalid month key: ${periodKey}`);
      }

      const start = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, 1, 0, 0, 0, 0));
      const end = new Date(Date.UTC(Number(match[1]), Number(match[2]), 1, 0, 0, 0, 0));
      return { start, end };
    }
    case GOAL_TIMELINES.ANNUAL: {
      const match = /^(\d{4})$/.exec(periodKey);

      if (!match) {
        throw new Error(`Invalid year key: ${periodKey}`);
      }

      const year = Number(match[1]);
      const start = new Date(Date.UTC(year, 0, 1, 0, 0, 0, 0));
      const end = new Date(Date.UTC(year + 1, 0, 1, 0, 0, 0, 0));
      return { start, end };
    }
    case GOAL_TIMELINES.WEEKLY:
    default: {
      const match = /^(\d{4})-W(\d{2})$/.exec(periodKey);

      if (!match) {
        throw new Error(`Invalid week key: ${periodKey}`);
      }

      const year = Number(match[1]);
      const week = Number(match[2]);
      const jan4 = new Date(Date.UTC(year, 0, 4));
      const jan4Day = jan4.getUTCDay() || 7;
      const weekOneMonday = new Date(jan4);
      weekOneMonday.setUTCDate(jan4.getUTCDate() - jan4Day + 1);

      const start = new Date(weekOneMonday);
      start.setUTCDate(weekOneMonday.getUTCDate() + (week - 1) * 7);
      start.setUTCHours(0, 0, 0, 0);

      const end = new Date(start);
      end.setUTCDate(start.getUTCDate() + 7);
      return { start, end };
    }
  }
}

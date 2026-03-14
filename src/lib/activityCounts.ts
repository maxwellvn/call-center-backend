type CountableReport = {
  activityType: string | null;
  durationSeconds?: number | null;
  outcome?: string | null;
  communicationSession?: {
    status?: string | null;
  } | null;
};

function normalizeOutcome(outcome?: string | null) {
  return outcome?.trim().toLowerCase() ?? "";
}

export function isNonCompletedCommunicationOutcome(outcome?: string | null) {
  const normalizedOutcome = normalizeOutcome(outcome);
  return normalizedOutcome === "canceled" || normalizedOutcome === "no response";
}

export function getCommunicationSessionStatusForReport(report: CountableReport) {
  if (report.activityType !== "CALL" && report.activityType !== "MESSAGE") {
    return null;
  }

  if (isNonCompletedCommunicationOutcome(report.outcome)) {
    return "CANCELED" as const;
  }

  if (report.activityType === "CALL" && Number(report.durationSeconds ?? 0) <= 0) {
    return "CANCELED" as const;
  }

  return "COMPLETED" as const;
}

export function isCountableActivity(report: CountableReport) {
  if (report.activityType !== "CALL" && report.activityType !== "MESSAGE") {
    return true;
  }

  if (report.communicationSession) {
    return report.communicationSession.status === "COMPLETED";
  }

  return !isNonCompletedCommunicationOutcome(report.outcome);
}

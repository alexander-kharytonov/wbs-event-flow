"use client";

import { useFormatter, useTranslations } from "next-intl";
import type { CheckInResult } from "@/features/attendance/check-in-result";

export function CheckInFeedback({
  result,
  timezone,
}: {
  result: CheckInResult;
  timezone: string;
}) {
  const t = useTranslations("events");
  const format = useFormatter();

  function dateLabel(value: string) {
    return format.dateTime(new Date(value), {
      dateStyle: "medium",
      timeStyle: "short",
      timeZone: timezone,
    });
  }

  switch (result.code) {
    case "CHECKED_IN":
      return t("checkInSuccess");
    case "ALREADY_CHECKED_IN":
      return t("checkInAlreadyAt", {
        date: dateLabel(result.checkedInAt),
        timezone,
      });
    case "INVALID_CREDENTIAL":
      return t("checkInInvalid");
    case "WRONG_EVENT":
      return t("checkInWrongEvent");
    case "ADMISSION_REVOKED":
      return t("checkInRevoked");
    case "EVENT_CANCELLED":
      return t("checkInCancelled");
    case "CHECK_IN_NOT_OPEN":
    case "CHECK_IN_CLOSED":
      return t(
        result.code === "CHECK_IN_NOT_OPEN" ? "checkInOpens" : "checkInClosed",
        { date: dateLabel(result.boundaryAt), timezone },
      );
    case "UNAVAILABLE":
      return t("checkInUnavailable");
    case "FAILED":
      return t("checkInFailed");
  }
}

export function CheckInWindow({
  opens,
  date,
  timezone,
}: {
  opens: boolean;
  date: Date | string;
  timezone: string;
}) {
  const t = useTranslations("events");
  const format = useFormatter();

  return t(opens ? "scannerOpens" : "scannerClosed", {
    date: format.dateTime(new Date(date), {
      timeZone: timezone,
      dateStyle: "medium",
      timeStyle: "short",
    }),
    timezone,
  });
}

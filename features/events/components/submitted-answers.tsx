"use client";

import { Alert, Box, Typography } from "@mui/material";
import { useFormatter, useTranslations } from "next-intl";
import type { HistoricalAnswer } from "@/features/events/historical-answers";

export function SubmittedAnswers({
  answers,
}: {
  answers: HistoricalAnswer[] | null;
}) {
  const t = useTranslations("events");
  const format = useFormatter();

  if (answers === null) {
    return <Alert severity="warning">{t("answerUnavailable")}</Alert>;
  }

  if (answers.length === 0) {
    return <Typography color="text.secondary">{t("answersNone")}</Typography>;
  }

  return (
    <Box component="dl" sx={{ m: 0 }}>
      {answers.map((answer, index) => (
        <Box
          key={answer.fieldId}
          sx={{
            display: "grid",
            gridTemplateColumns: {
              xs: "minmax(0, 1fr)",
              sm: "minmax(0, 2fr) minmax(0, 3fr)",
            },
            columnGap: 3,
            rowGap: 0.75,
            py: 2,
            borderTop: 1,
            borderColor: "divider",
            overflowWrap: "anywhere",
          }}
        >
          <Typography component="dt" variant="body2" color="text.secondary">
            {format.number(index + 1)}.{" "}
            {answer.label ?? t("answerQuestionUnavailable")}
          </Typography>
          <Typography
            component="dd"
            sx={{ m: 0, whiteSpace: "pre-wrap" }}
            color={answer.state !== "VALUE" ? "text.secondary" : "text.primary"}
          >
            {answer.state === "UNAVAILABLE"
              ? t("answerUnavailable")
              : answer.state === "NOT_PROVIDED"
                ? t("answerNotProvided")
                : typeof answer.value === "boolean"
                  ? t(answer.value ? "yes" : "no")
                  : answer.value}
          </Typography>
        </Box>
      ))}
    </Box>
  );
}

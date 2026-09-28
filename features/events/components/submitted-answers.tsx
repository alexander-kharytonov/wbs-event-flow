import { Alert, Box, Typography } from "@mui/material";

export function SubmittedAnswers({
  answers,
}: {
  answers: { fieldId: string; label: string; value: string }[] | null;
}) {
  if (answers === null) {
    return <Alert severity="warning">Answer unavailable</Alert>;
  }

  if (answers.length === 0) {
    return (
      <Typography color="text.secondary">
        There were no additional questions on this registration form.
      </Typography>
    );
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
            {index + 1}. {answer.label}
          </Typography>
          <Typography
            component="dd"
            sx={{ m: 0, whiteSpace: "pre-wrap" }}
            color={
              answer.value === "Answer unavailable" ||
              answer.value === "Not provided"
                ? "text.secondary"
                : "text.primary"
            }
          >
            {answer.value}
          </Typography>
        </Box>
      ))}
    </Box>
  );
}

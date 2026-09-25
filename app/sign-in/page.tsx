import { Alert, Stack } from "@mui/material";
import { AuthForm } from "../auth-form";

export default async function SignInPage({
  searchParams,
}: PageProps<"/sign-in">) {
  const { verification, error } = await searchParams;

  return (
    <Stack spacing={3}>
      {(verification === "required" || error) && (
        <Alert severity="info">
          Verify your email before continuing. Sign in to request a new
          verification link.
        </Alert>
      )}
      <AuthForm mode="sign-in" />
    </Stack>
  );
}

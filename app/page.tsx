import { Alert, Button, Link, Stack, Typography } from "@mui/material";
import { getSession } from "@/lib/session";

export default async function Home({ searchParams }: PageProps<"/">) {
  const session = await getSession();
  const { error } = await searchParams;

  return (
    <Stack spacing={3}>
      <Typography variant="h3" component="h1">
        Event Flow
      </Typography>
      {error && (
        <Alert severity="error">
          The verification link is invalid or expired. Sign in to request a new
          verification email.
        </Alert>
      )}
      {session ? (
        <Button href="/dashboard" variant="contained">
          Go to dashboard
        </Button>
      ) : (
        <Stack component="nav" spacing={2}>
          <Button href="/register" variant="contained">
            Register as an organizer
          </Button>
          <Link href="/sign-in">Sign in</Link>
        </Stack>
      )}
    </Stack>
  );
}

import { Box, Container, Link, Stack, Typography } from "@mui/material";
import { getSession } from "@/lib/session";
import { SignOut } from "./sign-out";
import { ThemeControl } from "./theme-control";

export async function ApplicationShell({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getSession();

  return (
    <>
      <Box
        component="header"
        sx={{ borderBottom: 1, borderColor: "divider", py: 2 }}
      >
        <Container maxWidth="md">
          <Stack
            direction="row"
            useFlexGap
            sx={{ gap: 2, flexWrap: "wrap", alignItems: "center" }}
          >
            <Link
              href={session ? "/dashboard" : "/"}
              underline="none"
              color="inherit"
              variant="h6"
              sx={{ mr: "auto" }}
            >
              Event Flow
            </Link>
            <ThemeControl />
            {session && (
              <>
                <Typography sx={{ overflowWrap: "anywhere" }}>
                  {session.user.name}
                </Typography>
                <SignOut />
              </>
            )}
          </Stack>
        </Container>
      </Box>
      <Container component="main" maxWidth="sm" sx={{ py: { xs: 4, sm: 8 } }}>
        {children}
      </Container>
    </>
  );
}

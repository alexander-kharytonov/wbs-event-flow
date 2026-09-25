import { Box, Container, Link, Stack, Typography } from "@mui/material";
import { ThemeControl } from "@/components/ui/theme-control";
import { SignOut } from "@/features/auth/components/sign-out";
import { getSession } from "@/lib/session";

export async function ApplicationHeader() {
  const session = await getSession();

  return (
    <Box
      component="header"
      sx={{ borderBottom: 1, borderColor: "divider", py: 1.5 }}
    >
      <Container maxWidth="md">
        <Stack
          direction="row"
          useFlexGap
          sx={{ gap: 1, flexWrap: "wrap", alignItems: "center" }}
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
            <Stack
              direction="row"
              spacing={1}
              sx={{
                alignItems: "center",
                minWidth: 0,
                maxWidth: "100%",
                pl: 1,
                borderLeft: 1,
                borderColor: "divider",
              }}
            >
              <Typography
                variant="body2"
                sx={{ overflowWrap: "anywhere", minWidth: 0 }}
              >
                {session.user.name}
              </Typography>
              <SignOut />
            </Stack>
          )}
        </Stack>
      </Container>
    </Box>
  );
}

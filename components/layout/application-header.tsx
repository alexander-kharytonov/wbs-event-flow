import { Box, Button, Container, Divider, Link, Stack } from "@mui/material";
import { ThemeControl } from "@/components/ui/theme-control";
import { AccountMenu } from "@/features/auth/components/account-menu";
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
          <Divider
            orientation="vertical"
            sx={{ minHeight: 28, my: 1, display: { xs: "none", sm: "block" } }}
            flexItem
          />
          {session ? (
            <AccountMenu name={session.user.name} />
          ) : (
            <Button href="/sign-in">Sign in</Button>
          )}
        </Stack>
      </Container>
    </Box>
  );
}

import { Box, Container, Link, Stack } from "@mui/material";
import { ApplicationFooter } from "@/components/layout/application-footer";
import { ThemeControl } from "@/components/ui/theme-control";

export default function PublicLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <Box sx={{ minHeight: "100dvh", display: "flex", flexDirection: "column" }}>
      <Box
        component="header"
        sx={{ borderBottom: 1, borderColor: "divider", py: 1.5 }}
      >
        <Container maxWidth="md">
          <Stack
            direction="row"
            sx={{ alignItems: "center", justifyContent: "space-between" }}
          >
            <Link href="/" underline="none" color="inherit" variant="h6">
              Event Flow
            </Link>
            <ThemeControl />
          </Stack>
        </Container>
      </Box>
      <Container
        component="main"
        maxWidth="md"
        sx={{ py: { xs: 3, sm: 5 }, flex: "1 0 auto" }}
      >
        {children}
      </Container>
      <ApplicationFooter />
    </Box>
  );
}

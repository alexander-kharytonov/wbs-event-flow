import { ArrowForward } from "@mui/icons-material";
import { Box, Container, Link, Stack, Typography } from "@mui/material";
import { Logo } from "@/components/ui/logo";

export function ApplicationFooter() {
  return (
    <Box
      component="footer"
      sx={{
        borderTop: 1,
        borderColor: "divider",
        bgcolor: "background.paper",
        flexShrink: 0,
      }}
    >
      <Container maxWidth="lg">
        <Stack
          direction={{ xs: "column", md: "row" }}
          sx={{
            py: { xs: 3, sm: 4 },
            gap: 3,
            justifyContent: "space-between",
            alignItems: { xs: "flex-start", md: "center" },
          }}
        >
          <Stack spacing={1} sx={{ alignItems: "flex-start" }}>
            <Logo />
            <Typography variant="body2" color="text.secondary">
              Bring people together. Keep the details in flow.
            </Typography>
          </Stack>
          <Stack
            component="nav"
            aria-label="Footer navigation"
            direction="row"
            sx={{
              gap: { xs: 2.5, sm: 3 },
              flexWrap: "wrap",
              alignItems: "center",
            }}
          >
            <Link
              href="/#how-it-works"
              color="text.secondary"
              underline="hover"
            >
              How it works
            </Link>
            <Link href="/#questions" color="text.secondary" underline="hover">
              FAQ
            </Link>
            <Link
              href="/e"
              underline="hover"
              sx={{
                display: "inline-flex",
                alignItems: "center",
                gap: 0.75,
                fontWeight: 600,
              }}
            >
              Explore events
              <ArrowForward sx={{ fontSize: 18 }} />
            </Link>
          </Stack>
        </Stack>
        <Stack
          direction={{ xs: "column", sm: "row" }}
          sx={{
            borderTop: 1,
            borderColor: "divider",
            py: 2,
            gap: 1,
            justifyContent: "space-between",
            color: "text.secondary",
          }}
        >
          <Typography variant="caption">
            © {new Date().getFullYear()} Event Flow
          </Typography>
          <Typography variant="caption" sx={{ letterSpacing: "0.04em" }}>
            Create. Connect. Welcome.
          </Typography>
        </Stack>
      </Container>
    </Box>
  );
}

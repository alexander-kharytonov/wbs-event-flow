import { Box, Container, Typography } from "@mui/material";

export function ApplicationFooter() {
  return (
    <Box
      component="footer"
      sx={{ borderTop: 1, borderColor: "divider", py: 2, flexShrink: 0 }}
    >
      <Container maxWidth="md">
        <Typography variant="body2" color="text.secondary">
          © {new Date().getFullYear()} Event Flow
        </Typography>
      </Container>
    </Box>
  );
}

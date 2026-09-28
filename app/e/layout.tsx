import { Box, Container } from "@mui/material";
import { ApplicationFooter } from "@/components/layout/application-footer";
import { ApplicationHeader } from "@/components/layout/application-header";

export default function PublicLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <Box sx={{ minHeight: "100dvh", display: "flex", flexDirection: "column" }}>
      <ApplicationHeader />
      <Container
        component="main"
        id="main-content"
        tabIndex={-1}
        maxWidth="lg"
        sx={{ py: { xs: 3, sm: 5 }, flex: "1 0 auto" }}
      >
        {children}
      </Container>
      <ApplicationFooter />
    </Box>
  );
}

import { Container, Typography } from "@mui/material";

export default function TicketNotFound() {
  return (
    <Container component="main" maxWidth="sm" sx={{ py: 6 }}>
      <Typography variant="h4" component="h1" gutterBottom>
        Ticket unavailable
      </Typography>
      <Typography color="text.secondary">
        This private link is invalid or unavailable.
      </Typography>
    </Container>
  );
}

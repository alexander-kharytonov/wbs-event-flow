import { Box, Link } from "@mui/material";
import type { MouseEventHandler } from "react";

export function Logo({
  onClick,
}: {
  onClick?: MouseEventHandler<HTMLAnchorElement>;
}) {
  return (
    <Link
      href="/"
      aria-label="Event Flow home"
      underline="none"
      color="text.primary"
      variant="h6"
      onClick={onClick}
      sx={{ fontWeight: 750, letterSpacing: "-0.04em", whiteSpace: "nowrap" }}
    >
      Event
      <Box component="span" sx={{ color: "primary.main" }}>
        {" "}
        Flow
      </Box>
      .
    </Link>
  );
}

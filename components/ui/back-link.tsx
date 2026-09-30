import ArrowBack from "@mui/icons-material/ArrowBack";
import { Link } from "@mui/material";
import type { ReactNode } from "react";

export function BackLink({
  href,
  children,
}: {
  href: string;
  children: ReactNode;
}) {
  return (
    <Link
      href={href}
      sx={{
        display: "inline-flex",
        alignItems: "center",
        alignSelf: "flex-start",
        gap: 0.75,
      }}
    >
      <ArrowBack sx={{ fontSize: "1em" }} />
      {children}
    </Link>
  );
}

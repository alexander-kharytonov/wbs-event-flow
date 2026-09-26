"use client";

import { Button, Link } from "@mui/material";
import NextLink from "next/link";

export function ApplicationDetailLink({
  href,
  fullName,
  button = false,
}: {
  href: string;
  fullName: string;
  button?: boolean;
}) {
  if (button) {
    return (
      <Button
        component={NextLink}
        href={href}
        scroll={false}
        aria-label={`View application from ${fullName}`}
      >
        View
      </Button>
    );
  }

  return (
    <Link component={NextLink} href={href} scroll={false} variant="subtitle1">
      {fullName}
    </Link>
  );
}

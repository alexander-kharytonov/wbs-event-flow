"use client";

import { Box, Stack } from "@mui/material";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { EditorNavigationGuard } from "@/components/ui/editor-navigation-guard";
import { PageHeader } from "@/components/ui/page-header";
import { AccountNavigation } from "@/features/auth/components/account-navigation";

export function AccountWorkspace({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const active = pathname.startsWith("/account/registrations")
    ? "registrations"
    : pathname === "/account/profile"
      ? "profile"
      : "overview";

  return (
    <EditorNavigationGuard description="Your unsaved profile changes will be lost.">
      <Stack spacing={3}>
        <PageHeader title="My account" />
        <Box
          sx={{
            bgcolor: "background.paper",
            border: 1,
            borderColor: "divider",
            borderRadius: 1,
            display: "grid",
            gridTemplateColumns: {
              xs: "minmax(0, 1fr)",
              md: "240px minmax(0, 1fr)",
            },
          }}
        >
          <Box
            sx={{
              minWidth: 0,
              borderStyle: "solid",
              borderWidth: 0,
              borderRightWidth: { md: 1 },
              borderBottomWidth: { xs: 1, md: 0 },
              borderColor: "divider",
            }}
          >
            <AccountNavigation active={active} />
          </Box>
          <Box
            id="account-panel"
            role="tabpanel"
            aria-labelledby={`account-nav-${active}`}
            tabIndex={0}
            sx={{ minWidth: 0, p: { xs: 2, sm: 4 } }}
          >
            {children}
          </Box>
        </Box>
      </Stack>
    </EditorNavigationGuard>
  );
}

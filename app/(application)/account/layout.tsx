import type { ReactNode } from "react";
import { AccountWorkspace } from "@/features/auth/components/account-workspace";

export default function AccountLayout({ children }: { children: ReactNode }) {
  return <AccountWorkspace>{children}</AccountWorkspace>;
}

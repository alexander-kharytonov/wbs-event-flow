import type { ReactNode } from "react";

export default function DashboardLayout({
  children,
  eventModal,
}: {
  children: ReactNode;
  eventModal: ReactNode;
}) {
  return (
    <>
      {children}
      {eventModal}
    </>
  );
}

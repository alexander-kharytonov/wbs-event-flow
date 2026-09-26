import type { ReactNode } from "react";

export default function EventLayout({
  children,
  applicationModal,
}: {
  children: ReactNode;
  applicationModal: ReactNode;
}) {
  return (
    <>
      {children}
      {applicationModal}
    </>
  );
}

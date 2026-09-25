import "server-only";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireVerifiedUser } from "@/lib/session";

export async function requireOrganizer() {
  const user = await requireVerifiedUser();
  const organizer = await prisma.organizerProfile.findUnique({
    where: { userId: user.id },
    select: { id: true },
  });

  if (!organizer) {
    redirect("/onboarding/organizer");
  }

  return organizer;
}

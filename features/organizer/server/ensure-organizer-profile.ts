import "server-only";
import { prisma } from "@/lib/prisma";

export async function ensureOrganizerProfile(userId: string) {
  // PostgreSQL ON CONFLICT DO NOTHING and UNIQUE(userId) also cover concurrent
  // onboarding requests, without modifying an existing profile's timestamps.
  await prisma.organizerProfile.createMany({
    data: [{ userId }],
    skipDuplicates: true,
  });
}

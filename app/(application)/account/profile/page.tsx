import type { Metadata } from "next";
import { ProfileForm } from "@/features/auth/components/profile-form";
import { requireVerifiedUser } from "@/lib/session";

export const metadata: Metadata = { title: "My profile | Event Flow" };

export default async function ProfilePage() {
  const user = await requireVerifiedUser();

  return <ProfileForm name={user.name} email={user.email} />;
}

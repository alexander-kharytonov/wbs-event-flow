import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { ProfileForm } from "@/features/auth/components/profile-form";
import { requireVerifiedUser } from "@/lib/session";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("auth");

  return { title: `${t("profile")} | Event Flow` };
}

export default async function ProfilePage() {
  const user = await requireVerifiedUser();

  return <ProfileForm name={user.name} email={user.email} />;
}

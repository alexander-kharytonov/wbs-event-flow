import { redirect } from "next/navigation";
import { ensureOrganizerProfile } from "@/features/organizer/server/ensure-organizer-profile";
import { requireVerifiedUser } from "@/lib/session";

export async function GET() {
  const user = await requireVerifiedUser();
  await ensureOrganizerProfile(user.id);
  redirect("/dashboard");
}

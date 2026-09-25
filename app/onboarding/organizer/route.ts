import { redirect } from "next/navigation";
import { ensureOrganizerProfile } from "@/lib/organizer";
import { requireVerifiedUser } from "@/lib/session";

export async function GET() {
  const user = await requireVerifiedUser();
  await ensureOrganizerProfile(user.id);
  redirect("/dashboard");
}

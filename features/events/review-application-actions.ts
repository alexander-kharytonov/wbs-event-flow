"use server";

import { revalidatePath } from "next/cache";
import { reviewEventApplication } from "@/features/events/server/review-application";
import { requireVerifiedUser } from "@/lib/session";

async function review(input: unknown, decision: "APPROVED" | "REJECTED") {
  const user = await requireVerifiedUser();
  const result = await reviewEventApplication(user.id, input, decision);

  if (
    result.success ||
    result.code === "ALREADY_REVIEWED" ||
    result.code === "CAPACITY_REACHED"
  ) {
    revalidatePath("/dashboard/events/[id]", "layout");
    revalidatePath("/e/[publicId]", "page");
  }

  return result;
}

export async function approveApplication(input: unknown) {
  return review(input, "APPROVED");
}

export async function rejectApplication(input: unknown) {
  return review(input, "REJECTED");
}

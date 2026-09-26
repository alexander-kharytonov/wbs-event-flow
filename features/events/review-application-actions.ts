"use server";

import { revalidatePath } from "next/cache";
import { reviewOwnedApplication } from "@/features/events/server/review-application";
import { requireOrganizer } from "@/features/organizer/server/require-organizer";

async function review(input: unknown, decision: "APPROVED" | "REJECTED") {
  const organizer = await requireOrganizer();
  const result = await reviewOwnedApplication(organizer.id, input, decision);

  if (
    result.success ||
    result.code === "ALREADY_REVIEWED" ||
    result.code === "CAPACITY_REACHED"
  ) {
    revalidatePath("/dashboard/events/[id]", "layout");
  }

  return result;
}

export async function approveApplication(input: unknown) {
  return review(input, "APPROVED");
}

export async function rejectApplication(input: unknown) {
  return review(input, "REJECTED");
}

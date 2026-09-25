"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireOrganizer } from "@/features/organizer/server/require-organizer";
import { prisma } from "@/lib/prisma";
import { createEventSchema } from "./create-event-schema";

export type CreateEventState = {
  errors?: Record<string, string[]>;
  message?: string;
};

export async function createEvent(
  _previous: CreateEventState,
  formData: FormData,
): Promise<CreateEventState> {
  const organizer = await requireOrganizer();
  const parsed = createEventSchema.safeParse(Object.fromEntries(formData));

  if (!parsed.success) {
    const errors: Record<string, string[]> = {};

    for (const issue of parsed.error.issues) {
      const field = String(issue.path[0]);
      errors[field] = [...(errors[field] ?? []), issue.message];
    }

    return { errors, message: "Please correct the highlighted fields." };
  }

  let eventId: string;

  try {
    const event = await prisma.event.create({
      data: { ...parsed.data, organizerId: organizer.id, publishedAt: null },
      select: { id: true },
    });
    eventId = event.id;
  } catch {
    return { message: "We couldn’t save your event. Please try again." };
  }

  revalidatePath("/dashboard");
  redirect(`/dashboard/events/${eventId}`);
}

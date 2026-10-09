"use server";

import { revalidatePath } from "next/cache";
import {
  parseTemplateText,
  templateCreateInput,
} from "@/features/events/import/template-input";
import {
  createTemplateEvent,
  type TemplateCreateResult,
} from "@/features/events/server/create-template-event";
import { requireOrganizer } from "@/features/organizer/server/require-organizer";
import { requireVerifiedUser } from "@/lib/session";

export async function importTemplate(
  formData: FormData,
): Promise<TemplateCreateResult> {
  const organizer = await requireOrganizer();
  const user = await requireVerifiedUser();
  const parsed = parseTemplateText(formData.get("template"));

  if (!parsed.success) {
    return parsed;
  }

  const result = await createTemplateEvent(
    user.id,
    organizer.id,
    templateCreateInput(parsed.template.event, parsed.sourceVersion),
  );

  if (result.success) {
    revalidatePath("/dashboard");
  }

  return result;
}

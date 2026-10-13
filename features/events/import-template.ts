"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import {
  parseTemplateText,
  templateCreateInput,
} from "@/features/events/import/template-input";
import { creationInput } from "@/features/events/server/create-event-with-cover";
import {
  createTemplateEvent,
  type TemplateCreateResult,
} from "@/features/events/server/create-template-event";
import { isEventPasswordOrigin } from "@/features/events/server/event-password-session";
import { requireOrganizer } from "@/features/organizer/server/require-organizer";
import { requireVerifiedUser } from "@/lib/session";

export async function importTemplate(
  formData: FormData,
): Promise<TemplateCreateResult> {
  const organizer = await requireOrganizer();
  const user = await requireVerifiedUser();

  if (!isEventPasswordOrigin(await headers())) {
    return {
      success: false,
      issues: [
        {
          code: "create_failed",
          path: "template",
          message: "templateCreateFailed",
        },
      ],
    };
  }
  const parsed = parseTemplateText(formData.get("template"));

  if (!parsed.success) {
    return parsed;
  }

  const result = await createTemplateEvent(
    user.id,
    organizer.id,
    templateCreateInput(parsed.template.event),
    creationInput(formData),
  );

  if (result.success) {
    revalidatePath("/dashboard");
  }

  return result;
}

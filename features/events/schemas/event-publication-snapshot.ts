import { eventSnapshotV2Schema } from "@/features/events/schemas/event-snapshot";
import {
  isChoice,
  registrationFieldSchema,
} from "@/features/events/schemas/registration-form";

// New publications satisfy the frozen v2 contract AND today's authoring rules.
export const eventPublicationSnapshotSchema = eventSnapshotV2Schema.superRefine(
  (event, ctx) => {
    for (const [index, field] of event.registrationForm.fields.entries()) {
      const validated = registrationFieldSchema.safeParse({
        label: field.label,
        type: field.type,
        required: field.required,
        description: field.description ?? "",
        ...(isChoice(field.type)
          ? { options: field.options.map(({ label }) => ({ label })) }
          : {}),
      });

      if (!validated.success) {
        for (const issue of validated.error.issues) {
          ctx.addIssue({
            code: "custom",
            path: ["registrationForm", "fields", index, ...issue.path],
            message: issue.message,
          });
        }
      }
    }

    for (const field of [
      "registrationOpensAt",
      "registrationClosesAt",
    ] as const) {
      if (event[field] && Date.parse(event[field]) > Date.parse(event.endsAt)) {
        ctx.addIssue({
          code: "custom",
          path: [field],
          message: "Registration must not extend beyond the event end.",
        });
      }
    }
  },
);

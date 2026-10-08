import "server-only";
import { z } from "zod";

export const communicationKindSchema = z.enum(["MANUAL", "TRANSACTIONAL"]);

export const communicationTriggerSchema = z.enum([
  "EVENT_CANCELLED",
  "APPLICATION_RECEIVED",
  "NEW_APPLICATION",
  "APPLICATION_APPROVED",
  "APPLICATION_REJECTED",
]);

export const manualAudienceSchema = z.enum([
  "ALL_ACTIVE_ATTENDEES",
  "PRIMARY_ATTENDEES",
  "CHECKED_IN",
  "NOT_ARRIVED",
  "PENDING_APPLICATIONS",
  "EVENT_STAFF",
]);

// Count Unicode code points, not UTF-16 code units. Reject unpaired surrogates.
function unicodeText(max: number) {
  return z
    .string()
    .refine(
      (value) =>
        value.isWellFormed() &&
        [...value].length >= 1 &&
        [...value].length <= max,
      `Use 1–${max} Unicode characters.`,
    );
}

// Bidi/zero-width formatting used for spoofing is not accepted in mail headers.
export const communicationSubjectSchema = unicodeText(200).refine(
  (value) => !/[\p{Cc}\p{Cf}\p{Zl}\p{Zp}]/u.test(value),
  "Subject must be a single line without control characters.",
);

export const manualMessageSchema = z
  .string()
  .transform((value) => value.replace(/\r\n/g, "\n"))
  .pipe(unicodeText(10_000))
  .refine(
    (value) =>
      !/\p{Cc}/u.test(value.replace(/[\n\t]/g, "")) &&
      !/[\u202a-\u202e\u2066-\u2069\ufeff]/u.test(value),
    "Message contains unsafe control characters.",
  );

// The future client command has content/audience only; never sender or recipients.
export const manualContentSchema = z.strictObject({
  subject: communicationSubjectSchema,
  message: manualMessageSchema,
});

export const manualContextSchema = z.strictObject({
  schemaVersion: z.literal(1),
  kind: z.literal("MANUAL"),
  eventTitle: z.string().min(1).max(200),
});

// Semantic history, deliberately separate from delivery payloads and Ticket CTA.
// No URL, Ticket reference, auth field, arbitrary JSON or recipient relation.
export const transactionalContextSchema = z.strictObject({
  schemaVersion: z.literal(1),
  kind: z.literal("TRANSACTIONAL"),
  trigger: communicationTriggerSchema,
  eventTitle: z.string().min(1).max(200).optional(),
});

export const communicationContextSchema = z.discriminatedUnion("kind", [
  manualContextSchema,
  transactionalContextSchema,
]);

export const actorSnapshotSchema = z
  .strictObject({
    actorUserId: z.uuid().nullable(),
    actorNameSnapshot: z.string().min(1).nullable(),
    actorRoleSnapshot: z.enum(["OWNER", "MANAGER", "RECEPTION"]).nullable(),
  })
  .refine(
    (value) =>
      (value.actorNameSnapshot === null) ===
        (value.actorRoleSnapshot === null) &&
      (value.actorUserId === null || value.actorNameSnapshot !== null),
    "Actor name and role must be captured together.",
  );

export const idempotencyKeySchema = z
  .string()
  .min(1)
  .max(200)
  .regex(/^[A-Za-z0-9:._-]+$/);

export const requestDigestSchema = z.string().regex(/^[a-f0-9]{64}$/);

export const deliveryAssociationSchema = z.strictObject({
  communicationId: z.uuid(),
  recipientEmail: z
    .email()
    .refine((value) => value === value.trim().toLowerCase()),
});

export type CommunicationKind = z.infer<typeof communicationKindSchema>;
export type CommunicationTrigger = z.infer<typeof communicationTriggerSchema>;
export type ManualAudience = z.infer<typeof manualAudienceSchema>;
export type ManualContent = z.infer<typeof manualContentSchema>;
export type CommunicationContext = z.infer<typeof communicationContextSchema>;
export type ActorSnapshot = z.infer<typeof actorSnapshotSchema>;
export type DeliveryAssociation = z.infer<typeof deliveryAssociationSchema>;

export function normalizeRecipientEmails(emails: readonly string[]) {
  return [
    ...new Set(
      emails.map((email) => z.email().parse(email.trim().toLowerCase())),
    ),
  ].sort();
}

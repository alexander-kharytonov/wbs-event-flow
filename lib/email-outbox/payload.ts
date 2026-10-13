import { z } from "zod";
import { locales } from "@/lib/i18n/locale";
import english from "@/lib/i18n/messages/email/en.json";

// Every delivery freezes its recipient locale at enqueue.
const locale = z.enum(locales);

export const manualEmailPayload = z.strictObject({ locale });

// Frozen email contracts, independent of future event authoring rules.
const title = z.string().min(1).max(200);
const publicId = z.uuid();
const event = z.strictObject({
  title,
  startsAt: z.iso.datetime({ precision: 3 }),
  endsAt: z.iso.datetime({ precision: 3 }),
  timezone: z.string().refine((value) => {
    try {
      new Intl.DateTimeFormat("en", { timeZone: value });

      return true;
    } catch {
      return false;
    }
  }),
  publicId,
});

export const applicationReceivedPayload = z.strictObject({
  locale,
  schemaVersion: z.literal(1),
  applicantName: z.string().min(1),
  event,
  linkedApplicant: z.boolean(),
  applicationId: z.uuid(),
});

export const newApplicationPayload = z.strictObject({
  locale,
  schemaVersion: z.literal(1),
  applicantName: z.string().min(1),
  event,
  eventId: z.uuid(),
});

// The approval writer always creates the current ticket-backed payload.
export const applicationApprovedPayload = z.strictObject({
  locale,
  schemaVersion: z.literal(2),
  applicantName: z.string().min(1),
  event,
  ticketId: z.uuid(),
});

// Rejection must not depend on a current publication or usable public link.
// Even a damaged historical snapshot cannot introduce a new Reject guard.
export const applicationRejectedPayload = z.strictObject({
  locale,
  schemaVersion: z.literal(1),
  applicantName: z.string(),
  eventTitle: title.optional(),
  publicId: publicId.optional(),
});

export const eventCancelledPayload = z.strictObject({
  locale,
  schemaVersion: z.literal(1),
  applicantName: z.string().min(1),
  event: event.omit({ publicId: true }),
  cancellationReason: z.string().trim().min(1).max(2000),
  publicId: publicId.optional(),
});

export const emailPayloadSchemas = {
  EVENT_CANCELLED: eventCancelledPayload,
  APPLICATION_RECEIVED: applicationReceivedPayload,
  NEW_APPLICATION: newApplicationPayload,
  APPLICATION_APPROVED: applicationApprovedPayload,
  APPLICATION_REJECTED: applicationRejectedPayload,
};

export function rejectionEventTitle(snapshot: unknown) {
  const parsed = z
    .object({
      title,
    })
    .safeParse(snapshot);

  return parsed.success ? parsed.data.title : undefined;
}

// Stable English history labels. Recipient subjects come from email dictionaries.
export const transactionalEmailSubjects = {
  APPLICATION_RECEIVED: english.receivedSubject,
  NEW_APPLICATION: english.organizerSubject,
  APPLICATION_APPROVED: english.approvedSubject,
  APPLICATION_REJECTED: english.rejectedSubject,
  EVENT_CANCELLED: english.cancelledSubject,
} as const;

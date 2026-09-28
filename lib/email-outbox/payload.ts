import { z } from "zod";

// Frozen v1 email contracts, independent of future event authoring rules.
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
  schemaVersion: z.literal(1),
  applicantName: z.string().min(1),
  event,
  linkedApplicant: z.boolean(),
});

export const newApplicationPayload = z.strictObject({
  schemaVersion: z.literal(1),
  applicantName: z.string().min(1),
  event,
  eventId: z.uuid(),
});

export const applicationApprovedPayload = z.strictObject({
  schemaVersion: z.literal(1),
  applicantName: z.string().min(1),
  event,
});

// Rejection must not depend on a current publication or usable public link.
// Even a damaged historical snapshot cannot introduce a new Reject guard.
export const applicationRejectedPayload = z.strictObject({
  schemaVersion: z.literal(1),
  applicantName: z.string(),
  eventTitle: title.optional(),
  publicId: publicId.optional(),
});

export const emailPayloadSchemas = {
  APPLICATION_RECEIVED: applicationReceivedPayload,
  NEW_APPLICATION: newApplicationPayload,
  APPLICATION_APPROVED: applicationApprovedPayload,
  APPLICATION_REJECTED: applicationRejectedPayload,
};

export function rejectionEventTitle(snapshot: unknown) {
  const parsed = z
    .object({ schemaVersion: z.literal(1), title })
    .safeParse(snapshot);

  return parsed.success ? parsed.data.title : undefined;
}

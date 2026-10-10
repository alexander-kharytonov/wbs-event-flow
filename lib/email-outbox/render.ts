import "server-only";
import { loadManualCommunicationEmail } from "@/features/communications/server/render";
import type { EmailOutboxType } from "@/generated/prisma/client";
import {
  applicationApprovedPayload,
  applicationReceivedPayload,
  applicationRejectedPayload,
  eventCancelledPayload,
  newApplicationPayload,
  transactionalEmailSubjects,
} from "@/lib/email-outbox/payload";
import { renderEmailTemplate } from "@/lib/email-template";
import { getServerEnv } from "@/lib/env";
import { prisma } from "@/lib/prisma";
import { decryptTicketSecret } from "@/lib/ticket-crypto";

export async function renderOutboxEmail(
  type: EmailOutboxType,
  payload: unknown,
  communicationId: string | null = null,
) {
  if (type === "MANUAL_EVENT_MESSAGE") {
    if (!communicationId) {
      throw new Error("Manual delivery has no Communication.");
    }

    return loadManualCommunicationEmail(prisma, communicationId);
  }

  const origin = getServerEnv().BETTER_AUTH_URL;
  const absoluteUrl = (path: string) => new URL(path, origin).href;
  let subject: string;
  let greeting: string;
  let introduction: string;
  let eventTitle: string | undefined;
  let schedule: string | undefined;
  let eventUrl: string | undefined;
  let action: { label: string; url: string } | undefined;

  if (type === "EVENT_CANCELLED") {
    const data = eventCancelledPayload.parse(payload);
    const formatter = new Intl.DateTimeFormat("en-GB", {
      dateStyle: "medium",
      timeStyle: "short",
      timeZone: data.event.timezone,
    });
    subject = transactionalEmailSubjects.EVENT_CANCELLED;
    greeting = `Hello ${data.applicantName},`;
    introduction = `The event you applied to has been cancelled. ${data.cancellationReason}`;
    eventTitle = data.event.title;
    schedule = `${formatter.format(new Date(data.event.startsAt))} – ${formatter.format(new Date(data.event.endsAt))} (${data.event.timezone})`;
    eventUrl = data.publicId ? absoluteUrl(`/e/${data.publicId}`) : undefined;
    action = eventUrl ? { label: "View event", url: eventUrl } : undefined;
  } else if (type === "APPLICATION_REJECTED") {
    const data = applicationRejectedPayload.parse(payload);
    subject = transactionalEmailSubjects.APPLICATION_REJECTED;
    greeting = data.applicantName ? `Hello ${data.applicantName},` : "Hello,";
    introduction =
      "Thank you for your interest. Your application was not approved.";
    eventTitle = data.eventTitle;
    eventUrl = data.publicId ? absoluteUrl(`/e/${data.publicId}`) : undefined;
    action = eventUrl ? { label: "View event", url: eventUrl } : undefined;
  } else {
    const data =
      type === "APPLICATION_RECEIVED"
        ? applicationReceivedPayload.parse(payload)
        : type === "NEW_APPLICATION"
          ? newApplicationPayload.parse(payload)
          : applicationApprovedPayload.parse(payload);
    eventTitle = data.event.title;
    eventUrl = absoluteUrl(`/e/${data.event.publicId}`);
    const formatter = new Intl.DateTimeFormat("en-GB", {
      dateStyle: "medium",
      timeStyle: "short",
      timeZone: data.event.timezone,
    });
    schedule = `${formatter.format(new Date(data.event.startsAt))} – ${formatter.format(new Date(data.event.endsAt))} (${data.event.timezone})`;

    if (type === "NEW_APPLICATION" && "eventId" in data) {
      subject = transactionalEmailSubjects.NEW_APPLICATION;
      greeting = "Hello,";
      introduction = `${data.applicantName} has applied to attend your event. The application is pending review.`;
      action = {
        label: "Review applications",
        url: absoluteUrl(`/dashboard/events/${data.eventId}/applications`),
      };
    } else if (type === "APPLICATION_RECEIVED") {
      subject = transactionalEmailSubjects.APPLICATION_RECEIVED;
      greeting = `Hello ${data.applicantName},`;
      introduction =
        "Your application has been received and is pending review. We will email you when the organizer makes a decision.";
      action =
        "linkedApplicant" in data && data.linkedApplicant
          ? {
              label: "My registrations",
              url: absoluteUrl("/account/registrations"),
            }
          : { label: "View event", url: eventUrl };
    } else {
      subject = transactionalEmailSubjects.APPLICATION_APPROVED;
      greeting = `Hello ${data.applicantName},`;
      introduction =
        "Your application has been approved. We look forward to seeing you at the event.";

      if (!("ticketId" in data)) {
        throw new Error("Invalid approval payload.");
      }

      const ticket = await prisma.ticket.findUniqueOrThrow({
        where: { id: data.ticketId },
        select: {
          attendeeId: true,
          revokedAt: true,
          anonymousAccessHash: true,
          anonymousAccessEncrypted: true,
          attendee: {
            select: {
              revokedAt: true,
              registration: {
                select: {
                  eventId: true,
                  userId: true,
                  revokedAt: true,
                  event: { select: { cancelledAt: true } },
                },
              },
            },
          },
        },
      });

      if (
        ticket.revokedAt ||
        ticket.attendee.revokedAt ||
        ticket.attendee.registration.revokedAt ||
        ticket.attendee.registration.event.cancelledAt
      ) {
        introduction = ticket.attendee.registration.event.cancelledAt
          ? "Your application was approved, but the event has since been cancelled. Your ticket history is preserved."
          : "Your application was approved, but your admission has since been revoked. Your ticket history is preserved.";
        action = undefined;
      } else if (
        ticket.anonymousAccessHash &&
        ticket.anonymousAccessEncrypted
      ) {
        const access = decryptTicketSecret(
          ticket.anonymousAccessEncrypted,
          ticket.attendeeId,
          "access",
          ticket.anonymousAccessHash,
        );
        introduction =
          "Your application has been approved and your ticket is ready. Keep this private ticket link safe; anyone with it can view your ticket.";
        action = {
          label: "View ticket",
          url: absoluteUrl(`/ticket/${access}`),
        };
      } else if (ticket.attendee.registration.userId) {
        introduction =
          "Your application has been approved and your ticket is ready. Sign in to view it in your registration.";
        action = {
          label: "View ticket",
          url: absoluteUrl(
            `/account/registrations/${ticket.attendee.registration.eventId}`,
          ),
        };
      } else {
        // A deleted linked User never turns this into an anonymous Ticket.
        introduction =
          "Your application was approved. The account previously linked to this registration is no longer available.";
        action = undefined;
      }
    }
  }

  const extraEventLink =
    eventUrl && action?.url !== eventUrl ? eventUrl : undefined;

  return {
    subject,
    ...renderEmailTemplate({
      title: subject,
      greeting,
      introduction,
      detailTitle: eventTitle,
      detailText: schedule,
      action,
      secondaryAction: extraEventLink
        ? { label: "View event", url: extraEventLink }
        : undefined,
    }),
  };
}

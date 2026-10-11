import "server-only";
import { createFormatter } from "use-intl/core";
import { loadManualCommunicationEmail } from "@/features/communications/server/render";
import type { EmailOutboxType } from "@/generated/prisma/client";
import {
  applicationApprovedPayload,
  applicationReceivedPayload,
  applicationRejectedPayload,
  emailPayloadSchemas,
  eventCancelledPayload,
  manualEmailPayload,
  newApplicationPayload,
} from "@/lib/email-outbox/payload";
import { renderEmailTemplate } from "@/lib/email-template";
import { getServerEnv } from "@/lib/env";
import { createBackgroundTranslator } from "@/lib/i18n/background";
import { defaultLocale } from "@/lib/i18n/locale";
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

    return loadManualCommunicationEmail(
      prisma,
      communicationId,
      manualEmailPayload.parse(payload).locale ?? defaultLocale,
    );
  }

  const locale =
    emailPayloadSchemas[type].parse(payload).locale ?? defaultLocale;
  const t = await createBackgroundTranslator(locale);
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
    const formatter = createFormatter({
      locale,
      timeZone: data.event.timezone,
    });
    subject = t("email.cancelledSubject");
    greeting = t("email.greetingName", { name: data.applicantName });
    introduction = t("email.cancelledIntro", {
      reason: data.cancellationReason,
    });
    eventTitle = data.event.title;
    schedule = t("email.schedule", {
      start: formatter.dateTime(new Date(data.event.startsAt), {
        dateStyle: "medium",
        timeStyle: "short",
      }),
      end: formatter.dateTime(new Date(data.event.endsAt), {
        dateStyle: "medium",
        timeStyle: "short",
      }),
      timezone: data.event.timezone,
    });
    eventUrl = data.publicId ? absoluteUrl(`/e/${data.publicId}`) : undefined;
    action = eventUrl
      ? { label: t("email.viewEvent"), url: eventUrl }
      : undefined;
  } else if (type === "APPLICATION_REJECTED") {
    const data = applicationRejectedPayload.parse(payload);
    subject = t("email.rejectedSubject");
    greeting = data.applicantName
      ? t("email.greetingName", { name: data.applicantName })
      : t("email.greeting");
    introduction = t("email.rejectedIntro");
    eventTitle = data.eventTitle;
    eventUrl = data.publicId ? absoluteUrl(`/e/${data.publicId}`) : undefined;
    action = eventUrl
      ? { label: t("email.viewEvent"), url: eventUrl }
      : undefined;
  } else {
    const data =
      type === "APPLICATION_RECEIVED"
        ? applicationReceivedPayload.parse(payload)
        : type === "NEW_APPLICATION"
          ? newApplicationPayload.parse(payload)
          : applicationApprovedPayload.parse(payload);
    eventTitle = data.event.title;
    eventUrl = absoluteUrl(`/e/${data.event.publicId}`);
    const formatter = createFormatter({
      locale,
      timeZone: data.event.timezone,
    });
    schedule = t("email.schedule", {
      start: formatter.dateTime(new Date(data.event.startsAt), {
        dateStyle: "medium",
        timeStyle: "short",
      }),
      end: formatter.dateTime(new Date(data.event.endsAt), {
        dateStyle: "medium",
        timeStyle: "short",
      }),
      timezone: data.event.timezone,
    });

    if (type === "NEW_APPLICATION" && "eventId" in data) {
      subject = t("email.organizerSubject");
      greeting = t("email.greeting");
      introduction = t("email.organizerIntro", { name: data.applicantName });
      action = {
        label: t("email.reviewApplications"),
        url: absoluteUrl(`/dashboard/events/${data.eventId}/applications`),
      };
    } else if (type === "APPLICATION_RECEIVED") {
      subject = t("email.receivedSubject");
      greeting = t("email.greetingName", { name: data.applicantName });
      introduction = t("email.receivedIntro");
      action =
        "linkedApplicant" in data && data.linkedApplicant
          ? {
              label: t("email.myRegistrations"),
              url: absoluteUrl("/account/registrations"),
            }
          : { label: t("email.viewEvent"), url: eventUrl };
    } else {
      subject = t("email.approvedSubject");
      greeting = t("email.greetingName", { name: data.applicantName });
      introduction = t("email.approvedIntro");

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
          ? t("email.cancelledAdmission")
          : t("email.revokedAdmission");
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
        introduction = t("email.anonymousTicket");
        action = {
          label: t("email.viewTicket"),
          url: absoluteUrl(`/ticket#${access}`),
        };
      } else if (ticket.attendee.registration.userId) {
        introduction = t("email.accountTicket");
        action = {
          label: t("email.viewTicket"),
          url: absoluteUrl(
            `/account/registrations/${ticket.attendee.registration.eventId}`,
          ),
        };
      } else {
        // A deleted linked User never turns this into an anonymous Ticket.
        introduction = t("email.deletedAccount");
        action = undefined;
      }
    }
  }

  const extraEventLink =
    eventUrl && action?.url !== eventUrl ? eventUrl : undefined;

  return {
    subject,
    ...renderEmailTemplate({
      locale,
      title: subject,
      greeting,
      introduction,
      detailTitle: eventTitle,
      detailText: schedule,
      action,
      secondaryAction: extraEventLink
        ? { label: t("email.viewEvent"), url: extraEventLink }
        : undefined,
    }),
  };
}

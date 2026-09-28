import "server-only";
import type { EmailOutboxType } from "@/generated/prisma/client";
import {
  applicationApprovedPayload,
  applicationReceivedPayload,
  applicationRejectedPayload,
  newApplicationPayload,
} from "@/lib/email-outbox/payload";
import { renderEmailTemplate } from "@/lib/email-template";
import { getServerEnv } from "@/lib/env";

export function renderOutboxEmail(type: EmailOutboxType, payload: unknown) {
  const origin = getServerEnv().BETTER_AUTH_URL;
  const absoluteUrl = (path: string) => new URL(path, origin).href;
  let subject: string;
  let greeting: string;
  let introduction: string;
  let eventTitle: string | undefined;
  let schedule: string | undefined;
  let eventUrl: string | undefined;
  let action: { label: string; url: string } | undefined;

  if (type === "APPLICATION_REJECTED") {
    const data = applicationRejectedPayload.parse(payload);
    subject = "An update on your application";
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
      subject = "A new application for your event";
      greeting = "Hello,";
      introduction = `${data.applicantName} has applied to attend your event. The application is pending review.`;
      action = {
        label: "Review applications",
        url: absoluteUrl(`/dashboard/events/${data.eventId}/applications`),
      };
    } else if (type === "APPLICATION_RECEIVED") {
      subject = "We received your application";
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
      subject = "Your application is approved";
      greeting = `Hello ${data.applicantName},`;
      introduction =
        "Your application has been approved. We look forward to seeing you at the event.";
      action = { label: "View event", url: eventUrl };
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

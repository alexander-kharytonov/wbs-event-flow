import { badgeDimensions } from "@/features/badges/badge-layout";
import type { BadgePresentation } from "@/features/badges/badge-presentation";

export type BadgeLabels = {
  title: string;
  guest: string;
  attendee: string;
  organizer: string;
  manager: string;
  reception: string;
  qrAlt: string;
  qrPreview: string;
};

export function badgeLabels(
  t: (
    key:
      | "badgeTitle"
      | "guest"
      | "badgeAttendee"
      | "organizer"
      | "manager"
      | "reception"
      | "badgeQrAlt"
      | "badgeQrPreview",
  ) => string,
): BadgeLabels {
  return {
    title: t("badgeTitle"),
    guest: t("guest"),
    attendee: t("badgeAttendee"),
    organizer: t("organizer"),
    manager: t("manager"),
    reception: t("reception"),
    qrAlt: t("badgeQrAlt"),
    qrPreview: t("badgeQrPreview"),
  };
}

export function Badge({
  badge,
  labels,
}: {
  badge: BadgePresentation;
  labels: BadgeLabels;
}) {
  const dimensions = badgeDimensions(badge.style);
  const qr = Boolean(badge.qrDataUrl || badge.qrPlaceholder);

  return (
    <article
      aria-label={labels.title}
      className="ef-badge-badge"
      data-orientation={badge.style.orientation}
      data-alignment={badge.style.alignment}
      data-name-size={badge.style.nameSize}
      data-qr={qr}
      style={{
        width: `${dimensions.width}mm`,
        height: `${dimensions.height}mm`,
        padding: `${badge.style.paddingMm}mm`,
      }}
    >
      <div className="ef-badge-text">
        {badge.eventName && (
          <div className="ef-badge-event">{badge.eventName}</div>
        )}
        <div className="ef-badge-name">{badge.name}</div>
        {badge.variant === "TEAM" && (
          <div className="ef-badge-type">
            {badge.role === "Organizer"
              ? labels.organizer
              : badge.role === "Manager"
                ? labels.manager
                : labels.reception}
          </div>
        )}
        {badge.attendeeType && (
          <div className="ef-badge-type">
            {badge.attendeeType === "GUEST" ? labels.guest : labels.attendee}
          </div>
        )}
        {badge.secondary && (
          <div className="ef-badge-field">{badge.secondary}</div>
        )}
        {badge.tertiary && (
          <div className="ef-badge-field">{badge.tertiary}</div>
        )}
      </div>
      {(qr || badge.ticketNumber) && (
        <div className="ef-badge-ticket">
          {badge.qrDataUrl && (
            // The generated data URL already contains the QR quiet zone. No optimizer or remote URL.
            // biome-ignore lint/performance/noImgElement: local QR data presentation at physical print size
            <img
              className="ef-badge-qr"
              src={badge.qrDataUrl}
              alt={labels.qrAlt}
              width={240}
              height={240}
            />
          )}
          {badge.qrPlaceholder && (
            <div className="ef-badge-qr ef-badge-placeholder">
              {labels.qrPreview}
            </div>
          )}
          {badge.ticketNumber && (
            <div className="ef-badge-number">{badge.ticketNumber}</div>
          )}
        </div>
      )}
    </article>
  );
}

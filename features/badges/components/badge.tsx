import { badgeDimensions } from "@/features/badges/badge-layout";
import type { BadgePresentation } from "@/features/badges/badge-presentation";

export function Badge({ badge }: { badge: BadgePresentation }) {
  const dimensions = badgeDimensions(badge.style);
  const qr = Boolean(badge.qrDataUrl || badge.qrPlaceholder);

  return (
    <article
      aria-label="Badge"
      className="ef-badge-badge"
      data-preset={badge.style.preset}
      data-orientation={badge.style.orientation}
      data-alignment={badge.style.alignment}
      data-name-size={badge.style.nameSize}
      data-qr={qr}
      style={{
        width: `${dimensions.width}mm`,
        height: `${dimensions.height}mm`,
      }}
    >
      <div className="ef-badge-text">
        {badge.eventName && (
          <div className="ef-badge-event">{badge.eventName}</div>
        )}
        <div className="ef-badge-name">{badge.name}</div>
        {badge.variant === "TEAM" && (
          <div className="ef-badge-type">{badge.role}</div>
        )}
        {badge.attendeeType && (
          <div className="ef-badge-type">
            {badge.attendeeType === "GUEST" ? "Guest" : "Attendee"}
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
              alt="Ticket QR"
              width={240}
              height={240}
            />
          )}
          {badge.qrPlaceholder && (
            <div className="ef-badge-qr ef-badge-placeholder">QR preview</div>
          )}
          {badge.ticketNumber && (
            <div className="ef-badge-number">{badge.ticketNumber}</div>
          )}
        </div>
      )}
    </article>
  );
}

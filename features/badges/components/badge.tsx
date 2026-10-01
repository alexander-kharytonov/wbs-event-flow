import { badgeDimensions } from "@/features/badges/badge-layout";
import type { BadgePresentation } from "@/features/badges/badge-presentation";
import styles from "@/features/badges/components/badge.module.css";

export function Badge({ badge }: { badge: BadgePresentation }) {
  const dimensions = badgeDimensions(badge.style);
  const qr = Boolean(badge.qrDataUrl || badge.qrPlaceholder);

  return (
    <article
      aria-label="Badge"
      className={styles.badge}
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
      <div className={styles.text}>
        {badge.eventName && (
          <div className={styles.event}>{badge.eventName}</div>
        )}
        <div className={styles.name}>{badge.name}</div>
        {badge.attendeeType && (
          <div className={styles.type}>
            {badge.attendeeType === "GUEST" ? "Guest" : "Attendee"}
          </div>
        )}
        {badge.secondary && (
          <div className={styles.field}>{badge.secondary}</div>
        )}
        {badge.tertiary && <div className={styles.field}>{badge.tertiary}</div>}
      </div>
      {(qr || badge.ticketNumber) && (
        <div className={styles.ticket}>
          {badge.qrDataUrl && (
            // The generated data URL already contains the QR quiet zone. No optimizer or remote URL.
            // biome-ignore lint/performance/noImgElement: local QR data presentation at physical print size
            <img
              className={styles.qr}
              src={badge.qrDataUrl}
              alt="Ticket QR"
              width={240}
              height={240}
            />
          )}
          {badge.qrPlaceholder && (
            <div className={`${styles.qr} ${styles.placeholder}`}>
              QR preview
            </div>
          )}
          {badge.ticketNumber && (
            <div className={styles.number}>{badge.ticketNumber}</div>
          )}
        </div>
      )}
    </article>
  );
}

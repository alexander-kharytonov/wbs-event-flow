// Fixed application CSS shared by React preview and all print transports.
export const badgeCss = `
.ef-badge-badge {
  box-sizing: border-box;
  flex-shrink: 0;
  padding: 3mm;
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: center;
  gap: 3mm;
  overflow: hidden;
  background: #fff;
  color: #111;
  font-family: Arial, sans-serif;
  text-align: left;
  break-inside: avoid;
  print-color-adjust: exact;
  -webkit-print-color-adjust: exact;
}

.ef-badge-text {
  display: flex;
  flex-direction: column;
  gap: 1mm;
  min-width: 0;
  min-height: 0;
  overflow: hidden;
}

.ef-badge-event,
.ef-badge-name,
.ef-badge-field {
  display: -webkit-box;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
  overflow: hidden;
  overflow-wrap: anywhere;
  line-height: 1.15;
  flex-shrink: 0;
}

.ef-badge-event {
  font-size: 3mm;
  max-height: 6.9mm;
}

.ef-badge-name {
  font-size: 5mm;
  font-weight: 700;
  max-height: 11.5mm;
}

.ef-badge-field {
  font-size: 3mm;
  max-height: 6.9mm;
}

.ef-badge-type {
  font-size: 2.6mm;
  line-height: 1.2;
  text-transform: uppercase;
  letter-spacing: 0.3mm;
}

.ef-badge-ticket {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1mm;
  width: 24mm;
  flex-shrink: 0;
  overflow: hidden;
}

.ef-badge-qr {
  display: block;
  width: 24mm;
  height: 24mm;
  flex-shrink: 0;
  object-fit: contain;
  background: #fff;
}

.ef-badge-placeholder {
  display: grid;
  place-items: center;
  border: 0.3mm dashed #888;
  box-sizing: border-box;
  font-size: 2.8mm;
  color: #555;
}

.ef-badge-number {
  font: 2.6mm / 1.2 monospace;
  white-space: nowrap;
}

.ef-badge-badge[data-preset="CLASSIC"] .ef-badge-event {
  font-weight: 700;
}

.ef-badge-badge[data-preset="MINIMAL"] .ef-badge-type {
  text-transform: none;
  letter-spacing: normal;
}

.ef-badge-badge[data-preset="CHECK_IN"] .ef-badge-type {
  font-weight: 700;
}

.ef-badge-badge[data-preset="CHECK_IN"] .ef-badge-ticket {
  grid-column: 1;
  grid-row: 1;
}

.ef-badge-badge[data-preset="CHECK_IN"]:has(.ef-badge-ticket) {
  grid-template-columns: auto minmax(0, 1fr);
}

.ef-badge-badge[data-orientation="PORTRAIT"],
.ef-badge-badge[data-orientation="PORTRAIT"][data-preset="CHECK_IN"]:has(.ef-badge-ticket) {
  grid-template-columns: minmax(0, 1fr);
  grid-template-rows: minmax(0, 1fr) auto;
  gap: 2mm;
}

.ef-badge-badge[data-orientation="PORTRAIT"] .ef-badge-ticket {
  grid-column: 1;
  grid-row: 2;
  justify-self: center;
}

.ef-badge-badge[data-alignment="CENTER"] {
  text-align: center;
}

.ef-badge-badge[data-name-size="SMALL"] .ef-badge-name {
  font-size: 4mm;
  max-height: 9.2mm;
}

.ef-badge-badge[data-name-size="LARGE"] .ef-badge-name {
  font-size: 6mm;
  max-height: 13.8mm;
}
`;

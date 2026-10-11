import "server-only";
import type { Messages } from "@/lib/i18n/messages";

export class ManualCommunicationError extends Error {
  constructor(readonly code: keyof Messages["events"]) {
    super(code);
  }
}

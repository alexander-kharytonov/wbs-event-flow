import "server-only";
import { isTicketSecret } from "@/lib/ticket-crypto";

const prefix = "eventflow:ticket:v1:";

export function parseTicketQr(payload: unknown): string | null {
  if (
    typeof payload !== "string" ||
    payload.length !== prefix.length + 43 ||
    !payload.startsWith(prefix)
  ) {
    return null;
  }

  const credential = payload.slice(prefix.length);

  return isTicketSecret(credential) ? credential : null;
}

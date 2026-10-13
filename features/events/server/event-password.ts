import "server-only";
import { randomBytes, scrypt, timingSafeEqual } from "node:crypto";
import { eventPasswordSchema } from "@/features/events/event-password-input";

// OWASP scrypt configuration: N=2^15, r=8, p=3; unique 128-bit salt.
function derive(password: string, salt: Buffer): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scrypt(
      password,
      salt,
      32,
      { N: 32768, r: 8, p: 3, maxmem: 64 * 1024 * 1024 },
      (error, key) => {
        if (error) {
          reject(error);
        } else {
          resolve(key);
        }
      },
    );
  });
}

export async function hashEventPassword(password: string) {
  eventPasswordSchema.parse(password);
  const salt = randomBytes(16);
  const key = await derive(password, salt);

  return `scrypt:${salt.toString("hex")}:${key.toString("hex")}`;
}

export async function verifyEventPassword(password: string, hash: string) {
  if (
    !eventPasswordSchema.safeParse(password).success ||
    !/^scrypt:[a-f0-9]{32}:[a-f0-9]{64}$/.test(hash)
  ) {
    return false;
  }
  const [, salt, key] = hash.split(":");

  return timingSafeEqual(
    await derive(password, Buffer.from(salt, "hex")),
    Buffer.from(key, "hex"),
  );
}

// No secret enters EventFormValues, action results, or the serialized snapshot.
export async function draftEventPassword(
  formData: FormData,
  visibility: string,
  current: string | null,
  published: string | null = null,
) {
  const enabled = formData.get("passwordProtection");

  if (enabled !== "true" && enabled !== "false") {
    return { error: "accessPasswordInvalid" as const };
  }

  if (visibility !== "PRIVATE" || enabled === "false") {
    return { hash: null };
  }
  const password = formData.get("eventPassword");

  if (password === "" && current) {
    return { hash: current };
  }
  const parsed = eventPasswordSchema.safeParse(password);

  if (!parsed.success) {
    return { error: "accessPasswordInvalid" as const };
  }

  // Preserve the live generation when a draft replacement is reverted before publication.
  for (const candidate of new Set([current, published])) {
    if (candidate && (await verifyEventPassword(parsed.data, candidate))) {
      return { hash: candidate };
    }
  }

  return { hash: await hashEventPassword(parsed.data) };
}

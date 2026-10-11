import { z } from "zod";

const httpOrigin = z.url().refine((value) => {
  const url = URL.parse(value);

  return (
    url !== null &&
    ["http:", "https:"].includes(url.protocol) &&
    url.origin === value &&
    !url.hostname.includes("*")
  );
}, "Expected an HTTP(S) origin without a trailing slash");

const serverEnvSchema = z.object({
  NODE_ENV: z
    .enum(["development", "production", "test"])
    .default("development"),
  BETTER_AUTH_URL: httpOrigin,
  BETTER_AUTH_TRUSTED_ORIGINS: z
    .string()
    .default("")
    .transform((value) => (value.trim() === "" ? [] : value.split(",")))
    .pipe(z.array(httpOrigin)),
  BETTER_AUTH_SECRET: z.string().min(32),
  TICKET_CREDENTIAL_ENCRYPTION_KEY: z
    .string()
    .regex(/^[A-Za-z0-9_-]{43}$/)
    .refine((value) => {
      const key = Buffer.from(value, "base64url");

      return key.length === 32 && key.toString("base64url") === value;
    }, "Expected 32 random bytes encoded as canonical base64url"),
  SMTP_HOST: z.string().min(1),
  SMTP_PORT: z.coerce.number().int().min(1).max(65535),
  SMTP_FROM: z.email(),
  DATABASE_URL: z.url().refine((value) => {
    const url = URL.parse(value);

    return (
      url !== null &&
      ["postgresql:", "postgres:"].includes(url.protocol) &&
      url.hostname.length > 0 &&
      url.pathname.length > 1
    );
  }, "Expected a PostgreSQL URL with a host and database name"),
});

export function getServerEnv() {
  const result = serverEnvSchema.safeParse({
    DATABASE_URL: process.env.DATABASE_URL,
    NODE_ENV: process.env.NODE_ENV,
    BETTER_AUTH_URL: process.env.BETTER_AUTH_URL,
    BETTER_AUTH_TRUSTED_ORIGINS: process.env.BETTER_AUTH_TRUSTED_ORIGINS,
    BETTER_AUTH_SECRET: process.env.BETTER_AUTH_SECRET,
    TICKET_CREDENTIAL_ENCRYPTION_KEY:
      process.env.TICKET_CREDENTIAL_ENCRYPTION_KEY,
    SMTP_HOST: process.env.SMTP_HOST,
    SMTP_PORT: process.env.SMTP_PORT,
    SMTP_FROM: process.env.SMTP_FROM,
  });

  if (!result.success) {
    throw new Error(
      `Invalid server environment: check ${result.error.issues.map((issue) => issue.path.join(".")).join(", ")}`,
    );
  }

  return result.data;
}

// Better Auth reads the same explicit allowlist from its supported environment
// variable. The canonical URL remains the origin for email and public links.
export function getTrustedAppOrigins() {
  const env = getServerEnv();

  return [env.BETTER_AUTH_URL, ...env.BETTER_AUTH_TRUSTED_ORIGINS];
}

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

const serverEnvSchema = z
  .object({
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
    GOOGLE_CLIENT_ID: z.string().trim().default(""),
    GOOGLE_CLIENT_SECRET: z.string().trim().default(""),
    TICKET_CREDENTIAL_ENCRYPTION_KEY: z
      .string()
      .regex(/^[A-Za-z0-9_-]{43}$/)
      .refine((value) => {
        const key = Buffer.from(value, "base64url");

        return key.length === 32 && key.toString("base64url") === value;
      }, "Expected 32 random bytes encoded as canonical base64url"),
    EMAIL_TRANSPORT: z.enum(["smtp", "resend"]).default("smtp"),
    RESEND_API_KEY: z.string().default(""),
    DATABASE_POOL_MAX: z.coerce.number().int().min(1).max(20).default(5),
    EMAIL_OUTBOX_ENABLED: z.enum(["true", "false"]).default("true"),
    SMTP_HOST: z.string().default("127.0.0.1"),
    SMTP_PORT: z.coerce.number().int().min(1).max(65535).default(1025),
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
  })
  .refine(
    (value) =>
      value.EMAIL_TRANSPORT !== "resend" ||
      value.RESEND_API_KEY.startsWith("re_"),
    { path: ["RESEND_API_KEY"], message: "Configure a Resend API key" },
  )
  .refine(
    (value) =>
      value.NODE_ENV !== "production" ||
      process.env.NEXT_PHASE === "phase-production-build" ||
      value.BETTER_AUTH_URL.startsWith("https://"),
    {
      path: ["BETTER_AUTH_URL"],
      message: "Production requires an HTTPS canonical origin",
    },
  )
  .refine(
    (value) =>
      Boolean(value.GOOGLE_CLIENT_ID) === Boolean(value.GOOGLE_CLIENT_SECRET),
    {
      path: ["GOOGLE_CLIENT_ID"],
      message: "Configure both Google OAuth credentials or neither",
    },
  );

export function getServerEnv() {
  const result = serverEnvSchema.safeParse({
    GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID,
    GOOGLE_CLIENT_SECRET: process.env.GOOGLE_CLIENT_SECRET,
    DATABASE_URL: process.env.DATABASE_URL,
    NODE_ENV: process.env.NODE_ENV,
    BETTER_AUTH_URL: process.env.BETTER_AUTH_URL,
    BETTER_AUTH_TRUSTED_ORIGINS: process.env.BETTER_AUTH_TRUSTED_ORIGINS,
    BETTER_AUTH_SECRET: process.env.BETTER_AUTH_SECRET,
    TICKET_CREDENTIAL_ENCRYPTION_KEY:
      process.env.TICKET_CREDENTIAL_ENCRYPTION_KEY,
    EMAIL_TRANSPORT: process.env.EMAIL_TRANSPORT,
    RESEND_API_KEY: process.env.RESEND_API_KEY,
    DATABASE_POOL_MAX: process.env.DATABASE_POOL_MAX,
    EMAIL_OUTBOX_ENABLED: process.env.EMAIL_OUTBOX_ENABLED,
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

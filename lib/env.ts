import { z } from "zod";

const serverEnvSchema = z.object({
  NODE_ENV: z
    .enum(["development", "production", "test"])
    .default("development"),
  BETTER_AUTH_URL: z.url().refine((value) => {
    const url = new URL(value);

    return ["http:", "https:"].includes(url.protocol) && url.origin === value;
  }, "Expected an HTTP(S) origin without a trailing slash"),
  BETTER_AUTH_SECRET: z.string().min(32),
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
    BETTER_AUTH_SECRET: process.env.BETTER_AUTH_SECRET,
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

import { z } from "zod";

const serverEnvSchema = z.object({
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
  });

  if (!result.success) {
    throw new Error(
      "Invalid server environment: DATABASE_URL must be a PostgreSQL URL with a host and database name",
    );
  }

  return result.data;
}

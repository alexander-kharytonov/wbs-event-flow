import "server-only";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../generated/prisma/client";
import { getServerEnv } from "./env";

const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaClient;
};
const env = getServerEnv();
const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    adapter: new PrismaPg({
      connectionString: env.DATABASE_URL,
      connectionTimeoutMillis: 5000,
      max: env.DATABASE_POOL_MAX,
    }),
  });

// Instrumentation, route handlers and SSR bundles must share the same pool.
globalForPrisma.prisma = prisma;

export { prisma };

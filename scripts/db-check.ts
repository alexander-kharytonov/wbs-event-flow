import { loadEnvConfig } from "@next/env";

async function main() {
  loadEnvConfig(process.cwd(), true);
  const { prisma } = await import("../lib/prisma");

  try {
    const result = await prisma.$queryRaw<
      { database: string; version: string; ok: number }[]
    >`SELECT current_database() AS database, version() AS version, 1 AS ok`;
    console.table(result);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch(() => {
  console.error(
    "Database connection check failed. Check server environment and PostgreSQL availability.",
  );
  process.exitCode = 1;
});

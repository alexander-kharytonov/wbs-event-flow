import { loadEnvConfig } from "@next/env";

async function main() {
  loadEnvConfig(process.cwd(), true);
  const { cleanupMedia } = await import(
    "@/features/events/server/media-cleanup"
  );
  const { prisma } = await import("@/lib/prisma");

  try {
    const result = await cleanupMedia();
    console.log("Media cleanup:", result);

    if (result.failed > 0) {
      process.exitCode = 1;
    }
  } finally {
    await prisma.$disconnect();
  }
}

main().catch(() => {
  console.error(
    "Media cleanup failed. Check database access and the private MEDIA_STORAGE_ROOT configuration.",
  );
  process.exitCode = 1;
});

import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await prisma.$transaction(
      async (tx) => {
        await tx.$executeRaw`SET LOCAL statement_timeout = '2000ms'`;
        await tx.$queryRaw`SELECT 1`;
      },
      { maxWait: 6000, timeout: 3000 },
    );

    return new Response("ok", { headers: { "Cache-Control": "no-store" } });
  } catch {
    return new Response("unavailable", {
      status: 503,
      headers: { "Cache-Control": "no-store" },
    });
  }
}

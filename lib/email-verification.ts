import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { sendMail } from "./mail";
import { prisma } from "./prisma";

const verificationPrefix = "event-flow:email-verification:";

function tokenIdentifier(token: string) {
  return verificationPrefix + createHash("sha256").update(token).digest("hex");
}

export async function sendLatestVerificationEmail(
  user: { id: string; email: string },
  url: string,
  token: string,
) {
  // A nonce distinguishes even JWTs issued in the same second.
  const deliveryToken = `${token}.${randomBytes(32).toString("base64url")}`;
  const link = new URL(url);
  link.searchParams.set("token", deliveryToken);
  const htmlURL = link.href
    .replaceAll("&", "&amp;")
    .replaceAll('"', "&quot;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");

  await prisma.$transaction(
    async (tx) => {
      // Serialize deliveries, including the first one, for this account.
      const users = await tx.$queryRaw<{ emailVerified: boolean }[]>`
        SELECT "emailVerified" FROM "user" WHERE "id" = ${user.id} FOR UPDATE
      `;

      if (!users[0] || users[0].emailVerified) {
        return;
      }

      const data = {
        identifier: tokenIdentifier(deliveryToken),
        value: "email-verification",
        expiresAt: new Date(Date.now() + 3_600_000),
      };
      await tx.verification.upsert({
        where: { id: verificationPrefix + user.id },
        create: { id: verificationPrefix + user.id, ...data },
        update: data,
      });
      // SMTP failure rolls back the replacement, preserving the previous link.
      await sendMail({
        to: user.email,
        subject: "Verify your email — Event Flow",
        text: `Verify your email: ${link.href}\nThis link expires in one hour. Only the latest verification email can be used.`,
        html: `<p><a href="${htmlURL}">Verify your email</a></p><p>This link expires in one hour. Only the latest verification email can be used.</p>`,
      });
    },
    { timeout: 20_000 },
  );
}

export async function consumeVerificationToken(token: unknown) {
  if (typeof token !== "string" || token.split(".").length !== 4) {
    return null;
  }

  // One conditional write arbitrates resend, replay, and concurrent clicks.
  const consumed = await prisma.verification.deleteMany({
    where: {
      id: { startsWith: verificationPrefix },
      identifier: tokenIdentifier(token),
      expiresAt: { gt: new Date() },
    },
  });

  return consumed.count === 1 ? token.slice(0, token.lastIndexOf(".")) : null;
}

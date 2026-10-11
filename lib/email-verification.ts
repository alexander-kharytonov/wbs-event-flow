import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { renderEmailTemplate } from "@/lib/email-template";
import { createBackgroundTranslator } from "@/lib/i18n/background";
import type { UiLocale } from "@/lib/i18n/locale";
import { sendMail } from "./mail";
import { prisma } from "./prisma";

const verificationPrefix = "event-flow:email-verification:";

function tokenHash(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export async function sendLatestVerificationEmail(
  user: { id: string; email: string },
  url: string,
  token: string,
  locale: UiLocale,
) {
  // A nonce distinguishes even JWTs issued in the same second.
  const deliveryToken = `${token}.${user.id}.${randomBytes(32).toString("base64url")}`;
  const link = new URL(url);
  link.searchParams.set("token", deliveryToken);
  const t = await createBackgroundTranslator(locale);
  const message = renderEmailTemplate({
    locale,
    title: t("email.verificationTitle"),
    greeting: t("email.greeting"),
    introduction: t("email.verificationIntro"),
    detailText: t("email.verificationExpiry", { hours: 1 }),
    action: { label: t("email.verificationTitle"), url: link.href },
  });

  await prisma.$transaction(
    async (tx) => {
      // Serialize deliveries, including the first one, for this account.
      const users = await tx.$queryRaw<{ emailVerified: boolean }[]>`
        SELECT "emailVerified" FROM "user" WHERE "id" = ${user.id}::uuid FOR UPDATE
      `;

      if (!users[0] || users[0].emailVerified) {
        return;
      }

      const identifier = verificationPrefix + user.id;
      await tx.verification.deleteMany({ where: { identifier } });
      await tx.verification.create({
        data: {
          identifier,
          value: tokenHash(deliveryToken),
          expiresAt: new Date(Date.now() + 3_600_000),
        },
      });
      // SMTP failure rolls back the replacement, preserving the previous link.
      await sendMail({
        to: user.email,
        subject: t("email.verificationSubject"),
        ...message,
      });
    },
    { timeout: 20_000 },
  );
}

export async function consumeVerificationToken(token: unknown) {
  if (typeof token !== "string") {
    return null;
  }

  const parts = token.split(".");

  if (parts.length !== 5 || !parts[3] || !parts[4]) {
    return null;
  }

  // One conditional write arbitrates resend, replay, and concurrent clicks.
  const consumed = await prisma.verification.deleteMany({
    where: {
      identifier: verificationPrefix + parts[3],
      value: tokenHash(token),
      expiresAt: { gt: new Date() },
    },
  });

  return consumed.count === 1 ? parts.slice(0, 3).join(".") : null;
}

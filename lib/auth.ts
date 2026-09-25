import "server-only";
import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { createAuthMiddleware } from "better-auth/api";
import { getServerEnv } from "./env";
import { sendMail } from "./mail";
import { prisma } from "./prisma";

const env = getServerEnv();

export const auth = betterAuth({
  baseURL: env.BETTER_AUTH_URL,
  secret: env.BETTER_AUTH_SECRET,
  database: prismaAdapter(prisma, { provider: "postgresql" }),
  hooks: {
    before: createAuthMiddleware(async (ctx) => {
      if (
        ![
          "/sign-up/email",
          "/sign-in/email",
          "/send-verification-email",
        ].includes(ctx.path)
      ) {
        return;
      }

      // Better Auth 1.7 swallows email task failures by default. Keep delivery
      // synchronous and propagate failures through this request's context.
      return {
        context: {
          context: {
            async runInBackgroundOrAwait(task: Promise<unknown>) {
              await task;
            },
          },
        },
      };
    }),
  },
  emailAndPassword: {
    enabled: true,
    requireEmailVerification: true,
    minPasswordLength: 10,
    maxPasswordLength: 128,
  },
  emailVerification: {
    sendOnSignUp: true,
    sendOnSignIn: true,
    expiresIn: 3600,
    autoSignInAfterVerification: true,
    async sendVerificationEmail({ user, url }) {
      const htmlURL = url
        .replaceAll("&", "&amp;")
        .replaceAll('"', "&quot;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;");
      // Await SMTP acceptance so a delivery failure cannot appear successful.
      await sendMail({
        to: user.email,
        subject: "Verify your email — Event Flow",
        text: `Verify your email: ${url}\nThis link expires in one hour.`,
        html: `<p><a href="${htmlURL}">Verify your email</a></p><p>This link expires in one hour.</p>`,
      });
    },
  },
  session: {
    expiresIn: 604800,
    updateAge: 86400,
    cookieCache: { enabled: false },
  },
});

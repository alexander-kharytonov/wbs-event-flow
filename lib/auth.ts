import "server-only";
import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { createAuthMiddleware } from "better-auth/api";
import {
  consumeVerificationToken,
  sendLatestVerificationEmail,
} from "./email-verification";
import { getServerEnv } from "./env";
import { prisma } from "./prisma";
import { safeReturnPath } from "./safe-return-path";

const env = getServerEnv();

export const auth = betterAuth({
  baseURL: env.BETTER_AUTH_URL,
  secret: env.BETTER_AUTH_SECRET,
  database: prismaAdapter(prisma, { provider: "postgresql" }),
  // Prisma defaults generate UUIDv7 for all auth records.
  advanced: { database: { generateId: false } },
  rateLimit: {
    enabled: true,
    customRules: {
      "/send-verification-email": { window: 60, max: 1 },
    },
  },
  hooks: {
    before: createAuthMiddleware(async (ctx) => {
      if (ctx.path === "/verify-email") {
        const token = await consumeVerificationToken(ctx.query?.token);

        if (!token) {
          const query = new URLSearchParams({ error: "INVALID_TOKEN" });
          const callback = safeReturnPath(ctx.query?.callbackURL);
          const returnTo = callback
            ? safeReturnPath(
                new URL(callback, env.BETTER_AUTH_URL).searchParams.get(
                  "returnTo",
                ),
              )
            : undefined;

          if (returnTo) {
            query.set("returnTo", returnTo);
          }

          throw ctx.redirect(`/verify-email?${query}`);
        }

        return { context: { query: { ...ctx.query, token } } };
      }

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
    sendOnSignIn: false,
    expiresIn: 3600,
    autoSignInAfterVerification: true,
    async sendVerificationEmail({ user, url, token }) {
      await sendLatestVerificationEmail(user, url, token);
    },
  },
  session: {
    expiresIn: 604800,
    updateAge: 86400,
    cookieCache: { enabled: false },
  },
});

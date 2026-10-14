import "server-only";
import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import {
  APIError,
  createAuthMiddleware,
  getSessionFromCtx,
} from "better-auth/api";
import { NextRequest } from "next/server";
import { z } from "zod";
import { defaultLocale, localeCookie, resolveLocale } from "@/lib/i18n/locale";
import { sendPasswordResetEmail } from "@/lib/password-reset";
import {
  consumeVerificationToken,
  sendLatestVerificationEmail,
} from "./email-verification";
import { getServerEnv, getTrustedAppOrigins } from "./env";
import { prisma } from "./prisma";
import { safeReturnPath } from "./safe-return-path";

const env = getServerEnv();

export const auth = betterAuth({
  baseURL: env.BETTER_AUTH_URL,
  secret: env.BETTER_AUTH_SECRET,
  database: prismaAdapter(prisma, { provider: "postgresql" }),
  socialProviders: env.GOOGLE_CLIENT_ID
    ? {
        google: {
          clientId: env.GOOGLE_CLIENT_ID,
          clientSecret: env.GOOGLE_CLIENT_SECRET,
          prompt: "select_account",
        },
      }
    : {},
  account: {
    accountLinking: {
      enabled: true,
      disableImplicitLinking: true,
      trustedProviders: [],
      allowDifferentEmails: false,
      allowUnlinkingAll: false,
      updateUserInfoOnLink: true,
    },
  },
  onAPIError: { errorURL: "/sign-in" },
  user: {
    async validateUserInfo({ user, source }, ctx) {
      if (source.method !== "oauth") {
        return;
      }

      if (user.emailVerified !== true) {
        return { error: "google_email_unverified" };
      }

      if (source.action === "link-account") {
        const session = await getSessionFromCtx(ctx, {
          disableCookieCache: true,
        });

        if (
          !session?.user.emailVerified ||
          session.user.id !== user.id ||
          session.session.expiresAt.getTime() <= Date.now()
        ) {
          return { error: "link_session_required" };
        }
      }
    },
  },
  databaseHooks: {
    account: {
      create: {
        async before(_account, ctx) {
          // Recovery must never turn an OAuth-only identity into a password login.
          if (ctx?.path === "/reset-password") {
            throw new APIError("BAD_REQUEST", {
              code: "INVALID_TOKEN",
              message: "Invalid token",
            });
          }
        },
      },
    },
    user: {
      update: {
        async before(data, ctx) {
          // Native link profile sync is restricted to the image: never replace
          // the user's chosen name, email, preferences or domain profile.
          if (
            (ctx?.path === "/link-social" ||
              ctx?.path?.startsWith("/callback/")) &&
            "name" in data
          ) {
            return { data: { name: undefined, image: data.image } };
          }
        },
      },
    },
  },
  // Prisma defaults generate UUIDv7 for all auth records.
  advanced: { database: { generateId: false } },
  verification: {
    storeIdentifier: {
      default: "plain",
      overrides: { "reset-password:": "hashed" },
    },
  },
  rateLimit: {
    enabled: true,
    customRules: {
      "/send-verification-email": { window: 60, max: 1 },
      "/request-password-reset": { window: 60, max: 1 },
      "/reset-password": { window: 60, max: 5 },
    },
  },
  hooks: {
    before: createAuthMiddleware(async (ctx) => {
      if (
        ctx.request &&
        ["/request-password-reset", "/reset-password"].includes(ctx.path) &&
        !getTrustedAppOrigins().includes(
          ctx.request.headers.get("origin") ?? "",
        )
      ) {
        throw new APIError("FORBIDDEN", {
          code: "INVALID_ORIGIN",
          message: "Invalid origin",
        });
      }

      if (ctx.path === "/request-password-reset") {
        const input = z
          .strictObject({
            email: z.email(),
            redirectTo: z.literal("/reset-password").optional(),
          })
          .safeParse(ctx.body);

        if (
          !input.success ||
          (ctx.request && new URL(ctx.request.url).search !== "")
        ) {
          throw new APIError("BAD_REQUEST", {
            code: "INVALID_REQUEST",
            message: "Invalid recovery request",
          });
        }

        // Keep the native neutral response for absent and OAuth-only accounts.
        const credential = await prisma.account.findFirst({
          where: {
            providerId: "credential",
            NOT: [{ password: null }, { password: "" }],
            user: { email: input.data.email.toLowerCase() },
          },
          select: { id: true },
        });

        if (!credential) {
          return ctx.json({
            status: true,
            message:
              "If this email exists in our system, check your email for the reset link",
          });
        }

        // Delivery never uses a caller-supplied redirect or Host header.
        return {
          context: { body: { ...input.data, redirectTo: "/reset-password" } },
        };
      }

      if (
        ctx.path.startsWith("/reset-password/") ||
        (ctx.path === "/reset-password" && ctx.query?.token)
      ) {
        // Tokens are accepted only in POST bodies, never paths or queries.
        throw new APIError("BAD_REQUEST", {
          code: "INVALID_TOKEN",
          message: "Invalid token",
        });
      }

      if (ctx.path === "/reset-password") {
        const token = ctx.body?.token;

        if (typeof token !== "string" || !/^[A-Za-z0-9]{24}$/.test(token)) {
          throw new APIError("BAD_REQUEST", {
            code: "INVALID_TOKEN",
            message: "Invalid token",
          });
        }

        const verification =
          await ctx.context.internalAdapter.findVerificationValue(
            `reset-password:${token}`,
          );
        const credential = verification
          ? await ctx.context.internalAdapter.findCredentialAccount(
              verification.value,
            )
          : null;

        if (!credential?.password) {
          throw new APIError("BAD_REQUEST", {
            code: "INVALID_TOKEN",
            message: "Invalid token",
          });
        }
        // Native resetPassword validates expiry and atomically consumes the token.
      }

      if (ctx.path === "/link-social" || ctx.path === "/unlink-account") {
        const session = await getSessionFromCtx(ctx, {
          disableCookieCache: true,
        });

        if (
          !session?.user.emailVerified ||
          session.session.expiresAt.getTime() <= Date.now()
        ) {
          throw new APIError("UNAUTHORIZED", {
            code: "LINK_SESSION_REQUIRED",
            message: "Sign in again to manage Google.",
          });
        }

        if (
          ctx.path === "/link-social" &&
          (ctx.body?.provider !== "google" ||
            ctx.body?.additionalData?.expectedUserId !== session.user.id)
        ) {
          throw new APIError("BAD_REQUEST", {
            code: "PROVIDER_NOT_ALLOWED",
            message: "Provider unavailable.",
          });
        }

        if (ctx.path === "/unlink-account") {
          const accounts = await prisma.account.findMany({
            where: { userId: session.user.id },
            select: { id: true, providerId: true, password: true },
          });
          const target = accounts.find(
            (account) => account.id === ctx.body?.accountId,
          );
          // Only Google can be removed. The credential row is never removable,
          // so concurrent unlink requests cannot delete each other's fallback.
          if (
            target?.providerId !== "google" ||
            !accounts.some(
              (account) =>
                account.providerId === "credential" &&
                Boolean(account.password),
            )
          ) {
            throw new APIError("BAD_REQUEST", {
              code: "FAILED_TO_UNLINK_LAST_ACCOUNT",
              message: "Keep a usable login method.",
            });
          }
        }
      }

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
    resetPasswordTokenExpiresIn: 1800,
    revokeSessionsOnPasswordReset: true,
    async sendResetPassword(data, request) {
      await sendPasswordResetEmail(data, await authEmailLocale(request));
    },
  },
  emailVerification: {
    sendOnSignUp: true,
    sendOnSignIn: false,
    expiresIn: 3600,
    autoSignInAfterVerification: true,
    async sendVerificationEmail({ user, url, token }, request) {
      const locale = await authEmailLocale(request);

      await sendLatestVerificationEmail(user, url, token, locale);
    },
  },
  session: {
    expiresIn: 604800,
    updateAge: 86400,
    cookieCache: { enabled: false },
  },
});

async function authEmailLocale(request?: Request) {
  let locale = defaultLocale;

  if (request) {
    const session = await auth.api.getSession({
      headers: request.headers,
      query: { disableCookieCache: true, disableRefresh: true },
    });
    const account = session
      ? await prisma.user.findUnique({
          where: { id: session.user.id },
          select: { uiLocale: true },
        })
      : null;
    const cookie = new NextRequest(request.url, {
      headers: request.headers,
    }).cookies.get(localeCookie)?.value;
    locale = resolveLocale(
      account?.uiLocale,
      cookie,
      request.headers.get("accept-language"),
    );
  }

  return locale;
}

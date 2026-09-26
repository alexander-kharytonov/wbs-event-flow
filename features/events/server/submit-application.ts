import "server-only";
import { z } from "zod";
import {
  type ApplicationFormState,
  applicationAnswersSchema,
  applicationInputSchema,
} from "@/features/events/application-input";
import { registrationAvailability } from "@/features/events/registration-availability";
import { eventSnapshotSchema } from "@/features/events/schemas/event-snapshot";
import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";

// Prisma's PostgreSQL driver adapter reports the violated index in its cause.
const duplicateApplicationConstraint = z.object({
  driverAdapterError: z.object({
    cause: z.object({
      constraint: z.object({
        index: z.enum([
          "Application_eventId_email_key",
          "Application_eventId_userId_key",
        ]),
      }),
    }),
  }),
});

export async function submitEventApplication(
  input: unknown,
): Promise<ApplicationFormState> {
  // Reject unknown fields (including userId), but validate applicant details
  // only after resolving the authoritative identity and submitted revision.
  const parsed = applicationInputSchema
    .extend({
      fullName: z.unknown(),
      email: z.unknown(),
      answers: z.unknown(),
    })
    .safeParse(input);

  if (!parsed.success) {
    return { message: "This registration form is invalid." };
  }

  const { publicId, eventRevisionId } = parsed.data;

  try {
    // Revisions are created only by publication. Do not require this revision
    // to still be current: an already opened form keeps its historical meaning.
    const revision = await prisma.eventRevision.findFirst({
      where: { id: eventRevisionId, event: { publicId } },
      select: { eventId: true, snapshot: true },
    });
    const snapshot = eventSnapshotSchema.safeParse(revision?.snapshot);

    if (!revision || !snapshot.success) {
      return { message: "This registration form is unavailable." };
    }

    const availability = registrationAvailability(snapshot.data, new Date());

    if (availability !== "OPEN") {
      return {
        message:
          availability === "CLOSED"
            ? "Registration is closed."
            : "Registration has not opened yet.",
      };
    }

    const session = await getSession();
    const user = session?.user.emailVerified ? session.user : null;

    if (snapshot.data.accountRequirement === "REQUIRED" && !user) {
      return {
        message: "Sign in with a verified email to register for this event.",
      };
    }

    const applicant = applicationInputSchema.safeParse({
      ...parsed.data,
      email: user ? user.email : parsed.data.email,
    });

    if (!applicant.success) {
      return {
        message: "Check your registration details.",
        errors: Object.fromEntries(
          applicant.error.issues.map((issue) => [
            String(issue.path[0]),
            issue.message,
          ]),
        ),
      };
    }

    const { fullName, email, answers } = applicant.data;

    const normalized = applicationAnswersSchema(snapshot.data).safeParse(
      answers,
    );

    if (!normalized.success) {
      return {
        message: "Check your answers to the registration questions.",
        errors: Object.fromEntries(
          normalized.error.issues.map((issue) => [
            `answer:${String(issue.path[0])}`,
            issue.message,
          ]),
        ),
      };
    }

    try {
      // One nested write atomically persists the complete answer aggregate.
      await prisma.application.create({
        data: {
          eventId: revision.eventId,
          eventRevisionId,
          userId: user?.id ?? null,
          fullName,
          email,
          answers: { create: Object.values(normalized.data) },
        },
        select: { id: true },
      });
    } catch (error) {
      if (
        !(
          error instanceof Prisma.PrismaClientKnownRequestError &&
          error.code === "P2002" &&
          duplicateApplicationConstraint.safeParse(error.meta).success
        )
      ) {
        throw error;
      }
      // A duplicate has exactly the same public result; never read or expose it.
    }

    return { success: true };
  } catch (error) {
    // Never log submitted answers, identity details, or Prisma query arguments.
    console.error(
      "Application submission failed",
      JSON.stringify({
        type: error instanceof Error ? error.name : "UnknownError",
        code:
          error instanceof Prisma.PrismaClientKnownRequestError
            ? error.code
            : undefined,
        staleIdentitySchema:
          error instanceof Error &&
          /Unknown argument `userId`/.test(error.message),
      }),
    );

    return {
      message: "We couldn’t submit your registration. Please try again.",
    };
  }
}

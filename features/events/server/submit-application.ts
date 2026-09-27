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

// Admission policy comes from the current publication read under the Event lock.
function admissionError(
  currentSnapshot: unknown,
  hasVerifiedUser: boolean,
): ApplicationFormState | null {
  const current = eventSnapshotSchema.safeParse(currentSnapshot);

  if (!current.success) {
    return { message: "This registration form is unavailable." };
  }

  const availability = registrationAvailability(current.data, new Date());

  if (availability !== "OPEN") {
    return {
      message:
        availability === "CLOSED"
          ? "Registration is closed."
          : "Registration has not opened yet.",
    };
  }

  if (current.data.accountRequirement === "REQUIRED" && !hasVerifiedUser) {
    return {
      message: "Sign in with a verified email to register for this event.",
    };
  }

  return null;
}

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
      select: {
        eventId: true,
        snapshot: true,
        event: {
          select: {
            organizer: { select: { userId: true } },
          },
        },
      },
    });
    const snapshot = eventSnapshotSchema.safeParse(revision?.snapshot);

    if (!revision || !snapshot.success) {
      return { message: "This registration form is unavailable." };
    }

    const session = await getSession();
    const user = session?.user.emailVerified ? session.user : null;

    if (session?.user.id === revision.event.organizer.userId) {
      return { message: "You cannot apply to attend your own event." };
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
      return await prisma.$transaction(
        async (tx) => {
          // Publication locks this same row. Keep its pointer stable until the
          // application is saved, and read it again after acquiring the lock.
          await tx.$queryRaw`
            SELECT "id" FROM "Event"
            WHERE "id" = ${revision.eventId}::uuid AND "publicId" = ${publicId}::uuid
            FOR UPDATE`;
          const currentEvent = await tx.event.findUnique({
            where: { id: revision.eventId, publicId },
            select: {
              organizer: { select: { userId: true } },
              publishedRevision: { select: { id: true, snapshot: true } },
            },
          });
          const unavailable = admissionError(
            currentEvent?.publishedRevision?.snapshot,
            user !== null,
          );

          if (unavailable) {
            return unavailable;
          }

          if (session && session.user.id === currentEvent?.organizer.userId) {
            return { message: "You cannot apply to attend your own event." };
          }

          // Reapplications must use today's form, not replay a withdrawn form.
          const previousWithdrawal = user
            ? await tx.application.findFirst({
                where: {
                  eventId: revision.eventId,
                  userId: user.id,
                  status: "WITHDRAWN",
                },
                select: { id: true },
              })
            : null;

          if (
            previousWithdrawal &&
            currentEvent?.publishedRevision?.id !== eventRevisionId
          ) {
            return {
              message:
                "The registration form has changed. Reload the event and complete the current form.",
            };
          }

          const finalAdmissionError = admissionError(
            currentEvent?.publishedRevision?.snapshot,
            user !== null,
          );

          if (finalAdmissionError) {
            return finalAdmissionError;
          }

          // Recheck current admission policy immediately before the atomic write.
          await tx.application.create({
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

          return { success: true };
        },
        { isolationLevel: "ReadCommitted" },
      );
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

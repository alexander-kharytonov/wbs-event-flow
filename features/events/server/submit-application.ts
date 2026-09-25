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

type SubmissionResult = ApplicationFormState & { success?: true };

// Prisma's PostgreSQL driver adapter reports the violated index in its cause.
const duplicateApplicationConstraint = z.object({
  driverAdapterError: z.object({
    cause: z.object({
      constraint: z.object({
        index: z.literal("Application_eventId_email_key"),
      }),
    }),
  }),
});

export async function submitAnonymousApplication(
  input: unknown,
): Promise<SubmissionResult> {
  const parsed = applicationInputSchema.safeParse(input);

  if (!parsed.success) {
    return {
      message: "Check your registration details.",
      errors: Object.fromEntries(
        parsed.error.issues.map((issue) => [
          String(issue.path[0]),
          issue.message,
        ]),
      ),
    };
  }

  const { publicId, eventRevisionId, fullName, email, answers } = parsed.data;

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

    if (snapshot.data.accountRequirement !== "OPTIONAL") {
      return { message: "An Event Flow account is required to register." };
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
  } catch {
    return {
      message: "We couldn’t submit your registration. Please try again.",
    };
  }
}

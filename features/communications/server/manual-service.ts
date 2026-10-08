import "server-only";
import { resolveManualAudience } from "@/features/communications/server/audience";
import {
  assertManualSendEligibility,
  enqueueManualCommunication,
  manualPreviewSchema,
  manualSendSchema,
} from "@/features/communications/server/manual-enqueue";
import { ManualCommunicationError } from "@/features/communications/server/manual-error";
import { prisma } from "@/lib/prisma";

export type ManualFailure = {
  success: false;
  error: string;
  fieldErrors?: Record<string, string>;
  ambiguous?: boolean;
};

function failure(error: unknown): ManualFailure {
  return {
    success: false,
    ambiguous: !(error instanceof ManualCommunicationError),
    error:
      error instanceof ManualCommunicationError
        ? error.message
        : "We couldn’t complete this request. Please retry the same message.",
  };
}

export async function previewManualMessage(
  actorUserId: string,
  rawInput: unknown,
) {
  const parsed = manualPreviewSchema.safeParse(rawInput);

  if (!parsed.success) {
    return {
      success: false,
      error: "Choose a valid audience.",
    } as ManualFailure;
  }

  try {
    const preview = await prisma.$transaction(
      async (tx) => {
        await tx.$executeRaw`SET TRANSACTION READ ONLY`;
        await tx.$executeRaw`SET LOCAL statement_timeout = '10s'`;
        await assertManualSendEligibility(tx, parsed.data.eventId, actorUserId);
        const resolved = await resolveManualAudience(
          tx,
          parsed.data.eventId,
          parsed.data.audience,
        );

        return {
          audience: parsed.data.audience,
          recipientCount: resolved.emails.length,
          unavailableCount: resolved.unavailableCount,
        };
      },
      { isolationLevel: "RepeatableRead", timeout: 15_000 },
    );

    return { success: true, ...preview } as const;
  } catch (error) {
    return failure(error);
  }
}

export async function sendManualMessage(
  actorUserId: string,
  rawInput: unknown,
) {
  const parsed = manualSendSchema.safeParse(rawInput);

  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};

    for (const issue of parsed.error.issues) {
      const field = String(issue.path[0]);

      if (["audience", "subject", "message"].includes(field)) {
        fieldErrors[field] ??= issue.message;
      }
    }

    return {
      success: false,
      error: "Check the message fields.",
      fieldErrors,
    } as ManualFailure;
  }

  try {
    const result = await prisma.$transaction(
      async (tx) => {
        await tx.$executeRaw`SET LOCAL statement_timeout = '10s'`;
        await tx.$executeRaw`SET LOCAL lock_timeout = '10s'`;

        return enqueueManualCommunication(tx, actorUserId, parsed.data);
      },
      { isolationLevel: "ReadCommitted", timeout: 30_000, maxWait: 5_000 },
    );

    return { success: true, ...result } as const;
  } catch (error) {
    return failure(error);
  }
}

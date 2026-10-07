import "server-only";
import type { StoredAnswer } from "@/features/events/resolve-historical-answer";
import {
  authorizeEventActor,
  type EventPermission,
  hasEventPermission,
} from "@/features/events/server/event-access";
import {
  checkRowLimit,
  createCsv,
  MAX_EXPORT_ROWS,
} from "@/features/exports/csv";
import {
  type AnswerColumn,
  answerCells,
  revisionColumns,
} from "@/features/exports/history";
import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";

export const exportPermissions = {
  applications: ["applications.read"],
  attendees: ["attendees.read.full", "applications.read"],
  attendance: ["attendees.read.full"],
  staff: ["staff.manage"],
} as const satisfies Record<string, readonly EventPermission[]>;

export type ExportDataset = keyof typeof exportPermissions;

const contextHeaders = ["Event title", "Event timezone"];
const headers = {
  applications: [
    ...contextHeaders,
    "Application ID",
    "Full name",
    "Email",
    "Status",
    "Submitted at",
    "Updated at",
    "Reviewed at",
    "Reviewer name",
    "Reviewer availability",
    "Withdrawn at",
    "Submitted revision",
  ],
  attendees: [
    ...contextHeaders,
    "Attendee ID",
    "Kind",
    "Name",
    "Email",
    "Admission status",
    "Created at",
    "Revoked at",
    "Registration ID",
    "Registration created at",
    "Registration revoked at",
    "Source application ID",
    "Primary name",
    "Submitted revision",
    "Answers scope",
  ],
  attendance: [
    ...contextHeaders,
    "Attendance ID",
    "Attendee ID",
    "Kind",
    "Name",
    "Email",
    "Registration ID",
    "Primary name",
    "Current admission status",
    "Checked in at",
    "Method",
    "Actor name",
    "Actor availability",
  ],
  staff: [...contextHeaders, "Name", "Email", "Role"],
};
const batchSize = 100;

async function history(
  tx: Prisma.TransactionClient,
  eventId: string,
  revisionIds: string[],
  fixedColumns: number,
) {
  const columns: AnswerColumn[] = [];
  const numbers = new Map<string, number>();
  // First read only revision identities/order, then bounded batches of JSON.
  const revisions = await tx.eventRevision.findMany({
    where: { eventId, id: { in: [...new Set(revisionIds)] } },
    orderBy: { number: "asc" },
    select: { id: true, number: true },
  });

  for (let start = 0; start < revisions.length; start += batchSize) {
    const batch = await tx.eventRevision.findMany({
      where: {
        eventId,
        id: {
          in: revisions.slice(start, start + batchSize).map(({ id }) => id),
        },
      },
      orderBy: { number: "asc" },
      select: { id: true, number: true, snapshot: true },
    });

    for (const revision of batch) {
      columns.push(
        ...revisionColumns(revision, fixedColumns + columns.length * 2),
      );
      numbers.set(revision.id, revision.number);
    }
  }

  return { columns, numbers };
}

async function answersFor(
  tx: Prisma.TransactionClient,
  applicationIds: string[],
) {
  const answers = await tx.applicationAnswer.findMany({
    where: { applicationId: { in: [...new Set(applicationIds)] } },
    select: {
      applicationId: true,
      fieldId: true,
      textValue: true,
      booleanValue: true,
      selectedOptions: { select: { optionId: true } },
    },
  });
  const result = new Map<string, StoredAnswer[]>();

  for (const answer of answers) {
    const group = result.get(answer.applicationId) ?? [];
    group.push(answer);
    result.set(answer.applicationId, group);
  }

  return result;
}

function historicalHeaders(
  dataset: "applications" | "attendees",
  columns: AnswerColumn[],
) {
  return [
    ...headers[dataset],
    ...columns.flatMap(({ header }) => [header, `${header} — state`]),
  ];
}

function admission(attendee: {
  revokedAt: Date | null;
  registration: { revokedAt: Date | null };
}) {
  return attendee.revokedAt === null && attendee.registration.revokedAt === null
    ? "ACTIVE"
    : "REVOKED";
}

const registrationSelect = {
  id: true,
  createdAt: true,
  revokedAt: true,
  sourceApplicationId: true,
  sourceApplication: { select: { eventRevisionId: true } },
  attendees: { where: { kind: "PRIMARY" }, select: { name: true } },
} satisfies Prisma.RegistrationSelect;

// Called only with a fresh session-derived userId. No client identity is accepted.
export async function buildEventCsv(
  userId: string,
  eventId: string,
  dataset: ExportDataset,
) {
  return prisma.$transaction(
    async (tx) => {
      const required = exportPermissions[dataset];
      const access = await authorizeEventActor(
        tx,
        eventId,
        userId,
        required[0],
      );

      if (
        !access ||
        !required.every((permission) =>
          hasEventPermission(access.role, permission),
        )
      ) {
        return null;
      }

      const event = await tx.event.findUniqueOrThrow({
        where: { id: eventId },
        select: { title: true, timezone: true },
      });
      const context = [event.title, event.timezone];
      let csv: string;

      if (dataset === "applications") {
        const rows = await tx.application.findMany({
          where: { eventId },
          orderBy: [{ createdAt: "asc" }, { id: "asc" }],
          take: MAX_EXPORT_ROWS + 1,
          select: {
            id: true,
            fullName: true,
            email: true,
            status: true,
            createdAt: true,
            updatedAt: true,
            reviewedAt: true,
            withdrawnAt: true,
            eventRevisionId: true,
            reviewedByUser: { select: { name: true } },
          },
        });
        checkRowLimit(rows.length);
        const { columns, numbers } = await history(
          tx,
          eventId,
          rows.map((row) => row.eventRevisionId),
          headers.applications.length,
        );
        const output = createCsv(historicalHeaders(dataset, columns));

        for (let start = 0; start < rows.length; start += batchSize) {
          const batch = rows.slice(start, start + batchSize);
          const answers = await answersFor(
            tx,
            batch.map(({ id }) => id),
          );

          for (const row of batch) {
            output.add([
              ...context,
              row.id,
              row.fullName,
              row.email,
              row.status,
              row.createdAt,
              row.updatedAt,
              row.reviewedAt,
              row.reviewedByUser?.name ?? null,
              row.reviewedByUser ? "AVAILABLE" : "UNAVAILABLE",
              row.withdrawnAt,
              numbers.get(row.eventRevisionId) ?? null,
              ...answerCells(
                columns,
                row.eventRevisionId,
                answers.get(row.id) ?? [],
                true,
              ),
            ]);
          }
        }

        csv = output.finish();
      } else if (dataset === "attendees") {
        const rows = await tx.attendee.findMany({
          where: { registration: { eventId } },
          orderBy: [{ createdAt: "asc" }, { id: "asc" }],
          take: MAX_EXPORT_ROWS + 1,
          select: {
            id: true,
            kind: true,
            name: true,
            email: true,
            createdAt: true,
            revokedAt: true,
            registration: { select: registrationSelect },
          },
        });
        checkRowLimit(rows.length);
        const { columns, numbers } = await history(
          tx,
          eventId,
          rows.map((row) => row.registration.sourceApplication.eventRevisionId),
          headers.attendees.length,
        );
        const output = createCsv(historicalHeaders(dataset, columns));

        for (let start = 0; start < rows.length; start += batchSize) {
          const batch = rows.slice(start, start + batchSize);
          const answers = await answersFor(
            tx,
            batch
              .filter((row) => row.kind === "PRIMARY")
              .map((row) => row.registration.sourceApplicationId),
          );

          for (const row of batch) {
            const registration = row.registration;
            const revisionId = registration.sourceApplication.eventRevisionId;
            const primary = row.kind === "PRIMARY";
            output.add([
              ...context,
              row.id,
              row.kind,
              row.name,
              row.email,
              admission(row),
              row.createdAt,
              row.revokedAt,
              registration.id,
              registration.createdAt,
              registration.revokedAt,
              registration.sourceApplicationId,
              primary ? null : (registration.attendees[0]?.name ?? null),
              numbers.get(revisionId) ?? null,
              primary ? "SOURCE_APPLICATION" : "NOT_APPLICABLE",
              ...answerCells(
                columns,
                revisionId,
                primary
                  ? (answers.get(registration.sourceApplicationId) ?? [])
                  : [],
                primary,
              ),
            ]);
          }
        }

        csv = output.finish();
      } else if (dataset === "attendance") {
        const rows = await tx.attendance.findMany({
          where: { attendee: { registration: { eventId } } },
          orderBy: [{ checkedInAt: "asc" }, { id: "asc" }],
          take: MAX_EXPORT_ROWS + 1,
          select: {
            id: true,
            checkedInAt: true,
            method: true,
            checkedInByUser: { select: { name: true } },
            attendee: {
              select: {
                id: true,
                kind: true,
                name: true,
                email: true,
                revokedAt: true,
                registration: {
                  select: {
                    id: true,
                    revokedAt: true,
                    attendees: {
                      where: { kind: "PRIMARY" },
                      select: { name: true },
                    },
                  },
                },
              },
            },
          },
        });
        checkRowLimit(rows.length);
        const output = createCsv(headers.attendance);

        for (const row of rows) {
          const person = row.attendee;
          output.add([
            ...context,
            row.id,
            person.id,
            person.kind,
            person.name,
            person.email,
            person.registration.id,
            person.kind === "GUEST"
              ? (person.registration.attendees[0]?.name ?? null)
              : null,
            admission(person),
            row.checkedInAt,
            row.method,
            row.checkedInByUser?.name ?? null,
            row.checkedInByUser ? "AVAILABLE" : "UNAVAILABLE",
          ]);
        }

        csv = output.finish();
      } else {
        const rows = await tx.eventStaff.findMany({
          where: { eventId },
          orderBy: [{ createdAt: "asc" }, { userId: "asc" }],
          take: MAX_EXPORT_ROWS,
          select: { role: true, user: { select: { name: true, email: true } } },
        });
        checkRowLimit(rows.length + 1);
        const owner = await tx.event.findUniqueOrThrow({
          where: { id: eventId },
          select: {
            organizer: {
              select: { user: { select: { name: true, email: true } } },
            },
          },
        });
        const output = createCsv(headers.staff);
        output.add([
          ...context,
          owner.organizer.user.name,
          owner.organizer.user.email,
          "OWNER",
        ]);

        for (const row of rows) {
          output.add([...context, row.user.name, row.user.email, row.role]);
        }

        csv = output.finish();
      }

      const slug =
        event.title
          .normalize("NFKD")
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, "-")
          .replace(/^-|-$/g, "")
          .slice(0, 80) || "event";

      return { csv, filename: `${slug}-${dataset}.csv` };
    },
    { isolationLevel: "RepeatableRead", timeout: 30_000 },
  );
}

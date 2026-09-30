import { createDecipheriv } from "node:crypto";
import { loadEnvConfig } from "@next/env";
import { Client } from "pg";

// The ONLY legacy Registration AAD reader. Never imported by production code.
function decryptLegacy(
  envelope: string,
  registrationId: string,
  purpose: string,
  key: Buffer,
) {
  const parts = envelope.split(".");

  if (parts.length !== 4 || parts[0] !== "v1") {
    throw new Error("Legacy envelope version");
  }

  const [iv, ciphertext, tag] = parts.slice(1).map((part) => {
    const bytes = Buffer.from(part, "base64url");

    if (bytes.toString("base64url") !== part) {
      throw new Error("Legacy envelope encoding");
    }

    return bytes;
  });

  if (iv.length !== 12 || ciphertext.length !== 43 || tag.length !== 16) {
    throw new Error("Legacy envelope dimensions");
  }

  const decipher = createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAAD(
    Buffer.from(`eventflow:ticket:v1:${registrationId}:${purpose}`),
  );
  decipher.setAuthTag(tag);

  return Buffer.concat([
    decipher.update(ciphertext),
    decipher.final(),
  ]).toString("utf8");
}

let phase = "environment";

async function main() {
  loadEnvConfig(process.cwd(), true);
  const { getServerEnv } = await import("../lib/env");
  const { encryptTicketSecret, decryptTicketSecret, hashTicketSecret } =
    await import("../lib/ticket-crypto");
  const env = getServerEnv();
  const client = new Client({ connectionString: env.DATABASE_URL });
  await client.connect();

  try {
    await client.query("BEGIN");
    await client.query("SET LOCAL lock_timeout = '10s'");
    await client.query(
      'LOCK TABLE "user", "Event", "Application", "Registration", "Attendee", "Ticket", "Attendance" IN ACCESS EXCLUSIVE MODE',
    );
    phase = "Application/Registration history preflight";
    const history = await client.query(`
      SELECT 1 FROM "Application" a FULL JOIN "Registration" r ON r."sourceApplicationId" = a.id
      WHERE (a.status = 'PENDING' AND (a."reviewedAt" IS NOT NULL OR a."withdrawnAt" IS NOT NULL))
        OR (a.status IN ('APPROVED', 'REJECTED') AND (a."reviewedAt" IS NULL OR a."withdrawnAt" IS NOT NULL))
        OR (a.status = 'WITHDRAWN' AND a."withdrawnAt" IS NULL)
        OR a."reviewedAt" < a."createdAt" OR a."withdrawnAt" < a."createdAt" OR a."withdrawnAt" < a."reviewedAt"
        OR a.email = '' OR a.email <> lower(btrim(a.email)) OR a.email ~ '[[:space:]]'
        OR CASE WHEN a.status = 'APPROVED' OR (a.status = 'WITHDRAWN' AND a."reviewedAt" IS NOT NULL)
          THEN r.id IS NULL OR r."eventId" IS DISTINCT FROM a."eventId" OR r."userId" IS DISTINCT FROM a."userId"
            OR r."attendeeName" IS DISTINCT FROM a."fullName" OR r."attendeeEmail" IS DISTINCT FROM a.email
            OR r."createdAt" IS DISTINCT FROM a."reviewedAt"
            OR r."revokedAt" IS DISTINCT FROM CASE WHEN a.status = 'WITHDRAWN' THEN a."withdrawnAt" ELSE NULL END
          ELSE r.id IS NOT NULL END LIMIT 1`);

    if (history.rowCount) {
      throw new Error("History inconsistent");
    }

    const legacy =
      (
        await client.query(
          `SELECT 1 FROM information_schema.columns WHERE table_schema = current_schema() AND table_name = 'Ticket' AND column_name = 'registrationId'`,
        )
      ).rowCount === 1;
    const registrations = (
      await client.query('SELECT * FROM "Registration" ORDER BY id')
    ).rows;
    const attendees = (
      await client.query('SELECT * FROM "Attendee" ORDER BY id')
    ).rows;
    const tickets = (
      await client.query(
        legacy
          ? 'SELECT * FROM "Ticket" ORDER BY id'
          : 'SELECT t.*, a."registrationId" FROM "Ticket" t JOIN "Attendee" a ON a.id = t."attendeeId" ORDER BY t.id',
      )
    ).rows;
    const attendance = (
      await client.query(
        legacy
          ? 'SELECT * FROM "Attendance" ORDER BY id'
          : 'SELECT h.*, a."registrationId" FROM "Attendance" h JOIN "Attendee" a ON a.id = h."attendeeId" ORDER BY h.id',
      )
    ).rows;
    const pristine =
      legacy &&
      attendees.length === 0 &&
      tickets.every((t) => t.attendeeId === null) &&
      attendance.every((h) => h.attendeeId === null);
    phase = "PRIMARY mapping / Ticket / Attendance preflight";

    if (
      tickets.length !== registrations.length ||
      attendees.some((a) => a.kind !== "PRIMARY")
    ) {
      throw new Error("Cardinality");
    }

    for (const r of registrations) {
      const matches = tickets.filter((t) => t.registrationId === r.id);

      if (
        matches.length !== 1 ||
        +matches[0].issuedAt !== +r.createdAt ||
        +matches[0].revokedAt !== +r.revokedAt
      ) {
        throw new Error("Ticket correspondence");
      }
    }

    for (const h of attendance) {
      const ticket = tickets.find((t) => t.id === h.ticketId);

      if (
        !ticket ||
        h.method !== "QR" ||
        h.registrationId !== ticket.registrationId ||
        (!pristine && h.attendeeId !== ticket.attendeeId)
      ) {
        throw new Error("Attendance provenance");
      }
    }

    const verifyMapping = async () => {
      const invalid =
        await client.query(`SELECT 1 FROM "Registration" r LEFT JOIN "Attendee" a ON a."registrationId" = r.id AND a.kind = 'PRIMARY'
        WHERE a.id IS NULL OR a."userId" IS DISTINCT FROM r."userId" OR a.name IS DISTINCT FROM r."attendeeName"
          OR a.email IS DISTINCT FROM r."attendeeEmail" OR a."createdAt" IS DISTINCT FROM r."createdAt"
          OR a."revokedAt" IS DISTINCT FROM r."revokedAt"
        UNION ALL SELECT 1 FROM "Attendee" WHERE kind <> 'PRIMARY'
        UNION ALL SELECT 1 FROM "Attendee" GROUP BY "registrationId" HAVING count(*) <> 1
        UNION ALL SELECT 1 FROM "Event" e WHERE
          (SELECT count(*) FROM "Registration" r WHERE r."eventId" = e.id AND r."revokedAt" IS NULL) <>
          (SELECT count(*) FROM "Attendee" a JOIN "Registration" r ON r.id = a."registrationId" WHERE r."eventId" = e.id AND a."revokedAt" IS NULL)`);

      if (invalid.rowCount) {
        throw new Error("PRIMARY identity/history/capacity mismatch");
      }
    };

    if (!pristine) {
      await verifyMapping();
    }

    // Preflight ALL old envelopes before creating a single mapping or changing an envelope.
    phase = "crypto integrity preflight";
    const secrets = new Map<
      string,
      { credential: string; access: string | null }
    >();

    for (const t of tickets) {
      const primary = attendees.find(
        (a) => a.registrationId === t.registrationId,
      );

      if (!pristine && (!primary || t.attendeeId !== primary.id)) {
        throw new Error("Partial migration");
      }

      if (
        (t.anonymousAccessHash === null) !==
        (t.anonymousAccessEncrypted === null)
      ) {
        throw new Error("Capability pair");
      }

      const read = (
        envelope: string,
        purpose: "credential" | "access",
        hash: string,
      ) => {
        const secret = pristine
          ? decryptLegacy(
              envelope,
              t.registrationId,
              purpose,
              Buffer.from(env.TICKET_CREDENTIAL_ENCRYPTION_KEY, "base64url"),
            )
          : decryptTicketSecret(envelope, t.attendeeId, purpose, hash);

        if (hashTicketSecret(secret) !== hash) {
          throw new Error("Secret hash mismatch");
        }

        return secret;
      };
      secrets.set(t.id, {
        credential: read(t.credentialEncrypted, "credential", t.credentialHash),
        access:
          t.anonymousAccessHash === null
            ? null
            : read(t.anonymousAccessEncrypted, "access", t.anonymousAccessHash),
      });
    }

    if (pristine) {
      phase = "PRIMARY backfill and AAD rebind";
      await client.query(`INSERT INTO "Attendee" (id, "registrationId", kind, "userId", name, email, "createdAt", "revokedAt")
        SELECT uuidv7(), id, 'PRIMARY', "userId", "attendeeName", "attendeeEmail", "createdAt", "revokedAt" FROM "Registration"`);
      const primaries = (
        await client.query('SELECT id, "registrationId" FROM "Attendee"')
      ).rows;

      for (const t of tickets) {
        const primary = primaries.find(
          (a) => a.registrationId === t.registrationId,
        );
        const secret = secrets.get(t.id);

        if (!primary || !secret) {
          throw new Error("Missing mapping");
        }

        await client.query(
          'UPDATE "Ticket" SET "attendeeId" = $1, "credentialEncrypted" = $2, "anonymousAccessEncrypted" = $3 WHERE id = $4',
          [
            primary.id,
            encryptTicketSecret(secret.credential, primary.id, "credential"),
            secret.access === null
              ? null
              : encryptTicketSecret(secret.access, primary.id, "access"),
            t.id,
          ],
        );
      }

      await client.query(
        'UPDATE "Attendance" h SET "attendeeId" = a.id FROM "Attendee" a WHERE a."registrationId" = h."registrationId"',
      );
    }

    phase = "post-migration preservation verification";
    await verifyMapping();
    const complete = (
      await client.query(
        'SELECT t.*, a."registrationId" FROM "Ticket" t JOIN "Attendee" a ON a.id = t."attendeeId" ORDER BY t.id',
      )
    ).rows;

    if (complete.length !== tickets.length) {
      throw new Error("Missing Ticket mapping");
    }

    for (const [i, t] of complete.entries()) {
      const old = tickets[i];
      const secret = secrets.get(t.id);

      for (const field of [
        "id",
        "number",
        "credentialHash",
        "anonymousAccessHash",
        "issuedAt",
        "revokedAt",
        "registrationId",
      ]) {
        if (JSON.stringify(t[field]) !== JSON.stringify(old[field])) {
          throw new Error("Ticket history changed");
        }
      }

      if (
        !secret ||
        decryptTicketSecret(
          t.credentialEncrypted,
          t.attendeeId,
          "credential",
          t.credentialHash,
        ) !== secret.credential ||
        (secret.access !== null &&
          decryptTicketSecret(
            t.anonymousAccessEncrypted,
            t.attendeeId,
            "access",
            t.anonymousAccessHash,
          ) !== secret.access)
      ) {
        throw new Error("Secret changed");
      }
    }

    const completeAttendance = (
      await client.query(
        'SELECT h.*, a."registrationId" FROM "Attendance" h JOIN "Attendee" a ON a.id = h."attendeeId" ORDER BY h.id',
      )
    ).rows;

    if (completeAttendance.length !== attendance.length) {
      throw new Error("Attendance count changed");
    }

    for (const [i, h] of completeAttendance.entries()) {
      const t = complete.find((t) => t.id === h.ticketId);

      if (!t || h.attendeeId !== t.attendeeId) {
        throw new Error("Attendance provenance changed");
      }

      for (const field of [
        "id",
        "checkedInAt",
        "checkedInByUserId",
        "method",
        "ticketId",
        "registrationId",
      ]) {
        if (JSON.stringify(h[field]) !== JSON.stringify(attendance[i][field])) {
          throw new Error("Attendance history changed");
        }
      }
    }

    await client.query("COMMIT");
    console.log(
      pristine
        ? "Attendee migration committed."
        : "Already migrated: verified no-op.",
      {
        registrations: registrations.length,
        tickets: tickets.length,
        attendance: attendance.length,
        anonymousCapabilities: tickets.filter(
          (t) => t.anonymousAccessHash !== null,
        ).length,
        revoked: registrations.filter((r) => r.revokedAt !== null).length,
        guests: 0,
        preservedSecretsAndHistory: true,
      },
    );
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    await client.end();
  }
}

main().catch(() => {
  // Never print database rows, query arguments, identities, envelopes or secrets.
  console.error(
    `Attendee migration failed at ${phase}; transaction rolled back. Investigate history/key/state before retrying.`,
  );
  process.exitCode = 1;
});

// Historical №19 backfill must run from the №19/20 release before №21A.
console.error(
  "Retired after Attendee cutover. Use db:migrate-attendees; missing historical Tickets must be investigated, never regenerated.",
);
process.exitCode = 1;

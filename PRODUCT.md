# Event Flow

Event Flow lets organizers publish events, collect applications, and review who
can attend. This document is the product-level source of truth for implemented
capabilities. [DOMAIN.md](DOMAIN.md) defines their invariants and boundaries;
[README.md](README.md) covers development setup.

## Identity

An Event Flow account uses email and password with email verification. A User is
a neutral identity and can apply to events without becoming an organizer.
Organizer access is activated explicitly through **Become an organizer**. Signing
up, signing in, or visiting the organizer onboarding page does not activate it.
Attendance is expressed through applications, not a separate attendee account or
role.

## Organizer experience

Organizers can:

- Open `/dashboard` and filter their events by All, Public, or Private. These
  filters reflect the organizer workspace settings, including unpublished edits.
- Create and edit event title, description, start/end, timezone, visibility,
  account requirement, capacity, and registration window.
- Build a registration form with short text, long text, single choice, multiple
  choice, and checkbox questions; edit, delete, reorder, and mark them required.
- Preview the current workspace and its registration form without submitting an
  application through Preview.
- Publish an event and republish subsequent changes. Editing alone does not
  change the public event. Republishing an already published unchanged version
  does not create another version.
- Open Applications and filter All, Pending, Approved, Rejected, or Withdrawn.
  Counts represent submitted attempts, not distinct people.
- Read an application's submitted details and historical answers, then approve
  or reject a pending application.

## Public events

`/e` lists published PUBLIC events, with the nearest upcoming event highlighted
and Upcoming, Happening now, and Past groups. An event is happening from its start
inclusive until its end exclusive. Past events remain in the catalog.

Published PUBLIC and PRIVATE events both have direct `/e/[publicId]` URLs with a
stable UUIDv7 publicId assigned on first publication. PRIVATE events are
excluded from discovery and marked noindex/nofollow; they are not password
protected. Public event content and catalog entries show the published version,
including its visibility, rather than unpublished organizer edits.

## Registration

Registration always collects full name and email, plus the questions on the
opened published form. OPTIONAL events accept anonymous applicants and signed-in
users; verified signed-in users use their account email. REQUIRED events require
a verified account, but do not require organizer activation.

The currently published account requirement and registration window control
whether submission is allowed. A previously opened form retains its questions
and answer meaning even if the event is republished, subject to the separate
reapplication rule below. A new account requirement applies to old open forms too.

Registration is Not open yet, Open, or Closed. It closes at the earlier of the
configured close time and event end, or at event end if no close time was set.
It may remain open after the event starts, but never after it ends. New event
settings cannot place registration opening or closing after event end.

Only approved applications occupy places. A full event can still receive pending
applications; approval waits until a place is available. Capacity may be unlimited.
Reducing published capacity below existing approvals keeps those approvals and
blocks further approvals until space is available.

## Applications

Each successful new submission creates a separate pending application for
organizer review. Submitted name, email, questions, and answers preserve the
meaning of that attempt. Later profile or form edits do not rewrite them.
Duplicate attempts receive a neutral confirmation without exposing another
application's existence or details.

A verified user can see their linked current application on the public event and
withdraw a pending or approved application before the currently published event
end. Withdrawal keeps the old attempt and frees a place if it was approved.
Anonymous applications are not claimed by signing in with a matching email and
cannot be withdrawn through the account flow.

After withdrawal, a linked user can apply again while registration is open. The
new attempt uses the current form, needs review again, and carries over answers
only to unchanged questions. Changed or newly required questions must be
completed as needed. Rejected applications cannot be withdrawn or retried with
the same event/email or event/account identity.

An authenticated event owner cannot submit a new application to their own event.
Existing eligible owner applications can still be withdrawn. This restriction
does not identify the physical person behind an anonymous submission.

## Account

`/account` is the verified user's workspace, with Overview, Registrations, and
Profile sections.
`/account/profile` lets users edit their name; email is displayed read-only. Overview
links to public events and organizer activation or the existing organizer dashboard.

`/account/registrations` shows linked Event registrations, one card per Event.
The current non-withdrawn attempt supplies Pending, Approved, or Rejected status;
otherwise the latest withdrawn attempt supplies Withdrawn. Linked PRIVATE events
and historical owner applications are included. Anonymous email matches are not
claimed. Cards show the current published title and schedule, including republished
changes, never unpublished edits or the historical submitted version.
Upcoming includes events that have not ended, ordered by start ascending; Past
contains ended events, ordered by end descending. Ties use publicId. View event
opens the existing public event withdrawal/reapplication flow.

Registration leads to `/verify-email`. Only the latest successfully sent
verification link is accepted; it is single-use and expires after one hour.
An email delivery failure preserves the previous link. Successful
verification signs the user in. Successful sign-in or verification returns to a
safe local contextual destination, or `/account` by default. An unverified sign-in
leads to the verification screen; requesting another email is an explicit action,
with a 60-second resend cooldown that also starts after successful registration.
Sign out is available in the shared account menu.

## Current boundaries

The product does not provide email changes or password reset, anonymous
application claiming, a full applicant attempt history/detail screen, or ticket/QR check-in.
These boundaries describe current scope, not a delivery roadmap.

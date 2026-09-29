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
Applications express requests; Registrations express granted admission. Neither
requires a separate attendee account or role.

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
- Open Attendees to read Active and Revoked registrations, with submitted name,
  email and grant/revocation dates. This view has no attendee mutation controls.

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

Only active Registrations occupy places. A full event can still receive pending
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
end. Approval atomically creates a Registration from the submitted identity.
Withdrawal keeps the old attempt and atomically revokes its Registration, freeing
a place if it was approved. Revoked admission remains in history.
Anonymous applications are not claimed by signing in with a matching email and
cannot be withdrawn through the account flow.

After withdrawal, a linked user can apply again while registration is open. The
new attempt uses the current form, needs review again and creates a new Registration
only on approval; old Registrations are never reactivated. It carries over answers
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
Active admission displays “Registration confirmed”; revoked admission remains
visible. The current non-withdrawn attempt supplies Pending, Approved, or Rejected status;
otherwise the latest withdrawn attempt supplies Withdrawn. Linked PRIVATE events
and historical owner applications are included. Anonymous email matches are not
claimed. Cards show the current published title and schedule, including republished
changes, never unpublished edits or the historical submitted version. Unpublished
events retain an unavailable card linking to registration history.
Upcoming includes events that have not ended, ordered by start ascending; Past
contains ended events, ordered by end descending. Ties use publicId. View event
opens the existing public event withdrawal/reapplication flow.

View registration opens `/account/registrations/[eventId]`, showing the current
application and expandable previous attempts with submitted identity, lifecycle
dates, admission grant/revocation context, and answers from each attempt's submitted form. If the current publication
is unavailable, the detail remains readable using safe submitted event context,
without unpublished workspace content or a View event action.

Registration leads to `/verify-email`. Only the latest successfully sent
verification link is accepted; it is single-use and expires after one hour.
An email delivery failure preserves the previous link. Successful
verification signs the user in. Successful sign-in or verification returns to a
safe local contextual destination, or `/account` by default. An unverified sign-in
leads to the verification screen; requesting another email is an explicit action,
with a 60-second resend cooldown that also starts after successful registration.
Sign out is available in the shared account menu.

## Current boundaries

Transactional email confirms each new application to its historical applicant
email (including anonymous applicants) and notifies the organizer. Reapplication
creates a new pair of notifications. Approval and rejection each notify the
applicant; withdrawal does not send email. Received applications remain pending
review. Rejection messages contain no rejection reason and may omit the Event
link when it is unavailable. Email delivery retries automatically, with rare
duplicate delivery possible after a crash. There are no notification preferences.

Organizer Applications and Attendees, My Registrations (including registration detail), and the
verified user's personalized application state on Public Event update in realtime
after application changes.
Realtime is a progressive enhancement: pages still render authoritative server
data, and a normal reload remains available if the connection is interrupted.
Anonymous applicants do not receive a personal status stream. Cancellation also invalidates affected linked attendees through this stream.
Catalog and other Event editing/publication updates are outside this realtime scope.

The product does not provide email changes or password reset, anonymous
application claiming or ticket/QR check-in.
These boundaries describe current scope, not a delivery roadmap.

## Event lifecycle

Lifecycle (scheduled or irreversibly cancelled), publication (published or
unpublished), visibility (PUBLIC/PRIVATE from the snapshot), and workspace
(active or archived) are independent axes. Upcoming, Ongoing, and Completed are
derived from persisted Event dates; cancellation takes precedence.

First publication is Upcoming only. Historically published events can republish
while Upcoming or Ongoing. Unpublish preserves the URL identity, all revisions,
and applications, but removes public access. Publishing again creates a new
revision even when content has not changed. Completed events cannot publish.

Upcoming workspaces are editable. During an ongoing event, the start is immutable
and a changed end must remain in the future. Completed, cancelled, and archived
workspaces are read-only. Applications freeze on completion or cancellation;
their statuses and historical answers are preserved. Cancellation, completion,
archive and restore do not revoke or rewrite Registration history.

Owners can cancel a previously published Upcoming/Ongoing event with a required,
trimmed reason of at most 2000 characters. Cancellation cannot be undone or edited.
It preserves publication: a published cancelled page remains readable with the
reason, but registration and application actions stop and the catalog excludes it.
Pending/approved applicants, including anonymous applicants, receive cancellation
email once per normalized address as a durable delivery intent. Delivery retains
the existing at-least-once semantics. Linked affected attendees receive realtime
invalidation. Registration cards/details show cancellation separately from status.

Archive is available only for Completed/Cancelled events. It moves the read-only
workspace to `/dashboard/archived` without changing publication, attendees, email, or attendee
realtime. Restore returns it to active My events without making it editable.
Hard Delete is limited to pristine drafts with no revisions, applications, registrations, public
identity, first publication timestamp, or cancellation. No soft deletion exists.

The archive has its own route and visibility filters. It offers no Create event
action; new drafts are created from active My events.

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
- Open Applications, search submitted name/email and select All, Pending, Approved,
  Rejected, or Withdrawn in the status filter.
  Counts represent submitted attempts, not distinct people.
- Read an application's submitted details and historical answers, then approve
  or reject a pending application.
- Open Attendees to read Active and Revoked admitted people, with submitted name,
  email and grant/revocation dates. Search name/email/Ticket number, filter admission
  and attendance, and open person details with owner-only Manual check-in.

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

Only active Attendees occupy places. A full event can still receive pending
applications; approval waits until a place is available. Capacity may be unlimited.
Reducing published capacity below existing approvals keeps those approvals and
blocks further approvals until space is available.

## Applications

Each successful new submission creates a separate pending application for
organizer review. Submitted name, email, questions, and answers preserve the
meaning of that attempt. Later profile or form edits do not rewrite them.
Duplicate attempts receive a neutral confirmation without exposing another
application's existence or details.

A verified user can see their linked current application on the public event or
their account registration-detail page and
withdraw a pending or approved application before the currently published event
end. Approval atomically creates a Registration, its PRIMARY Attendee from the submitted identity, and that person’s Ticket.
Withdrawal keeps the old attempt and atomically revokes its Registration and all active Attendees and Tickets, freeing
a place if it was approved. Revoked admission remains in history.
Anonymous applications are not claimed by signing in with a matching email and
cannot be withdrawn through the account flow.

After withdrawal, a linked user can apply again while registration is open. The
new attempt uses the current form, needs review again and creates a new Registration
with a new PRIMARY and Ticket only on approval; old Registrations, Attendees and Tickets are never reactivated. It carries over answers
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
application claiming.
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
workspace into the Archived filter in My events without changing publication, attendees, email, or attendee
realtime. Restore returns it to active My events without making it editable.
Hard Delete is limited to pristine drafts with no revisions, applications, registrations, public
identity, first publication timestamp, or cancellation. No soft deletion exists.

My events combines active and archived events with title search and independent
All/Active/Archived, All/Public/Private, and All/Upcoming/Ongoing/Completed/Cancelled
filters, each defaulting to All. Filter options have no counts, including on
Applications and Attendees. Filters are local UI state only; URL query
parameters do not initialize them.
There is no separate archive route.
The Archived filter offers no Create event action.

## Tickets

Registration holds the approved party’s ownership and lifecycle. Attendee is the
concrete admitted person and capacity seat; its Ticket is the immutable credential.
Registrations contain a PRIMARY and optional GUEST Attendees. Registration ownership and Attendee account association have separate
responsibilities, even though they currently match. The structural migration
preserves existing QR credentials, anonymous access tokens/URLs and Ticket history. Verified linked attendees see current and historical Tickets on their
Registration Detail. Applicants who were anonymous at Ticket issue receive a
separate private bearer link in approval email; no account is required. Anyone
holding that link can view this party’s Tickets and add/remove its Guests. It never grants whole-party withdrawal or claiming.
A linked User's deletion preserves history but does not create anonymous access.

Ticket cards show the submitted attendee identity, Event schedule, support number
and QR. Keep both the QR and anonymous link private. Revoked admissions/Tickets
and cancelled Events hide the QR. Completed Events retain Ticket history and may
still display QR; this makes no promise about check-in eligibility. Cancel,
completion, archive and publication changes never rewrite Ticket history.
Approval email links to authenticated detail or the separate anonymous capability;
it never contains the QR credential. Delivery checks current revocation and
cancellation before offering a Ticket CTA. Tickets are not transferable or
regenerable, and PDF and Wallet are not implemented.

## Check-in and attendance

Attendance is the immutable historical fact of a successful check-in, separate
from Application review, Registration admission and Ticket credentials. Verified
Event owner-organizers can scan Ticket QR codes online from Check-in beside
Attendees. Camera access starts on request and stays on between scans. Each scan
blocks further ticket submissions until the result arrives and the organizer
chooses Scan next. Stop scanner or leaving Check-in releases the camera.

New QR or MANUAL attendance requires an ongoing, non-cancelled Event and active
Registration and Attendee. QR additionally requires an active Ticket; Manual does
not require a present or active Ticket. The server uses persisted Event dates and
DB time: start inclusive, end exclusive. Publication and archive state do not independently gate check-in.
Ticket validity is not check-in eligibility.

Each Attendee can be checked in once through QR or owner-only Manual check-in.
Both record the authorized actor User. Repeat attempts show Already checked in
with the original time, including after later withdrawal or cancellation.
Attendance survives admission/Ticket revocation, cancellation, archive and
publication changes. There is no undo, check-out, re-entry or
offline scanning.

Attendees shows PRIMARY/GUEST details, Ticket status, attendance method/time and
actor (unavailable if deleted). Guests appear nested under their PRIMARY attendee,
grouped by Registration. Search and independent admission/attendance filters
match each person separately. A matching guest keeps their PRIMARY visible as
context, even when the PRIMARY does not match; non-matching guests stay hidden.
Matching only the PRIMARY does not reveal non-matching guests.
Filters apply to the loaded list; admission offers All/Active/Revoked, with All + All
as the default. Compact counters beside the heading are computed before
filters: Admitted = active Attendees, Checked in = active with Attendance, Not
arrived = active without Attendance. Capacity uses only the current valid published
snapshot and appears in the shared event header before the navigation tabs
(null is Unlimited, invalid
shows a warning, absent publication hides the capacity block). Revoked history remains
visible without contributing to operational counters. Linked Ticket details refresh
through the existing account stream; anonymous Ticket pages show attendance after reload. Check-in alone does not hide
the QR; existing revocation/cancellation visibility rules still apply.

## Guests / +1

The PRIMARY manages their Registration party through a verified account owner
session or their existing anonymous PRIMARY link. A Guest is an admitted person
and capacity seat, with a required name and optional email contact snapshot.
Email grants no identity or ownership. Guests have no account association or own
browser capability; their normal Tickets and Attendance use the existing QR flow.

Organizers configure 0–10 maximum active guests per registration in the Event
workspace and publish the policy. Zero disables adding guests. Historical v1
snapshots imply zero; new publications use v2. Add requires a current published
permission and available published capacity. Remove needs neither publication nor
a positive limit. Both require an active party, a non-cancelled Event, and time
strictly before the persisted event start; party composition then freezes.
Reducing the published guest limit never revokes existing Guests. Already removed
guests remain history and consume no seats. Whole-party withdrawal keeps its
existing lifecycle rules and revokes all active people and Tickets; reapplication
starts with a new PRIMARY only. Adding/removing Guests sends no email. Cancellation
recipients remain pending applicants and Registration/PRIMARY owners.

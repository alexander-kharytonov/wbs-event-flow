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
  and attendance, and open person details with authorized Manual check-in.

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
Event workspace editing, publication, unpublish, archive and restore also invalidate
open Event workspaces. Catalog and personal attendee streams do not receive these
workspace-only signals.

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

Event Edit keeps the exact stored instants of untouched dates even though inputs
show minutes. Editing a date uses the existing local-time/DST rules. Changing timezone
reinterprets local dates, except an ongoing event's locked start, which keeps its
instant and follows the new display zone. Valid exact intervals across a DST fold
are not blocked by local browser min/max hints, including during template review.

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
Event owners, Managers and Reception staff can scan Ticket QR codes online from Check-in beside
Attendees. Camera access starts on request and stays on between scans. Each scan
blocks further ticket submissions until the result arrives and the organizer
chooses Scan next. Stop scanner or leaving Check-in releases the camera.

New QR or MANUAL attendance requires an ongoing, non-cancelled Event and active
Registration and Attendee. QR additionally requires an active Ticket; Manual does
not require a present or active Ticket. The server uses persisted Event dates and
DB time: start inclusive, end exclusive. Publication and archive state do not independently gate check-in.
Ticket validity is not check-in eligibility.

Each Attendee can be checked in once through QR or authorized Manual check-in.
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
After the event starts, the Guests section is hidden if no guests were ever
added to that Registration. Existing guest tickets, including revoked ones,
remain visible in history.
Reducing the published guest limit never revokes existing Guests. Already removed
guests remain history and consume no seats. Whole-party withdrawal keeps its
existing lifecycle rules and revokes all active people and Tickets; reapplication
starts with a new PRIMARY only. Adding/removing Guests sends no email. Cancellation
recipients remain pending applicants and Registration/PRIMARY owners.


## Event staff

The owner remains the Event's organizer. Owners can directly assign existing verified
Event Flow users as Manager or Reception from the Staff tab, without invitations or
acceptance. Staff do not need an OrganizerProfile. Only owners add, change roles or
remove access; owners cannot assign themselves. Duplicate assignments with the same
role are harmless; changing a role is an explicit action. Removal deletes membership,
not past reviews or Attendance. Draft, cancelled, completed and archived Events keep
memberships; normal lifecycle guards still apply.

One Dashboard shows owned and assigned Events using the same cards with compact
Owner/Manager/Reception context. One Event workspace supplies permission-specific
navigation. Managers read applications and historical answers, review applications,
read full Attendees and perform QR/Manual check-in. Reception sees operational Event
context, active attendees and check-in, without email, applications/answers/counts,
revoked browsing or Attendance actor identity. Only owners edit Event/forms, preview
the draft, publish, change lifecycle and manage Staff. Manager and Reception can also
read the current Event description in Overview, using the same description as the owner.

Staff may apply to an Event, but cannot review their own linked Application. New
reviews record the acting User; historical unknown reviewers remain unknown. Membership
changes refresh open workspaces; revoked users see “Your access to this event has
changed.” and return to Dashboard. Role changes discard previous-role client state.
Direct visits to inaccessible Events or sections return neutral not-found responses.

## Badges (24A)

A badge is a derived presentation of one active Attendee, not a new admission,
credential or stored Badge entity. Printing never changes Attendance and can happen
before check-in. Owners and Managers have a Badges workspace; only owners configure
its layout. Reception has individual print access without a Badges tab.

Each Event has one operational layout, independent of Publish/Republish. A null layout
uses the built-in defaults. One layout supports 90 × 60, 85 × 54 and 100 × 70 mm,
either orientation, limited text settings and optional Event/type/
Ticket/QR fields. Padding sets the inner spacing on all sides from 0 to 10 mm
in whole millimeters (default 3 mm), shared by preview and print. Save affects newly
opened print documents.

Owners explicitly select up to two SHORT_TEXT, LONG_TEXT or SINGLE_CHOICE questions.
PRIMARY values come from the submitted Application revision only when field ID, type
and label match the selected descriptor. Missing values are omitted; incompatible
values are omitted with owner preview warnings. Guests never inherit PRIMARY answers.
Text is limited to two visible lines per field.

Reception may see the owner-approved individual BadgePresentation, including selected
custom values and the existing, decodable Ticket QR. This narrow exception does not
expose Applications, answer models, revision snapshots, email, the field catalog or
raw Ticket crypto fields. Printed/PDF data is not secret from its recipient.

Individual print opens explicitly in a separate tab without workspace chrome, using
fresh authorization, active Registration/Attendee checks and the current saved layout.
Cancelled Events deny printing. Draft, upcoming, ongoing, completed and archived Events
otherwise allow it. Missing, revoked or unavailable Tickets leave a visual badge
without a QR/available Ticket number. There is no new QR protocol or credential.

Designer previews prefer a real active PRIMARY, otherwise use semantic labels without
demo records. Preview QR areas are placeholders, not admission credentials. A print
document is a snapshot at load time and prints only after an explicit Print click.
Print documents include a thin dashed cutting guide inside each badge edge, without
changing its physical dimensions or content padding.
Browser/OS paper and scaling settings remain the operator's responsibility. There is
no Badge issuance or print history.

Individual operational printing (24B1): successful QR check-in offers Print badge;
Already checked in offers Reprint badge only when the server supplies a current
print target. Reprint describes the attendance context, not a recorded previous print.
The target is only an opaque selector hint; the separate print document rechecks
access and current eligibility. Opening it stops the scanner/camera but preserves
the result. Returning to the scanner does not restart the camera: only explicit
Scan next starts a new scan. No automatic printing or advancement occurs.

Owners, Managers and Reception can open Print badge from attendee detail, including
after Manual check-in refreshes Attendance. Notifications remain confirmations;
printing is a persistent detail action. Reception's attendee data is unchanged;
approved badge content is loaded only in the authorized print document.


Operational batch printing (24B2): OWNER has Design / Staff / Attendees sections;
MANAGER has Staff / Attendees, without Designer/settings/save. RECEPTION remains
individual-only and has no Badges workspace. Operational lists contain only attendee
ID/name/kind with Guest-of context, or team name/email/role. The Staff list uses
the shared Owner / Manager / Reception role labels; email is browsing-only. Printing
always uses the current saved/default design, never unsaved Designer changes.

Print selected accepts 1–200 unique active attendees (PRIMARY and GUEST), ordered by
Attendee.createdAt then id, independently of selection order. Any unavailable selector
rejects the entire document neutrally; selection does not reserve admission. A native
POST opens a separate tab. Refresh may resubmit POST and builds a new snapshot without
writing domain state. Print all active ignores search/selection and selects up to 200
current active attendees server-side. More results expose an explicit Print next batch
in the document, using live (createdAt, id) keyset continuation, never fixed historical
ranges or offset. Each document has one authoritative snapshot; the active set may
change between batches. Cancelled Events deny printing; Attendance is irrelevant.
Missing/revoked Tickets leave visual attendee badges without Ticket content.

Print event team uses Organizer first, then current staff in createdAt/userId order,
with controlled Organizer / Manager / Reception labels and authoritative User.name.
Team badges use the same design but always include role and never Ticket, QR,
authentication content or registration fields. More than 200 team members is refused;
there is no team batching or individual/selected team printing. Individual, bulk attendee and team
printing uses A4 portrait sheets with 10 mm margins and 3 mm gaps. Badges retain their
physical dimensions and orientation, with dashed cutting guides and automatic sheet
breaks (eight 90 × 60 mm badges per sheet). Individual printing uses the same document
with one badge. Printing remains explicit; choose A4 and 100% scale.
No schema migration, persistent Badge, TeamBadge, PrintJob, print history, vendor
printer integration or automatic printing is introduced.


## Event Overview (25)

The existing Overview adapts to the persisted Event lifecycle: readiness and
applications before start, attendance during the Event, and an operational
attendance summary after completion. Cancelled/archived workspaces retain their
read-only context. No separate Analytics tab or stored statistics exists.
Never-published Events remain preparation/readiness-first even after their scheduled
start or end, without rate, method breakdown, timeline or peak. Previously-published
Events retain lifecycle-appropriate operations/history when currently unpublished.
Reception retains its limited counters under a neutral Event operations heading.

All counts, method totals, timeline and peak use current active Attendees whose
Registration is also active, including PRIMARY and GUEST equally. Checked in means
an Attendance exists; not arrived is active minus checked in. Attendance rate is
checked in / active, or an em dash when no attendees are active. Revoked Attendance
remains immutable history but is excluded from Overview, even after completion.
The summary is not a count of all historical visits or unique physical people.

Owners and Managers see application status counts (submitted attempts), current
published capacity in the shared header, registration availability, attendance,
QR/Manual totals and the timeline. Capacity never falls back to draft values;
unpublished/invalid publication is unavailable and null capacity is Unlimited.
Reception receives only active/checked-in/not-arrived counters, existing operational
context/description and Attendees/Check-in links. Owner controls remain owner-only.

Attendance rate and timeline become prominent only during/after the Event.
Timeline intervals start at 30 elapsed minutes and double for long Events to keep
at most 192 scheduled buckets. Labels use Event timezone and UTC offset, including
DST repeated times. Peak uses those same buckets, with earliest winning ties;
zero arrivals have no peak. A table provides all interval values alongside the chart.
Open Overviews refresh on existing Event invalidations and once at the next lifecycle
boundary, without polling. Absolute boundary checks on timer callbacks and return to
a visible/active page handle delayed callbacks and device sleep; the server still
determines lifecycle. Cards open existing sections without implied URL filters.

## CSV data exports (26A)

The Event header Export menu downloads whole-Event datasets, independent of local
search and filters. Owners export Applications, Attendees, Attendance and Staff;
Managers export the first three; Reception has no export access. Exports remain
readable for completed, cancelled and archived Events while access is retained.

Applications include every attempt, including withdrawn submissions. Attendees
include PRIMARY/GUEST and revoked admission. Only PRIMARY rows contain source
Application answers; Guests have empty answers with NOT_APPLICABLE states and
PRIMARY name context. Attendance includes every recorded arrival, even after
admission revocation, with QR/Manual and available actor name. Staff includes the
owner first, then current Managers/Reception. Reviewer and actor names reflect
current linked accounts; unavailable identities are never replaced by the owner.

Historical answer columns are separated by submitted revision and question, with
human labels and adjacent VALUE/NOT_PROVIDED/NOT_APPLICABLE/UNAVAILABLE states.
Question and choice meanings come from the submitted snapshot, never today's form.
Invalid historical snapshots reject the whole export.

CSV uses UTF-8 with BOM, comma separators and quoted cells. Spreadsheet formula
mitigation may prefix dangerous text with an apostrophe, changing only the exported
representation. Spreadsheet applications may alter this protection when saving and
reopening files. Exports are complete or fail: at most 10,000 data rows, 500 total
columns and 20 MiB serialized output. Empty datasets produce headers only. No
partial file, persistent export file, export history or background job is created.

## Event template export (26B)

Owners can download **Export template** from the Event header Export menu.
The menu groups CSV datasets and JSON configuration separately. Template filenames
include a sanitized Event title followed by `-template-v1.json`, preserving Unicode.
EventTemplateV1 is portable configuration, not a backup or a public artifact:
it contains current staff emails. It uses current saved workspace configuration,
including unpublished Event, Registration Form and Badge Design changes.

The JSON contains title, nullable description, start/end, timezone, visibility,
account requirement, nullable capacity, maximum guests per registration, nullable
registration open/close dates, registration form, staff and nullable badge layout.
Dates retain their original instants, including past dates. Completed, cancelled
and archived Events can be exported without copying their lifecycle state.

Custom questions retain their array order, type, label, nullable description,
required flag and ordered option labels. Full name/email are built-in inputs,
not custom fields. Questions receive local keys field_1, field_2, etc.; database
identities are excluded. Badge bindings use those keys only when the saved
field ID, type and label exactly match a current question. A historical, deleted,
recreated or changed binding rejects the whole export and asks the owner to
update Badge Design. Invalid saved layouts also fail; null remains null and
legacy missing padding becomes 3 mm. Physical badge constraints remain unchanged.

Staff contains only current Manager/Reception assignments, ordered by assignment
creation time then user ID, with normalized email and role. The owner is excluded.
There are no Applications, Registrations, Attendees, Guests, Tickets, QR credentials,
Attendance, internal IDs, publication history, lifecycle state or notifications.

Template v1 allows at most 100 questions, 100 options per question, 1,000 options
in total, 100 staff and 512 KiB of serialized UTF-8 JSON. Exports are complete or
fail; these limits do not restrict manual editing. Downloads are private and
uncached. The v1 export contract remains unchanged by Import/Create (26C).
Duplicate Event is not implemented.


## Event template import / create (26C)

Create event defaults to manual entry in both the page and modal. A **Use template**
switch in the header opens template import.
Upload a UTF-8 JSON file or paste JSON, then Validate. Both use the same strict
parser, reject unsupported versions/unknown properties/internal identity fields,
and enforce the existing v1 limits. Preview performs no writes or account lookup.

Review allows editing Event settings, local questions/options, staff email/role,
and Badge Design before an explicit Create event. Loading another template resets
all review state. Manual Create retains its browser timezone default; imported
configuration retains its supplied timezone. Untouched imported dates keep their
exact instants, including seconds/milliseconds. Editing a date (or its timezone)
uses the existing local-time/DST validation. Dates are never shifted automatically.
Past dates are valid and warned about; a past end creates a Completed, read-only
Event under the existing lifecycle. Correct dates before Create if later editing
is needed.

Questions retain local identity through reorder/edit. Every created question and
option receives a new database identity. Badge bindings follow exact question
identity/type/label; removing or changing a referenced question blocks Create until
the owner explicitly fixes the binding or restores compatibility. Null design
remains the default. No operational badge preview/save action runs during review.

Create atomically saves a new unpublished Event owned by the current verified
Organizer, its Form, Badge Design and resolved Staff. Missing/unverified/self Staff
are neutral skips; same-role duplicate emails are combined and reported, while
conflicting roles fail validation. Unexpected database/integrity failure rolls
back the entire Event. No publication, history, Applications, Registrations,
Attendees, Tickets or Attendance are imported. Existing Events are never modified.

Add Staff and Import share an in-process budget of 100 unique normalized email
attempts per actor per ten-minute window. An import reserves its entire unique
email count before any lookup or creation; insufficient budget rejects the whole
attempt. Repeated operations consume budget again. This is not a distributed
abuse-prevention guarantee. Successful assignment reveals eligibility as with
existing Add Staff; unavailable reasons and account metadata are never returned.

After creation, the import result shows added Staff count and neutral skipped/
duplicate email warnings, followed by Open event. Results stay in memory and may
vanish on reload; no emails are placed in navigation URLs, cookies or persistent
browser storage. There is no ImportJob, invitation, destructive import or Duplicate
Event flow.

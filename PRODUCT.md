# Event Flow

Event Flow lets organizers publish events, collect applications, and review who
can attend. This document is the product-level source of truth for implemented
capabilities. [DOMAIN.md](DOMAIN.md) defines their invariants and boundaries;
[README.md](README.md) covers development setup.

## Product landing page

The home page explains the implemented organizer journey from draft and publication
through application review, tickets and check-in. It introduces event pages, custom
forms, team roles, communications, badges, duplication and exports, with a separate
attendee path and FAQ. It makes no pricing, payment, customer-count or testimonial
claims. The organizer CTA preserves the existing signed-in/onboarding flow; public
event discovery and account registration remain available as separate paths.

Page content and links render on the server. Motion enhances visible sections after
hydration with a headline reveal, a sequential flow diagram, section accents and
staggered attendee steps. Feature icons and CTA arrows react subtly to hover.
Animations run once on entry without continuous loops; they do not hide SSR content or
require JavaScript for reading, navigation or the native FAQ disclosures. Reduced
motion disables these animations. No business data is created by the landing page.

## Identity

An Event Flow account uses email and password with email verification, or Google
with a verified Google email when OAuth is configured. A User is
a neutral identity and can apply to events without becoming an organizer.
Organizer access is activated explicitly through **Become an organizer**. Signing
up, signing in, or visiting the organizer onboarding page does not activate it.
Applications express requests; Registrations express granted admission. Neither
requires a separate attendee account or role.

## Organizer experience

Organizers can:

- Open `/dashboard` for an Organizer Dashboard with owned-event lifecycle totals,
  applications awaiting review, pending work grouped by Event, the next five
  upcoming Events, and Create Event / My Events / Staff Events quick actions.
- Open `/dashboard/events` (My Events) for the existing owned-event cards, search,
  archive, visibility and lifecycle filters. These reflect workspace settings,
  including unpublished edits. Existing Event management URLs are unchanged.
- Create and edit event title, content language, description, start/end, timezone, visibility,
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

Dashboard lifecycle totals include all owned workspaces, including archived ones,
using the persisted start/end and cancellation precedence. Cancelled Events are
excluded from Upcoming/Ongoing/Completed totals. Applications awaiting review counts
PENDING attempts only for non-archived, non-cancelled Events that have not ended,
excluding the actor's own historical linked applications. Unpublished Events may
still require rejection/review; approval retains all existing publication/capacity guards.
Requires Attention links to each Event's existing Applications screen, without
implying a preselected status filter. Upcoming Events shows the nearest five
non-archived, non-cancelled owned Events with their timezone, publication state,
and relevant pending count. Empty sections explain the next available action.

Desktop/mobile navigation distinguishes Dashboard, My Events and Staff Events.
My Events is shown for activated organizers; Staff Events is shown only with an
existing non-owned assignment. Staff-only users can open Dashboard for their Staff
Events shortcut and optional organizer activation. Attendee-only users retain account,
registrations and organizer activation navigation. No GET activates organizer access.
Dashboard data refreshes on navigation/reload and at the next owned Event start/end;
it does not add polling or one realtime stream per Event.

## Public events

`/e` lists published PUBLIC events, with the nearest upcoming event highlighted
and Upcoming, Happening now, and Past groups. An event is happening from its start
inclusive until its end exclusive. Past events remain in the catalog.

Published PUBLIC and PRIVATE events both have direct `/e/[publicId]` URLs with a
stable UUIDv7 publicId assigned on first publication. PRIVATE events are
excluded from discovery and marked noindex/nofollow. Organizers may optionally
protect PRIVATE events with a password (see Private event password protection below). Public event content and catalog entries show the published version,
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
It may remain open after the event starts, but never after it ends. Event settings
and frozen publication snapshots require registration opening no later than event
start and closing no later than event end. When both registration boundaries are set, closing must be
after opening. Event end must be after event start. Create/Edit and template review
date fields provide linked calendar min/max bounds; explicit validation explains
invalid date combinations.

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
end. Approval atomically creates a Registration, its PRIMARY Attendee from the submitted identity, and one Ticket per admitted person. All declared guests are admitted in the same transaction.
Withdrawal keeps the old attempt and atomically revokes its Registration and all active Attendees and Tickets, freeing
all occupied party places if it was approved. Revoked admission remains in history.
Anonymous applications are not claimed by signing in with a matching email and
cannot be withdrawn through the account flow.

After withdrawal, applicants can apply again while registration is open. The
new attempt uses the current form, needs review again and creates a new Registration
with a new PRIMARY and Ticket only on approval; old Registrations, Attendees and Tickets are never reactivated. It carries over answers
only to unchanged applicant questions for linked users; guest declarations and answers
are never copied automatically. Changed or newly required questions must be
completed as needed. Rejected applications cannot be withdrawn or retried with
the same event/email or event/account identity.

An authenticated event owner cannot submit a new application to their own event.
Existing eligible owner applications can still be withdrawn. This restriction
does not identify the physical person behind an anonymous submission.

## Private anonymous application access

A newly submitted anonymous application gets an independent, attempt-specific private
link in its application-received email. The public submission response remains neutral,
including duplicate attempts. Matching an email address never grants access or claims
an application. Existing applications without this credential do not gain one retroactively.

The link uses `/application#<capability>` and the same protected POST exchange pattern as
Tickets. The bearer never enters URL paths or queries. A two-hour HttpOnly, same-site
session opens a credential-free application URL. It grants only that attempt's details,
declared guests and confirmed withdrawal, including the entire party after approval.
Ticket viewing and guest management still require the independent Ticket link.

Withdrawal requires the existing Event lifecycle checks and explicit confirmation that
approval, reserved places and active Tickets will be lost. The transaction revokes the
whole active party and clears application access. Old links and sessions then fail closed;
a new anonymous submission gets a new private link and needs organizer approval again.
No old guest answers or credentials are copied. Anonymous forms retain ordinary opened
revision rules; linked reapplication additionally requires the current revision as before.

## Account

`/account` is the verified user's workspace, with Overview, Registrations, and
Profile sections in a persistent tabbed workspace. It shares the Event editor's
responsive MUI Tabs: a 240px sidebar on desktop and horizontal tabs on mobile,
with CSS determining layout before hydration. Existing section URLs, direct links,
refresh and browser history are preserved; registration details keep Registrations
active. Loading and error content stays inside the shared workspace.
`/account/profile` lets users edit their name; email is displayed read-only. Overview
links to public events and organizer activation or the existing organizer dashboard.
Profile Save is disabled without changes, while pending or when the name is blank.
Successful Save keeps the page open and updates the clean baseline. Ordinary app
links (including Account tabs) and Sign out use the shared discard confirmation
when profile edits are unsaved. Reload/tab close has best-effort beforeunload
protection; browser history and OS termination are not guaranteed to prompt.

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

Google is available on Sign In and Registration when configured. Matching email
addresses never merge accounts automatically: sign in using the existing login
method, then explicitly connect Google in Profile. Linking requires a verified
session and a Google account with the same email; an identity already linked to
another User is rejected. Cancelling or failing OAuth shows retryable feedback.
Profile shows Google connection status and allows confirmed disconnection only
when an email/password login remains. Google-only users cannot disconnect their
only login method; adding a password is outside this scope. Stale sessions require
signing out and signing in again. Connecting Google uses the shared unsaved-edit
confirmation before leaving Profile. Google may supply the avatar, displayed with
an initials fallback if unavailable; linking preserves the user's name and email.
No image uploads or image storage are introduced.

Email/password account registration leads to `/verify-email`. Only the latest successfully sent
verification link is accepted; it is single-use and expires after one hour.
An email delivery failure preserves the previous link. Successful
verification signs the user in. Successful sign-in or verification returns to a
safe local contextual destination, or `/account` by default. An unverified sign-in
leads to the verification screen; requesting another email is an explicit action,
with a 60-second resend cooldown that also starts after successful registration.
Sign out is available in the shared account menu.

## Form feedback and shared UI

Text fields and selects use the shared theme's outlined appearance, including
focus, error and disabled states. Disabled fields have a muted background and
dashed outline to distinguish them from editable fields. Empty collection views reuse EmptyState with
an icon, title, description and an optional action.

Form submission actions are disabled while required values are missing or their
request is pending. Once required values are filled, formatting errors do not
disable submission: client validation runs on submit and explains them without
native browser validation popups. Invalid fields show inline errors until their
value is edited; editing one field preserves errors on unrelated fields. Server
field errors use the same presentation. Errors without a matching field appear
in an Alert above the submission action. In the cover editor, file selection and
media operation errors use shared notifications; field errors remain inline.
An empty or unmapped server field-error object must not hide the server message.
Version-conflict feedback and its reload action remain visible while editing.

Existing authorization, lifecycle and workflow guards still apply. Independent
actions, such as updating the recipient estimate, require only their own inputs;
they do not require unrelated message fields to be complete.
Server validation, authorization and lifecycle rules remain authoritative.

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
and a changed end must remain in the future. Configuration of completed, cancelled,
and archived Events is read-only. Operational actions, including Staff management,
Badge printing and Communications, retain their separately documented eligibility
rules. Applications freeze on completion or cancellation;
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
responsibilities; the PRIMARY account association matches party ownership, while
GUEST has no linked account. QR credentials, anonymous access tokens and
Ticket history remain immutable. Verified linked attendees see current and historical Tickets on their
Registration Detail. Applicants who were anonymous at Ticket issue receive a
separate private bearer link in approval email; no account is required. Anyone
holding that link can view this party’s Tickets and manage Guests by removing guests before Event start.
The Ticket link never grants whole-party withdrawal or claiming. A separate application
link in the application-received email grants application-scoped viewing and withdrawal.
Private email links deliver the existing anonymous capability in a URL fragment
(`/ticket#<capability>`), which is not sent in the HTTP URL. JavaScript exchanges
it through a protected POST, clears the fragment on success, and opens a
credential-free Ticket URL. A Secure production, HttpOnly, same-site cookie is
scoped to that Ticket path and expires after two hours without automatic renewal.
Refresh, navigation and locale changes retain the session; after expiry, reopen
the private email link. Multiple Ticket paths keep independent sessions.
Invalid or expired access shows neutral feedback. Old path-based bearer links
are unsupported and must not be opened through production ingress.
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

## Guest registration and group admission

Organizers configure only Allow guests and Maximum guests per applicant (0–10;
zero means disabled). Every participant completes the same Registration Form Builder
questions, including identical field types, options and required rules. Full name and
email are required for the primary and each guest. Each participant's answers are
independent. Guest email is contact data and never grants an account, ownership,
application access or a private management capability. Guests do not need accounts.

Applicants declare zero to the opened revision's guest limit during initial registration.
The complete group is saved atomically against that immutable EventRevision. Pending
applications reserve no places. Owners and Managers review every participant and their
historical answers before approval. Approval admits the entire group and issues all
Tickets atomically, only if current published capacity fits everybody. Concurrent
approval, publication, removal and withdrawal retain the Event lock.

After approval, guests cannot be added, replaced or restored. The linked party owner or
independent anonymous PRIMARY Ticket capability can remove guests before persisted
Event start, without requiring publication or a positive guest limit. Removal revokes
the guest's Ticket and releases their place, preserving declaration and answer history.
Adding guests requires withdrawal and a new application with renewed approval. Whole
party withdrawal revokes active admission, Tickets and application credentials; a new
attempt never reuses old credentials or automatically copies guests.

There is one shared form and no policy selector, policy lock, separate guest questions
or policy-specific publication guard. Changed questions/limits affect new publications,
never existing submissions. Templates carry the shared form and remap field/option IDs.
Snapshots/templates use one strict current contract, without compatibility readers or
versioning. The current clean-installation schema contains only the shared form
and complete guest declaration provenance. Submitted history stays immutable within
this contract. The approved demo clean release discards existing demo data rather
than converting it; deployment/reset are separate controlled operations.

## Event staff

The owner remains the Event's organizer. Owners can directly assign existing verified
Event Flow users as Manager or Reception from the Staff tab, without invitations or
acceptance. Staff do not need an OrganizerProfile. Only owners add, change roles or
remove access; owners cannot assign themselves. Duplicate assignments with the same
role are harmless; changing a role is an explicit action. Removal deletes membership,
not past reviews or Attendance. Draft, cancelled, completed and archived Events keep
memberships; normal lifecycle guards still apply.

My Events (`/dashboard/events`) shows only owned Events. Staff Events
(`/dashboard/staff`) uses the same card/list component for current assignments,
with Manager/Reception context and no application counts or attendee data.
Owned Events are excluded even if a Staff relationship also exists. Removed
assignments disappear on the next server read; existing Event access rechecks and
neutral not-found responses remain authoritative. One Event workspace supplies
permission-specific
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

## Badges

A badge is a derived presentation of one active Attendee, not a new admission,
credential or stored Badge entity. Printing never changes Attendance and can happen
before check-in. Owners and Managers have a Badges workspace; only owners configure
its layout. Reception has individual print access without a Badges tab.

Each Event has one operational layout, independent of Publish/Republish. A null layout
uses the built-in defaults. One layout supports 90 × 60, 85 × 54 and 100 × 70 mm,
either orientation, limited text settings and optional Event/type/
Ticket/QR fields. Padding sets the inner spacing on all sides from 0 to 10 mm
in whole millimeters (default 10 mm), shared by preview and print. Saved layouts
retain their explicitly configured padding. Save affects newly
opened print documents.

Owners explicitly select up to two SHORT_TEXT, LONG_TEXT, SINGLE_CHOICE or
MULTIPLE_CHOICE questions. Multiple-choice values list selected option labels
separated by a comma and space, in the submitted form's option order.
Each slot references a question from the shared registration form. Values resolve
for the specific attendee from their submitted Application or linked guest declaration,
using that immutable revision and exact field ID/type/label. Guests never inherit the
primary participant's answers.
The designer can preview Applicant or Guest, using semantic labels when that type has
no active attendee. CHECKBOX questions are excluded from badge selection. Missing
values are omitted; incompatible
values are omitted with owner preview warnings. Guests never inherit PRIMARY answers.
Text is limited to two visible lines per field.

Reception may see the owner-approved individual BadgePresentation, including selected
attendee custom values and the existing, decodable Ticket QR. This narrow
exception does not
expose Applications, answer models, revision snapshots, email, the field catalog or
raw Ticket crypto fields. Selecting a question for the badge explicitly authorizes its
value for all staff permitted to print that badge. Unselected guest answers never enter
print HTML, PDF or client state. Reception cannot configure layouts or export CSV.
Printed/PDF data is not secret from its recipient.

Individual print opens explicitly in a separate tab without workspace chrome, using
fresh authorization, active Registration/Attendee checks and the current saved layout.
Cancelled Events deny printing. Draft, upcoming, ongoing, completed and archived Events
otherwise allow it. Missing, revoked or unavailable Tickets leave a visual badge
without a QR/available Ticket number. There is no new QR protocol or credential.

Designer previews use an active attendee of the selected type, otherwise semantic
labels and, when enabled, the ticket-number placeholder `EF-XXXX-XXXX`, without demo
records. The number placeholder appears only in previews without an attendee.
Preview QR areas are placeholders, not admission credentials. A print
document is a snapshot at load time and prints only after an explicit Print click.
Print documents include a thin dashed cutting guide inside each badge edge, without
changing its physical dimensions or content padding.
Browser/OS paper and scaling settings remain the operator's responsibility. There is
no Badge issuance or print history.

Individual operational printing: successful QR check-in offers Print badge;
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


Operational batch printing: OWNER has Design / Staff / Attendees sections;
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


## Event Overview

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

## CSV data exports

The Event header Export menu downloads whole-Event datasets, independent of local
search and filters. Owners export Applications, Attendees, Attendance and Staff;
Managers export the first three; Reception has no export access. Exports remain
readable for completed, cancelled and archived Events while access is retained.

Applications include every attempt, including withdrawn submissions: one APPLICANT
row followed by each declared GUEST in declaration order. Row subject, Application ID,
Registration ID (when admitted), Guest declaration ID, one-based Guest position and
separate Guest name/email retain group relationships without treating a declaration as
admission. Applicant identity/status context repeats on guest rows; answers do not.
Attendees include PRIMARY/GUEST and revoked admission. PRIMARY rows contain source
Application answers; declared guests contain their own historical answers with
GUEST_DECLARATION scope and Guest declaration ID. Guest rows retain PRIMARY name context. Attendance includes
every recorded arrival, even after
admission revocation, with QR/Manual and available actor name. Staff includes the
owner first, then current Managers/Reception. Reviewer and actor names reflect
current linked accounts; unavailable identities are never replaced by the owner.

Historical answer columns are separated by submitted revision and question, with
human labels, type, revision number and stable revisionId:fieldId identifiers,
with adjacent VALUE/NOT_PROVIDED/NOT_APPLICABLE/UNAVAILABLE states. Every participant uses the same answer columns, with values from their own answers.
Questions from another revision are NOT_APPLICABLE.
Removed guests remain exportable history, with revoked admission in Attendees.
Question and choice meanings come from the submitted snapshot, never today's form.
Invalid historical snapshots reject the whole export.

CSV uses UTF-8 with BOM, comma separators and quoted cells. Spreadsheet formula
mitigation may prefix dangerous text with an apostrophe, changing only the exported
representation. Spreadsheet applications may alter this protection when saving and
reopening files. Exports are complete or fail: at most 10,000 data rows, 500 total
columns and 20 MiB serialized output. Empty datasets produce headers only. No
partial file, persistent export file, export history or background job is created.

## Event template export

Owners can download **Export template** from the Event header Export menu.
The menu groups CSV datasets and JSON configuration separately. Template filenames
include a sanitized Event title followed by `-template.json`, preserving Unicode.
EventTemplate is the only supported format and includes the rich
configuration described in Rich Event editor and EventTemplate below. A template is portable
configuration, not a backup or a public artifact:
it contains current staff emails. It uses current saved workspace configuration,
including unpublished Event, Registration Form and Badge Design changes.

The JSON contains title, nullable description, start/end, timezone, visibility,
account requirement, nullable capacity, maximum guests per registration, nullable
registration open/close dates, registration form, staff and nullable badge layout.
Dates retain their original instants, including past dates. Completed, cancelled
and archived Events can be exported without copying their lifecycle state.

Custom questions retain their order, type, label, nullable description,
required flag and ordered option labels. Full name/email are built-in inputs,
not custom fields. Questions receive local keys field_1, field_2, etc.; database
identities are excluded. Badge bindings use those keys only when the saved
field ID, type and label exactly match a current shared registration question. A
historical, deleted,
recreated or changed binding rejects the whole export and asks the owner to
update Badge Design. Invalid saved layouts also fail; null remains null and
saved layouts require explicit padding and reject obsolete preset fields. Physical
badge constraints remain unchanged.

Staff contains only current Manager/Reception assignments, ordered by assignment
creation time then user ID, with normalized email and role. The owner is excluded.
There are no Applications, Registrations, Attendees, Guests, Tickets, QR credentials,
Attendance, internal IDs, publication history, lifecycle state or notifications.

EventTemplate allows at most 100 questions, 100 options per question, 1,000 options
in total, 100 staff and 512 KiB of serialized UTF-8 JSON. Exports are complete or
fail; these limits do not restrict manual editing. Downloads are private and
uncached. Import/Create uses the same strict EventTemplate contract.
Duplicate Event reuses this portable configuration (see Duplicate event below).


## Event template import / create

Create event defaults to manual entry in the full-page workspace editor. A **Use template**
switch in the header opens template import.
Upload a UTF-8 JSON file or paste JSON, then Validate. Both use the same strict
parser, reject obsolete properties and internal identity fields,
and enforce the same template limits. Preview performs no writes or account lookup.

Review allows editing Event settings, local questions/options, staff email/role,
and Badge Design before an explicit Create event. Replacing a template asks before discarding local edits and then resets
all review state. Uploaded replacements are read and validated before confirmation;
cancelled replacements and invalid or unreadable files preserve the existing JSON
and Review. A successful upload still requires Validate to open a new Review.
Manual Create retains its browser timezone default; imported
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
attempt. New operations consume budget again; replaying a successful creation
receipt does not repeat lookup or budget consumption. This is not a distributed
abuse-prevention guarantee. Successful assignment reveals eligibility as with
existing Add Staff; unavailable reasons and account metadata are never returned.

After successful manual or template creation, the app immediately opens the new
Event editor. Import shows added Staff count and neutral skipped/duplicate email
warnings in a notification that remains visible after navigation. Client notifications stay in
memory and may vanish on reload; the private server retry receipt retains the result.
No emails are placed in navigation URLs, cookies or persistent
browser storage. There is no ImportJob, invitation or destructive import.

## Communications foundation

Communication stores one immutable logical send for one Event, with kind
(MANUAL/TRANSACTIONAL), optional transactional trigger, actor name/role snapshot,
manual audience, subject/message, versioned semantic context, recipient count,
and Event-scoped idempotency key/request digest. EmailOutbox is its only
per-recipient delivery authority; each associated row freezes a normalized email.
There is no third delivery table. History retention is the lifetime of the Event:
Event/Communication deletion is restricted by history/delivery references. Actor
account deletion clears only its FK, preserving the name/role snapshot; Staff
removal never rewrites history.

Owner and Manager have explicit communications.read and communications.send;
Reception has neither. Manual sending requires send permission, at least
one historical EventRevision and an unarchived Event. Thus never-published Draft
and Archived are history-only; published Upcoming, Ongoing, Completed, previously
published Cancelled, and restored previously published Events allow sending.
Unpublish does not erase publication history. Archive/Restore preserve history
and queued deliveries, never restart old sends or generate new emails.

Manual audience v1 is All active attendees, Primary attendees, Checked in, Not
arrived, Pending applications, or Event staff. Approved applications are not an
audience. Subject is 1–200 Unicode code points on one safe line; message is
1–10,000, with normalized CRLF, ordinary newlines/tabs and no unsafe controls.
Manual rendering uses the shared Event Flow shell, escaped text and a plain-text
alternative, server-owned From, and no custom HTML, Reply-To, CTA or tracking.
Semantic history never copies Ticket credentials or anonymous capability URLs;
the existing approval delivery still supplies its private access link when eligible.

Delivery status means queued (PENDING), claimed (PROCESSING), accepted by the email transport
(SENT), or automatic attempts exhausted (FAILED). SENT does not prove mailbox
delivery or opening. One logical recipient intent can result in at-least-once
physical email delivery. Existing five attempts and delays of 1 minute, 5 minutes,
30 minutes and 2 hours remain the minimum delays; Resend Retry-After and quota
reset times can extend them.

Manual admission limits are 1,000 unique recipients per communication,
5 sends per Event/hour, 10 per actor/hour, and 2,000 outstanding recipients per
Event / 10,000 globally. Outstanding means PENDING or PROCESSING. DB transaction
locks enforce these limits under concurrent submissions; these limits never apply to
transactional emails, including Event cancellation.

Communications includes transactional Event emails, manual Send, unified History
and delivery details, as described below. Every delivery belongs to a Communication
with a required request digest. Delivery uses the existing Outbox infrastructure; there is
no Communication cleanup/retention job.


## Transactional Communications integration

Every new APPLICATION_RECEIVED, NEW_APPLICATION, APPLICATION_APPROVED,
APPLICATION_REJECTED and EVENT_CANCELLED intent belongs to a Communication.
Submission creates two logical Communications: applicant confirmation and current
Event owner notification. Reapplication has a new Application identity and its own
pair. Approval/rejection each create one Communication for the actual transition.
Cancellation creates one grouped Communication for the existing normalized unique
pending Application and active Registration contact addresses, without Guest or
extra Staff recipients. Empty cancellation audiences record recipientCount=0,
with no Outbox rows and no delivery claim; the cancellation still happened.

Mutation, Communication, frozen Outbox recipients/payloads and notification commit
atomically. An enqueue error rolls back the domain action; a subsequent delivery
failure does not. Ticket CTA/private anonymous access, dynamic delivery
eligibility, retries and at-least-once guarantee are
unchanged. History keeps stable English subject labels from the email dictionary;
email localization translates delivered subjects and text/HTML per recipient.

History stores only the trigger and safely available frozen Event title, never
applicant identity/answers, Ticket references, credentials or capability URLs.
Public/applicant submission notifications have no actor identity in history.
Review records the actual Owner/Manager reviewer; cancellation records the verified
owner who invoked the owner-only action. Name/role snapshots survive Staff removal
and account deletion. A damaged submitted rejection snapshot still permits Reject
and omits the optional history title, matching existing email fallback behavior.

Deterministic Event-scoped keys use Application id plus type for submission,
Application id plus PENDING-to-decision transition and type for review, and Event
id plus EVENT_CANCELLED for the irreversible one-time cancellation. Existing Outbox
deduplication keys are preserved. Same key/digest reuses the intent; conflicting
content fails. All deliveries belong to the corresponding historical send. Manual Send and the shared History/Details UI use the same
Communication records and are described below.


## Manual Communications Center

The Event workspace has a Communications section for Owner and Manager, with New
message and History in separate internal tabs for all Communications in that Event,
regardless of initiator. Switching tabs preserves the in-memory compose state and
history filters. The History link opens the History tab. Reception has no navigation, page access, preview, send, or history DTO.

Compose selects exactly one audience: All active attendees (PRIMARY + GUEST),
Primary attendees, Checked in, Not arrived, Pending applications, or Event staff
(current owner plus Managers and Reception). Attendee audiences require both
Attendee and Registration to be unrevoked. Checked in means Attendance exists;
Not arrived means none exists. Only current PENDING attempts are selected.
Addresses come from Attendee.email, Application.email, or team User.email.
Missing/invalid emails are skipped; a Guest never falls back to the Primary's
email. Trim/lowercase deduplication yields one intent per unique deliverable
address, without provider-specific alias rules.

Subject is 1–200 Unicode code points; plain-text message is 1–10,000, with the
foundation's text safety/CRLF normalization. There is no rich editor, attachment,
custom CTA, arbitrary recipient list, sender override or persisted Manual Draft.
Compose is memory-only; no message, email or body goes into URLs, cookies or
localStorage.

Preview is read-only and displays “Estimated recipients: N”, with an explanation
that the actual count can change. Changing audience invalidates it. Every new Send
requires a fresh estimate and a confirmation Dialog showing audience, subject and
estimated count. Cancel preserves the text. “Queue message” recomputes the current
audience under server authority and freezes its emails atomically with the
Communication and durable Outbox intents. Opening confirmation creates nothing.
Success says “Queued for N recipients”, clears compose, updates History and links
to it; it never claims delivery.

Each send intent has an opaque request key scoped to Event and verified actor.
An unchanged retry returns the existing Communication; changed content with the
same key is rejected. Network ambiguity retains the exact attempted payload and
key, with editing locked until recovery or explicit abandonment. “Retry same send”
opens confirmation without refreshing Preview. It can recover a committed result
or complete the original send if it was not queued; server authorization and all
applicable guards remain authoritative. Starting a new message warns that the
previous message may already be queued. A new intent receives a new key. Keys
survive retries within the mounted compose, not a page reload. Cancel, Escape and
backdrop close preserve text and return visible focus to the initiating action.

Sending requires communications.send, any historical publication and no archive.
Upcoming/Ongoing/Completed, previously published Cancelled, restored and currently
unpublished Events qualify. Never-published Draft and Archived remain history-only.
Archive/Restore neither cancels queued deliveries nor resends old messages.

All manual limits apply atomically: 1,000 unique addresses/send, 5 sends/Event/hour,
10 sends/actor/hour, 2,000 outstanding/Event and 10,000 outstanding globally.
Outstanding means Pending or Processing. Empty audiences and over-limit sends
fail entirely. Audience resolution reads at most 10,001 matching email records;
more than 10,000 is a safety refusal, including when duplication/missing addresses
might reduce the final unique count. It never sends a truncated audience.

History shows Manual/Transactional, subject, time, audience/trigger, recipient
count and Pending/Processing/Sent/Failed counts, newest first, 20 per page.
Sent means email transport accepted, not mailbox delivery or opening. Enqueue
reuses routing-only Event SSE invalidation; History also has an explicit refresh.
This same History includes delivery-status invalidation and safe details;
historical transactional content is never reconstructed. No new transactional trigger, delivery
worker, polling mechanism or background infrastructure is introduced.


## Unified History and Delivery Visibility

The existing Communications History unifies Manual and Transactional messages,
with subject, trigger/audience, creation time, frozen actor name/role, recipient
count, four delivery counts and an overall status. Newest-first keyset pages
contain 20 records. History supports case-insensitive subject search and an
All/Manual/Transactional type filter across the full Event history, with Manual
selected on initial load. Clear filters shows All types. Changing a
filter returns to the latest matching page. Search stays in memory and is sent
only in a read request body, never in URLs or browser storage. Type chips use
consistent distinct colors and icons in History and details. Actor roles reuse
the shared EventAccessStatus chip. History rows group subject/type/time, audience
and actor, then a compact delivery summary with all four counts.
Clicking a History row opens details in a dialog and updates the URL. Closing,
Escape or Back restores History with its filters; Forward reopens the dialog.
Reloading or directly opening that URL renders the full communication details
page. Recipient pagination within the dialog replaces the current history entry,
so closing still returns to History in one step.
Zero-recipient communications say “No recipients”; mixed
results distinguish in-progress partial failures from completed failures.
Invalid counts or a delivery total different from the frozen recipient count
show the neutral “Status unavailable”, including inconsistent zero-recipient rows.

Owner and Manager can open an Event-scoped details page in every lifecycle state,
including Draft, Completed, Cancelled and Archived. Each read verifies the session,
communications.read and Event membership. Reception and foreign selectors receive
neutral denial without content, recipient addresses or delivery counts.

Details show the saved plain-text Manual message with escaped text and preserved
line breaks. Transactional details show only the frozen semantic trigger/Event
name and “Message content is not stored in communication history.” They never
reconstruct an old email from current Event/Application/Ticket state or show raw
payload, HTML/MIME, SMTP errors, credentials or private capability links.

Recipient deliveries use frozen EmailOutbox addresses, with current status,
attempts, queued time and Transport acceptance time. Pages contain at most 50 addresses,
ordered by immutable email, using validated Event/Communication-scoped opaque ID
cursors. V1 shows All statuses, without email search or a status filter; status
changes cannot move recipients across page boundaries. Recipient lists never enter
the general History DTO or URLs.

Pending means queued and awaiting an attempt; Processing means claimed by the
dispatcher; Sent means email transport accepted; Failed means automatic attempts exhausted.
Transport acceptance is not mailbox delivery confirmation, opening or click tracking.
Status changes trigger routing-only invalidation through existing Event SSE after
the DB commit. Updates are best-effort; reconnect and explicit Refresh recover a
missed signal. Notification failure cannot change delivery results or cause a
resend. No polling, new worker or transport is added.

History retention remains the Event lifetime. Content, audience, actor snapshots,
recipient counts and addresses stay frozen; only delivery operational fields are
live. Archive/Restore preserve history and the queue. There is no manual resend,
retry-failed, cancel-delivery or delivery override UI; Send eligibility is unchanged.


## Duplicate event

Owners can choose **Duplicate event** from the Event actions menu in any lifecycle,
publication or archive state. It opens the full Create page
directly in Review, using the current saved workspace, including unpublished
changes. No JSON download/upload is needed. Manager/Reception and foreign users
cannot read this configuration through Duplicate.

The original configuration must pass current EventTemplate export size/portability checks
and create validation before Review opens. Invalid or historical Badge bindings
reject the whole operation; no fields or bindings are silently dropped. A neutral
error explains that access, template limits and current-form Badge compatibility
must permit duplication.

The copied title receives ` (Copy)` without truncation. A title over 200 characters
is preserved in Review with an inline error and must be shortened before Create.
All supported settings, questions/options, Staff emails/roles and Badge layout are
editable. Untouched dates preserve exact instants and nulls; edited dates/timezone
use the existing DST rules. Past dates are allowed with the existing warning:
an unpublished copy can already be Completed and read-only.

Review creates no Event; a newly uploaded cover remains temporary until Create.
Explicit Create uses the same atomic creation, Staff budget/resolver, Badge
remapping and success navigation as Import.
The new Event has fresh identity and belongs to the verified creator; publication,
cancellation/archive state and all operational/history records are excluded.
The source is never changed. The URL contains only `duplicateFrom=<eventId>`;
private configuration stays out of URLs and persistent browser storage.
Editor Cancel/Back ask before discarding changed review values and create no Event.
Background refresh keeps the active snapshot and edits even if the source later exceeds template limits, has invalid
Badge bindings, or cannot temporarily be read. Confirmed loss of verified session
or source access removes the protected Review. Initial failures never open Review.
Full page reload opens the Create page and may reload the source, discarding edits.
No persistent draft is kept.
Submit locking prevents resubmission after confirmed success in that UI. After a
lost response, retrying the same authenticated request key and payload recovers the
committed result from its creation receipt without creating another Event. A full
reload loses the in-memory retry state; a new request key can create another Event.
The receipt and temporary-cover rules are defined in Cover during Event creation below.

## Event cover foundation

Owners with verified accounts can upload cover images for existing editable Events
through the media API, then explicitly attach, replace or remove the draft cover.
The rich Event editor uses these APIs; see Public Event landing page and SEO below for public presentation.
Create/Import/Duplicate Review supports private temporary covers before Create,
as described in Cover during Event creation below. Template validation alone still performs no writes.

Uploads accept one static JPEG, PNG or WebP, at most 5 MiB and 4096 × 4096 pixels.
The editor offers a fixed 16:9 crop with drag positioning, zoom and keyboard-accessible
position sliders. Upload sends the original file and the chosen crop to the server.
The server validates and re-encodes images, applies orientation and the crop, strips metadata,
and creates immutable responsive WebP variants plus a JPEG social variant.
JPEG files may include phone metadata or other data after the image end marker.
The server discards that trailer before decoding; the 5 MiB limit applies to the
entire upload, including the trailer. Only the primary still image becomes the cover.
Original files and names are not retained. At most two upload-processing operations
run per application process. New upload admission is refused when the organizer
already has at least ten pending assets (incomplete uploads or READY assets with no
draft/revision reference). Removing a cover remains allowed under normal Event guards
and can increase pending assets above ten; this is not a total-count invariant.
Further uploads are refused while the current count is at least ten.

Saving a draft cover is a versioned Event edit. Only Publish/Republish changes the
published cover. Removing/replacing a draft cover never removes media used by a
published or historical revision. Unpublish closes public media access. Cancellation,
archive and restore preserve media and the existing public-page availability rules.
Draft/upload previews are owner-only and Event-scoped; public media is available
only when it is the cover of the current valid published revision.

EventSnapshot is the current unversioned publication and historical format.
Historical revisions remain immutable. Descriptions use only Markdown, with no
format selector or format property. Location, agenda and public organizer data use
the same current snapshot contract and OWNER Preview rendering.

Import, Export and Duplicate support only EventTemplate, preserving rich
configuration and explicitly reporting omitted source cover images.

Existing Event media cleanup remains an explicit maintenance command: incomplete uploads
expire after 24 hours, unused ready assets after seven days, and assets referenced
by any draft or revision are retained. Historical media remains for the lifetime of
its revision. Operators must invoke cleanup and maintain storage/backups.


## Cover during Event creation

Create, Import Review and Duplicate Review allow selecting, cropping, uploading,
previewing, replacing and removing a new cover before the Event exists. All tabs
stay mounted, preserving selection, crop and alt text through navigation and UI
language changes. The existing 16:9 touch drag and keyboard sliders are reused.
Upload shows byte progress, then server processing, with errors and retry through
Upload cropped image. A selected but unprepared crop must be uploaded or cancelled
before Create. No Event is created by uploading or previewing a cover.

Temporary covers belong to the verified organizer, remain private and expire 24 hours
after upload reservation. The existing ten-pending-assets admission quota includes
creation uploads and discarded temporary assets awaiting deletion. Replacing a prepared
cover keeps the old selection until the new upload succeeds, then requests its discard.
Remove requests discard before clearing selection. Abandoned forms, lost upload
responses and failed uploads remain tracked and expire automatically. Failed creation
preserves the prepared upload until its original expiry; retries never extend expiry.
A runtime sweep starts with the app and runs every 15 minutes, collecting at most 100
temporary assets and 100 aged orphan files per pass. Failures retry on later sweeps;
shutdown drains the active sweep. Cleanup resumes on startup after downtime.

Initial cover attachment is part of atomic Event creation. The Event, registration
configuration, selected cover consumption and successful retry receipt commit together.
A failed transaction leaves no Event and preserves the temporary upload. Past Events
may receive this initial cover even when immediately Completed; all subsequent cover
changes retain the existing read-only restrictions. Creation never publishes a cover.

Each mounted creation form uses a random request key. Repeating the same authenticated
request returns the committed result without another Event or another Staff lookup.
A changed payload or another organizer cannot reuse the key. Concurrent submissions
serialize on that key; a temporary cover can be consumed once. Receipts retain their
minimal result and keyed payload fingerprint, including after pristine Event deletion,
so old requests cannot recreate deleted Events. Raw authoring values and passwords are
not stored in receipts. Import results retain the original private Staff warnings.

When a request outcome is uncertain, submitted values are frozen in memory and
**Retry same creation** resends that exact request. Keep the page open until resolved;
reload or leaving the form loses this in-memory recovery state. Check My Events before
starting over after leaving an uncertain creation. There is no persistent browser draft.
Missing, expired or inaccessible prepared media prevents creation and offers removal
or another upload. Existing private preview/publication rules and image limits remain.


## Rich Event editor and EventTemplate

The existing Create/Edit and Import/Duplicate Review forms share rich authoring.
Descriptions are authored as Markdown, with a 20,000-character limit. Ordinary
text needs no special formatting. Opening a draft or template preserves its Markdown
source text. The editor combines Write/Preview with
grouped formatting toggles for selected text (bold, italic, heading and list)
and a separate link insertion action. Toggling an active format removes it.
The Markdown preview, Overview and
OWNER Event Preview share a renderer permitting headings, paragraphs, emphasis,
lists and absolute HTTP(S) links without credentials. Raw HTML, images, MDX and
iframes are not rendered. Templates with obsolete description-format fields are
rejected rather than converted.

Location is None, Physical, Online or Hybrid. None stores null; the selected type
requires its applicable venue/address and/or online label/URL fields. Agenda has
at most 100 entries, titles up to 200 characters and optional descriptions up to
2,000. Add/remove/move controls preserve row identity and expose inline errors.
Times must be chronological (ties allowed) inside [Event start, Event end); the
editor never sorts or shifts them automatically. Untouched imported/saved instants
keep exact seconds/milliseconds through title edits and reorder. New or changed
local times reject skipped/repeated DST hours. Timezone edits reinterpret local
values under existing Event date rules; Event date edits only revalidate agenda.
The Ongoing Event start remains locked.

Public organizer information is optional, Event-local and authored explicitly:
display name, optional description and optional website URL. It never automatically
includes account email, staff email or private profile metadata.

Existing editable Events also show the cover editor: Select file -> Adjust 16:9 crop -> Upload ->
normalized preview -> Save cover; replace/remove and alt text up to 500 characters
use the existing authorized attachment action. Cover and Event Save cannot overlap.
Image preparation/upload uses a cover-shaped skeleton, not a progress bar.
An info alert explains selection, crop, upload/save and the accepted image limits.
Cover editor previews use 16:9 without stretching images. Previously stored media is not rewritten.
A successful cover response alone updates the local optimistic token and preserves
all other edits. A success notification (not an inline alert) says: "Cover saved. Other event changes are not saved yet."
A conflict requires reload. Draft changes never alter the currently published cover;
abandoned uploads follow the existing 24-hour/7-day cleanup rules.

For owners eligible to publish, an alert above the Event title explains draft,
unpublished or unpublished-changes status and exposes Publish, Republish or
Publish changes. The existing menu action remains available. Both use the same
publication action, version checks, conflict feedback and lifecycle guards.

EventTemplate preserves portable settings including Markdown description, location,
exact agenda and public organizer. Its cover marker is NONE if absent or OMITTED
if the source has a cover. Images/asset IDs/storage keys are never copied. Export,
Import Review and Duplicate Review explain omission; organizers may select a new
cover during creation. Source images are never copied.
Obsolete template properties are rejected without conversion. Existing Staff/Badge identity rules,
size limits, atomic Create and Duplicate refresh/revocation semantics are preserved.

OWNER Preview displays the draft cover and rich content from the workspace's
snapshot. Public pages still use published revisions only. Overview remains an
operational view without expanded Staff access. Rich authoring requires no worker, polling or
additional storage backend; see Public Event landing page and SEO below for public presentation.

## Event Workspace Editor

Create, Edit, Import Review and Duplicate Review use one full-page editor at the
existing /dashboard/events/new and /dashboard/events/[id]/edit URLs. Event editor
route interception is removed; Application and Communication detail dialogs remain.
Direct links, refresh and ordinary Back/Forward use the same page routes.

Eight switchable tabs show only the active panel: Basics (title, description),
Cover (independently saved image, crop and alt text), Schedule (dates and timezone),
Location (venue and online meeting details), Event agenda (compact agenda), Registration
(capacity, guests, registration dates), Access (visibility, account requirement), Organizer
(public organizer information). Import/Duplicate additionally shows Additional
settings for Registration Form questions, Staff and Badge Design. Review errors
open that tab; ordinary Create/Edit does not show it. No separate builder is introduced.
All panels remain mounted in one form, with inactive panels hidden from layout,
keyboard navigation and assistive technology. Switching never saves, resets errors,
or discards values. Desktop uses vertical MUI Tabs with icons and labels; mobile
uses horizontally scrollable tabs. Cover follows Basics and is available during
creation and editing. Fields and feedback retain shared theme/light/dark behavior.

A compact sticky action area provides Create event / Save draft,
Preview saved draft and Cancel / Back actions. Contextual help explains separate
publication and that Preview excludes unsaved edits. Cover edits have a separate
reminder and their own Save cover action in Cover. Save draft is disabled when
Event fields have no unsaved changes; there are no ordinary saved/unsaved status
labels. Pending Save, validation errors, save failures and version conflicts remain
visible. Missing required values still disable submission; Complete required fields locates unfinished input.
Nonempty invalid values remain submittable. Save validates every section, activates
the first affected section and focuses its invalid field (or a general Alert).
Agenda field errors expose the corresponding details. Other errors remain intact.
Conflict and unknown-save feedback keeps Reload latest version available.

Successful Edit stays open and adopts the confirmed server version, canonical
values and exact date/agenda source. Dirty state clears only after confirmed
success. Create opens the new Event editor with its selected prepared cover attached;
past, Completed Events retain the existing read-only boundary after creation. No automatic Save occurs.
Cover selection/upload/attachment remains independent, with its own pending edits
and save status. Successful cover attachment alone advances its optimistic token
without saving or clearing other Event edits. Cover and Event Save cannot overlap.

Editor Back/Cancel, ordinary same-tab app links, Sign out and template mode/replacement
controls use a MUI Discard unsaved changes? dialog with Keep editing / Discard changes.
Beforeunload is best effort for reload/tab close; browser history controls and OS
termination are not guaranteed to prompt. Confirmed access revocation still discards
protected state immediately. No persistent local draft storage is introduced.
Preview saved draft opens in a new tab, retaining local edits and explaining that
Preview only includes saved workspace data. Publication remains a separate explicit
operation from the Event overview; Save never publishes or changes historical revisions.

Agenda items show title, local date/time, a brief description, move/edit/delete
controls and expandable details. New items expand and receive focus; reorder/delete
restore focus to the affected/neighboring item. Rows retain stable UI identities.
No sorting or time shifting occurs; exact instants and DST rules remain authoritative.

## Public Event landing page and SEO

The direct Event page presents the current published revision in a responsive
Hero with title, dates/timezone, location summary and registration navigation.
An optional cover uses existing fixed variants, their actual widths and a reserved
image area. Hero details sit over the image with a dark gradient for readability in both themes;
its responsive height follows the content instead of adding a full image above it.
Covered heroes and cards prefer a 16:9 frame from the lg breakpoint; smaller screens use content height. Content can increase its height on
narrow screens; the poster fills the resulting frame with object-fit: fill, without another crop. Failed images retain the dark backdrop.
Without a cover the Hero stays compact. No
stock image, image optimizer or public media cache is used.
Catalog descriptions use the same format-aware restricted Markdown renderer.
Covers sit behind card content with a dark gradient in both themes in both the public catalog and
My events; cards without covers retain their usual appearance. Only the background image of a fully clickable Event card scales slightly
on hover with a fine pointer; reduced-motion preferences disable this effect.
Public catalog cards show only published covers. Cards in the same grid row
stretch to equal height, including a mix of covered and uncovered events. My events cards show draft covers
for owned Events through the owner-only media route; assigned staff cards do not
request private owner media.

Description, location, schedule and public organizer sections appear only when
present. EventSnapshot uses the same restricted Markdown renderer as the editor. Agenda uses MUI Timeline with a vertical rail, time on the opposite side from
the title, and smaller supporting descriptions below each title. Entries retain their original order and instants, grouped by day
in the Event timezone. The timezone is stated once above the agenda; individual
times show hours and minutes without repeated UTC offsets. Exact instants remain
in the datetime attributes, including at DST transitions.
Public organizer details are exclusively Event-local authored content. Organizer
appears below Location and Registration in the sidebar (stacked beneath them on mobile).
Location uses a separate card above Organizer. When a
website is supplied, the organizer name is the external link; there is no separate
website action.

The landing page contains event content and registration availability, with prominent
Register (or Apply again) links in the Hero and registration panel. It does not
embed the application form. `/e/[publicId]/register` provides compact published event
context using the shared public catalog card, Back to event, and a focused
single-page application. The event card and Your details sit side by side on
desktop and stack on mobile. When the form is unavailable, registration status
and its available actions occupy an outlined details card beside the event instead.
Your details keeps name and email stacked vertically.
Organizer questions use wrapping labels above text and select controls so the full
question remains visible on narrow screens. Single-choice questions use MUI Select
with MenuItem options, an explicitly associated label,
inline helper/error text and the existing empty-selection behavior. Organizer questions sit directly on the page without
an outer card. The final submission panel uses a theme accent and a prominent action alongside
the heading on desktop, stacked on mobile. Questions
use unnumbered labels and generous spacing without dividers; controls use the
shared light/dark theme. Registration uses the accepted lg page container width
and uses shared BackLink navigation. Post-submission guidance appears in an Alert.
Review errors uses the same error color as the Event editor.
Complete required fields runs the existing client validation without submitting and
focuses/scrolls to the first invalid control. Review errors returns to the first
remaining invalid control; field feedback clears individually. Submit remains disabled while required
values are missing or a request is pending.
The public landing includes All events navigation above the Hero.
No wizard or Registration Builder changes are introduced.

Both pages preserve personal application/admission status, withdrawal and history
navigation. The registration page explains closed, not-yet-open, cancelled, full,
owner and account-required states; authentication returns to this registration URL.
A full Event still accepts applications while otherwise eligible. Successful submission
retains neutral confirmation and organizer review semantics. Existing Server Actions,
historical revision binding, unchanged-question reapplication prefill, validation,
and pending protection remain authoritative. Registration pages are noindex/nofollow;
the landing page retains its existing canonical and social metadata. Completed and
cancelled Events retain published content/history without application actions.
Archive does not independently remove public access or add an admission rule.
An opened registration form keeps its revision and question definitions across
server refreshes; current publication updates do not replace entered answers.
An update notice offers an explicit restart with the latest form, clearing unsaved
answers. Ordinary applications may submit the opened historical revision;
reapplications must restart when the current revision changes. Current server
eligibility still controls whether the form exists. Event, verified identity or
withdrawn-attempt changes replace the form; closing, cancellation, unpublication,
owner access or an existing active application removes it as applicable.


OWNER Preview uses horizontal Landing and Registration tabs, matching the Badges workspace.
Landing contains no embedded form; Registration reuses the public form layout in read-only
preview mode, without the final submission panel or its actions. Both tabs read the workspace and OWNER media URLs;
the public page never reads draft content.

Metadata uses the published title and a bounded plain-text description from the
same sanitized Markdown output, with canonical/social URLs based on configured
origin. Only current valid PUBLIC, non-cancelled, non-archived Events are indexable;
Completed PUBLIC Events remain indexable. PRIVATE keeps direct-link availability,
noindex/nofollow and no rich social metadata. Cancelled/archived pages are noindex.
Unknown, unpublished or invalid Events return HTTP 404 for HTML document requests,
without Event-specific metadata; valid publications return HTTP 200. The catalog's
loading boundary is isolated from this publication guard. RSC client navigation
may use HTTP 200 with NEXT_HTTP_ERROR_FALLBACK;404: the client must display Not Found,
and the payload must not expose protected content. The transport status is not
publication authorization; both paths retain the same publication guards.

Public social cards reference the current published JPEG social variant. Existing
private/no-store and noindex media headers remain; external card display/caching
is best effort. Old cover URLs stop authorizing after replacement/unpublish, and
previously downloaded images cannot be recalled. No OG generator, discovery or
private access controls are added.

## V0 development policy

Before the first release, breaking changes are allowed. Event Flow is a public demo;
the Product Owner approved complete destruction of existing demo data for the
controlled clean release documented in README.md. The current installation uses
one PostgreSQL 18 baseline, with no seeds, backfills or retained-data upgrade path.
Preparing the baseline does not itself reset local/production data or deploy it.

EventSnapshot and EventTemplate each have one current, unversioned contract, without
legacy readers, converters or compatibility paths. Historical domain revisions stay
immutable within that contract; authorization, concurrency controls and idempotency
remain mandatory. Future schema changes use incremental migrations. Further baseline
consolidation or database/media resets require explicit approval; disposable data
alone does not authorize them.

## UI language foundation

The interface currently offers English, German, Polish and Ukrainian. Russian
translations remain supported but are temporarily unavailable for selection.
Locale resolution and preference writes accept only the offered languages. Resolution
is account preference → validated first-party cookie → browser Accept-Language
(including regional tags and quality weights) → English. A new/existing account
without an explicit preference continues to use cookie/browser resolution; GET
requests never persist inferred language. An explicit signed-in selection saves
User.uiLocale and the cookie; anonymous selection saves only the cookie.

The language menu is available in the shared application/public header (including
authentication and public registration) and the anonymous Ticket surface. Selection
preserves the full URL, scroll position and unsaved form state. The client loads
messages, saves the selection with PUT, then updates its locale context. A failed
load or save keeps the active language and shows a translated retryable notification
that remains visible after the menu closes and clears when selection is retried.
A successful PUT is sufficient; there is no read-back confirmation.
The cookie is host-only, HttpOnly, SameSite=Lax, one year, and Secure on HTTPS.

SSR initializes preferences for each document. Mounted client state is not replaced
by later server props, navigation, focus, visibility changes or pageshow. External
changes become visible after a full reload. Successful authentication transitions
load a new document; preference selection itself never navigates or refreshes
application data. Server-only text may reflect newer preferences on a subsequent
server render while mounted client labels retain the current document's choice.
The document language attribute follows that active client choice after RSC refresh.
Preference and sign-out error notifications translate at render time, including
when the language changes while a notification is visible.

Writes use the session authenticated for that request, not the session present
when the menu was opened. An old tab can therefore save to the currently signed-in
account; an expired session saves only the anonymous cookie. There is no automatic
retry or replay. Concurrent writes use last-write-wins behavior. A lost response
can leave persistence uncertain; repeating the selection is safe.

Shared navigation, account navigation, language/appearance controls, essential
shell labels, MUI built-in labels and the shared DateTime component use the active
UI locale; Event timezone and instant semantics stay unchanged.

Dictionaries cover authentication, profile,
the home page, public discovery and registration, application history/review/withdrawal, guests,
tickets, staff, communications, scanner and manual check-in controls, registration
questions, Event authoring validation, cover controls, overview and arrival charts,
publication/lifecycle feedback, import/duplicate review, export controls and badge
design/print documents.
Localized feedback stores message codes and any interpolation values, translating
when rendered. Historical answer presentation distinguishes literal user text from
checkbox booleans and unavailable/not-provided states; only those UI states are
translated. Questions, option labels, Event descriptions, cancellation reasons,
manual message subjects/bodies and other authored content retain their language.

Technical identifiers, template/CSV field names, ticket numbers, QR payloads and
Event-authored email/template content is not translated. Badge preview and printed labels use the current Event language, read with its operational
name and saved design in the authorized snapshot. Print controls and errors retain
the operator UI locale. Authored names/answers and admission credentials are unchanged.
Localized metadata is resolved on the server; it updates on the next server render.
UI acceptance must still exercise authenticated organizer workflows and populated
historical/attendance/communication states in all offered UI languages.

Server-only translated output updates on the next server render; immediately
switchable labels consume client context with SSR initial messages. UI locale is
not included in Event snapshots/templates, mutation inputs, revision bindings or
domain idempotency digests; email localization separately freezes recipient language in email
delivery intents. Exported technical headers, formats and stored timestamps
remain unchanged. Background translation can receive an explicit locale without
HTTP context; see Email localization below.

## UI appearance preference

The appearance menu offers light, dark and system modes. Resolution is account
preference → validated first-party cookie → system. A null account preference
means no explicit selection. Explicit system mode follows the OS of each current
device; the resolved light/dark appearance is never saved as a preference.
Signed-in selections save User.uiMode and the cookie; anonymous selections save
only the cookie. The client waits for a successful PUT before calling MUI setMode.
Write failure keeps the current mode and shows a translated retryable notification
that remains visible after the menu closes and clears when selection is retried.
Changing appearance preserves URL, scroll, component identity and unsaved forms.
Initial rendering uses the resolved preference before page content is displayed.
MUI localStorage is not an authority and old local-only preferences are not imported.
MUI follows OS changes in system mode without persistence requests. The same
reload-based freshness and request-time session semantics as language apply.

## Event language

Every Event has one required content language: en, de, pl, uk or ru. This describes
organizer-authored content; it does not translate content. Public registration
select placeholders (required and optional) use the Event language from the opened
form revision; the read-only preview uses its workspace snapshot language.
Validation, buttons and other system UI use the visitor's UI language. Questions,
descriptions and answer options remain exactly as authored.

Manual Create initializes it from the active organizer UI locale when
the form opens. Changing UI locale afterward preserves all form values, including
Event language. Basics offers explicit language selection in Create, Edit, Import
Review and Duplicate Review.

Language selectors in the editor and public catalog currently offer en/de/pl/uk.
Russian remains a supported content language and retains its translations, but is
temporarily hidden from selection; serialized contracts are unchanged.

Language is a draft field with the existing save/version/lifecycle guards. Publish
freezes it in EventSnapshot; editing draft language never changes an existing
publication or historical revision. EventTemplate export/import/duplicate preserve
the source language regardless of the importing organizer's UI locale. Language
is required in both current contracts; missing/unsupported values are rejected.

Event cards show uppercase language codes. Organizer/assigned cards show workspace
language; public and account registration cards show current published language.
Unavailable registration cards do not infer language from drafts. The public catalog
has an independent Event language selector, defaulting to All languages. Its URL
parameter `language` filters published language before choosing the featured event
and Upcoming/Happening now/Past groups. UI language changes do not alter that filter.
Unknown, unavailable or repeated language parameters behave as All languages. Other URL
parameters are retained. Existing grouping/order is unchanged; this catalog has no
pagination. Search events filters published titles immediately, using trimmed,
case-insensitive substring matching as in the organizer dashboard. Search and
language filters combine before featured selection and grouping; search text
persists when the language selection changes.

Event language provides no automatic translation or multilingual content fields. Email localization is described below.

## Email localization

All existing email presentation supports en, de, pl, uk and ru: email verification,
application receipt, organizer notification, approval/Ticket links (including
revoked/cancelled/unavailable-account states), rejection, Event cancellation and
manual Communications. Subjects, HTML, plain text and action labels are localized.
Event titles, names, cancellation reasons, manual subjects/messages and all other
authored content remain unchanged. No password-reset, Guest-add/remove or
withdrawal email is introduced.

Every Outbox payload requires a frozen locale; missing or invalid locales fail
validation. Application receipt emails require their Application reference, while
private application/Ticket links are resolved and checked at delivery time.
The server selects the locale per recipient when creating the delivery:
explicitly linked Users (including organizers and staff) use User.uiLocale, or en
when unset. Anonymous recipients use the Event language in their submitted
Application revision; admitted attendees use Registration.sourceApplication's
revision. Guests never inherit the Primary account preference, and matching an
email never establishes account ownership. Later Event edits/publications or UI
preference changes do not change queued mail or retry language. An unreadable
historical language falls back to en without adding an admission/rejection guard.

Manual sends retain one delivery per normalized address. An explicitly linked
recipient account wins, including its en fallback. Otherwise the earliest
Registration among recipients sharing that address supplies the historical
language. Ties use Registration ID, then Attendee ID, ascending. Pending applicants
use Application creation time then ID; team recipients use User creation time
then ID. Among multiple linked records, that same deterministic order applies.

Authentication uses the resolved UI language at request time (authenticated
account preference, locale cookie, browser language, then en); without a request
it uses en. The email-verification expiry and single-use/latest-link rules stay
unchanged. Event dates use the frozen Event timezone. Already queued deliveries
without locale retain English; delivery addresses, links, idempotency, retry and
security behavior are unchanged. Communication history keeps its existing stable
English transactional subject label, since grouped sends may have several languages.


## Private event password protection

Access in the Event editor offers optional password protection for PRIVATE events.
Manual Create and Edit support entering a password, generating a secure password,
show/hide and copy. Passwords use the existing 10–128 character policy. Show/hide
and copy apply only to the newly entered value before Save; saved passwords cannot
be recovered. Leave the replacement input blank to keep the saved password. A
forgotten password requires entering a replacement, Save, then Republish.
Password values are cleared after a save attempt, including failures; reenter a
replacement to retry. No password is retained in React state or browser storage.

Save changes only the draft. The currently published password continues to work
until Publish/Republish. The Access panel identifies saved unpublished access
changes and offers Republish, which publishes all saved Event changes. Unsaved
Event or cover changes must be saved or discarded first. Switching the draft to
PUBLIC clears its password on Save; public access changes only on publication.
Disabling protection likewise takes effect only on publication.

Published protected pages display a generic password form, without Event title,
description, form questions, cover, location, agenda or organizer details, until
verification succeeds. The registration URL and cover URLs enforce the same gate.
Unpublished/invalid Events remain unavailable. OWNER Preview continues to require
owner authority and displays the saved draft without a visitor password challenge;
it neither grants visitor access nor accepts registrations.

Successful verification grants access only to that Event for two hours, with no
sliding expiration or automatic renewal. Navigation and UI language changes retain
access. Expiry requires verification again. Password changes or removal invalidate
previous grants atomically on publication. Publishing without changing the effective
password configuration preserves valid grants, including republishing after unpublish.
Unpublish still removes all visitor access while the Event is unpublished.

An Event permits at most 100 failed password attempts in a fixed 15-minute window
starting at its first failure. Successful attempts do not reset the counter. At the
limit all verification is temporarily unavailable, including correct passwords;
already valid grants continue to work. Availability returns after the window ends.
Errors are generic and do not reveal counters or internal timing. This event-wide
availability trade-off is accepted for the current public demo.

Password access grants no account, organizer, staff, application, admission or ticket
privileges. Those independently authorized surfaces retain their current rules.
Every new submission checks the current password grant as well as existing policy;
password access does not change historical form binding. Already delivered content
cannot be recalled from a visitor; revocation rejects subsequent server access.

Templates and duplicates never include passwords, hashes or password grants. Their
review explains that protection must be configured in the new Event editor before
publication. They retain the current strict EventTemplate contract.

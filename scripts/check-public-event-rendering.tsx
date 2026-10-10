// Requested 29C presentation checks; no database, fixtures on disk or SMTP.
import assert from "node:assert/strict";
import { renderToStaticMarkup } from "react-dom/server";
import { EventCover } from "@/features/events/components/event-cover";
import { eventDescriptionText } from "@/features/events/components/event-description";
import { EventGuestView } from "@/features/events/components/event-guest-view";
import { EventRichContent } from "@/features/events/components/event-rich-content";
import { eventCoverImage } from "@/features/events/event-cover";
import { publicEventMetadata } from "@/features/events/public-event-metadata";
import { eventSnapshotSchema } from "@/features/events/schemas/event-snapshot";

const legacy = {
  schemaVersion: 1,
  title: "Published event",
  description: "**Literal legacy text**",
  startsAt: "2030-10-26T08:00:00.000Z",
  endsAt: "2030-10-28T10:00:00.000Z",
  timezone: "Europe/Berlin",
  visibility: "PUBLIC",
  accountRequirement: "OPTIONAL",
  capacity: 1,
  registrationOpensAt: null,
  registrationClosesAt: null,
  registrationForm: { fields: [] },
};
const manifest = Object.fromEntries(
  ["640", "1280", "1920", "social"].map((variant) => [
    variant,
    {
      width: 480,
      height: 240,
      bytes: 100,
      contentType: variant === "social" ? "image/jpeg" : "image/webp",
      sha256: "a".repeat(64),
    },
  ]),
);
const rich = eventSnapshotSchema.parse({
  ...legacy,
  schemaVersion: 3,
  maxGuestsPerRegistration: 0,
  descriptionFormat: "MARKDOWN",
  description:
    "# Welcome\n\nA **bright** day. [Join](https://example.test/private-destination)\n\n<script>secret</script>\n\n![hidden image](https://evil.test/image)",
  cover: {
    assetId: "019a0000-0000-7000-8000-000000000001",
    alt: "Published cover",
    variants: manifest,
  },
  location: {
    type: "HYBRID",
    venueName: "Public venue",
    address: "Public address",
    onlineLabel: "Join online",
    onlineUrl: "https://example.test/join",
  },
  schedule: [
    {
      title: "First day",
      description: null,
      startsAt: "2030-10-26T08:00:00.123Z",
    },
    {
      title: "Before fold",
      description: null,
      startsAt: "2030-10-27T00:30:00.123Z",
    },
    {
      title: "Same instant",
      description: null,
      startsAt: "2030-10-27T00:30:00.123Z",
    },
    {
      title: "After fold",
      description: null,
      startsAt: "2030-10-27T01:30:00.456Z",
    },
  ],
  publicOrganizer: {
    displayName: "Public organizer",
    description: "Explicit public bio",
    websiteUrl: "https://example.test",
  },
});
assert.equal(rich.schemaVersion, 3);

if (rich.schemaVersion !== 3 || !rich.cover) {
  throw new Error("Invalid V3 verification input");
}
for (const version of [1, 2]) {
  const snapshot = eventSnapshotSchema.parse({
    ...legacy,
    schemaVersion: version,
    ...(version === 2 ? { maxGuestsPerRegistration: 0 } : {}),
  });
  const html = renderToStaticMarkup(
    <EventGuestView snapshot={snapshot} now={new Date("2030-10-25")} />,
  );
  assert.match(html, /\*\*Literal legacy text\*\*/);
  assert.doesNotMatch(
    html,
    /<strong>|<img|event-location-title|event-schedule-title|event-organizer-title/,
  );
  assert.equal((html.match(/<h1\b/g) ?? []).length, 1);
}
const richHtml = renderToStaticMarkup(
  <EventGuestView
    snapshot={rich}
    now={new Date("2030-10-25")}
    occupied={1}
    showApplicationLink
  >
    <div>Existing form slot</div>
  </EventGuestView>,
);
assert.equal((richHtml.match(/<h1\b/g) ?? []).length, 1);
assert.match(richHtml, /<h3>Welcome<\/h3>/);
const headingsHtml = renderToStaticMarkup(
  <EventGuestView
    snapshot={{
      ...rich,
      description:
        "# One\n\n## Two\n\n### Three\n\n#### Four\n\n##### Five\n\n###### Six",
    }}
    now={new Date("2030-10-25")}
  />,
);
assert.deepEqual(headingsHtml.match(/<h[3-6]>.*?<\/h[3-6]>/g), [
  "<h3>One</h3>",
  "<h4>Two</h4>",
  "<h5>Three</h5>",
  "<h6>Four</h6>",
  "<h6>Five</h6>",
  "<h6>Six</h6>",
]);
assert.equal((headingsHtml.match(/<h1\b/g) ?? []).length, 1);
assert.match(headingsHtml, /<h2[^>]*id="event-description-title"/);
assert.match(richHtml, /<strong>bright<\/strong>/);
assert.doesNotMatch(richHtml, /<script|evil\.test|hidden image/);
assert.match(richHtml, /02:30 GMT\+2/);
assert.match(richHtml, /02:30 GMT\+1/);
assert.match(richHtml, /Saturday, 26 October 2030/);
assert.match(richHtml, /Sunday, 27 October 2030/);
for (const entry of rich.schedule) {
  assert.ok(richHtml.includes(`dateTime="${entry.startsAt}"`));
}
assert.ok(richHtml.indexOf("Before fold") < richHtml.indexOf("Same instant"));
assert.ok(richHtml.indexOf("Same instant") < richHtml.indexOf("After fold"));
assert.match(richHtml, /All places are currently filled. You can still apply/);
assert.match(richHtml, /href="#event-application"/);
assert.match(richHtml, /Public organizer/);
assert.match(richHtml, /rel="noopener noreferrer"/);
for (const location of [
  { type: "PHYSICAL", venueName: "Physical venue", address: "Address" },
  {
    type: "ONLINE",
    onlineLabel: "Online venue",
    onlineUrl: "https://example.test/join",
  },
  rich.location,
]) {
  const snapshot = eventSnapshotSchema.parse({ ...rich, location });
  assert.match(
    renderToStaticMarkup(<EventRichContent snapshot={snapshot} />),
    /event-location-title/,
  );
}
const image = eventCoverImage(rich.cover, "/e/event/cover/asset");
assert.equal(image.srcSet, "/e/event/cover/asset/640 480w");
const coverHtml = renderToStaticMarkup(<EventCover image={image} />);
assert.match(coverHtml, /width="480" height="240" alt="Published cover"/);
assert.doesNotMatch(coverHtml, /_next\/image/);
const plain = eventDescriptionText(rich.description ?? "", "MARKDOWN");
assert.equal(plain, "Welcome A bright day. Join");
assert.equal(
  eventDescriptionText("**literal**\ntext", "PLAIN_TEXT"),
  "**literal** text",
);
const published = {
  snapshot: rich,
  cancelledAt: null,
  cancellationReason: null,
  archived: false,
  eventRevisionId: "revision",
  lifecycleEndsAt: new Date(rich.endsAt),
};
const metadata = publicEventMetadata(
  published,
  "public-id",
  "https://trusted.test",
);
assert.equal(metadata.description, plain);
assert.deepEqual(metadata.alternates, {
  canonical: "https://trusted.test/e/public-id",
});
assert.deepEqual(metadata.robots, { index: true, follow: true });
assert.ok(JSON.stringify(metadata.openGraph).includes("/social"));
assert.ok(JSON.stringify(metadata.twitter).includes("summary_large_image"));
for (const change of [{ archived: true }, { cancelledAt: new Date() }]) {
  assert.deepEqual(
    publicEventMetadata(
      { ...published, ...change },
      "id",
      "https://trusted.test",
    ).robots,
    { index: false, follow: true },
  );
}
const privateMetadata = publicEventMetadata(
  { ...published, snapshot: { ...rich, visibility: "PRIVATE" } },
  "id",
  "https://trusted.test",
);
assert.deepEqual(privateMetadata.robots, { index: false, follow: false });
assert.equal(privateMetadata.openGraph, null);
assert.equal(privateMetadata.twitter, null);
console.log(
  "PASS: V1/V2 literal text, V3 rich rendering, headings, location types, multi-day/DST/ties, full capacity CTA, cover widths, shared Markdown text and metadata policy",
);

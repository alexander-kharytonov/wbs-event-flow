import assert from "node:assert/strict";
import { renderToStaticMarkup } from "react-dom/server";
import {
  EventDescription,
  safeMarkdownUrl,
} from "@/features/events/components/event-description";

for (const url of [
  "javascript:alert(1)",
  "data:text/html,test",
  "mailto:secret@example.com",
  "//example.com",
  "/relative",
  "https://user:password@example.com",
]) {
  assert.equal(safeMarkdownUrl(url), undefined);
}
assert.equal(safeMarkdownUrl("https://example.com"), "https://example.com/");
const source =
  '# Heading\n\n**Strong** *emphasis*\n\n- Item\n\n[Safe](https://example.com) [Bad](javascript:alert%281%29)\n\n<img src="https://evil.invalid" onerror="alert(1)">\n\n<iframe src="https://evil.invalid"></iframe>\n\n![image](https://evil.invalid/image)';
const html = renderToStaticMarkup(
  <EventDescription text={source} format="MARKDOWN" />,
);
assert.match(html, /<h3>Heading<\/h3>/);
assert.match(html, /<strong>Strong<\/strong>/);
assert.match(html, /<ul>/);
assert.match(html, /rel="noopener noreferrer"/);
assert.doesNotMatch(html, /<img|<iframe|javascript:|evil\.invalid|onerror=/);
const plain = renderToStaticMarkup(
  <EventDescription
    text="**Unchanged** <script>test</script>"
    format="PLAIN_TEXT"
  />,
);
assert.match(plain, /\*\*Unchanged\*\*/);
assert.doesNotMatch(plain, /<strong>|<script>/);
console.log(
  "PASS: shared Markdown renderer, HTML/images excluded, absolute HTTP(S) filtering and historical plain text",
);

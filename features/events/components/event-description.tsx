import { Box } from "@mui/material";
import { isValidElement } from "react";
import Markdown from "react-markdown";

export function safeMarkdownUrl(value: string) {
  const url = URL.parse(value);

  return url &&
    ["http:", "https:"].includes(url.protocol) &&
    !url.username &&
    !url.password
    ? url.href
    : undefined;
}

const markdownOptions = {
  skipHtml: true,
  allowedElements: [
    "h1",
    "h2",
    "h3",
    "h4",
    "h5",
    "h6",
    "p",
    "em",
    "strong",
    "ul",
    "ol",
    "li",
    "a",
    "br",
  ],
  urlTransform: safeMarkdownUrl,
};

function renderedText(node: unknown): string {
  if (typeof node === "string") {
    return node;
  }

  if (Array.isArray(node)) {
    return node.map(renderedText).join("");
  }

  if (isValidElement<{ children?: unknown }>(node)) {
    const text = renderedText(node.props.children);
    const block =
      typeof node.type === "string" &&
      [
        "h1",
        "h2",
        "h3",
        "h4",
        "h5",
        "h6",
        "p",
        "ul",
        "ol",
        "li",
        "br",
      ].includes(node.type);

    return block ? `${text} ` : text;
  }

  return "";
}

// Extract only rendered text from the same sanitized parser output: never hrefs,
// raw HTML, image alt text, or a second Markdown interpretation for metadata.
export function eventDescriptionText(
  text: string,
  format: "PLAIN_TEXT" | "MARKDOWN",
) {
  const plain =
    format === "MARKDOWN"
      ? renderedText(Markdown({ ...markdownOptions, children: text }))
      : text;

  return plain.replace(/\s+/g, " ").trim();
}

// The same restricted renderer runs in the form preview and server Preview.
export function EventDescription({
  text,
  format,
}: {
  text: string;
  format: "PLAIN_TEXT" | "MARKDOWN";
}) {
  if (format === "PLAIN_TEXT") {
    return (
      <Box sx={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>
        {text}
      </Box>
    );
  }

  return (
    <Box
      sx={{
        overflowWrap: "anywhere",
        "& > :first-child": { mt: 0 },
        "& > :last-child": { mb: 0 },
        "& a": { color: "primary.main" },
        "& h3, & h4, & h5, & h6": { lineHeight: 1.4 },
      }}
    >
      <Markdown
        {...markdownOptions}
        components={{
          h1: ({ children }) => <h3>{children}</h3>,
          h2: ({ children }) => <h4>{children}</h4>,
          h3: ({ children }) => <h5>{children}</h5>,
          h4: ({ children }) => <h6>{children}</h6>,
          h5: ({ children }) => <h6>{children}</h6>,
          h6: ({ children }) => <h6>{children}</h6>,
          a: ({ href, children }) =>
            href ? (
              <a href={href} target="_blank" rel="noopener noreferrer">
                {children}
              </a>
            ) : (
              <span>{children}</span>
            ),
        }}
      >
        {text}
      </Markdown>
    </Box>
  );
}

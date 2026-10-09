import { Box } from "@mui/material";
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
        skipHtml
        allowedElements={[
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
        ]}
        urlTransform={safeMarkdownUrl}
        components={{
          h1: ({ children }) => <h3>{children}</h3>,
          h2: ({ children }) => <h4>{children}</h4>,
          h3: ({ children }) => <h5>{children}</h5>,
          h4: ({ children }) => <h6>{children}</h6>,
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

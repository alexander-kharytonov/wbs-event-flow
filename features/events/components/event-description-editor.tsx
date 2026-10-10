"use client";

import FormatBold from "@mui/icons-material/FormatBold";
import FormatItalic from "@mui/icons-material/FormatItalic";
import FormatListBulleted from "@mui/icons-material/FormatListBulleted";
import Link from "@mui/icons-material/Link";
import Title from "@mui/icons-material/Title";
import {
  Alert,
  Box,
  IconButton,
  Stack,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Tooltip,
  Typography,
} from "@mui/material";
import { useId, useRef, useState } from "react";
import { EventDescription } from "@/features/events/components/event-description";

function lineRange(value: string, start: number, end: number) {
  const from = start === 0 ? 0 : value.lastIndexOf("\n", start - 1) + 1;
  const newline = value.indexOf("\n", Math.max(start, end - 1));

  return { from, to: newline < 0 ? value.length : newline };
}

// The toggles describe the selected source text, not a separate rich-text state.
function selectionFormats(value: string, start: number, end: number) {
  const before = value.slice(0, start).match(/\*+$/)?.[0].length ?? 0;
  const after = value.slice(end).match(/^\*+/)?.[0].length ?? 0;
  const markers = Math.min(before, after);
  const { from, to } = lineRange(value, start, end);
  const lines = value.slice(from, to).split("\n");
  const formats: string[] = [];

  if (markers >= 2) {
    formats.push("bold");
  }

  if (markers % 2 === 1) {
    formats.push("italic");
  }

  if (lines.every((line) => line.startsWith("## "))) {
    formats.push("heading");
  }

  if (lines.every((line) => line.startsWith("- "))) {
    formats.push("list");
  }

  return formats;
}

export function EventDescriptionEditor({
  value,
  disabled,
  error,
  formatError,
  onChange,
}: {
  value: string;
  disabled: boolean;
  error?: string;
  formatError?: string;
  onChange: (value: string) => void;
}) {
  const [mode, setMode] = useState<"write" | "preview">("write");
  const [selection, setSelection] = useState({ start: 0, end: 0 });
  const input = useRef<HTMLTextAreaElement>(null);
  const id = useId();
  const formats = selectionFormats(value, selection.start, selection.end);

  function replace(next: string, start: number, end: number) {
    if (disabled || next.length > 20000) {
      return;
    }

    onChange(next);
    setSelection({ start, end });
    requestAnimationFrame(() => {
      input.current?.focus();
      input.current?.setSelectionRange(start, end);
    });
  }

  function toggle(format: string) {
    const element = input.current;

    if (!element || disabled) {
      return;
    }

    const start = element.selectionStart;
    const end = element.selectionEnd;
    const active = selectionFormats(value, start, end).includes(format);

    if (format === "heading" || format === "list") {
      const prefix = format === "heading" ? "## " : "- ";
      const { from, to } = lineRange(value, start, end);
      const lines = value.slice(from, to).split("\n");
      const text = lines
        .map((line) => (active ? line.slice(prefix.length) : prefix + line))
        .join("\n");
      replace(
        value.slice(0, from) + text + value.slice(to),
        from,
        from + text.length,
      );

      return;
    }

    const marker = format === "bold" ? "**" : "*";
    const text = value.slice(start, end) || "text";

    if (active) {
      replace(
        value.slice(0, start - marker.length) +
          value.slice(start, end) +
          value.slice(end + marker.length),
        start - marker.length,
        end - marker.length,
      );
    } else {
      replace(
        value.slice(0, start) + marker + text + marker + value.slice(end),
        start + marker.length,
        start + marker.length + text.length,
      );
    }
  }

  function insertLink() {
    const element = input.current;

    if (!element || disabled) {
      return;
    }

    const start = element.selectionStart;
    const end = element.selectionEnd;
    const label = value.slice(start, end) || "link text";
    const url = "https://example.com";
    const text = `[${label}](${url})`;
    const urlStart = start + label.length + 3;
    replace(
      value.slice(0, start) + text + value.slice(end),
      urlStart,
      urlStart + url.length,
    );
  }

  const toolbar = (
    <Stack
      direction="row"
      sx={{
        gridArea: "toolbar",
        width: "100%",
        alignItems: "center",
        justifyContent: "space-between",
        flexWrap: "wrap",
        gap: 1,
        pb: 1.5,
        mb: 1.5,
        borderBottom: 1,
        borderColor: "divider",
      }}
    >
      <Stack direction="row" spacing={0.5} sx={{ alignItems: "center" }}>
        <ToggleButtonGroup
          size="small"
          value={mode === "write" ? formats : []}
          disabled={disabled || mode === "preview"}
          aria-label="Format selected Markdown text"
        >
          {[
            {
              value: "bold",
              label: "Bold",
              icon: <FormatBold fontSize="small" />,
            },
            {
              value: "italic",
              label: "Italic",
              icon: <FormatItalic fontSize="small" />,
            },
            {
              value: "heading",
              label: "Heading",
              icon: <Title fontSize="small" />,
            },
            {
              value: "list",
              label: "Bullet list",
              icon: <FormatListBulleted fontSize="small" />,
            },
          ].map((tool) => (
            <Tooltip
              key={tool.value}
              title={disabled || mode === "preview" ? "" : tool.label}
            >
              <ToggleButton
                type="button"
                value={tool.value}
                aria-label={tool.label}
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => toggle(tool.value)}
                sx={{ width: 36, height: 36 }}
              >
                {tool.icon}
              </ToggleButton>
            </Tooltip>
          ))}
        </ToggleButtonGroup>
        <Tooltip title="Insert link">
          <span>
            <IconButton
              type="button"
              aria-label="Insert link"
              disabled={disabled || mode === "preview"}
              onMouseDown={(event) => event.preventDefault()}
              onClick={insertLink}
              size="small"
              sx={{ width: 36, height: 36 }}
            >
              <Link fontSize="small" />
            </IconButton>
          </span>
        </Tooltip>
      </Stack>
      <ToggleButtonGroup
        exclusive
        size="small"
        value={mode}
        onChange={(_, next: "write" | "preview" | null) => {
          if (next) {
            setMode(next);
          }
        }}
        aria-label="Description editor view"
      >
        <ToggleButton value="write" sx={{ px: 1.5, height: 36 }}>
          Write
        </ToggleButton>
        <ToggleButton value="preview" sx={{ px: 1.5, height: 36 }}>
          Preview
        </ToggleButton>
      </ToggleButtonGroup>
    </Stack>
  );

  return (
    <Stack spacing={1}>
      <input type="hidden" name="description" value={value} />
      <input type="hidden" name="descriptionFormat" value="MARKDOWN" />
      <Stack
        direction="row"
        sx={{ justifyContent: "space-between", alignItems: "baseline" }}
      >
        <Typography id={`${id}-label`} component="h3" variant="subtitle1">
          Description
        </Typography>
        <Typography variant="caption" color="text.secondary">
          Markdown
        </Typography>
      </Stack>
      {formatError && <Alert severity="error">{formatError}</Alert>}
      <TextField
        inputRef={input}
        value={value}
        onChange={(event) => {
          onChange(event.target.value);
          setSelection({
            start: event.target.selectionStart ?? 0,
            end: event.target.selectionEnd ?? 0,
          });
        }}
        onSelect={() => {
          if (input.current) {
            setSelection({
              start: input.current.selectionStart,
              end: input.current.selectionEnd,
            });
          }
        }}
        disabled={disabled}
        error={Boolean(error)}
        helperText={error}
        multiline
        minRows={8}
        maxRows={16}
        fullWidth
        slotProps={{
          input: {
            startAdornment: toolbar,
            readOnly: mode === "preview",
            sx: {
              display: "grid",
              gridTemplateColumns: "minmax(0, 1fr)",
              gridTemplateAreas: '"toolbar" "content"',
              "& > textarea": { gridArea: "content" },
            },
            endAdornment:
              mode === "preview" ? (
                <Box
                  sx={{
                    gridArea: "content",
                    position: "relative",
                    // InputBase centers grid items; stretch this empty wrapper
                    // to the textarea's row so its absolute preview has height.
                    alignSelf: "stretch",
                    minWidth: 0,
                    minHeight: 0,
                  }}
                >
                  <Box
                    role="region"
                    aria-label="Description preview"
                    tabIndex={0}
                    sx={{
                      position: "absolute",
                      inset: 0,
                      overflow: "auto",
                      overflowWrap: "anywhere",
                    }}
                  >
                    {value.trim() ? (
                      <EventDescription text={value} format="MARKDOWN" />
                    ) : (
                      <Typography color="text.secondary">
                        Your description preview will appear here.
                      </Typography>
                    )}
                  </Box>
                </Box>
              ) : undefined,
          },
          htmlInput: {
            maxLength: 20000,
            "aria-labelledby": `${id}-label`,
            "aria-hidden": mode === "preview" ? true : undefined,
            tabIndex: mode === "preview" ? -1 : undefined,
            // Keep the source mounted so both modes share its autosized height.
            style: { visibility: mode === "preview" ? "hidden" : "visible" },
          },
        }}
        onKeyDown={(event) => {
          if (
            mode === "write" &&
            event.target === input.current &&
            (event.ctrlKey || event.metaKey) &&
            ["b", "i"].includes(event.key.toLowerCase())
          ) {
            event.preventDefault();
            toggle(event.key.toLowerCase() === "b" ? "bold" : "italic");
          }
        }}
      />
      <Stack direction="row" sx={{ justifyContent: "space-between", gap: 2 }}>
        <Typography variant="caption" color="text.secondary">
          Select text to format it. Markdown shortcuts supported.
        </Typography>
        <Typography
          variant="caption"
          color="text.secondary"
          sx={{ flexShrink: 0 }}
        >
          {value.length.toLocaleString("en")} / 20,000
        </Typography>
      </Stack>
    </Stack>
  );
}

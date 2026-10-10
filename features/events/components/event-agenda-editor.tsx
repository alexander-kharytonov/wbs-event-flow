"use client";

import Add from "@mui/icons-material/Add";
import ArrowDownward from "@mui/icons-material/ArrowDownward";
import ArrowUpward from "@mui/icons-material/ArrowUpward";
import DeleteOutlined from "@mui/icons-material/DeleteOutlined";
import EventNoteOutlined from "@mui/icons-material/EventNoteOutlined";
import {
  Alert,
  Button,
  IconButton,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import { useEffect, useRef, useState } from "react";
import { EmptyState } from "@/components/ui/empty-state";
import type { EventFormValues } from "@/features/events/event-input-schema";
import type { useFormFeedback } from "@/hooks/use-form-feedback";

export function EventAgendaEditor({
  revealErrorsKey,
  values,
  setValues,
  feedback,
  disabled,
}: {
  revealErrorsKey: number;
  values: EventFormValues;
  setValues: React.Dispatch<React.SetStateAction<EventFormValues>>;
  feedback: ReturnType<typeof useFormFeedback>;
  disabled: boolean;
}) {
  const sequence = useRef(values.schedule.length);
  const agenda = useRef<HTMLDivElement>(null);
  const addButton = useRef<HTMLButtonElement>(null);
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set());

  const errorRows = [
    ...new Set(
      Object.keys(feedback.errors)
        .filter((field) => /^schedule\.agenda_[0-9]+\./.test(field))
        .map((field) => field.split(".")[1]),
    ),
  ].join(",");
  useEffect(() => {
    if (!errorRows || !revealErrorsKey) {
      return;
    }
    setExpanded((current) => new Set([...current, ...errorRows.split(",")]));
  }, [errorRows, revealErrorsKey]);

  function isExpanded(key: string) {
    return expanded.has(key);
  }

  function changeRow(
    key: string,
    field: "title" | "description" | "startsAt",
    value: string,
  ) {
    feedback.clear(`schedule.${key}.${field}`);
    // A collection-level identity/limit error is not an unrelated row error.
    feedback.setErrors((current) => {
      const next = { ...current };
      delete next.schedule;

      return next;
    });
    setValues((current) => ({
      ...current,
      schedule: current.schedule.map((entry) =>
        entry.key === key
          ? {
              ...entry,
              [field]: value,
              edited: field === "startsAt" ? true : entry.edited,
            }
          : entry,
      ),
    }));
  }

  function move(index: number, offset: number) {
    const key = values.schedule[index].key;
    setValues((current) => {
      const schedule = [...current.schedule];
      [schedule[index], schedule[index + offset]] = [
        schedule[index + offset],
        schedule[index],
      ];

      return { ...current, schedule };
    });
    feedback.setErrors((current) => {
      const next = { ...current };
      delete next.schedule;

      return next;
    });
    requestAnimationFrame(() =>
      agenda.current
        ?.querySelector<HTMLButtonElement>(
          `[data-agenda-key="${key}"] [data-agenda-edit]`,
        )
        ?.focus(),
    );
  }

  return (
    <Stack component="section" spacing={2} ref={agenda}>
      <Typography variant="h6" component="h2">
        Event agenda
      </Typography>
      <Alert severity="info">
        Times use the event timezone. Keep entries in chronological order; equal
        times are allowed. Changing event dates does not shift agenda entries.
      </Alert>
      {feedback.errors.schedule && (
        <Alert severity="error" tabIndex={-1} data-editor-error>
          {feedback.errors.schedule}
        </Alert>
      )}
      {!values.schedule.length && (
        <EmptyState
          icon={<EventNoteOutlined />}
          title="No agenda entries"
          description="Add the sessions or activities you want to share with attendees."
        />
      )}
      {values.schedule.map((entry, index) => (
        <Stack
          key={entry.key}
          data-agenda-key={entry.key}
          spacing={2}
          sx={{
            border: 1,
            borderColor: "divider",
            p: 2,
            borderRadius: 1,
          }}
        >
          <Stack
            direction={{ xs: "column", sm: "row" }}
            sx={{
              alignItems: { sm: "center" },
              justifyContent: "space-between",
              gap: 1,
            }}
          >
            <Stack spacing={0.5} sx={{ minWidth: 0, flex: 1 }}>
              <Typography
                component="h3"
                variant="subtitle1"
                sx={{ overflowWrap: "anywhere" }}
              >
                {entry.title || `Untitled entry ${index + 1}`}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {entry.startsAt.replace("T", " · ") || "Time not set"}
              </Typography>
              {entry.description && (
                <Typography
                  variant="body2"
                  color="text.secondary"
                  sx={{
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {entry.description}
                </Typography>
              )}
            </Stack>
            <Stack direction="row" useFlexGap sx={{ flexWrap: "wrap" }}>
              <Button
                type="button"
                data-agenda-edit
                aria-expanded={isExpanded(entry.key)}
                aria-controls={`agenda-details-${entry.key}`}
                aria-label={`${isExpanded(entry.key) ? "Collapse" : "Edit"} agenda entry ${index + 1}`}
                onClick={() => {
                  setExpanded((current) => {
                    const next = new Set(current);

                    if (next.has(entry.key)) {
                      next.delete(entry.key);
                    } else {
                      next.add(entry.key);
                    }

                    return next;
                  });
                }}
              >
                {isExpanded(entry.key) ? "Collapse" : "Edit"}
              </Button>
              <IconButton
                type="button"
                aria-label={`Move agenda entry ${index + 1} up`}
                disabled={disabled || index === 0}
                onClick={() => move(index, -1)}
              >
                <ArrowUpward />
              </IconButton>
              <IconButton
                type="button"
                aria-label={`Move agenda entry ${index + 1} down`}
                disabled={disabled || index === values.schedule.length - 1}
                onClick={() => move(index, 1)}
              >
                <ArrowDownward />
              </IconButton>
              <IconButton
                type="button"
                aria-label={`Remove agenda entry ${index + 1}`}
                disabled={disabled}
                onClick={() => {
                  const nextKey =
                    values.schedule[index + 1]?.key ??
                    values.schedule[index - 1]?.key;
                  setValues((current) => ({
                    ...current,
                    schedule: current.schedule.filter(
                      (row) => row.key !== entry.key,
                    ),
                  }));
                  feedback.clear(`schedule.${entry.key}`);
                  requestAnimationFrame(() => {
                    const target = nextKey
                      ? agenda.current?.querySelector<HTMLInputElement>(
                          `[data-agenda-key="${nextKey}"] [data-agenda-edit]`,
                        )
                      : null;
                    (target ?? addButton.current)?.focus();
                  });
                }}
              >
                <DeleteOutlined />
              </IconButton>
            </Stack>
          </Stack>
          <Stack
            id={`agenda-details-${entry.key}`}
            hidden={!isExpanded(entry.key)}
            spacing={2}
            sx={{ display: isExpanded(entry.key) ? "flex" : "none" }}
          >
            <TextField
              label="Agenda title"
              required
              fullWidth
              disabled={disabled}
              value={entry.title}
              onChange={(event) =>
                changeRow(entry.key, "title", event.target.value)
              }
              {...feedback.field(`schedule.${entry.key}.title`)}
              slotProps={{ htmlInput: { maxLength: 200 } }}
            />
            <TextField
              label="Agenda start"
              type="datetime-local"
              required
              fullWidth
              disabled={disabled}
              value={entry.startsAt}
              onChange={(event) =>
                changeRow(entry.key, "startsAt", event.target.value)
              }
              {...feedback.field(`schedule.${entry.key}.startsAt`)}
              slotProps={{ inputLabel: { shrink: true } }}
            />
            <TextField
              label="Agenda description (optional)"
              multiline
              minRows={2}
              fullWidth
              disabled={disabled}
              value={entry.description}
              onChange={(event) =>
                changeRow(entry.key, "description", event.target.value)
              }
              {...feedback.field(`schedule.${entry.key}.description`)}
              slotProps={{ htmlInput: { maxLength: 2000 } }}
            />
          </Stack>
        </Stack>
      ))}
      <Button
        ref={addButton}
        type="button"
        startIcon={<Add />}
        disabled={disabled || values.schedule.length >= 100}
        sx={{ alignSelf: "flex-start" }}
        onClick={() => {
          const key = `agenda_${sequence.current++}`;
          setExpanded((current) => new Set([...current, key]));
          setValues((current) => ({
            ...current,
            schedule: [
              ...current.schedule,
              {
                key,
                sourceIndex: null,
                edited: true,
                title: "",
                description: "",
                startsAt: "",
              },
            ],
          }));
          feedback.clear("schedule");
          requestAnimationFrame(() =>
            agenda.current
              ?.querySelector<HTMLInputElement>(
                `[data-agenda-key="${key}"] input`,
              )
              ?.focus(),
          );
        }}
      >
        Add agenda entry
      </Button>
    </Stack>
  );
}

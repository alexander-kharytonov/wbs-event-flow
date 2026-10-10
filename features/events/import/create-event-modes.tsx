"use client";

import UploadFileOutlined from "@mui/icons-material/UploadFileOutlined";
import {
  Alert,
  Button,
  FormControlLabel,
  Stack,
  Switch,
  TextField,
  Tooltip,
  Typography,
} from "@mui/material";
import { useRef, useState } from "react";
import { BackLink } from "@/components/ui/back-link";
import { EventFormDialog } from "@/features/events/components/event-form-dialog";
import { createEvent } from "@/features/events/create-event";
import { EventForm } from "@/features/events/event-form";
import {
  parseTemplateText,
  type TemplateEvent,
  type TemplateIssue,
} from "@/features/events/import/template-input";
import {
  TemplateIssues,
  TemplateReview,
} from "@/features/events/import/template-review";
import { TEMPLATE_V1_LIMITS } from "@/features/exports/event-template";

export function CreateEventModes({
  modal = false,
  initialTemplate: incomingTemplate,
  duplicateError,
}: {
  modal?: boolean;
  initialTemplate?: TemplateEvent;
  duplicateError?: string;
}) {
  // The server changes this container's key on source changes or confirmed denial.
  // Other refresh outcomes must not replace or remove an acquired snapshot.
  const [initialTemplate, setInitialTemplate] = useState(incomingTemplate);
  const [mode, setMode] = useState("manual");
  const [text, setText] = useState("");
  const [issues, setIssues] = useState<TemplateIssue[]>([]);
  const [review, setReview] = useState<{
    generation: number;
    sourceVersion: 1 | 2;
    event: TemplateEvent;
  }>();
  const [busy, setBusy] = useState(false);
  const [reading, setReading] = useState(false);
  const uploadSequence = useRef(0);
  const generation = useRef(0);

  if (!initialTemplate && incomingTemplate) {
    setInitialTemplate(incomingTemplate);
  }

  const modeSwitch = (
    <Tooltip title="Create an event from a JSON template">
      <FormControlLabel
        sx={{ m: 0, flexShrink: 0 }}
        label={<Typography variant="body2">Use template</Typography>}
        control={
          <Switch
            size="small"
            checked={mode === "import"}
            disabled={busy || reading}
            onChange={(_, checked) => setMode(checked ? "import" : "manual")}
          />
        }
      />
    </Tooltip>
  );
  const content = (
    <Stack spacing={3}>
      {duplicateError && !initialTemplate ? (
        <Alert severity="error">{duplicateError}</Alert>
      ) : initialTemplate ? (
        <>
          <Alert severity="info">
            Review this copy before creating a new unpublished event. Nothing is
            saved until Create event. Reloading discards your edits and reloads
            the source configuration.
          </Alert>
          <TemplateReview initial={initialTemplate} onBusyChange={setBusy} />
        </>
      ) : mode === "manual" ? (
        <EventForm serverAction={createEvent} />
      ) : (
        <Stack spacing={3}>
          <Alert severity="info">
            Upload an Event Flow JSON template or paste its contents. Review and
            edit it before creating a new unpublished event.
          </Alert>
          <Button
            component="label"
            variant="outlined"
            startIcon={<UploadFileOutlined />}
            disabled={busy || reading}
            sx={{ alignSelf: "flex-start" }}
          >
            {reading ? "Reading…" : "Upload JSON"}
            <input
              hidden
              type="file"
              accept=".json,application/json"
              disabled={busy || reading}
              onChange={async (change) => {
                const file = change.target.files?.[0];
                change.target.value = "";

                if (!file) {
                  return;
                }

                const sequence = ++uploadSequence.current;
                setReview(undefined);
                setIssues([]);
                setText("");

                if (file.size > TEMPLATE_V1_LIMITS.bytes) {
                  setIssues([
                    {
                      code: "limit",
                      path: "template",
                      message:
                        "The template must not exceed 512 KiB of UTF-8 JSON.",
                    },
                  ]);

                  return;
                }

                setReading(true);

                try {
                  const contents = new TextDecoder("utf-8", {
                    fatal: true,
                  }).decode(await file.arrayBuffer());

                  if (sequence === uploadSequence.current) {
                    setText(contents);
                  }
                } catch {
                  setIssues([
                    {
                      code: "file",
                      path: "template",
                      message: "Could not read this file as UTF-8 JSON.",
                    },
                  ]);
                } finally {
                  setReading(false);
                }
              }}
            />
          </Button>
          <TextField
            label="Template JSON"
            multiline
            minRows={5}
            maxRows={12}
            value={text}
            disabled={busy || reading}
            onChange={(change) => {
              setText(change.target.value);
              setReview(undefined);
              setIssues([]);
            }}
            fullWidth
            error={issues.length > 0}
            helperText={
              issues[0]?.message ??
              "Maximum 512 KiB of UTF-8 JSON. Templates may contain private staff emails."
            }
          />
          <TemplateIssues issues={issues} />
          <Button
            variant="outlined"
            sx={{ alignSelf: "flex-start" }}
            disabled={busy || reading || !text.trim()}
            onClick={() => {
              const result = parseTemplateText(text);
              setIssues([]);

              if (result.success) {
                setReview({
                  generation: ++generation.current,
                  sourceVersion: result.sourceVersion,
                  event: result.template.event,
                });
              } else {
                setReview(undefined);
                setIssues(result.issues);
              }
            }}
          >
            Validate
          </Button>
          {review && (
            <>
              {!busy && (
                <Alert severity="success">
                  Template validated. Review the configuration below. Nothing is
                  saved until Create event.
                </Alert>
              )}
              <TemplateReview
                key={review.generation}
                initial={review.event}
                sourceVersion={review.sourceVersion}
                onBusyChange={setBusy}
              />
            </>
          )}
        </Stack>
      )}
    </Stack>
  );

  return modal ? (
    <EventFormDialog
      title="Create event"
      headerActions={
        !initialTemplate && !duplicateError ? modeSwitch : undefined
      }
    >
      {content}
    </EventFormDialog>
  ) : (
    <Stack spacing={3} sx={{ width: "100%" }}>
      <BackLink href="/dashboard">My events</BackLink>
      <Stack
        direction="row"
        sx={{
          alignItems: "center",
          gap: 2,
          justifyContent: "space-between",
          flexWrap: "wrap",
        }}
      >
        <Typography variant="h4" component="h1">
          Create event
        </Typography>
        {!initialTemplate && !duplicateError && modeSwitch}
      </Stack>
      {content}
    </Stack>
  );
}

"use client";

import Add from "@mui/icons-material/Add";
import ArrowDownward from "@mui/icons-material/ArrowDownward";
import ArrowUpward from "@mui/icons-material/ArrowUpward";
import DeleteOutlined from "@mui/icons-material/DeleteOutlined";
import EditOutlined from "@mui/icons-material/EditOutlined";
import PeopleOutlined from "@mui/icons-material/PeopleOutlined";
import QuizOutlined from "@mui/icons-material/QuizOutlined";
import {
  Alert,
  Box,
  Button,
  Chip,
  Dialog,
  DialogTitle,
  IconButton,
  MenuItem,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { EmptyState } from "@/components/ui/empty-state";
import {
  type BadgeLayout,
  badgeFieldSchema,
  defaultBadgeLayout,
} from "@/features/badges/badge-layout";
import { BadgeLayoutControls } from "@/features/badges/components/badge-layout-controls";
import { RegistrationFieldForm } from "@/features/events/components/registration-field-form";
import { EventForm } from "@/features/events/event-form";
import {
  type EventDateField,
  type EventFormState,
  eventDateFields,
  eventInputSchema,
  eventValidationError,
  type PreservedEventDates,
  parseEventWithPreservedDates,
} from "@/features/events/event-input-schema";
import {
  canonicalizeReview,
  portableBindingIssues,
  type TemplateEvent,
  type TemplateField,
  type TemplateIssue,
  templateEventValues,
} from "@/features/events/import/template-input";
import { importTemplate } from "@/features/events/import-template";
import {
  fieldTypeLabels,
  registrationFieldSchema,
} from "@/features/events/schemas/registration-form";
import type { TemplateCreateResult } from "@/features/events/server/create-template-event";
import { staffEmailSchema } from "@/features/events/staff-input";
import { useFormFeedback } from "@/hooks/use-form-feedback";
import { useNotifications } from "@/hooks/use-notifications";

export function TemplateIssues({ issues }: { issues: TemplateIssue[] }) {
  return (
    issues.length > 0 && (
      <Alert severity="error">
        <Stack spacing={0.5}>
          {[
            ...new Map(
              issues.map((issue) => [
                `${issue.path}:${issue.code}:${issue.message}`,
                issue,
              ]),
            ).values(),
          ].map((issue) => (
            <Typography
              variant="body2"
              key={`${issue.path}:${issue.code}:${issue.message}`}
            >
              <strong>{issue.path}</strong>: {issue.message}
            </Typography>
          ))}
        </Stack>
      </Alert>
    )
  );
}

function ReviewBadge({
  event,
  onChange,
}: {
  event: TemplateEvent;
  onChange: (layout: TemplateEvent["badgeLayout"]) => void;
}) {
  const portable = event.badgeLayout;
  const toField = (binding: NonNullable<typeof portable>["secondaryField"]) =>
    binding
      ? { fieldId: binding.fieldKey, type: binding.type, label: binding.label }
      : null;
  const layout: BadgeLayout | null = portable
    ? {
        ...portable,
        secondaryField: toField(portable.secondaryField),
        tertiaryField: toField(portable.tertiaryField),
      }
    : null;
  const catalog = event.registrationForm.fields.flatMap((field, index) => {
    const parsed = badgeFieldSchema.safeParse({
      fieldId: field.key,
      type: field.type,
      label: field.label,
    });

    return parsed.success
      ? [{ ...parsed.data, context: `Question ${index + 1}` }]
      : [];
  });

  return (
    <Stack spacing={2}>
      <Typography variant="h6" component="h2">
        Badge Design
      </Typography>
      <Typography variant="body2" color="text.secondary">
        {layout
          ? "Imported design. Changes apply when the event is created."
          : "Default badge design. No custom layout will be saved."}
      </Typography>
      {layout ? (
        <>
          <BadgeLayoutControls
            layout={layout}
            catalog={catalog}
            onChange={(next) => {
              const binding = (field: BadgeLayout["secondaryField"]) =>
                field
                  ? {
                      fieldKey: field.fieldId,
                      type: field.type,
                      label: field.label,
                    }
                  : null;
              onChange({
                ...next,
                secondaryField: binding(next.secondaryField),
                tertiaryField: binding(next.tertiaryField),
              });
            }}
          />
          <Button
            sx={{ alignSelf: "flex-start" }}
            onClick={() => onChange(null)}
          >
            Use default design
          </Button>
        </>
      ) : (
        <Button
          sx={{ alignSelf: "flex-start" }}
          onClick={() =>
            onChange({
              ...defaultBadgeLayout,
              secondaryField: null,
              tertiaryField: null,
            })
          }
        >
          Customize design
        </Button>
      )}
    </Stack>
  );
}

export function TemplateReview({
  initial: initialTemplate,
  onBusyChange,
}: {
  initial: TemplateEvent;
  onBusyChange: (busy: boolean) => void;
}) {
  // One mounted review owns one source snapshot, including every exact date.
  // Duplicate source keys and Import generation keys intentionally start a new review.
  const [initial] = useState(initialTemplate);
  const router = useRouter();
  const notifications = useNotifications();
  const [event, setEvent] = useState(initial);
  const staffFeedback = useFormFeedback();
  const [staffKeys, setStaffKeys] = useState(() =>
    initial.staff.map((_, index) => String(index)),
  );
  const nextStaffKey = useRef(initial.staff.length);
  const [issues, setIssues] = useState<TemplateIssue[]>([]);
  const [editor, setEditor] = useState<{ field?: TemplateField } | null>(null);
  const [fieldMessage, setFieldMessage] = useState<string>();
  const [busy, setBusy] = useState(false);
  const [created, setCreated] = useState(false);
  const editedDates = useRef(new Set<EventDateField>());
  const nextKey = useRef(initial.registrationForm.fields.length + 1);
  const initialValues = useRef(templateEventValues(initial)).current;
  const initialTitle = eventInputSchema.in.shape.title.safeParse(initial.title);

  function showIssues(nextIssues: TemplateIssue[]): EventFormState {
    const errors: Record<string, string[]> = {};
    const staffErrors: Record<string, string> = {};
    const remaining: TemplateIssue[] = [];

    for (const issue of nextIssues) {
      const field = issue.path.replace(/^event\./, "");
      const staffField = /^event\.staff\[(\d+)\]\.(email|role)$/.exec(
        issue.path,
      );

      if (Object.hasOwn(initialValues, field)) {
        errors[field] = [...(errors[field] ?? []), issue.message];
      } else if (staffField && staffKeys[Number(staffField[1])] !== undefined) {
        staffErrors[`${staffKeys[Number(staffField[1])]}.${staffField[2]}`] =
          issue.message;
      } else {
        remaining.push(issue);
      }
    }
    staffFeedback.setErrors(staffErrors);
    setIssues(remaining);

    return { errors };
  }

  const fields = event.registrationForm.fields;
  const bindings = portableBindingIssues(event);

  function setFields(next: TemplateField[]) {
    setEvent((current) => ({ ...current, registrationForm: { fields: next } }));
    setIssues([]);
  }

  function move(index: number, offset: number) {
    const next = [...fields];
    [next[index], next[index + offset]] = [next[index + offset], next[index]];
    setFields(next);
  }

  if (created) {
    return <Alert severity="info">Opening event…</Alert>;
  }

  return (
    <>
      <Box
        component="fieldset"
        disabled={busy}
        sx={{ border: 0, p: 0, m: 0, minWidth: 0 }}
      >
        <EventForm
          importedDates={initial}
          initialErrors={
            initialTitle.success
              ? undefined
              : { title: initialTitle.error.issues[0].message }
          }
          initialValues={initialValues}
          disabled={
            bindings.length > 0 ||
            event.staff.some((member) => !member.email.trim())
          }
          scheduleNotice={(values) => {
            const preserved: PreservedEventDates = {};

            for (const field of eventDateFields) {
              if (!editedDates.current.has(field)) {
                preserved[field] = initial[field];
              }
            }

            const parsed = parseEventWithPreservedDates(values, preserved);

            if (!parsed.success) {
              return null;
            }

            if (parsed.data.endsAt.getTime() <= Date.now()) {
              return (
                <Alert severity="warning">
                  This event has already ended. With these dates it will be
                  Completed and read-only after Create. Change the dates now if
                  you want to edit it later.
                </Alert>
              );
            }

            return parsed.data.startsAt.getTime() < Date.now() ? (
              <Alert severity="warning">
                The start is in the past. Imported dates are kept exactly unless
                you edit them.
              </Alert>
            ) : null;
          }}
          onDateEdit={(field) => {
            if (field === "timezone") {
              for (const name of eventDateFields) {
                editedDates.current.add(name);
              }
            } else if (eventDateFields.includes(field as EventDateField)) {
              editedDates.current.add(field as EventDateField);
            }
          }}
          serverAction={async (_previous, formData) => {
            setIssues([]);
            staffFeedback.reset();
            const staffErrors: Record<string, string> = {};

            for (const [index, member] of event.staff.entries()) {
              if (!staffEmailSchema.safeParse(member.email).success) {
                staffErrors[`${staffKeys[index]}.email`] =
                  "Enter a valid email address.";
              }
            }
            staffFeedback.setErrors(staffErrors);

            if (Object.keys(staffErrors).length) {
              return {};
            }

            const preserved: PreservedEventDates = {};

            for (const field of eventDateFields) {
              if (!editedDates.current.has(field)) {
                preserved[field] = initial[field];
              }
            }

            const parsed = parseEventWithPreservedDates(
              Object.fromEntries(formData),
              preserved,
            );

            if (!parsed.success) {
              return eventValidationError(parsed.error);
            }

            const values = parsed.data;
            const reviewed = canonicalizeReview({
              ...event,
              ...values,
              startsAt: values.startsAt.toISOString(),
              endsAt: values.endsAt.toISOString(),
              registrationOpensAt:
                values.registrationOpensAt?.toISOString() ?? null,
              registrationClosesAt:
                values.registrationClosesAt?.toISOString() ?? null,
            });

            if (!reviewed.success) {
              return showIssues(reviewed.issues);
            }

            setBusy(true);
            onBusyChange(true);
            let outcome: TemplateCreateResult;

            try {
              const payload = new FormData();
              payload.set("template", JSON.stringify(reviewed.template));
              outcome = await importTemplate(payload);
            } catch {
              setIssues([
                {
                  code: "request_failed",
                  path: "template",
                  message:
                    "We couldn’t confirm creation. Check My events before trying again.",
                },
              ]);
              onBusyChange(false);
              setBusy(false);

              return {};
            }

            if (!outcome.success) {
              onBusyChange(false);
              setBusy(false);

              return showIssues(outcome.issues);
            }

            // Keep creation locked until navigation completes.
            setCreated(true);
            notifications.show(
              <Stack spacing={1} sx={{ maxHeight: 240, overflowY: "auto" }}>
                <Typography>
                  Event created. Staff added: {outcome.addedCount}.
                </Typography>
                {outcome.skippedEmails.length > 0 && (
                  <Typography>
                    These staff assignments were not added:{" "}
                    {outcome.skippedEmails.join(", ")}
                  </Typography>
                )}
                {outcome.duplicateWarnings.length > 0 && (
                  <Typography>
                    Duplicate entries were combined:{" "}
                    {outcome.duplicateWarnings.join(", ")}
                  </Typography>
                )}
              </Stack>,
              {
                key: `template-created:${outcome.eventId}`,
                severity: outcome.skippedEmails.length ? "warning" : "success",
              },
            );
            router.replace(`/dashboard/events/${outcome.eventId}`);

            return {};
          }}
        >
          <Stack spacing={2}>
            <Typography variant="h6" component="h2">
              Registration Form
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Full name and email are always collected. Questions below remain
              local until Create.
            </Typography>
            {fields.length === 0 && (
              <EmptyState
                icon={<QuizOutlined />}
                title="No custom questions"
                description="Add questions to collect more information from your guests."
              />
            )}
            {fields.map((field, index) => (
              <Box
                key={field.key}
                sx={{
                  border: 1,
                  borderColor: "divider",
                  borderRadius: 1,
                  p: 2,
                }}
              >
                <Stack
                  direction="row"
                  spacing={1}
                  sx={{ alignItems: "flex-start" }}
                >
                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Typography sx={{ overflowWrap: "anywhere" }}>
                      {index + 1}. {field.label}
                    </Typography>
                    <Chip
                      size="small"
                      label={fieldTypeLabels[field.type]}
                      sx={{ my: 1, mr: 1 }}
                    />
                    {field.required && (
                      <Chip size="small" label="Required" variant="outlined" />
                    )}
                    {field.description && (
                      <Typography variant="body2" color="text.secondary">
                        {field.description}
                      </Typography>
                    )}
                    {field.options.map((option) => (
                      <Typography variant="body2" key={option.label}>
                        • {option.label}
                      </Typography>
                    ))}
                  </Box>
                  <Stack>
                    <IconButton
                      aria-label={`Edit question ${index + 1}`}
                      onClick={() => {
                        setFieldMessage(undefined);
                        setEditor({ field });
                      }}
                    >
                      <EditOutlined />
                    </IconButton>
                    <IconButton
                      aria-label={`Delete question ${index + 1}`}
                      onClick={() =>
                        setFields(
                          fields.filter((item) => item.key !== field.key),
                        )
                      }
                    >
                      <DeleteOutlined />
                    </IconButton>
                  </Stack>
                </Stack>
                <IconButton
                  size="small"
                  aria-label={`Move question ${index + 1} up`}
                  disabled={index === 0}
                  onClick={() => move(index, -1)}
                >
                  <ArrowUpward />
                </IconButton>
                <IconButton
                  size="small"
                  aria-label={`Move question ${index + 1} down`}
                  disabled={index === fields.length - 1}
                  onClick={() => move(index, 1)}
                >
                  <ArrowDownward />
                </IconButton>
              </Box>
            ))}
            <Button
              startIcon={<Add />}
              disabled={fields.length >= 100}
              sx={{ alignSelf: "flex-start" }}
              onClick={() => {
                setFieldMessage(undefined);
                setEditor({});
              }}
            >
              Add question
            </Button>
          </Stack>
          <Stack spacing={2}>
            <Typography variant="h6" component="h2">
              Staff
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Staff accounts will be resolved when the event is created.
            </Typography>
            {event.staff.length === 0 && (
              <EmptyState
                icon={<PeopleOutlined />}
                title="No staff assignments"
                description="Add existing Event Flow users to help manage this event."
              />
            )}
            {event.staff.map((member, index) => (
              <Stack
                direction={{ xs: "column", sm: "row" }}
                spacing={1}
                key={staffKeys[index]}
              >
                <TextField
                  label={`Staff email ${index + 1}`}
                  type="email"
                  required
                  fullWidth
                  value={member.email}
                  {...staffFeedback.field(`${staffKeys[index]}.email`)}
                  onChange={(change) => {
                    staffFeedback.clear(`${staffKeys[index]}.email`);
                    setEvent({
                      ...event,
                      staff: event.staff.map((item, i) =>
                        i === index
                          ? { ...item, email: change.target.value }
                          : item,
                      ),
                    });
                  }}
                />
                <TextField
                  select
                  label="Role"
                  value={member.role}
                  {...staffFeedback.field(`${staffKeys[index]}.role`)}
                  sx={{ minWidth: 150 }}
                  onChange={(change) => {
                    staffFeedback.clear(`${staffKeys[index]}.role`);
                    setEvent({
                      ...event,
                      staff: event.staff.map((item, i) =>
                        i === index
                          ? {
                              ...item,
                              role: change.target.value as typeof member.role,
                            }
                          : item,
                      ),
                    });
                  }}
                >
                  <MenuItem value="MANAGER">Manager</MenuItem>
                  <MenuItem value="RECEPTION">Reception</MenuItem>
                </TextField>
                <IconButton
                  aria-label={`Remove staff ${index + 1}`}
                  onClick={() => {
                    setStaffKeys(staffKeys.filter((_, i) => i !== index));
                    setEvent({
                      ...event,
                      staff: event.staff.filter((_, i) => i !== index),
                    });
                  }}
                >
                  <DeleteOutlined />
                </IconButton>
              </Stack>
            ))}
            <Button
              startIcon={<Add />}
              disabled={event.staff.length >= 100}
              sx={{ alignSelf: "flex-start" }}
              onClick={() => {
                setStaffKeys([...staffKeys, String(nextStaffKey.current++)]);
                setEvent({
                  ...event,
                  staff: [...event.staff, { email: "", role: "RECEPTION" }],
                });
              }}
            >
              Add staff
            </Button>
          </Stack>
          <TemplateIssues issues={bindings} />
          <TemplateIssues issues={issues} />
          <ReviewBadge
            event={event}
            onChange={(badgeLayout) => {
              setEvent({ ...event, badgeLayout });
              setIssues([]);
            }}
          />
        </EventForm>
      </Box>
      {editor && (
        <Dialog open fullWidth maxWidth="sm" onClose={() => setEditor(null)}>
          <DialogTitle>
            {editor.field ? "Edit question" : "Add question"}
          </DialogTitle>
          <RegistrationFieldForm
            initial={
              editor.field
                ? {
                    ...editor.field,
                    id: editor.field.key,
                    description: editor.field.description ?? "",
                  }
                : undefined
            }
            pending={false}
            message={fieldMessage}
            reloadHref="/dashboard/events/new"
            onCancel={() => setEditor(null)}
            onSave={(input) => {
              const parsed = registrationFieldSchema.safeParse(input);

              if (!parsed.success) {
                setFieldMessage(
                  "Check the question and option labels. Choice questions need at least two distinct options.",
                );

                return;
              }

              const options = parsed.data.options ?? [];
              const otherOptions = fields
                .filter((field) => field.key !== editor.field?.key)
                .reduce((sum, field) => sum + field.options.length, 0);

              if (
                options.length > 100 ||
                otherOptions + options.length > 1000
              ) {
                setFieldMessage(
                  "Use at most 100 options per question and 1,000 options in total.",
                );

                return;
              }

              const field: TemplateField = {
                ...parsed.data,
                key: editor.field?.key ?? `field_${nextKey.current++}`,
                description: parsed.data.description || null,
                options,
              };
              setFields(
                editor.field
                  ? fields.map((item) =>
                      item.key === editor.field?.key ? field : item,
                    )
                  : [...fields, field],
              );
              setEditor(null);
            }}
          />
        </Dialog>
      )}
    </>
  );
}

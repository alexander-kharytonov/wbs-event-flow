"use client";

import Add from "@mui/icons-material/Add";
import DeleteOutlined from "@mui/icons-material/DeleteOutlined";
import PeopleOutlined from "@mui/icons-material/PeopleOutlined";
import {
  Alert,
  Box,
  Button,
  Dialog,
  DialogTitle,
  IconButton,
  MenuItem,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useRef, useState } from "react";
import { useEditorNavigation } from "@/components/ui/editor-navigation-guard";
import { EmptyState } from "@/components/ui/empty-state";
import {
  type BadgeLayout,
  badgeFieldSchema,
  defaultBadgeLayout,
} from "@/features/badges/badge-layout";
import { BadgeLayoutControls } from "@/features/badges/components/badge-layout-controls";
import { EventText } from "@/features/events/components/event-text";
import { RegistrationFieldForm } from "@/features/events/components/registration-field-form";
import { RegistrationQuestions } from "@/features/events/components/registration-questions";
import { EventForm } from "@/features/events/event-form";
import {
  type EventDateField,
  type EventFormState,
  eventDateFields,
  eventFormInput,
  eventInputIssueMessage,
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
  templateCreateInput,
  templateEventValues,
} from "@/features/events/import/template-input";
import { importTemplate } from "@/features/events/import-template";
import { registrationFieldSchema } from "@/features/events/schemas/registration-form";
import type { TemplateCreateResult } from "@/features/events/server/create-template-event";
import { staffEmailSchema } from "@/features/events/staff-input";
import { useFormFeedback } from "@/hooks/use-form-feedback";
import { useNotifications } from "@/hooks/use-notifications";
import type { Messages } from "@/lib/i18n/messages";

export function TemplateIssues({ issues }: { issues: TemplateIssue[] }) {
  const t = useTranslations("events");

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
              <strong>{issue.path}</strong>:{" "}
              {t(issue.message as keyof Messages["events"])}
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
  const t = useTranslations("events");
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
      ? [
          {
            ...parsed.data,
            context: "templateQuestion" as const,
            contextValues: { number: index + 1 },
          },
        ]
      : [];
  });

  return (
    <Stack spacing={2}>
      <Typography variant="h6" component="h2">
        {t("badgeDesign")}
      </Typography>
      <Typography variant="body2" color="text.secondary">
        {layout ? t("templateImportedBadge") : t("templateDefaultBadge")}
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
            {t("templateDefaultDesign")}
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
          {t("templateCustomize")}
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
  const t = useTranslations("events");
  // One mounted review owns one source snapshot, including every exact date.
  // Duplicate source keys and Import generation keys intentionally start a new review.
  const [initial] = useState(initialTemplate);
  const router = useRouter();
  const navigation = useEditorNavigation();
  const notifications = useNotifications();
  const [event, setEvent] = useState(initial);
  const staffFeedback = useFormFeedback({}, (code) =>
    t(code as keyof Messages["events"]),
  );
  const [staffKeys, setStaffKeys] = useState(() =>
    initial.staff.map((_, index) => String(index)),
  );
  const nextStaffKey = useRef(initial.staff.length);
  const [issues, setIssues] = useState<TemplateIssue[]>([]);
  const [editor, setEditor] = useState<{ field?: TemplateField } | null>(null);
  const [fieldMessage, setFieldMessage] = useState<keyof Messages["events"]>();
  const [busy, setBusy] = useState(false);
  const [created, setCreated] = useState(false);
  const editedDates = useRef(new Set<EventDateField>());
  const nextKey = useRef(initial.registrationForm.fields.length + 1);
  const initialValues = useRef(templateEventValues(initial)).current;
  const initialTitle = eventInputSchema.in.shape.title.safeParse(initial.title);

  function showIssues(
    nextIssues: TemplateIssue[],
    input?: Record<string, unknown>,
  ): EventFormState {
    const errors: Record<string, string[]> = {};
    const staffErrors: Record<string, string> = {};
    const remaining: TemplateIssue[] = [];

    for (const issue of nextIssues) {
      const field = issue.path.replace(/^event\./, "");
      const staffField = /^event\.staff\[(\d+)\]\.(email|role)$/.exec(
        issue.path,
      );

      const agenda = /^schedule\[(\d+)\]\.(.+)$/.exec(field);
      const rows = Array.isArray(input?.schedule)
        ? input.schedule
        : initialValues.schedule;
      const mappedField = agenda
        ? `schedule.${rows[Number(agenda[1])]?.key}.${agenda[2]}`
        : field;

      if (Object.hasOwn(initialValues, field.split(/[.[]/)[0])) {
        errors[mappedField] = [...(errors[mappedField] ?? []), issue.message];
      } else if (staffField && staffKeys[Number(staffField[1])] !== undefined) {
        staffErrors[`${staffKeys[Number(staffField[1])]}.${staffField[2]}`] =
          issue.message;
      } else {
        remaining.push(issue);
      }
    }
    staffFeedback.setErrors(staffErrors);
    setIssues(remaining);

    if (Object.keys(staffErrors).length || remaining.length) {
      errors.review = ["inputCheckReview"];
    }

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
    return <Alert severity="info">{t("openingEditor")}</Alert>;
  }

  return (
    <>
      {initial.cover.status === "OMITTED" && (
        <Alert severity="warning">{t("templateCoverExcluded")}</Alert>
      )}
      <Box
        component="fieldset"
        disabled={busy}
        sx={{ border: 0, p: 0, m: 0, minWidth: 0 }}
      >
        <EventForm
          extraDirty={JSON.stringify(event) !== JSON.stringify(initial)}
          importedDates={initial}
          initialErrors={
            initialTitle.success
              ? undefined
              : { title: eventInputIssueMessage(initialTitle.error.issues[0]) }
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

            const parsed = parseEventWithPreservedDates(
              values,
              preserved,
              initial,
            );

            if (!parsed.success) {
              return null;
            }

            if (parsed.data.endsAt.getTime() <= Date.now()) {
              return <Alert severity="warning">{t("templateEnded")}</Alert>;
            }

            return parsed.data.startsAt.getTime() < Date.now() ? (
              <Alert severity="warning">{t("templatePastStart")}</Alert>
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
                staffErrors[`${staffKeys[index]}.email`] = "invalidEmail";
              }
            }
            staffFeedback.setErrors(staffErrors);

            if (Object.keys(staffErrors).length) {
              return {
                errors: { review: ["inputStaffEmails"] },
              };
            }

            const preserved: PreservedEventDates = {};

            for (const field of eventDateFields) {
              if (!editedDates.current.has(field)) {
                preserved[field] = initial[field];
              }
            }

            const parsed = parseEventWithPreservedDates(
              eventFormInput(formData),
              preserved,
              initial,
            );

            if (!parsed.success) {
              return eventValidationError(
                parsed.error,
                eventFormInput(formData),
              );
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
              return showIssues(reviewed.issues, eventFormInput(formData));
            }

            setBusy(true);
            onBusyChange(true);
            let outcome: TemplateCreateResult;

            try {
              const payload = new FormData();
              payload.set(
                "template",
                JSON.stringify(templateCreateInput(reviewed.template.event)),
              );
              outcome = await importTemplate(payload);
            } catch {
              setIssues([
                {
                  code: "request_failed",
                  path: "template",
                  message: "templateCreationUnconfirmed",
                },
              ]);
              onBusyChange(false);
              setBusy(false);

              return {
                errors: {
                  review: ["inputCreationUnconfirmed"],
                },
              };
            }

            if (!outcome.success) {
              onBusyChange(false);
              setBusy(false);

              return showIssues(outcome.issues, eventFormInput(formData));
            }

            // Keep creation locked until navigation completes.
            setCreated(true);
            notifications.show(
              <Stack spacing={1} sx={{ maxHeight: 240, overflowY: "auto" }}>
                <Typography>
                  <EventText
                    id="templateCreated"
                    values={{ count: outcome.addedCount }}
                  />
                </Typography>
                {outcome.skippedEmails.length > 0 && (
                  <Typography>
                    <EventText
                      id="templateSkipped"
                      values={{ emails: outcome.skippedEmails.join(", ") }}
                    />
                  </Typography>
                )}
                {outcome.duplicateWarnings.length > 0 && (
                  <Typography>
                    <EventText
                      id="templateDuplicates"
                      values={{ emails: outcome.duplicateWarnings.join(", ") }}
                    />
                  </Typography>
                )}
              </Stack>,
              {
                key: `template-created:${outcome.eventId}`,
                severity: outcome.skippedEmails.length ? "warning" : "success",
              },
            );
            navigation.confirmed(() =>
              router.replace(`/dashboard/events/${outcome.eventId}/edit`),
            );

            return {};
          }}
        >
          <Stack spacing={2}>
            <Typography variant="h6" component="h2">
              {t("registrationForm")}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {t("templateQuestionsHint")}
            </Typography>
            <RegistrationQuestions
              fields={fields}
              getKey={(field) => field.key}
              disabled={busy}
              addDisabled={fields.length >= 100}
              onAdd={() => {
                setFieldMessage(undefined);
                setEditor({});
              }}
              onEdit={(field) => {
                setFieldMessage(undefined);
                setEditor({ field });
              }}
              onDelete={(field) =>
                setFields(fields.filter((item) => item.key !== field.key))
              }
              onMove={move}
            />
          </Stack>
          <Stack spacing={2}>
            <Typography variant="h6" component="h2">
              {t("staff")}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {t("templateStaffHint")}
            </Typography>
            {event.staff.length === 0 && (
              <EmptyState
                icon={<PeopleOutlined />}
                title={t("templateNoStaff")}
                description={t("templateStaffDescription")}
              />
            )}
            {event.staff.map((member, index) => (
              <Stack
                direction={{ xs: "column", sm: "row" }}
                spacing={1}
                key={staffKeys[index]}
              >
                <TextField
                  label={t("templateStaffEmail", { number: index + 1 })}
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
                  label={t("role")}
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
                  <MenuItem value="MANAGER">{t("manager")}</MenuItem>
                  <MenuItem value="RECEPTION">{t("reception")}</MenuItem>
                </TextField>
                <IconButton
                  aria-label={t("templateRemoveStaff", { number: index + 1 })}
                  sx={{ alignSelf: { xs: "flex-end", sm: "flex-start" } }}
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
              {t("addStaff")}
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
            {editor.field ? t("questionEdit") : t("questionAdd")}
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
                setFieldMessage("questionCheckOptions");

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
                setFieldMessage("questionOptionsLimit");

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

"use client";

import Add from "@mui/icons-material/Add";
import BadgeOutlined from "@mui/icons-material/BadgeOutlined";
import PeopleOutlined from "@mui/icons-material/PeopleOutlined";
import SearchOutlined from "@mui/icons-material/SearchOutlined";
import {
  Alert,
  Avatar,
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  InputAdornment,
  List,
  ListItem,
  ListItemAvatar,
  ListItemButton,
  MenuItem,
  Paper,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { EmptyState } from "@/components/ui/empty-state";
import { EventAccessStatus } from "@/features/events/components/event-access-status";
import { EventText } from "@/features/events/components/event-text";
import { updateStaff } from "@/features/events/staff-actions";
import { staffEmailSchema } from "@/features/events/staff-input";
import { useFormFeedback } from "@/hooks/use-form-feedback";
import { useNotifications } from "@/hooks/use-notifications";
import type { Messages } from "@/lib/i18n/messages";

type Role = "MANAGER" | "RECEPTION";
type Member = {
  userId: string;
  role: Role;
  user: { name: string; email: string };
};
const descriptions = {
  MANAGER: "managerDescription",
  RECEPTION: "receptionDescription",
} as const;

export function StaffList({
  eventId,
  members,
}: {
  eventId: string;
  members: Member[];
}) {
  const t = useTranslations("events");
  const router = useRouter();
  const notifications = useNotifications();
  const feedback = useFormFeedback<keyof Messages["events"]>({}, t);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<Role | "ALL">("ALL");
  const query = search.trim().toLowerCase();
  const filteredMembers = members.filter(
    (member) =>
      (filter === "ALL" || member.role === filter) &&
      [member.user.name, member.user.email].some((value) =>
        value.toLowerCase().includes(query),
      ),
  );
  const [dialog, setDialog] = useState<{
    action: "add" | "change" | "remove";
    member?: Member;
  } | null>(null);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<Role>("RECEPTION");
  const [pending, startTransition] = useTransition();

  function open(action: "add" | "change" | "remove", member?: Member) {
    notifications.close(`staff:${eventId}`);
    feedback.reset();
    setEmail("");
    setRole(member?.role ?? "RECEPTION");
    setDialog({ action, member });
  }

  function submit() {
    if (!dialog || pending) {
      return;
    }

    feedback.reset();

    if (dialog.action === "add" && !staffEmailSchema.safeParse(email).success) {
      feedback.setErrors({ email: "invalidEmail" });

      return;
    }

    const command =
      dialog.action === "add"
        ? { action: "add", eventId, email, role }
        : dialog.action === "change"
          ? { action: "change", eventId, userId: dialog.member?.userId, role }
          : { action: "remove", eventId, userId: dialog.member?.userId };
    notifications.close(`staff:${eventId}`);
    startTransition(async () => {
      try {
        const result = await updateStaff(command);

        if (!result.success) {
          feedback.setErrors(result.fieldErrors ?? {});
          feedback.setMessage(result.message ?? "staffUpdateFailed");

          return;
        }

        notifications.show(
          <EventText
            id={
              dialog.action === "add"
                ? "staffAdded"
                : dialog.action === "change"
                  ? "staffRoleUpdated"
                  : "staffAccessRemoved"
            }
          />,
          {
            severity: "success",
            autoHideDuration: 4000,
            key: `staff:${eventId}`,
          },
        );
        setDialog(null);
        router.refresh();
      } catch {
        feedback.setMessage("staffUpdateFailed");
      }
    });
  }

  return (
    <>
      <Stack
        direction="row"
        sx={{ gap: 1, justifyContent: "space-between", alignItems: "center" }}
      >
        <Typography
          variant="h6"
          component="h2"
          sx={{ minHeight: 42, display: "flex", alignItems: "center" }}
        >
          {t("staff")}
        </Typography>
        <Stack direction="row" sx={{ gap: 2, alignItems: "center" }}>
          <Typography variant="body2" color="text.secondary">
            {t("staffCount", { count: members.length })}
          </Typography>
          <Button
            variant="contained"
            startIcon={<Add />}
            onClick={() => open("add")}
          >
            {t("addStaff")}
          </Button>
        </Stack>
      </Stack>
      <Stack spacing={2}>
        <Stack
          sx={{
            display: "grid",
            gap: 1.5,
            gridTemplateColumns: {
              xs: "minmax(0, 1fr)",
              md: "repeat(2, minmax(0, 1fr))",
            },
          }}
        >
          <TextField
            label={t("searchStaff")}
            placeholder={t("nameOrEmail")}
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            slotProps={{
              input: {
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchOutlined />
                  </InputAdornment>
                ),
              },
            }}
            sx={{ minWidth: 0 }}
          />
          <TextField
            select
            label={t("role")}
            value={filter}
            onChange={(event) => {
              const value = event.target.value;

              if (
                value === "ALL" ||
                value === "MANAGER" ||
                value === "RECEPTION"
              ) {
                setFilter(value);
              }
            }}
            sx={{ minWidth: 0 }}
          >
            {(["ALL", "MANAGER", "RECEPTION"] as const).map((value) => (
              <MenuItem key={value} value={value}>
                <Box
                  component="span"
                  sx={{ display: "inline-flex", alignItems: "center", gap: 1 }}
                >
                  {value === "ALL" ? (
                    <PeopleOutlined fontSize="small" />
                  ) : (
                    <BadgeOutlined fontSize="small" />
                  )}
                  {value === "ALL"
                    ? t("all")
                    : t(value === "MANAGER" ? "manager" : "reception")}
                </Box>
              </MenuItem>
            ))}
          </TextField>
        </Stack>
        {members.length === 0 ? (
          <EmptyState
            icon={<PeopleOutlined />}
            title={t("noStaff")}
            description={t("noStaffDescription")}
          />
        ) : filteredMembers.length === 0 ? (
          <EmptyState
            icon={<PeopleOutlined />}
            title={t("noMatchingStaff")}
            description={t("tryStaffFilters")}
            action={
              <Button
                onClick={() => {
                  setSearch("");
                  setFilter("ALL");
                }}
              >
                {t("clearFilters")}
              </Button>
            }
          />
        ) : (
          <Paper variant="outlined">
            <List disablePadding>
              {filteredMembers.map((member, index) => {
                return (
                  <ListItem
                    key={member.userId}
                    disablePadding
                    divider={index < filteredMembers.length - 1}
                  >
                    <ListItemButton
                      onClick={() => open("change", member)}
                      aria-label={t("manageNamedStaff", {
                        name: member.user.name,
                      })}
                      aria-haspopup="dialog"
                      alignItems="flex-start"
                      sx={{
                        px: { xs: 2, sm: 3 },
                        py: 2.5,
                        gap: { xs: 1.5, sm: 2 },
                        minWidth: 0,
                      }}
                    >
                      <ListItemAvatar sx={{ minWidth: 0, mt: 0.5 }}>
                        <StaffAvatar name={member.user.name} />
                      </ListItemAvatar>
                      <Box
                        sx={{
                          flex: 1,
                          minWidth: 0,
                          display: "flex",
                          flexDirection: { xs: "column", md: "row" },
                          gap: 2,
                          alignItems: { md: "center" },
                        }}
                      >
                        <Stack
                          spacing={0.5}
                          sx={{
                            flex: 1,
                            minWidth: 0,
                            overflowWrap: "anywhere",
                          }}
                        >
                          <Typography sx={{ fontWeight: 600 }}>
                            {member.user.name}
                          </Typography>
                          <Typography variant="body2">
                            {member.user.email}
                          </Typography>
                        </Stack>
                        <Box sx={{ flexShrink: 0 }}>
                          <EventAccessStatus role={member.role} />
                        </Box>
                      </Box>
                    </ListItemButton>
                  </ListItem>
                );
              })}
            </List>
          </Paper>
        )}
        <Dialog
          open={Boolean(dialog)}
          onClose={() => !pending && setDialog(null)}
          fullWidth
          maxWidth={dialog?.action === "remove" ? "xs" : "sm"}
          aria-labelledby="staff-dialog-title"
        >
          <DialogTitle id="staff-dialog-title">
            {dialog?.action === "add"
              ? t("addStaffMember")
              : dialog?.action === "change"
                ? t("manageStaffMember")
                : t("removeAccess")}
          </DialogTitle>
          <Box
            component="form"
            noValidate
            sx={{ display: "flex", flexDirection: "column", minHeight: 0 }}
            onSubmit={(event) => {
              event.preventDefault();
              submit();
            }}
          >
            <DialogContent>
              <Stack spacing={2.5}>
                {dialog?.action === "add" ? (
                  <TextField
                    autoFocus
                    fullWidth
                    disabled={pending}
                    label={t("email")}
                    type="email"
                    autoComplete="off"
                    required
                    value={email}
                    onChange={(event) => {
                      setEmail(event.target.value);
                      feedback.clear("email");
                    }}
                    error={Boolean(feedback.errors.email)}
                    helperText={
                      (feedback.errors.email
                        ? t(feedback.errors.email)
                        : undefined) ?? t("verifiedStaffEmail")
                    }
                  />
                ) : (
                  dialog?.member && (
                    <Stack
                      direction="row"
                      spacing={2}
                      sx={{ alignItems: "center", minWidth: 0 }}
                    >
                      <StaffAvatar name={dialog.member.user.name} />
                      <Stack
                        spacing={0.5}
                        sx={{ minWidth: 0, overflowWrap: "anywhere" }}
                      >
                        <Typography sx={{ fontWeight: 600 }}>
                          {dialog.member.user.name}
                        </Typography>
                        <Typography variant="body2">
                          {dialog.member.user.email}
                        </Typography>
                      </Stack>
                    </Stack>
                  )
                )}
                {dialog?.action === "remove" ? (
                  <Typography color="text.secondary">
                    {t("removeStaffDescription")}
                  </Typography>
                ) : (
                  <>
                    <TextField
                      select
                      label={t("role")}
                      disabled={pending}
                      value={role}
                      onChange={(event) =>
                        setRole(
                          event.target.value === "MANAGER"
                            ? "MANAGER"
                            : "RECEPTION",
                        )
                      }
                    >
                      <MenuItem value="MANAGER">{t("manager")}</MenuItem>
                      <MenuItem value="RECEPTION">{t("reception")}</MenuItem>
                    </TextField>
                    <Alert severity="warning">{t(descriptions[role])}</Alert>
                  </>
                )}
              </Stack>
            </DialogContent>
            {feedback.message && (
              <Alert severity="error" sx={{ mx: 3 }}>
                {feedback.message}
              </Alert>
            )}
            <DialogActions sx={{ px: 3, pb: 3, gap: 1, flexWrap: "wrap" }}>
              {dialog?.action === "change" && (
                <Button
                  color="error"
                  disabled={pending}
                  onClick={() => open("remove", dialog.member)}
                  sx={{ mr: "auto" }}
                >
                  {t("removeAccess")}
                </Button>
              )}
              <Button
                color="inherit"
                disabled={pending}
                onClick={() => setDialog(null)}
              >
                {t("cancel")}
              </Button>
              <Button
                type="submit"
                disabled={
                  pending || (dialog?.action === "add" && !email.trim())
                }
                variant="contained"
                loading={pending}
                color={dialog?.action === "remove" ? "error" : "primary"}
              >
                {dialog?.action === "add"
                  ? t("addStaff")
                  : dialog?.action === "change"
                    ? t("saveRole")
                    : t("removeAccess")}
              </Button>
            </DialogActions>
          </Box>
        </Dialog>
      </Stack>
    </>
  );
}

function StaffAvatar({ name }: { name: string }) {
  const nameParts = name.trim().split(/\s+/u).filter(Boolean);
  const initials = [
    nameParts[0],
    ...(nameParts.length > 1 ? [nameParts[nameParts.length - 1]] : []),
  ]
    .map((part) => Array.from(part ?? "")[0] ?? "")
    .join("")
    .toUpperCase();
  let colorHash = 0;

  for (const character of initials) {
    colorHash = (colorHash * 31 + (character.codePointAt(0) ?? 0)) % 360;
  }

  return (
    <Avatar
      sx={{
        bgcolor: `hsl(${colorHash}, 55%, 32%)`,
        color: "#fff",
        fontWeight: 600,
        fontSize: 14,
      }}
    >
      {initials}
    </Avatar>
  );
}

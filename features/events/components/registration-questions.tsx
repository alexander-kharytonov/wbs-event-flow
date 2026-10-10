"use client";

import Add from "@mui/icons-material/Add";
import ArrowDownward from "@mui/icons-material/ArrowDownward";
import ArrowUpward from "@mui/icons-material/ArrowUpward";
import DeleteOutlined from "@mui/icons-material/DeleteOutlined";
import EditOutlined from "@mui/icons-material/EditOutlined";
import QuizOutlined from "@mui/icons-material/QuizOutlined";
import {
  Box,
  Button,
  Chip,
  IconButton,
  Paper,
  Stack,
  Typography,
} from "@mui/material";
import { EmptyState } from "@/components/ui/empty-state";
import {
  type BuilderField,
  fieldTypeLabels,
} from "@/features/events/schemas/registration-form";

type Question = Omit<BuilderField, "id" | "description"> & {
  description?: string | null;
};

export function RegistrationQuestions<T extends Question>({
  fields,
  getKey,
  disabled = false,
  addDisabled = false,
  onAdd,
  onEdit,
  onDelete,
  onMove,
}: {
  fields: readonly T[];
  getKey: (field: T) => string;
  disabled?: boolean;
  addDisabled?: boolean;
  onAdd: () => void;
  onEdit: (field: T) => void;
  onDelete: (field: T) => void;
  onMove: (index: number, offset: number) => void;
}) {
  return (
    <Stack component="section" spacing={2}>
      <Stack
        direction="row"
        sx={{ alignItems: "center", justifyContent: "space-between" }}
        spacing={1}
      >
        <Typography
          variant="h6"
          component="h2"
          sx={{ minHeight: 42, display: "flex", alignItems: "center" }}
        >
          Questions
        </Typography>
        {
          <Button
            startIcon={<Add />}
            variant="contained"
            disabled={disabled || addDisabled}
            onClick={onAdd}
          >
            Add question
          </Button>
        }
      </Stack>
      {fields.length === 0 && (
        <EmptyState
          icon={<QuizOutlined />}
          title="No custom questions yet"
          description="Add questions to collect the information you need from your guests."
        />
      )}
      {fields.map((field, index) => (
        <Paper
          key={getKey(field)}
          variant="outlined"
          sx={{ p: { xs: 2, sm: 2.5 } }}
        >
          <Box
            sx={{
              display: "grid",
              gridTemplateColumns: {
                xs: "minmax(0, 1fr)",
                md: "minmax(0, 1fr) auto",
              },
              gap: 2,
            }}
          >
            <Stack spacing={1}>
              <Typography
                variant="subtitle1"
                component="h3"
                sx={{ overflowWrap: "anywhere" }}
              >
                {index + 1}. {field.label}
              </Typography>
              <Stack direction="row" spacing={1}>
                <Chip size="small" label={fieldTypeLabels[field.type]} />
                <Chip
                  size="small"
                  variant="outlined"
                  label={field.required ? "Required" : "Optional"}
                />
              </Stack>
              {field.description && (
                <Typography
                  variant="body2"
                  color="text.secondary"
                  sx={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}
                >
                  {field.description}
                </Typography>
              )}
              {field.options.length > 0 && (
                <Box
                  component="ol"
                  sx={{ m: 0, pl: 3, overflowWrap: "anywhere" }}
                >
                  {field.options.map((option) => (
                    <Typography
                      component="li"
                      variant="body2"
                      key={option.label}
                    >
                      {option.label}
                    </Typography>
                  ))}
                </Box>
              )}
            </Stack>
            {
              <Stack
                direction="row"
                spacing={0.5}
                sx={{
                  alignItems: "center",
                  alignSelf: "start",
                  flexWrap: "wrap",
                }}
              >
                <IconButton
                  aria-label={`Move question ${index + 1} up`}
                  disabled={disabled || index === 0}
                  onClick={() => onMove(index, -1)}
                >
                  <ArrowUpward fontSize="small" />
                </IconButton>
                <IconButton
                  aria-label={`Move question ${index + 1} down`}
                  disabled={disabled || index === fields.length - 1}
                  onClick={() => onMove(index, 1)}
                >
                  <ArrowDownward fontSize="small" />
                </IconButton>
                <Button
                  startIcon={<EditOutlined />}
                  disabled={disabled}
                  onClick={() => onEdit(field)}
                >
                  Edit
                </Button>
                <Button
                  startIcon={<DeleteOutlined />}
                  color="error"
                  disabled={disabled}
                  onClick={() => onDelete(field)}
                >
                  Delete
                </Button>
              </Stack>
            }
          </Box>
        </Paper>
      ))}
    </Stack>
  );
}

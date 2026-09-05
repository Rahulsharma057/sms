"use client";
import { useEffect, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Checkbox,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  IconButton,
  MenuItem,
  Paper,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import {
  Add,
  DeleteOutline,
  RemoveCircleOutline,
  Save,
} from "@mui/icons-material";
import api from "../lib/api";
const normalize = (t = {}) => ({
  sections: (t.sections || []).map((s, si) => ({
    key: s.key || `section_${si + 1}`,
    title: s.title || `Section ${si + 1}`,
    timing: s.timing || "",
    items: (s.items || []).map((i, ii) => ({
      key: i.key || `item_${si + 1}_${ii + 1}`,
      label: i.label || "",
    })),
  })),
  customFields: (t.customFields || []).map((f, i) => ({
    key: f.key || `custom_field_${i + 1}`,
    label: f.label || "",
    type: f.type || "text",
    options: Array.isArray(f.options) ? f.options : [],
    required: !!f.required,
  })),
});
export default function ReportFormatDialog({ open, onClose, onSaved }) {
  const [draft, setDraft] = useState({ sections: [], customFields: [] });
  const [loading, setLoading] = useState(false),
    [saving, setSaving] = useState(false),
    [error, setError] = useState(""),
    [message, setMessage] = useState("");
  useEffect(() => {
    if (!open) return;
    setLoading(true);
    setError("");
    setMessage("");
    api
      .get("/reports/template")
      .then((r) => setDraft(normalize(r?.data || {})))
      .catch((e) =>
        setError(e?.response?.data?.message || "Could not load report format."),
      )
      .finally(() => setLoading(false));
  }, [open]);
  const updateSection = (i, p) =>
    setDraft((x) => ({
      ...x,
      sections: x.sections.map((s, j) => (j === i ? { ...s, ...p } : s)),
    }));
  const updateItem = (si, ii, p) =>
    setDraft((x) => ({
      ...x,
      sections: x.sections.map((s, i) =>
        i !== si
          ? s
          : {
              ...s,
              items: s.items.map((it, j) => (j === ii ? { ...it, ...p } : it)),
            },
      ),
    }));
  const addItem = (si) =>
    setDraft((x) => ({
      ...x,
      sections: x.sections.map((s, i) =>
        i === si
          ? {
              ...s,
              items: [
                ...s.items,
                { key: `item_${Date.now()}`, label: "New checklist item" },
              ],
            }
          : s,
      ),
    }));
  const removeItem = (si, ii) =>
    setDraft((x) => ({
      ...x,
      sections: x.sections.map((s, i) =>
        i === si ? { ...s, items: s.items.filter((_, j) => j !== ii) } : s,
      ),
    }));
  const addSection = () =>
    setDraft((x) => ({
      ...x,
      sections: [
        ...x.sections,
        {
          key: `custom_section_${Date.now()}`,
          title: "New Section",
          timing: "",
          items: [],
        },
      ],
    }));
  const removeSection = (si) =>
    setDraft((x) => ({
      ...x,
      sections: x.sections.filter((_, i) => i !== si),
    }));
  const addField = () =>
    setDraft((x) => ({
      ...x,
      customFields: [
        ...x.customFields,
        {
          key: `custom_field_${Date.now()}`,
          label: "New Field",
          type: "text",
          options: [],
          required: false,
        },
      ],
    }));
  const updateField = (i, p) =>
    setDraft((x) => ({
      ...x,
      customFields: x.customFields.map((f, j) =>
        j === i ? { ...f, ...p } : f,
      ),
    }));
  const removeField = (i) =>
    setDraft((x) => ({
      ...x,
      customFields: x.customFields.filter((_, j) => j !== i),
    }));
 const save = async () => {
  setError("");
  setMessage("");

  if (!draft.sections.length) {
    return setError("At least one section is required.");
  }

  if (draft.sections.some((s) => !s.title.trim())) {
    return setError("Every section needs a title.");
  }

  if (
    draft.sections.some((s) =>
      s.items.some((i) => !i.label.trim())
    )
  ) {
    return setError("Every checklist item needs a label.");
  }

  if (draft.customFields.some((f) => !f.label.trim())) {
    return setError("Every additional field needs a label.");
  }

  if (
    draft.customFields.some(
      (f) =>
        f.type === "select" &&
        !f.options?.length
    )
  ) {
    return setError("Select fields need at least one option.");
  }

  try {
    setSaving(true);

    const r = await api.put(
      "/reports/template",
      draft
    );

    const saved =
      r?.data?.template || r?.data;

    setDraft(normalize(saved));

    // parent refresh
    onSaved?.(saved);

    // dialog close
    onClose();

  } catch (e) {
    setError(
      e?.response?.data?.message ||
        "Could not save report format."
    );
  } finally {
    setSaving(false);
  }
};
  return (
    <Dialog
      open={open}
      onClose={() => !saving && onClose()}
      fullWidth
      maxWidth="md"
    >
      <DialogTitle sx={{ fontWeight: 800 }}>
        Edit Daily Report Format
      </DialogTitle>
      <DialogContent dividers sx={{ bgcolor: "#f8fafc" }}>
        {loading ? (
          <Typography py={4} textAlign="center">
            Loading format…
          </Typography>
        ) : (
          <Stack spacing={2}>
            <Alert severity="info">
              This changes the <b>future report format only</b>. Already
              submitted reports remain unchanged.
            </Alert>
            {error && <Alert severity="error">{error}</Alert>}
            {message && <Alert severity="success">{message}</Alert>}
            {draft.sections.map((s, si) => (
              <Paper
                key={s.key}
                variant="outlined"
                sx={{ p: 1.5, borderRadius: 2 }}
              >
                <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
                  <TextField
                    fullWidth
                    size="small"
                    label="Section title"
                    value={s.title}
                    onChange={(e) =>
                      updateSection(si, { title: e.target.value })
                    }
                  />
                  <TextField
                    fullWidth
                    size="small"
                    label="Timing"
                    value={s.timing}
                    onChange={(e) =>
                      updateSection(si, { timing: e.target.value })
                    }
                  />
                  <IconButton
                    color="error"
                    onClick={() => removeSection(si)}
                    disabled={draft.sections.length === 1}
                  >
                    <DeleteOutline />
                  </IconButton>
                </Stack>
                <Divider sx={{ my: 1.2 }} />
                <Stack spacing={0.8}>
                  {s.items.map((it, ii) => (
                    <Stack key={it.key} direction="row" spacing={0.7}>
                      <TextField
                        fullWidth
                        size="small"
                        label={`Checklist item ${ii + 1}`}
                        value={it.label}
                        onChange={(e) =>
                          updateItem(si, ii, { label: e.target.value })
                        }
                      />
                      <IconButton
                        color="error"
                        onClick={() => removeItem(si, ii)}
                      >
                        <RemoveCircleOutline />
                      </IconButton>
                    </Stack>
                  ))}
                  <Button
                    size="small"
                    startIcon={<Add />}
                    onClick={() => addItem(si)}
                    sx={{ textTransform: "none", alignSelf: "flex-start" }}
                  >
                    Add checklist item
                  </Button>
                </Stack>
              </Paper>
            ))}
            <Button
              variant="outlined"
              startIcon={<Add />}
              onClick={addSection}
              sx={{ textTransform: "none" }}
            >
              Add New Section
            </Button>
            <Paper variant="outlined" sx={{ p: 1.5, borderRadius: 2 }}>
              <Stack
                direction="row"
                justifyContent="space-between"
                alignItems="center"
                mb={1}
              >
                <Box>
                  <Typography fontWeight={800}>Additional Fields</Typography>
                  <Typography variant="caption" color="text.secondary">
                    Fields added here appear in future reports.
                  </Typography>
                </Box>
                <Button
                  size="small"
                  startIcon={<Add />}
                  onClick={addField}
                  sx={{ textTransform: "none" }}
                >
                  Add Field
                </Button>
              </Stack>
              <Stack spacing={1}>
                {draft.customFields.map((f, i) => (
                  <Paper key={f.key} variant="outlined" sx={{ p: 1.2 }}>
                    <Stack
                      direction={{ xs: "column", sm: "row" }}
                      spacing={1}
                      alignItems={{ sm: "center" }}
                    >
                      <TextField
                        fullWidth
                        size="small"
                        label="Field label"
                        value={f.label}
                        onChange={(e) =>
                          updateField(i, { label: e.target.value })
                        }
                      />
                      <TextField
                        select
                        size="small"
                        label="Type"
                        value={f.type}
                        onChange={(e) =>
                          updateField(i, {
                            type: e.target.value,
                            options:
                              e.target.value === "select" ? f.options : [],
                          })
                        }
                        sx={{ minWidth: 150 }}
                      >
                        {[
                          "text",
                          "textarea",
                          "number",
                          "date",
                          "select",
                          "checkbox",
                        ].map((type) => (
                          <MenuItem key={type} value={type}>
                            {type}
                          </MenuItem>
                        ))}
                      </TextField>
                      <Stack direction="row" alignItems="center">
                        <Checkbox
                          checked={f.required}
                          onChange={(e) =>
                            updateField(i, { required: e.target.checked })
                          }
                        />
                        <Typography variant="caption">Required</Typography>
                      </Stack>
                      <IconButton color="error" onClick={() => removeField(i)}>
                        <DeleteOutline />
                      </IconButton>
                    </Stack>
                    {f.type === "select" && (
                      <TextField
                        fullWidth
                        size="small"
                        sx={{ mt: 1 }}
                        label="Options (comma separated)"
                        value={(f.options || []).join(", ")}
                        onChange={(e) =>
                          updateField(i, {
                            options: e.target.value
                              .split(",")
                              .map((x) => x.trim())
                              .filter(Boolean),
                          })
                        }
                      />
                    )}
                  </Paper>
                ))}
              </Stack>
            </Paper>
          </Stack>
        )}
      </DialogContent>
      <DialogActions>
        <Button
          onClick={onClose}
          disabled={saving}
          sx={{ textTransform: "none" }}
        >
          Close
        </Button>
        <Button
          variant="contained"
          startIcon={<Save />}
          onClick={save}
          disabled={saving || loading}
          sx={{ textTransform: "none" }}
        >
          {saving ? "Saving…" : "Save Format"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

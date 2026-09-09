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

// NEW: default labels for the fixed (non-checklist) report fields — must match backend DEFAULT_FIXED_FIELDS.
const FIXED_FIELD_DEFS = [
  { key: "positiveObservations", fallback: "Major positive observations" },
  { key: "hygieneLapses", fallback: "Cleanliness / hygiene lapses noted" },
  {
    key: "maintenanceFollowUp",
    fallback: "Maintenance items needing follow-up action",
  },
  { key: "urgentMatters", fallback: "Urgent Matters" },
  { key: "signature", fallback: "Signature of Duty Officer" },
  { key: "countersignedBy", fallback: "Countersigned by" },
];

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
  // NEW: fixedFields normalization
  fixedFields: FIXED_FIELD_DEFS.reduce((acc, { key, fallback }) => {
    const source = t.fixedFields?.[key] || {};
    acc[key] = {
      label: source.label || fallback,
      enabled: source.enabled === undefined ? true : !!source.enabled,
    };
    return acc;
  }, {}),
});

export default function ReportFormatDialog({ open, onClose, onSaved }) {
  const [draft, setDraft] = useState({
    sections: [],
    customFields: [],
    fixedFields: {},
  });
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

  // NEW: update a single fixed field's label/enabled state
  const updateFixedField = (key, patch) =>
    setDraft((x) => ({
      ...x,
      fixedFields: {
        ...x.fixedFields,
        [key]: { ...x.fixedFields[key], ...patch },
      },
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

    if (draft.sections.some((s) => s.items.some((i) => !i.label.trim()))) {
      return setError("Every checklist item needs a label.");
    }

    if (draft.customFields.some((f) => !f.label.trim())) {
      return setError("Every additional field needs a label.");
    }

    if (
      draft.customFields.some((f) => f.type === "select" && !f.options?.length)
    ) {
      return setError("Select fields need at least one option.");
    }

    // NEW: enabled fixed fields must still have a label
    if (
      FIXED_FIELD_DEFS.some(
        ({ key }) =>
          draft.fixedFields[key]?.enabled &&
          !draft.fixedFields[key]?.label?.trim(),
      )
    ) {
      return setError("Every enabled field below needs a label.");
    }

    try {
      setSaving(true);

      const r = await api.put("/reports/template", draft);

      const saved = r?.data?.template || r?.data;

      setDraft(normalize(saved));

      // parent refresh
      onSaved?.(saved);

      // dialog close
      onClose();
    } catch (e) {
      setError(e?.response?.data?.message || "Could not save report format.");
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

            {/* NEW: Other Report Fields — Observations / Urgent Matters / Verification */}
            <Paper variant="outlined" sx={{ p: 1.5, borderRadius: 2 }}>
              <Box mb={1}>
                <Typography fontWeight={800}>Other Report Fields</Typography>
                <Typography variant="caption" color="text.secondary">
                  Rename or hide the Observations, Urgent Matters and
                  Verification fields.
                </Typography>
              </Box>
              <Stack spacing={1}>
                {FIXED_FIELD_DEFS.map(({ key, fallback }) => {
                  const field = draft.fixedFields[key] || {
                    label: fallback,
                    enabled: true,
                  };
                  return (
                    <Stack
                      key={key}
                      direction={{ xs: "column", sm: "row" }}
                      spacing={1}
                      alignItems={{ sm: "center" }}
                    >
                      <TextField
                        fullWidth
                        size="small"
                        label="Field label"
                        value={field.label}
                        disabled={!field.enabled}
                        onChange={(e) =>
                          updateFixedField(key, { label: e.target.value })
                        }
                      />
                      <Stack
                        direction="row"
                        alignItems="center"
                        sx={{ flexShrink: 0 }}
                      >
                        <Checkbox
                          checked={field.enabled}
                          onChange={(e) =>
                            updateFixedField(key, { enabled: e.target.checked })
                          }
                        />
                        <Typography variant="caption">
                          Show in reports
                        </Typography>
                      </Stack>
                    </Stack>
                  );
                })}
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

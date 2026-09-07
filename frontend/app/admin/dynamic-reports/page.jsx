"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Box,
  Container,
  Typography,
  Paper,
  Table,
  TableHead,
  TableRow,
  TableCell,
  TableBody,
  TableContainer,
  TextField,
  MenuItem,
  Chip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  IconButton,
  Button,
  Stack,
  CircularProgress,
  Tooltip,
  Divider,
  Alert,
  InputAdornment,
  Switch,
  FormControlLabel,
  Pagination,
  Autocomplete,
  Avatar,
  RadioGroup,
  Radio,
  FormControl,
  Select,
  ToggleButton,
  ToggleButtonGroup,
  useMediaQuery,
} from "@mui/material";
import { useTheme } from "@mui/material/styles";
import {
  Add,
  Search,
  Edit,
  DeleteOutline,
  Assessment,
  FilterAltOff,
  PublicOutlined,
  PersonOutline,
  ArrowUpward,
  ArrowDownward,
  ListAlt,
} from "@mui/icons-material";
import ProtectedRoute from "../../../components/ProtectedRoute";
import Navbar from "../../../components/Navbar";
import api from "../../../lib/api";

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

// Field types that need a configured option list
const NEEDS_OPTIONS = ["select", "multiselect"];
const NEEDS_MAX_RATING = ["rating"];

const FIELD_TYPE_LABELS = {
  text: "Text",
  textarea: "Textarea",
  number: "Number",
  date: "Date",
  select: "Select (single choice)",
  multiselect: "Multi-select (multiple choices)",
  checkbox: "Checkbox",
  checkbox_remark: "Checkbox + Remark",
  rating: "Rating",
};

const EMPTY_FIELD = () => ({
  _key: Math.random().toString(36).slice(2),
  label: "",
  fieldType: "text",
  required: false,
  options: [],
  maxRating: 5,
});

const EMPTY_REPORT = {
  title: "",
  description: "",
  fields: [EMPTY_FIELD()],
  frequency: "daily",
  weekDays: [],
  customDates: [],
  targetType: "all",
  targetUsers: [],
  isActive: true,
};

const ROWS_PER_PAGE = 10;

const targetSummary = (report) => {
  if (report.targetType === "all") return "All users";
  const count = report.targetUsers?.length || 0;
  if (count === 0) return "No one selected";
  if (count === 1) return report.targetUsers[0]?.name || "1 user";
  return `${count} users`;
};

const frequencySummary = (report) => {
  if (report.frequency === "daily") return "Daily";
  if (report.frequency === "weekly")
    return `Weekly (${(report.weekDays || []).map((d) => WEEKDAYS[d]).join(", ") || "no days set"})`;
  return `Custom (${(report.customDates || []).length} dates)`;
};

function AdminDynamicReportsInner() {
  const router = useRouter();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("sm"));

  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [allUsers, setAllUsers] = useState([]);

  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);

  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(EMPTY_REPORT);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");

  // Draft text for the "add option" input, keyed by field._key
  const [optionDrafts, setOptionDrafts] = useState({});

  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [toast, setToast] = useState("");

  const loadReports = (overrides = {}) => {
    setLoading(true);
    const params = { page: overrides.page || 1, limit: ROWS_PER_PAGE };
    const s = overrides.search !== undefined ? overrides.search : search;
    if (s) params.search = s;

    api
      .get("/dynamic-reports", { params })
      .then((res) => {
        setReports(res.data?.reports || []);
        setTotalPages(res.data?.pagination?.totalPages || 1);
        setTotal(res.data?.pagination?.total || 0);
        setPage(res.data?.pagination?.page || 1);
      })
      .catch(() => setReports([]))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadReports({ page: 1 });
    api.get("/users/teachers").then((res) => setAllUsers(res.data || [])).catch(() => {});
  }, []);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(""), 2500);
    return () => clearTimeout(t);
  }, [toast]);

  const handleSearchChange = (value) => {
    setSearch(value);
    loadReports({ search: value, page: 1 });
  };

  const resetFilters = () => {
    setSearch("");
    loadReports({ search: "", page: 1 });
  };

  const handlePageChange = (_e, value) => loadReports({ page: value });

  const handleOpenCreate = () => {
    setEditingId(null);
    setForm(EMPTY_REPORT);
    setOptionDrafts({});
    setFormError("");
    setFormOpen(true);
  };

  const handleOpenEdit = (r) => {
    setEditingId(r._id);
    setForm({
      title: r.title || "",
      description: r.description || "",
      fields:
        r.fields?.length > 0
          ? r.fields.map((f) => ({
              ...f,
              _key: Math.random().toString(36).slice(2),
              options: f.options || [],
              maxRating: f.maxRating || 5,
            }))
          : [EMPTY_FIELD()],
      frequency: r.frequency || "daily",
      weekDays: r.weekDays || [],
      customDates: r.customDates || [],
      targetType: r.targetType || "all",
      targetUsers: r.targetUsers || [],
      isActive: r.isActive !== undefined ? r.isActive : true,
    });
    setOptionDrafts({});
    setFormError("");
    setFormOpen(true);
  };

  const handleCloseForm = () => {
    if (saving) return;
    setFormOpen(false);
  };

  const updateField = (index, patch) => {
    setForm((p) => {
      const fields = [...p.fields];
      fields[index] = { ...fields[index], ...patch };
      return { ...p, fields };
    });
  };

  const addField = () => setForm((p) => ({ ...p, fields: [...p.fields, EMPTY_FIELD()] }));

  const removeField = (index) =>
    setForm((p) => ({ ...p, fields: p.fields.filter((_, i) => i !== index) }));

  const moveField = (index, dir) => {
    setForm((p) => {
      const fields = [...p.fields];
      const target = index + dir;
      if (target < 0 || target >= fields.length) return p;
      [fields[index], fields[target]] = [fields[target], fields[index]];
      return { ...p, fields };
    });
  };

  // ---- Option chip helpers (used for select / multiselect) ----
  const addOption = (index, fieldKey) => {
    const draft = (optionDrafts[fieldKey] || "").trim();
    if (!draft) return;
    setForm((p) => {
      const fields = [...p.fields];
      const existing = fields[index].options || [];
      if (existing.includes(draft)) return p; // no duplicates
      fields[index] = { ...fields[index], options: [...existing, draft] };
      return { ...p, fields };
    });
    setOptionDrafts((p) => ({ ...p, [fieldKey]: "" }));
  };

  const removeOption = (index, opt) => {
    setForm((p) => {
      const fields = [...p.fields];
      fields[index] = { ...fields[index], options: (fields[index].options || []).filter((o) => o !== opt) };
      return { ...p, fields };
    });
  };

  const toggleWeekDay = (day) => {
    setForm((p) => ({
      ...p,
      weekDays: p.weekDays.includes(day)
        ? p.weekDays.filter((d) => d !== day)
        : [...p.weekDays, day].sort(),
    }));
  };

  const [customDateInput, setCustomDateInput] = useState("");
  const addCustomDate = () => {
    if (!customDateInput) return;
    setForm((p) => ({
      ...p,
      customDates: p.customDates.includes(customDateInput)
        ? p.customDates
        : [...p.customDates, customDateInput].sort(),
    }));
    setCustomDateInput("");
  };
  const removeCustomDate = (d) =>
    setForm((p) => ({ ...p, customDates: p.customDates.filter((x) => x !== d) }));

  const handleSave = async () => {
    setFormError("");
    if (!form.title.trim()) {
      setFormError("Title is required.");
      return;
    }
    const validFields = form.fields.filter((f) => f.label.trim());
    if (validFields.length === 0) {
      setFormError("Add at least one field with a label.");
      return;
    }
    const badOptions = validFields.find(
      (f) => NEEDS_OPTIONS.includes(f.fieldType) && (f.options || []).length === 0,
    );
    if (badOptions) {
      setFormError(`"${badOptions.label}" needs at least one option — type a value and click Add.`);
      return;
    }
    if (form.targetType === "specific" && form.targetUsers.length === 0) {
      setFormError("Select at least one user, or choose 'All users'.");
      return;
    }
    if (form.frequency === "weekly" && form.weekDays.length === 0) {
      setFormError("Select at least one weekday for a weekly report.");
      return;
    }
    if (form.frequency === "custom" && form.customDates.length === 0) {
      setFormError("Add at least one due date for a custom report.");
      return;
    }

    setSaving(true);
    try {
      const payload = {
        title: form.title,
        description: form.description,
        fields: validFields.map(({ key, label, fieldType, required, options, maxRating }) => ({
          key,
          label,
          fieldType,
          required,
          options: NEEDS_OPTIONS.includes(fieldType) ? options : [],
          ...(fieldType === "rating" ? { maxRating: Number(maxRating) || 5 } : {}),
        })),
        frequency: form.frequency,
        weekDays: form.weekDays,
        customDates: form.customDates,
        targetType: form.targetType,
        targetUsers: form.targetUsers.map((u) => u._id),
        isActive: form.isActive,
      };

      if (editingId) {
        await api.patch(`/dynamic-reports/${editingId}`, payload);
        setToast("Report updated successfully.");
      } else {
        await api.post("/dynamic-reports", payload);
        setToast("Report created successfully — assigned users notified.");
      }
      setFormOpen(false);
      loadReports({ page: editingId ? page : 1 });
    } catch (err) {
      setFormError(err?.response?.data?.message || "Could not save report.");
    } finally {
      setSaving(false);
    }
  };

  const toggleActive = async (r) => {
    try {
      await api.patch(`/dynamic-reports/${r._id}`, { isActive: !r.isActive });
      setToast(!r.isActive ? "Report activated." : "Report deactivated.");
      loadReports({ page });
    } catch (err) {
      setToast(err?.response?.data?.message || "Could not update report.");
    }
  };

  const handleDeleteConfirmed = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await api.delete(`/dynamic-reports/${deleteTarget._id}`);
      setDeleteTarget(null);
      setToast("Report deleted successfully.");
      const isLastItemOnPage = reports.length === 1 && page > 1;
      loadReports({ page: isLastItemOnPage ? page - 1 : page });
    } catch (err) {
      setToast(err?.response?.data?.message || "Could not delete report.");
    } finally {
      setDeleting(false);
    }
  };

  return (
    <Box sx={{ bgcolor: "#faf9fb", minHeight: "100vh" }}>
      <Navbar />
      <Container maxWidth="lg" sx={{ py: { xs: 2, sm: 3 }, px: { xs: 1.5, sm: 3 } }}>
        <Stack
          direction={{ xs: "column", sm: "row" }}
          justifyContent="space-between"
          alignItems={{ xs: "stretch", sm: "center" }}
          spacing={1.5}
          sx={{ mb: 2.5 }}
        >
          <Stack direction="row" spacing={1.2} alignItems="center">
            <Box
              sx={{
                width: 40,
                height: 40,
                borderRadius: 2,
                bgcolor: "#1c28ce",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
              }}
            >
              <Assessment sx={{ color: "white", fontSize: 22 }} />
            </Box>
            <Box>
              <Typography variant="h5" fontWeight={800}>
                Dynamic Reports
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Build recurring reports — daily, weekly, or on custom dates
              </Typography>
            </Box>
          </Stack>

          <Button
            variant="contained"
            startIcon={<Add />}
            onClick={handleOpenCreate}
            sx={{
              minHeight: 40,
              borderRadius: 2,
              textTransform: "none",
              fontWeight: 700,
              boxShadow: "none",
              bgcolor: "#2a34b9",
              "&:hover": { bgcolor: "#4528d3" },
              alignSelf: { xs: "stretch", sm: "auto" },
            }}
          >
            New Report
          </Button>
        </Stack>

        <Paper elevation={0} sx={{ p: { xs: 1.2, sm: 2.5 }, border: "1px solid #e2e8f0", borderRadius: 2.5, mb: 2.5 }}>
          <Stack direction="row" spacing={1} sx={{ flexWrap: "wrap", gap: 1 }}>
            <TextField
              size="small"
              placeholder="Search reports..."
              value={search}
              onChange={(e) => handleSearchChange(e.target.value)}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <Search fontSize="small" sx={{ color: "text.disabled" }} />
                  </InputAdornment>
                ),
              }}
              sx={{ flex: { xs: "1 1 100%", sm: "1 1 240px" } }}
            />
            <Button
              size="small"
              startIcon={<FilterAltOff fontSize="small" />}
              onClick={resetFilters}
              color="inherit"
              disabled={!search}
              sx={{ textTransform: "none" }}
            >
              Reset filters
            </Button>
          </Stack>
        </Paper>

        <Paper elevation={0} sx={{ p: { xs: 1.2, sm: 2.5 }, border: "1px solid #e2e8f0", borderRadius: 2.5 }}>
          {loading ? (
            <Box sx={{ display: "flex", justifyContent: "center", py: 5 }}>
              <CircularProgress size={24} sx={{ color: "#7e22ce" }} />
            </Box>
          ) : reports.length === 0 ? (
            <Box sx={{ py: 4, textAlign: "center" }}>
              <Assessment sx={{ fontSize: 40, color: "#c4b5fd", mb: 1 }} />
              <Typography color="text.secondary">No reports found.</Typography>
            </Box>
          ) : (
            <TableContainer sx={{ overflowX: "auto" }}>
              <Table size="small" sx={{ minWidth: 640 }}>
                <TableHead>
                  <TableRow sx={{ "& th": { bgcolor: "#faf5ff", fontWeight: 700, color: "#4c1d95", whiteSpace: "nowrap" } }}>
                    <TableCell>Title</TableCell>
                    <TableCell>Frequency</TableCell>
                    <TableCell>Assigned to</TableCell>
                    <TableCell>Active</TableCell>
                    <TableCell>Entries</TableCell>
                    <TableCell align="right">Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {reports.map((r) => (
                    <TableRow key={r._id} hover>
                      <TableCell sx={{ maxWidth: 220 }}>
                        <Typography fontWeight={600} noWrap>
                          {r.title}
                        </Typography>
                        {r.description && (
                          <Typography variant="caption" color="text.secondary" noWrap sx={{ display: "block" }}>
                            {r.description}
                          </Typography>
                        )}
                      </TableCell>
                      <TableCell>
                        <Chip size="small" label={frequencySummary(r)} sx={{ fontWeight: 600 }} />
                      </TableCell>
                      <TableCell>
                        <Chip
                          size="small"
                          icon={
                            r.targetType === "all" ? (
                              <PublicOutlined sx={{ fontSize: "14px !important" }} />
                            ) : (
                              <PersonOutline sx={{ fontSize: "14px !important" }} />
                            )
                          }
                          label={targetSummary(r)}
                          sx={{
                            fontWeight: 600,
                            bgcolor: r.targetType === "all" ? "#eef2ff" : "#fef3c7",
                            color: r.targetType === "all" ? "#4338ca" : "#92400e",
                          }}
                        />
                      </TableCell>
                      <TableCell>
                        <Tooltip title={r.isActive ? "Visible to assigned users" : "Hidden / inactive"}>
                          <Switch size="small" checked={r.isActive} onChange={() => toggleActive(r)} />
                        </Tooltip>
                      </TableCell>
                      <TableCell>
                        <Chip
                          size="small"
                          icon={<ListAlt sx={{ fontSize: "14px !important" }} />}
                          label={r.entryCount || 0}
                          onClick={() => router.push(`/admin/dynamic-reports/${r._id}/entries`)}
                          sx={{ cursor: "pointer", fontWeight: 600 }}
                        />
                      </TableCell>
                      <TableCell align="right">
                        <Tooltip title="View entries">
                          <IconButton
                            size="small"
                            onClick={() => router.push(`/admin/dynamic-reports/${r._id}/entries`)}
                            sx={{ color: "#1e3a5f" }}
                          >
                            <ListAlt fontSize="small" />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="Edit">
                          <IconButton size="small" onClick={() => handleOpenEdit(r)} sx={{ color: "#0f766e" }}>
                            <Edit fontSize="small" />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="Delete">
                          <IconButton size="small" onClick={() => setDeleteTarget(r)} sx={{ color: "#dc2626" }}>
                            <DeleteOutline fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          )}

          {!loading && reports.length > 0 && (
            <Stack
              direction="row"
              justifyContent="space-between"
              alignItems="center"
              flexWrap="wrap"
              gap={1}
              sx={{ mt: 2, pt: 1.5, borderTop: "1px solid #e2e8f0" }}
            >
              <Typography variant="caption" color="text.secondary">
                Page {page} of {totalPages} ({total} total)
              </Typography>
              <Pagination
                count={totalPages}
                page={page}
                onChange={handlePageChange}
                size="small"
                shape="rounded"
                siblingCount={isMobile ? 0 : 1}
                sx={{ "& .Mui-selected": { bgcolor: "#7e22ce !important", color: "white" } }}
              />
            </Stack>
          )}

          {toast && (
            <Alert severity="info" sx={{ mt: 2 }} onClose={() => setToast("")}>
              {toast}
            </Alert>
          )}
        </Paper>
      </Container>

      {/* CREATE / EDIT DIALOG */}
      <Dialog open={formOpen} onClose={handleCloseForm} maxWidth="sm" fullWidth fullScreen={isMobile}>
        <DialogTitle sx={{ fontWeight: 800 }}>{editingId ? "Edit Report" : "New Report"}</DialogTitle>
        <DialogContent dividers>
          <Stack spacing={1.5}>
            {formError && <Alert severity="error">{formError}</Alert>}

            <TextField
              label="Title"
              fullWidth
              size="small"
              value={form.title}
              onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))}
              autoFocus
            />
            <TextField
              label="Description"
              fullWidth
              size="small"
              value={form.description}
              onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
            />

            <Divider sx={{ my: 0.5 }} />
            <Typography variant="caption" color="text.secondary" fontWeight={700}>
              FIELDS
            </Typography>

            <Stack spacing={1}>
              {form.fields.map((field, index) => (
                <Paper key={field._key} variant="outlined" sx={{ p: 1.2, borderRadius: 2, borderColor: "#e2e8f0" }}>
                  <Stack direction={{ xs: "column", sm: "row" }} spacing={1} alignItems={{ sm: "center" }}>
                    <TextField
                      label={`Field ${index + 1} label`}
                      size="small"
                      fullWidth
                      value={field.label}
                      onChange={(e) => updateField(index, { label: e.target.value })}
                    />
                    <FormControl size="small" sx={{ minWidth: { xs: "100%", sm: 210 } }}>
                      <Select
                        value={field.fieldType}
                        onChange={(e) =>
                          updateField(index, {
                            fieldType: e.target.value,
                            options: NEEDS_OPTIONS.includes(e.target.value) ? field.options : [],
                            maxRating: e.target.value === "rating" ? field.maxRating || 5 : field.maxRating,
                          })
                        }
                        MenuProps={{ PaperProps: { sx: { maxHeight: 320 } } }}
                      >
                        {Object.entries(FIELD_TYPE_LABELS).map(([value, label]) => (
                          <MenuItem key={value} value={value}>
                            {label}
                          </MenuItem>
                        ))}
                      </Select>
                    </FormControl>
                    <Stack
                      direction="row"
                      alignItems="center"
                      justifyContent="space-between"
                      sx={{ width: { xs: "100%", sm: "auto" } }}
                    >
                      <FormControlLabel
                        sx={{ mx: 0, whiteSpace: "nowrap" }}
                        control={
                          <Switch
                            size="small"
                            checked={field.required}
                            onChange={(e) => updateField(index, { required: e.target.checked })}
                          />
                        }
                        label="Required"
                      />
                      <Stack direction="row">
                        <IconButton size="small" disabled={index === 0} onClick={() => moveField(index, -1)}>
                          <ArrowUpward fontSize="small" />
                        </IconButton>
                        <IconButton
                          size="small"
                          disabled={index === form.fields.length - 1}
                          onClick={() => moveField(index, 1)}
                        >
                          <ArrowDownward fontSize="small" />
                        </IconButton>
                        <IconButton
                          size="small"
                          onClick={() => removeField(index)}
                          disabled={form.fields.length === 1}
                          sx={{ color: "#dc2626" }}
                        >
                          <DeleteOutline fontSize="small" />
                        </IconButton>
                      </Stack>
                    </Stack>
                  </Stack>

                  {NEEDS_OPTIONS.includes(field.fieldType) && (
                    <Box sx={{ mt: 1.2 }}>
                      <Stack direction="row" spacing={1}>
                        <TextField
                          fullWidth
                          size="small"
                          placeholder="Type an option and click Add"
                          value={optionDrafts[field._key] || ""}
                          onChange={(e) =>
                            setOptionDrafts((p) => ({ ...p, [field._key]: e.target.value }))
                          }
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              e.preventDefault();
                              addOption(index, field._key);
                            }
                          }}
                        />
                        <Button
                          variant="outlined"
                          size="small"
                          onClick={() => addOption(index, field._key)}
                          sx={{ textTransform: "none", flexShrink: 0 }}
                        >
                          Add
                        </Button>
                      </Stack>
                      <Stack direction="row" spacing={0.6} flexWrap="wrap" useFlexGap sx={{ mt: 1 }}>
                        {(field.options || []).length === 0 ? (
                          <Typography variant="caption" color="error.main">
                            Add at least one option.
                          </Typography>
                        ) : (
                          field.options.map((opt) => (
                            <Chip key={opt} label={opt} size="small" onDelete={() => removeOption(index, opt)} />
                          ))
                        )}
                      </Stack>
                    </Box>
                  )}

                  {NEEDS_MAX_RATING.includes(field.fieldType) && (
                    <TextField
                      size="small"
                      type="number"
                      sx={{ mt: 1.2, maxWidth: 180 }}
                      label="Max stars"
                      inputProps={{ min: 2, max: 10 }}
                      value={field.maxRating ?? 5}
                      onChange={(e) => updateField(index, { maxRating: Number(e.target.value) || 5 })}
                    />
                  )}

                  {field.fieldType === "checkbox_remark" && (
                    <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 1 }}>
                      Shown as a checkbox with an optional remark box — like a checklist item.
                    </Typography>
                  )}
                </Paper>
              ))}
              <Button size="small" startIcon={<Add />} onClick={addField} sx={{ alignSelf: "flex-start", textTransform: "none" }}>
                Add field
              </Button>
            </Stack>

            <Divider sx={{ my: 0.5 }} />
            <Typography variant="caption" color="text.secondary" fontWeight={700}>
              FREQUENCY
            </Typography>

            <ToggleButtonGroup
              value={form.frequency}
              exclusive
              size="small"
              onChange={(_e, val) => val && setForm((p) => ({ ...p, frequency: val }))}
              sx={{ flexWrap: "wrap" }}
            >
              <ToggleButton value="daily" sx={{ textTransform: "none" }}>Daily</ToggleButton>
              <ToggleButton value="weekly" sx={{ textTransform: "none" }}>Weekly</ToggleButton>
              <ToggleButton value="custom" sx={{ textTransform: "none" }}>Custom dates</ToggleButton>
            </ToggleButtonGroup>

            {form.frequency === "weekly" && (
              <Stack direction="row" spacing={0.5} flexWrap="wrap" useFlexGap>
                {WEEKDAYS.map((label, day) => (
                  <Chip
                    key={day}
                    label={label}
                    clickable
                    onClick={() => toggleWeekDay(day)}
                    color={form.weekDays.includes(day) ? "primary" : "default"}
                    sx={{ fontWeight: 600 }}
                  />
                ))}
              </Stack>
            )}

            {form.frequency === "custom" && (
              <Stack spacing={1}>
                <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
                  <TextField
                    type="date"
                    size="small"
                    value={customDateInput}
                    onChange={(e) => setCustomDateInput(e.target.value)}
                    InputLabelProps={{ shrink: true }}
                  />
                  <Button size="small" variant="outlined" onClick={addCustomDate} sx={{ textTransform: "none" }}>
                    Add date
                  </Button>
                </Stack>
                <Stack direction="row" spacing={0.5} flexWrap="wrap" useFlexGap>
                  {form.customDates.map((d) => (
                    <Chip key={d} label={d} onDelete={() => removeCustomDate(d)} />
                  ))}
                </Stack>
              </Stack>
            )}

            <Divider sx={{ my: 0.5 }} />
            <Typography variant="caption" color="text.secondary" fontWeight={700}>
              ASSIGN TO
            </Typography>

            <FormControl>
              <RadioGroup
                row
                value={form.targetType}
                onChange={(e) =>
                  setForm((p) => ({
                    ...p,
                    targetType: e.target.value,
                    targetUsers: e.target.value === "all" ? [] : p.targetUsers,
                  }))
                }
              >
                <FormControlLabel
                  value="all"
                  control={<Radio size="small" />}
                  label={
                    <Stack direction="row" spacing={0.5} alignItems="center">
                      <PublicOutlined fontSize="small" />
                      <span>All users</span>
                    </Stack>
                  }
                />
                <FormControlLabel
                  value="specific"
                  control={<Radio size="small" />}
                  label={
                    <Stack direction="row" spacing={0.5} alignItems="center">
                      <PersonOutline fontSize="small" />
                      <span>Specific users</span>
                    </Stack>
                  }
                />
              </RadioGroup>
            </FormControl>

            {form.targetType === "specific" && (
              <Autocomplete
                multiple
                size="small"
                options={allUsers}
                value={form.targetUsers}
                onChange={(_e, value) => setForm((p) => ({ ...p, targetUsers: value }))}
                getOptionLabel={(u) => u.name || u.email || ""}
                isOptionEqualToValue={(a, b) => a._id === b._id}
                renderOption={(props, u) => (
                  <li {...props} key={u._id}>
                    <Stack direction="row" spacing={1} alignItems="center">
                      <Avatar sx={{ width: 24, height: 24, fontSize: 11 }}>
                        {(u.name || "?").charAt(0).toUpperCase()}
                      </Avatar>
                      <Box>
                        <Typography variant="body2">{u.name}</Typography>
                        {u.email && (
                          <Typography variant="caption" color="text.secondary">
                            {u.email}
                          </Typography>
                        )}
                      </Box>
                    </Stack>
                  </li>
                )}
                renderTags={(value, getTagProps) =>
                  value.map((u, index) => (
                    <Chip size="small" label={u.name} {...getTagProps({ index })} key={u._id} />
                  ))
                }
                renderInput={(params) => (
                  <TextField {...params} label="Select users" placeholder="Search users..." />
                )}
              />
            )}

            <Divider sx={{ my: 0.5 }} />

            <FormControlLabel
              control={
                <Switch
                  checked={form.isActive}
                  onChange={(e) => setForm((p) => ({ ...p, isActive: e.target.checked }))}
                />
              }
              label={form.isActive ? "Active — visible to assigned users" : "Inactive — hidden"}
            />
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, py: 2 }}>
          <Button onClick={handleCloseForm} disabled={saving} sx={{ textTransform: "none" }}>
            Cancel
          </Button>
          <Button
            variant="contained"
            onClick={handleSave}
            disabled={saving}
            startIcon={saving ? <CircularProgress size={16} color="inherit" /> : null}
            sx={{ textTransform: "none", fontWeight: 700, bgcolor: "#7e22ce", "&:hover": { bgcolor: "#6b21a8" } }}
          >
            {saving ? "Saving..." : editingId ? "Save Changes" : "Create Report"}
          </Button>
        </DialogActions>
      </Dialog>

      {/* DELETE CONFIRM */}
      <Dialog open={!!deleteTarget} onClose={() => !deleting && setDeleteTarget(null)} maxWidth="xs" fullWidth PaperProps={{ sx: { borderRadius: 2.5 } }}>
        <DialogContent sx={{ pt: 3 }}>
          <Stack spacing={1} alignItems="center" textAlign="center">
            <Box
              sx={{
                width: 48,
                height: 48,
                borderRadius: "50%",
                bgcolor: "#fee2e2",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <DeleteOutline sx={{ color: "#dc2626" }} />
            </Box>
            <Typography fontWeight={800}>Delete this report?</Typography>
            <Typography variant="body2" color="text.secondary">
              "{deleteTarget?.title}" and all of its submitted entries will be permanently removed.
            </Typography>
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2.5, justifyContent: "center", gap: 1 }}>
          <Button onClick={() => setDeleteTarget(null)} disabled={deleting} sx={{ textTransform: "none" }}>
            Cancel
          </Button>
          <Button
            variant="contained"
            color="error"
            onClick={handleDeleteConfirmed}
            disabled={deleting}
            startIcon={deleting ? <CircularProgress size={16} color="inherit" /> : <DeleteOutline />}
            sx={{ textTransform: "none", fontWeight: 700 }}
          >
            {deleting ? "Deleting..." : "Delete"}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

export default function AdminDynamicReportsPage() {
  return (
    <ProtectedRoute role="superadmin">
      <AdminDynamicReportsInner />
    </ProtectedRoute>
  );
}
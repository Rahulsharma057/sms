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
} from "@mui/material";
import {
  Close,
  Add,
  Search,
  Edit,
  DeleteOutline,
  DynamicForm,
  FilterAltOff,
  PublicOutlined,
  PersonOutline,
  QrCode2,
  ContentCopy,
  OpenInNew,
  PictureAsPdf,
  ArrowUpward,
  ArrowDownward,
  ListAlt,
} from "@mui/icons-material";
import ProtectedRoute from "../../../components/ProtectedRoute";
import Navbar from "../../../components/Navbar";
import api from "../../../lib/api";

const EMPTY_FIELD = () => ({
  _key: Math.random().toString(36).slice(2), // client-only key, never sent as-is to server
  label: "",
  fieldType: "text",
  required: false,
  placeholder: "",
});

const EMPTY_FORM = {
  title: "",
  description: "",
  fields: [EMPTY_FIELD()],
  theme: {
    primaryColor: "#7e22ce",
    headerText: "",
    submitButtonLabel: "Submit",
    successMessage: "Thank you! Your response has been recorded.",
  },
  targetType: "all",
  targetUsers: [],
  isPublished: false,
};

const ROWS_PER_PAGE = 10;

const publicUrlFor = (slug) =>
  typeof window !== "undefined" ? `${window.location.origin}/forms/${slug}` : `/forms/${slug}`;

const qrUrlFor = (url) =>
  `https://api.qrserver.com/v1/create-qr-code/?size=280x280&margin=8&ecc=H&data=${encodeURIComponent(url)}`;

const LOGO_SRC = "/sleepwell-logo.png"; // drop your logo in frontend/public/ under this name

const loadImage = (src, crossOrigin) =>
  new Promise((resolve, reject) => {
    const img = new Image();
    if (crossOrigin) img.crossOrigin = crossOrigin;
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });

// Draws the QR code onto a canvas and stamps the logo in the center with a
// white rounded backdrop, so it stays scannable (ecc=H tolerates ~30% loss).
const buildQrCompositeDataUrl = async (targetUrl, size = 500) => {
  const qrImg = await loadImage(
    `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&margin=8&ecc=H&data=${encodeURIComponent(targetUrl)}`,
    "anonymous"
  );
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  ctx.drawImage(qrImg, 0, 0, size, size);

  try {
    const logoImg = await loadImage(LOGO_SRC);
    const logoSize = size * 0.30;
    const pad = logoSize * 0.18;
    const cx = size / 2;
    const cy = size / 2;
    const boxSize = logoSize + pad * 2;
    const bx = cx - boxSize / 2;
    const by = cy - boxSize / 2;
    const radius = 0;

    ctx.fillStyle = "#ffffff";
    ctx.beginPath();
    ctx.moveTo(bx + radius, by);
    ctx.arcTo(bx + boxSize, by, bx + boxSize, by + boxSize, radius);
    ctx.arcTo(bx + boxSize, by + boxSize, bx, by + boxSize, radius);
    ctx.arcTo(bx, by + boxSize, bx, by, radius);
    ctx.arcTo(bx, by, bx + boxSize, by, radius);
    ctx.closePath();
    ctx.fill();

    ctx.drawImage(logoImg, cx - logoSize / 2, cy - logoSize / 2, logoSize, logoSize);
  } catch {
    // logo missing or blocked by CORS — QR still renders fine without it
  }

  return canvas.toDataURL("image/png");
};

const buildQrPdf = async (form) => {
  const { default: jsPDF } = await import("jspdf");
  const doc = new jsPDF({ unit: "mm", format: "a4" });

  const pageWidth = 210;
  const marginX = 16;

  doc.setFillColor(30, 58, 95);
  doc.rect(0, 0, pageWidth, 22, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont(undefined, "bold");
  doc.setFontSize(13);
  doc.text("Sleepwell Foundation", marginX, 14);
  doc.setTextColor(0, 0, 0);

  let y = 42;
  doc.setFont(undefined, "bold");
  doc.setFontSize(18);
  const titleLines = doc.splitTextToSize(form.title || "", pageWidth - marginX * 2);
  doc.text(titleLines, pageWidth / 2, y, { align: "center" });
  y += titleLines.length * 8 + 4;

  if (form.description) {
    doc.setFont(undefined, "normal");
    doc.setFontSize(11);
    doc.setTextColor(71, 85, 105);
    const descLines = doc.splitTextToSize(form.description, pageWidth - marginX * 2);
    doc.text(descLines, pageWidth / 2, y, { align: "center" });
    y += descLines.length * 5.5 + 6;
    doc.setTextColor(0, 0, 0);
  }

  const targetUrl = publicUrlFor(form.slug);
  const qrDataUrl = await buildQrCompositeDataUrl(targetUrl, 500);
  const qrSizeMm = 80;
  doc.addImage(qrDataUrl, "PNG", pageWidth / 2 - qrSizeMm / 2, y, qrSizeMm, qrSizeMm);
  y += qrSizeMm + 10;

  doc.setFont(undefined, "normal");
  doc.setFontSize(10);
  doc.setTextColor(30, 58, 95);
  doc.text(targetUrl, pageWidth / 2, y, { align: "center" });

  doc.save(`form-qr-${(form.title || "form").replace(/\s+/g, "_").slice(0, 40)}.pdf`);
};

const targetSummary = (form) => {
  if (form.targetType === "all") return "All users";
  const count = form.targetUsers?.length || 0;
  if (count === 0) return "No one selected";
  if (count === 1) return form.targetUsers[0]?.name || "1 user";
  return `${count} users`;
};

function AdminFormsInner() {
  const router = useRouter();
  const [forms, setForms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [allUsers, setAllUsers] = useState([]);

  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);

  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");

  const [linkTarget, setLinkTarget] = useState(null);
  const [downloadingPdf, setDownloadingPdf] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [toast, setToast] = useState("");

  const loadForms = (overrides = {}) => {
    setLoading(true);
    const params = { page: overrides.page || 1, limit: ROWS_PER_PAGE };
    const s = overrides.search !== undefined ? overrides.search : search;
    if (s) params.search = s;

    api
      .get("/forms", { params })
      .then((res) => {
        setForms(res.data?.forms || []);
        setTotalPages(res.data?.pagination?.totalPages || 1);
        setTotal(res.data?.pagination?.total || 0);
        setPage(res.data?.pagination?.page || 1);
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadForms({ page: 1 });
    // Same picker the Notices/Tasks pages use. Swap for a broader "/users"
    // endpoint if you want to target roles beyond teachers.
    api.get("/users/teachers").then((res) => setAllUsers(res.data || []));
  }, []);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(""), 2500);
    return () => clearTimeout(t);
  }, [toast]);

  const handleSearchChange = (value) => {
    setSearch(value);
    loadForms({ search: value, page: 1 });
  };

  const resetFilters = () => {
    setSearch("");
    loadForms({ search: "", page: 1 });
  };

  const handlePageChange = (_e, value) => loadForms({ page: value });

  const handleOpenCreate = () => {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setFormError("");
    setFormOpen(true);
  };

  const handleOpenEdit = (f) => {
    setEditingId(f._id);
    setForm({
      title: f.title || "",
      description: f.description || "",
      fields:
        f.fields?.length > 0
          ? f.fields.map((fld) => ({ ...fld, _key: fld._id || Math.random().toString(36).slice(2) }))
          : [EMPTY_FIELD()],
      theme: {
        primaryColor: f.theme?.primaryColor || "#7e22ce",
        headerText: f.theme?.headerText || "",
        submitButtonLabel: f.theme?.submitButtonLabel || "Submit",
        successMessage: f.theme?.successMessage || "Thank you! Your response has been recorded.",
      },
      targetType: f.targetType || "all",
      targetUsers: f.targetUsers || [],
      isPublished: !!f.isPublished,
    });
    setFormError("");
    setFormOpen(true);
  };

  const handleCloseForm = () => {
    if (saving) return;
    setFormOpen(false);
  };

  /* ---------- field builder helpers ---------- */
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
    if (form.targetType === "specific" && form.targetUsers.length === 0) {
      setFormError("Select at least one user, or choose 'All users'.");
      return;
    }

    setSaving(true);
    try {
      const payload = {
        title: form.title,
        description: form.description,
        fields: validFields.map(({ _id, label, fieldType, required, placeholder }) => ({
          _id, // present only when editing an existing field
          label,
          fieldType,
          required,
          placeholder,
        })),
        theme: form.theme,
        targetType: form.targetType,
        targetUsers: form.targetUsers.map((u) => u._id),
        isPublished: form.isPublished,
      };

      if (editingId) {
        await api.patch(`/forms/${editingId}`, payload);
        setToast("Form updated successfully.");
      } else {
        await api.post("/forms", payload);
        setToast("Form created successfully.");
      }
      setFormOpen(false);
      loadForms({ page: editingId ? page : 1 });
    } catch (err) {
      setFormError(err?.response?.data?.message || "Could not save form.");
    } finally {
      setSaving(false);
    }
  };

  const togglePublish = async (f) => {
    try {
      await api.patch(`/forms/${f._id}`, { isPublished: !f.isPublished });
      setToast(!f.isPublished ? "Form published — link is live." : "Form unpublished.");
      loadForms({ page });
    } catch (err) {
      setToast(err?.response?.data?.message || "Could not update form.");
    }
  };

  const handleDeleteConfirmed = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await api.delete(`/forms/${deleteTarget._id}`);
      setDeleteTarget(null);
      setToast("Form deleted successfully.");
      const isLastItemOnPage = forms.length === 1 && page > 1;
      loadForms({ page: isLastItemOnPage ? page - 1 : page });
    } catch (err) {
      setToast(err?.response?.data?.message || "Could not delete form.");
    } finally {
      setDeleting(false);
    }
  };

  const copyLink = async (slug) => {
    try {
      await navigator.clipboard.writeText(publicUrlFor(slug));
      setToast("Link copied to clipboard.");
    } catch {
      setToast("Could not copy link.");
    }
  };

  const handleDownloadPdf = async (f) => {
    setDownloadingPdf(true);
    try {
      await buildQrPdf(f);
    } catch {
      setToast("Could not generate the PDF.");
    } finally {
      setDownloadingPdf(false);
    }
  };

  return (
    <Box sx={{ bgcolor: "#faf9fb", minHeight: "100vh" }}>
      <Navbar />
      <Container maxWidth="lg" sx={{ py: 3 }}>
        {/* HEADER */}
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
                bgcolor: "#7e22ce",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <DynamicForm sx={{ color: "white", fontSize: 22 }} />
            </Box>
            <Box>
              <Typography variant="h5" fontWeight={800}>
                Forms
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Build custom forms and share a public link or QR code
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
              bgcolor: "#7e22ce",
              "&:hover": { bgcolor: "#6b21a8" },
              alignSelf: { xs: "stretch", sm: "auto" },
            }}
          >
            New Form
          </Button>
        </Stack>

        {/* FILTERS */}
        <Paper elevation={0} sx={{ p: { xs: 1.5, sm: 2.5 }, border: "1px solid #e2e8f0", borderRadius: 2.5, mb: 2.5 }}>
          <Stack direction="row" spacing={1} sx={{ flexWrap: "wrap", gap: 1 }}>
            <TextField
              size="small"
              placeholder="Search forms..."
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

        {/* TABLE */}
        <Paper elevation={0} sx={{ p: { xs: 1.5, sm: 2.5 }, border: "1px solid #e2e8f0", borderRadius: 2.5 }}>
          {loading ? (
            <Box sx={{ display: "flex", justifyContent: "center", py: 5 }}>
              <CircularProgress size={24} sx={{ color: "#7e22ce" }} />
            </Box>
          ) : forms.length === 0 ? (
            <Box sx={{ py: 4, textAlign: "center" }}>
              <Typography color="text.secondary">No forms found.</Typography>
            </Box>
          ) : (
            <TableContainer sx={{ overflowX: "auto" }}>
              <Table size="small">
                <TableHead>
                  <TableRow sx={{ "& th": { bgcolor: "#faf5ff", fontWeight: 700, color: "#4c1d95" } }}>
                    <TableCell>Title</TableCell>
                    <TableCell>Fields</TableCell>
                    <TableCell>Assigned to</TableCell>
                    <TableCell>Status</TableCell>
                    <TableCell>Responses</TableCell>
                    <TableCell align="right">Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {forms.map((f) => (
                    <TableRow key={f._id} hover>
                      <TableCell sx={{ maxWidth: 220 }}>
                        <Typography fontWeight={600} noWrap>
                          {f.title}
                        </Typography>
                        {f.description && (
                          <Typography variant="caption" color="text.secondary" noWrap sx={{ display: "block" }}>
                            {f.description}
                          </Typography>
                        )}
                      </TableCell>
                      <TableCell>{f.fields?.length || 0}</TableCell>
                      <TableCell>
                        <Chip
                          size="small"
                          icon={
                            f.targetType === "all" ? (
                              <PublicOutlined sx={{ fontSize: "14px !important" }} />
                            ) : (
                              <PersonOutline sx={{ fontSize: "14px !important" }} />
                            )
                          }
                          label={targetSummary(f)}
                          sx={{
                            fontWeight: 600,
                            bgcolor: f.targetType === "all" ? "#eef2ff" : "#fef3c7",
                            color: f.targetType === "all" ? "#4338ca" : "#92400e",
                          }}
                        />
                      </TableCell>
                      <TableCell>
                        <Tooltip title={f.isPublished ? "Link is live" : "Draft — link inactive"}>
                          <Switch size="small" checked={f.isPublished} onChange={() => togglePublish(f)} />
                        </Tooltip>
                      </TableCell>
                      <TableCell>
                        <Chip
                          size="small"
                          icon={<ListAlt sx={{ fontSize: "14px !important" }} />}
                          label={f.responseCount || 0}
                          onClick={() => router.push(`/admin/forms/${f._id}/responses`)}
                          sx={{ cursor: "pointer", fontWeight: 600 }}
                        />
                      </TableCell>
                      <TableCell align="right">
                        <Tooltip title="View responses">
                          <IconButton
                            size="small"
                            onClick={() => router.push(`/admin/forms/${f._id}/responses`)}
                            sx={{ color: "#1e3a5f" }}
                          >
                            <ListAlt fontSize="small" />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="Edit">
                          <IconButton size="small" onClick={() => handleOpenEdit(f)} sx={{ color: "#0f766e" }}>
                            <Edit fontSize="small" />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title={f.isPublished ? "Link & QR code" : "Publish the form to get a live link"}>
                          <span>
                            <IconButton
                              size="small"
                              disabled={!f.isPublished}
                              onClick={() => setLinkTarget(f)}
                              sx={{ color: "#6b21a8" }}
                            >
                              <QrCode2 fontSize="small" />
                            </IconButton>
                          </span>
                        </Tooltip>
                        <Tooltip title="Delete">
                          <IconButton size="small" onClick={() => setDeleteTarget(f)} sx={{ color: "#dc2626" }}>
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

          {!loading && forms.length > 0 && (
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
      <Dialog open={formOpen} onClose={handleCloseForm} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ fontWeight: 800 }}>{editingId ? "Edit Form" : "New Form"}</DialogTitle>
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
              placeholder="Shown at the top of the public form"
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
                <Paper
                  key={field._key || field._id}
                  variant="outlined"
                  sx={{ p: 1.2, borderRadius: 2, borderColor: "#e2e8f0" }}
                >
                  <Stack direction={{ xs: "column", sm: "row" }} spacing={1} alignItems={{ sm: "center" }}>
                    <TextField
                      label={`Field ${index + 1} label`}
                      size="small"
                      fullWidth
                      value={field.label}
                      onChange={(e) => updateField(index, { label: e.target.value })}
                    />
                    <FormControl size="small" sx={{ minWidth: 110 }}>
                      <Select
                        value={field.fieldType}
                        onChange={(e) => updateField(index, { fieldType: e.target.value })}
                      >
                        <MenuItem value="text">Text</MenuItem>
                        <MenuItem value="number">Number</MenuItem>
                      </Select>
                    </FormControl>
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
                </Paper>
              ))}
              <Button size="small" startIcon={<Add />} onClick={addField} sx={{ alignSelf: "flex-start", textTransform: "none" }}>
                Add field
              </Button>
            </Stack>

            <Divider sx={{ my: 0.5 }} />
            <Typography variant="caption" color="text.secondary" fontWeight={700}>
              LOOK & LAYOUT
            </Typography>

            <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5}>
              <TextField
                label="Accent color (hex)"
                size="small"
                fullWidth
                value={form.theme.primaryColor}
                onChange={(e) => setForm((p) => ({ ...p, theme: { ...p.theme, primaryColor: e.target.value } }))}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <Box
                        sx={{
                          width: 16,
                          height: 16,
                          borderRadius: "50%",
                          bgcolor: form.theme.primaryColor,
                          border: "1px solid #e2e8f0",
                        }}
                      />
                    </InputAdornment>
                  ),
                }}
              />
              <TextField
                label="Submit button label"
                size="small"
                fullWidth
                value={form.theme.submitButtonLabel}
                onChange={(e) =>
                  setForm((p) => ({ ...p, theme: { ...p.theme, submitButtonLabel: e.target.value } }))
                }
              />
            </Stack>
            <TextField
              label="Header text (optional banner)"
              size="small"
              fullWidth
              value={form.theme.headerText}
              onChange={(e) => setForm((p) => ({ ...p, theme: { ...p.theme, headerText: e.target.value } }))}
            />
            <TextField
              label="Success message"
              size="small"
              fullWidth
              multiline
              minRows={2}
              value={form.theme.successMessage}
              onChange={(e) => setForm((p) => ({ ...p, theme: { ...p.theme, successMessage: e.target.value } }))}
            />

            <Divider sx={{ my: 0.5 }} />
            <Typography variant="caption" color="text.secondary" fontWeight={700}>
              ASSIGN TO (visible inside the portal)
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
                  checked={form.isPublished}
                  onChange={(e) => setForm((p) => ({ ...p, isPublished: e.target.checked }))}
                />
              }
              label={form.isPublished ? "Published — public link is live" : "Draft — link inactive"}
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
            {saving ? "Saving..." : editingId ? "Save Changes" : "Create Form"}
          </Button>
        </DialogActions>
      </Dialog>

      {/* LINK & QR DIALOG */}
      <Dialog open={!!linkTarget} onClose={() => setLinkTarget(null)} maxWidth="xs" fullWidth>
        {linkTarget && (
          <>
            <DialogTitle sx={{ fontWeight: 800, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              Share "{linkTarget.title}"
              <IconButton size="small" onClick={() => setLinkTarget(null)}>
                <Close fontSize="small" />
              </IconButton>
            </DialogTitle>
            <DialogContent>
              <Stack spacing={2} alignItems="center" sx={{ py: 1 }}>
                <Box sx={{ position: "relative", width: 180, height: 180 }}>
                  <Box
                    component="img"
                    src={qrUrlFor(publicUrlFor(linkTarget.slug))}
                    alt="QR code"
                    sx={{ width: 180, height: 180, display: "block" }}
                  />
                  <Box
                    sx={{
                      position: "absolute",
                      top: "50%",
                      left: "50%",
                      transform: "translate(-50%, -50%)",
                      bgcolor: "white",
                      borderRadius: 0,
                      p: 0,
                      display: "flex",
                      boxShadow: "0 0 0 2px white",
                    }}
                  >
                    <Box component="img" src="/sleepwell-logo.png" alt="Sleepwell Foundation" sx={{ width: 80, height: 22, objectFit: "contain" }} />
                  </Box>
                </Box>
                <TextField
                  size="small"
                  fullWidth
                  value={publicUrlFor(linkTarget.slug)}
                  InputProps={{ readOnly: true }}
                />
                <Stack direction="row" spacing={1} sx={{ width: "100%" }}>
                  <Button
                    fullWidth
                    variant="outlined"
                    startIcon={<ContentCopy fontSize="small" />}
                    onClick={() => copyLink(linkTarget.slug)}
                    sx={{ textTransform: "none" }}
                  >
                    Copy link
                  </Button>
                  <Button
                    fullWidth
                    variant="contained"
                    startIcon={<OpenInNew fontSize="small" />}
                    href={publicUrlFor(linkTarget.slug)}
                    target="_blank"
                    rel="noopener noreferrer"
                    sx={{ textTransform: "none", bgcolor: "#7e22ce", "&:hover": { bgcolor: "#6b21a8" } }}
                  >
                    Open
                  </Button>
                </Stack>
                <Button
                  fullWidth
                  variant="outlined"
                  startIcon={downloadingPdf ? <CircularProgress size={16} /> : <PictureAsPdf fontSize="small" />}
                  onClick={() => handleDownloadPdf(linkTarget)}
                  disabled={downloadingPdf}
                  sx={{ textTransform: "none", borderColor: "#1e3a5f", color: "#1e3a5f" }}
                >
                  {downloadingPdf ? "Preparing PDF..." : "Download PDF"}
                </Button>
              </Stack>
            </DialogContent>
          </>
        )}
      </Dialog>

      {/* DELETE CONFIRM DIALOG */}
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
            <Typography fontWeight={800}>Delete this form?</Typography>
            <Typography variant="body2" color="text.secondary">
              "{deleteTarget?.title}" and all of its responses will be permanently removed. The public link will stop working.
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

export default function AdminFormsPage() {
  return (
    <ProtectedRoute role="superadmin">
      <AdminFormsInner />
    </ProtectedRoute>
  );
}
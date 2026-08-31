"use client";

import { useEffect, useRef, useState } from "react";
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
  ToggleButtonGroup,
  ToggleButton,
} from "@mui/material";
import {
  Close,
  Add,
  Search,
  Edit,
  Visibility,
  PictureAsPdf,
  Share,
  DeleteOutline,
  CampaignOutlined,
  FilterAltOff,
  PublicOutlined,
  PersonOutline,
  FormatBold,
  FormatItalic,
  WarningAmberOutlined,
  NotificationsActiveOutlined,
  UpdateOutlined,
} from "@mui/icons-material";
import ProtectedRoute from "../../../components/ProtectedRoute";
import Navbar from "../../../components/Navbar";
import api from "../../../lib/api";

/* =====================================================
   NOTICE TYPES — shared config for color/icon/label
===================================================== */

const NOTICE_TYPES = {
  warning: { label: "Warning", color: "#dc2626", bg: "#fee2e2", icon: WarningAmberOutlined },
  notice: { label: "Notice", color: "#4222ce", bg: "#f3e8ff", icon: CampaignOutlined },
  announcement: { label: "Announcement", color: "#0369a1", bg: "#e0f2fe", icon: NotificationsActiveOutlined },
  update: { label: "Update", color: "#0f766e", bg: "#d1fae5", icon: UpdateOutlined },
};

const getTypeConfig = (type) => NOTICE_TYPES[type] || NOTICE_TYPES.notice;

function TypeChip({ type, size = "small" }) {
  const cfg = getTypeConfig(type);
  const Icon = cfg.icon;
  return (
    <Chip
      size={size}
      icon={<Icon sx={{ fontSize: "14px !important" }} />}
      label={cfg.label}
      sx={{ fontWeight: 700, bgcolor: cfg.bg, color: cfg.color }}
    />
  );
}

/* =====================================================
   LIGHTWEIGHT TEXT FORMATTING — **bold** and *italic*
   Shared render helper: turns the markdown-lite syntax into
   React elements for display (used in preview + table).
===================================================== */

function formatNoticeText(text) {
  if (!text) return null;
  // Split on **bold** first, then *italic* within the remaining segments.
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((part, i) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      return <b key={i}>{part.slice(2, -2)}</b>;
    }
    const italicParts = part.split(/(\*[^*]+\*)/g);
    return italicParts.map((sub, j) => {
      if (sub.startsWith("*") && sub.endsWith("*") && sub.length > 1) {
        return <i key={`${i}-${j}`}>{sub.slice(1, -1)}</i>;
      }
      return <span key={`${i}-${j}`}>{sub}</span>;
    });
  });
}

const EMPTY_FORM = {
  title: "",
  subtitle: "",
  caption: "",
  information: "",
  type: "notice",
  buttonLabel: "",
  buttonUrl: "",
  isActive: true,
  targetType: "all",
  targetUsers: [], // array of user objects {_id, name, email} while editing
};

const ROWS_PER_PAGE = 10;

/* =====================================================
   PDF GENERATION
   Note: bold/italic markdown markers are stripped for the PDF (plain
   text export) — full styled runs in a wrapped PDF paragraph would need
   a per-segment layout engine, which is out of scope here.
===================================================== */

const PAGE_WIDTH = 210;
const MARGIN_X = 16;
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN_X * 2;

const stripMarkdown = (text = "") => text.replace(/\*\*([^*]+)\*\*/g, "$1").replace(/\*([^*]+)\*/g, "$1");

const buildNoticePdf = async (notice) => {
  const { default: jsPDF } = await import("jspdf");
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const cfg = getTypeConfig(notice.type);

  doc.setFillColor(30, 58, 95);
  doc.rect(0, 0, PAGE_WIDTH, 24, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont(undefined, "bold");
  doc.setFontSize(15);
  doc.text(cfg.label, MARGIN_X, 15);
  doc.setFont(undefined, "normal");
  doc.setFontSize(9);
  const dateStr = notice.createdAt ? new Date(notice.createdAt).toLocaleDateString("en-IN") : "";
  doc.text(dateStr, PAGE_WIDTH - MARGIN_X, 15, { align: "right" });
  doc.setTextColor(0, 0, 0);

  let y = 34;

  doc.setFont(undefined, "bold");
  doc.setFontSize(15);
  doc.setTextColor(15, 23, 42);
  const titleLines = doc.splitTextToSize(notice.title || "", CONTENT_WIDTH);
  doc.text(titleLines, MARGIN_X, y);
  y += titleLines.length * 6.5 + 2;

  if (notice.subtitle) {
    doc.setFont(undefined, "normal");
    doc.setFontSize(11);
    doc.setTextColor(71, 85, 105);
    const subLines = doc.splitTextToSize(notice.subtitle, CONTENT_WIDTH);
    doc.text(subLines, MARGIN_X, y);
    y += subLines.length * 5.5 + 4;
  }

  if (notice.caption) {
    doc.setFont(undefined, "italic");
    doc.setFontSize(9.5);
    doc.setTextColor(124, 58, 237);
    const capLines = doc.splitTextToSize(notice.caption, CONTENT_WIDTH);
    doc.text(capLines, MARGIN_X, y);
    y += capLines.length * 4.8 + 6;
  }

  doc.setDrawColor(226, 232, 240);
  doc.line(MARGIN_X, y, PAGE_WIDTH - MARGIN_X, y);
  y += 8;

  doc.setFont(undefined, "normal");
  doc.setFontSize(10.5);
  doc.setTextColor(15, 23, 42);
  const infoLines = doc.splitTextToSize(stripMarkdown(notice.information?.trim()) || "No further details.", CONTENT_WIDTH);
  doc.text(infoLines, MARGIN_X, y);
  y += infoLines.length * 5.2 + 8;

  if (notice.buttonLabel && notice.buttonUrl) {
    doc.setFont(undefined, "bold");
    doc.setFontSize(9.5);
    doc.setTextColor(30, 58, 95);
    doc.text(`${notice.buttonLabel}: ${notice.buttonUrl}`, MARGIN_X, y);
  }

  return doc;
};

const downloadNoticePdf = async (notice) => {
  const doc = await buildNoticePdf(notice);
  doc.save(`notice-${(notice.title || "notice").replace(/\s+/g, "_").slice(0, 40)}.pdf`);
};

const buildShareText = (notice) =>
  `${getTypeConfig(notice.type).label}: ${notice.title}
${notice.subtitle || ""}
${stripMarkdown(notice.information || "")}`.trim();

const shareNotice = async (notice, onFallback) => {
  const text = buildShareText(notice);
  if (navigator.share) {
    try {
      await navigator.share({ title: notice.title, text });
      return;
    } catch {
      // fallback below
    }
  }
  try {
    await navigator.clipboard.writeText(text);
    onFallback?.("Notice details copied to clipboard.");
  } catch {
    onFallback?.("Could not share or copy the notice.");
  }
};

const targetSummary = (notice) => {
  if (notice.targetType === "all") return "All users";
  const count = notice.targetUsers?.length || 0;
  if (count === 0) return "No one selected";
  if (count === 1) return notice.targetUsers[0]?.name || "1 user";
  return `${count} users`;
};

/* =====================================================
   COMPONENT
===================================================== */

function AdminNoticesInner() {
  const [notices, setNotices] = useState([]);
  const [loading, setLoading] = useState(true);

  const [allUsers, setAllUsers] = useState([]);

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState(""); // "", "true", "false"
  const [typeFilter, setTypeFilter] = useState(""); // "", "warning", "notice", "announcement", "update"

  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);

  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");

  const infoFieldRef = useRef(null);

  const [previewNotice, setPreviewNotice] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [toast, setToast] = useState("");

  const loadNotices = (overrides = {}) => {
    setLoading(true);
    const params = {
      page: overrides.page || 1,
      limit: ROWS_PER_PAGE,
    };
    const s = overrides.search !== undefined ? overrides.search : search;
    const st = overrides.status !== undefined ? overrides.status : statusFilter;
    const ty = overrides.type !== undefined ? overrides.type : typeFilter;
    if (s) params.search = s;
    if (ty) params.type = ty;

    api
      .get("/notices", { params })
      .then((res) => {
        let list = res.data?.notices || [];
        // Active/inactive filter is applied client-side since the manage
        // endpoint intentionally returns both, for the superadmin to see all.
        if (st === "true") list = list.filter((n) => n.isActive);
        if (st === "false") list = list.filter((n) => !n.isActive);
        setNotices(list);
        setTotalPages(res.data?.pagination?.totalPages || 1);
        setTotal(res.data?.pagination?.total || 0);
        setPage(res.data?.pagination?.page || 1);
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadNotices({ page: 1 });
    // Reuses the same endpoint the Tasks page uses for its teacher picker.
    // If your app has a broader "/users" endpoint covering all roles, swap
    // it in here so notices can target any user, not just teachers.
    api.get("/users/teachers").then((res) => setAllUsers(res.data || []));
  }, []);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(""), 2500);
    return () => clearTimeout(t);
  }, [toast]);

  const handleSearchChange = (value) => {
    setSearch(value);
    loadNotices({ search: value, page: 1 });
  };

  const handleStatusChange = (value) => {
    setStatusFilter(value);
    loadNotices({ status: value, page: 1 });
  };

  const handleTypeFilterChange = (value) => {
    setTypeFilter(value);
    loadNotices({ type: value, page: 1 });
  };

  const resetFilters = () => {
    setSearch("");
    setStatusFilter("");
    setTypeFilter("");
    loadNotices({ search: "", status: "", type: "", page: 1 });
  };

  const handlePageChange = (_e, value) => {
    loadNotices({ page: value });
  };

  const handleOpenCreate = () => {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setFormError("");
    setFormOpen(true);
  };

  const handleOpenEdit = (notice) => {
    setEditingId(notice._id);
    setForm({
      title: notice.title || "",
      subtitle: notice.subtitle || "",
      caption: notice.caption || "",
      information: notice.information || "",
      type: notice.type || "notice",
      buttonLabel: notice.buttonLabel || "",
      buttonUrl: notice.buttonUrl || "",
      isActive: !!notice.isActive,
      targetType: notice.targetType || "all",
      targetUsers: notice.targetUsers || [],
    });
    setFormError("");
    setFormOpen(true);
  };

  const handleCloseForm = () => {
    if (saving) return;
    setFormOpen(false);
  };

  // Wraps the current text-selection in the Information field with the
  // given marker (** for bold, * for italic) — a minimal WYSIWYG-ish
  // formatting toolbar without pulling in a full rich-text editor.
  const applyFormatting = (marker) => {
    const el = infoFieldRef.current;
    if (!el) return;

    const start = el.selectionStart;
    const end = el.selectionEnd;
    const value = form.information;

    const selected = value.slice(start, end) || "text";
    const before = value.slice(0, start);
    const after = value.slice(end);
    const wrapped = `${marker}${selected}${marker}`;
    const next = `${before}${wrapped}${after}`;

    setForm((p) => ({ ...p, information: next }));

    // Restore focus + selection around the wrapped text after re-render.
    requestAnimationFrame(() => {
      el.focus();
      const cursorStart = start + marker.length;
      const cursorEnd = cursorStart + selected.length;
      el.setSelectionRange(cursorStart, cursorEnd);
    });
  };

  const handleSave = async () => {
    setFormError("");
    if (!form.title.trim()) {
      setFormError("Title is required.");
      return;
    }
    if (form.buttonUrl && !form.buttonLabel) {
      setFormError("Add a button label along with the button link.");
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
        subtitle: form.subtitle,
        caption: form.caption,
        information: form.information,
        type: form.type,
        buttonLabel: form.buttonLabel,
        buttonUrl: form.buttonUrl,
        isActive: form.isActive,
        targetType: form.targetType,
        targetUsers: form.targetUsers.map((u) => u._id),
      };

      if (editingId) {
        await api.patch(`/notices/${editingId}`, payload);
        setToast("Notice updated successfully.");
      } else {
        await api.post("/notices", payload);
        setToast("Notice created successfully.");
      }
      setFormOpen(false);
      loadNotices({ page: editingId ? page : 1 });
    } catch (err) {
      setFormError(err?.response?.data?.message || "Could not save notice.");
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteConfirmed = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await api.delete(`/notices/${deleteTarget._id}`);
      setDeleteTarget(null);
      setToast("Notice deleted successfully.");
      const isLastItemOnPage = notices.length === 1 && page > 1;
      loadNotices({ page: isLastItemOnPage ? page - 1 : page });
    } catch (err) {
      setToast(err?.response?.data?.message || "Could not delete notice.");
    } finally {
      setDeleting(false);
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
                bgcolor: "#172393",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <CampaignOutlined sx={{ color: "white", fontSize: 22 }} />
            </Box>
            <Box>
              <Typography variant="h5" fontWeight={800}>
                Notices
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Create and assign warnings, notices, announcements & updates
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
              bgcolor: "#1d1090",
              "&:hover": { bgcolor: "#2f1c98" },
              alignSelf: { xs: "stretch", sm: "auto" },
            }}
          >
            New Notice
          </Button>
        </Stack>

        {/* FILTERS */}
        <Paper elevation={0} sx={{ p: { xs: 1.5, sm: 2.5 }, border: "1px solid #e2e8f0", borderRadius: 2.5, mb: 2.5 }}>
          <Stack direction="row" spacing={1} sx={{ flexWrap: "wrap", gap: 1 }}>
            <TextField
              size="small"
              placeholder="Search notices..."
              value={search}
              onChange={(e) => handleSearchChange(e.target.value)}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <Search fontSize="small" sx={{ color: "text.disabled" }} />
                  </InputAdornment>
                ),
              }}
              sx={{ flex: { xs: "1 1 100%", sm: "1 1 220px" } }}
            />

            <TextField
              select
              size="small"
              label="Type"
              value={typeFilter}
              onChange={(e) => handleTypeFilterChange(e.target.value)}
              sx={{ flex: { xs: "1 1 48%", sm: "0 1 160px" } }}
            >
              <MenuItem value="">All types</MenuItem>
              {Object.entries(NOTICE_TYPES).map(([key, cfg]) => (
                <MenuItem key={key} value={key}>
                  {cfg.label}
                </MenuItem>
              ))}
            </TextField>

            <TextField
              select
              size="small"
              label="Status"
              value={statusFilter}
              onChange={(e) => handleStatusChange(e.target.value)}
              sx={{ flex: { xs: "1 1 48%", sm: "0 1 150px" } }}
            >
              <MenuItem value="">All</MenuItem>
              <MenuItem value="true">Active</MenuItem>
              <MenuItem value="false">Inactive</MenuItem>
            </TextField>

            <Button
              size="small"
              startIcon={<FilterAltOff fontSize="small" />}
              onClick={resetFilters}
              color="inherit"
              disabled={!search && !statusFilter && !typeFilter}
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
          ) : notices.length === 0 ? (
            <Box sx={{ py: 4, textAlign: "center" }}>
              <Typography color="text.secondary">No notices found.</Typography>
            </Box>
          ) : (
            <TableContainer sx={{ overflowX: "auto" }}>
              <Table size="small">
                <TableHead>
                  <TableRow sx={{ "& th": { bgcolor: "#faf5ff", fontWeight: 700, color: "#4c1d95" } }}>
                    <TableCell>Title</TableCell>
                    <TableCell>Type</TableCell>
                    <TableCell>Assigned to</TableCell>
                    <TableCell>Status</TableCell>
                    <TableCell>Created</TableCell>
                    <TableCell align="right">Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {notices.map((n) => (
                    <TableRow key={n._id} hover>
                      <TableCell sx={{ maxWidth: 220 }}>
                        <Typography fontWeight={600} noWrap>
                          {n.title}
                        </Typography>
                        {n.subtitle && (
                          <Typography variant="caption" color="text.secondary" noWrap sx={{ display: "block" }}>
                            {n.subtitle}
                          </Typography>
                        )}
                      </TableCell>
                      <TableCell>
                        <TypeChip type={n.type} />
                      </TableCell>
                      <TableCell>
                        <Chip
                          size="small"
                          icon={n.targetType === "all" ? <PublicOutlined sx={{ fontSize: "14px !important" }} /> : <PersonOutline sx={{ fontSize: "14px !important" }} />}
                          label={targetSummary(n)}
                          sx={{
                            fontWeight: 600,
                            bgcolor: n.targetType === "all" ? "#eef2ff" : "#fef3c7",
                            color: n.targetType === "all" ? "#4338ca" : "#92400e",
                          }}
                        />
                      </TableCell>
                      <TableCell>
                        {n.isActive ? (
                          <Chip size="small" color="success" label="Active" />
                        ) : (
                          <Chip size="small" label="Inactive" />
                        )}
                      </TableCell>
                      <TableCell sx={{ whiteSpace: "nowrap" }}>
                        {n.createdAt ? new Date(n.createdAt).toLocaleDateString("en-IN") : "-"}
                      </TableCell>
                      <TableCell align="right">
                        <Tooltip title="Preview">
                          <IconButton size="small" onClick={() => setPreviewNotice(n)} sx={{ color: "#7e22ce" }}>
                            <Visibility fontSize="small" />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="Edit">
                          <IconButton size="small" onClick={() => handleOpenEdit(n)} sx={{ color: "#0f766e" }}>
                            <Edit fontSize="small" />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="Download PDF">
                          <IconButton size="small" onClick={() => downloadNoticePdf(n)} sx={{ color: "#6b21a8" }}>
                            <PictureAsPdf fontSize="small" />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="Share">
                          <IconButton size="small" onClick={() => shareNotice(n, setToast)} sx={{ color: "#1e3a5f" }}>
                            <Share fontSize="small" />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="Delete">
                          <IconButton size="small" onClick={() => setDeleteTarget(n)} sx={{ color: "#dc2626" }}>
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

          {/* PAGINATION */}
          {!loading && notices.length > 0 && (
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
        <DialogTitle sx={{ fontWeight: 800 }}>
          {editingId ? "Edit Notice" : "New Notice"}
        </DialogTitle>
        <DialogContent dividers>
          <Stack spacing={1.5}>
            {formError && <Alert severity="error">{formError}</Alert>}

            {/* TYPE SELECTOR */}
            <Typography variant="caption" color="text.secondary" fontWeight={700}>
              TYPE
            </Typography>
            <ToggleButtonGroup
              value={form.type}
              exclusive
              size="small"
              onChange={(_e, val) => val && setForm((p) => ({ ...p, type: val }))}
              sx={{ flexWrap: "wrap", gap: 0.75 }}
            >
              {Object.entries(NOTICE_TYPES).map(([key, cfg]) => {
                const Icon = cfg.icon;
                return (
                  <ToggleButton
                    key={key}
                    value={key}
                    sx={{
                      textTransform: "none",
                      borderRadius: "8px !important",
                      border: "1px solid #e2e8f0 !important",
                      px: 1.5,
                      gap: 0.6,
                      "&.Mui-selected": {
                        bgcolor: `${cfg.bg} !important`,
                        color: `${cfg.color} !important`,
                        fontWeight: 700,
                      },
                    }}
                  >
                    <Icon fontSize="small" />
                    {cfg.label}
                  </ToggleButton>
                );
              })}
            </ToggleButtonGroup>

            <TextField
              label="Title"
              fullWidth
              size="small"
              value={form.title}
              onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))}
              autoFocus
            />
            <TextField
              label="Subtitle"
              fullWidth
              size="small"
              value={form.subtitle}
              onChange={(e) => setForm((p) => ({ ...p, subtitle: e.target.value }))}
            />
            <TextField
              label="Caption"
              placeholder="Small note shown under the subtitle"
              fullWidth
              size="small"
              value={form.caption}
              onChange={(e) => setForm((p) => ({ ...p, caption: e.target.value }))}
            />

            {/* INFORMATION + FORMATTING TOOLBAR */}
            <Box>
              <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 0.5 }}>
                <Typography variant="caption" color="text.secondary">
                  Information
                </Typography>
                <Stack direction="row" spacing={0.5}>
                  <Tooltip title="Bold selected text">
                    <IconButton size="small" onClick={() => applyFormatting("**")}>
                      <FormatBold fontSize="small" />
                    </IconButton>
                  </Tooltip>
                  <Tooltip title="Italicize selected text">
                    <IconButton size="small" onClick={() => applyFormatting("*")}>
                      <FormatItalic fontSize="small" />
                    </IconButton>
                  </Tooltip>
                </Stack>
              </Stack>
              <TextField
                placeholder="Full details of the notice... select text and use Bold/Italic above to format it"
                fullWidth
                multiline
                minRows={4}
                size="small"
                value={form.information}
                onChange={(e) => setForm((p) => ({ ...p, information: e.target.value }))}
                inputRef={infoFieldRef}
              />
              {form.information && (
                <Box sx={{ mt: 1, p: 1.25, bgcolor: "#f8fafc", border: "1px dashed #e2e8f0", borderRadius: 1.5 }}>
                  <Typography variant="caption" color="text.disabled" sx={{ display: "block", mb: 0.5 }}>
                    Preview
                  </Typography>
                  <Typography variant="body2" sx={{ whiteSpace: "pre-wrap" }}>
                    {formatNoticeText(form.information)}
                  </Typography>
                </Box>
              )}
            </Box>

            <Divider sx={{ my: 0.5 }} />
            <Typography variant="caption" color="text.secondary" fontWeight={700}>
              OPTIONAL BUTTON
            </Typography>

            <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5}>
              <TextField
                label="Button label"
                placeholder="e.g. Learn more"
                fullWidth
                size="small"
                value={form.buttonLabel}
                onChange={(e) => setForm((p) => ({ ...p, buttonLabel: e.target.value }))}
              />
              <TextField
                label="Button link (URL)"
                placeholder="https://..."
                fullWidth
                size="small"
                value={form.buttonUrl}
                onChange={(e) => setForm((p) => ({ ...p, buttonUrl: e.target.value }))}
              />
            </Stack>

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
              label={form.isActive ? "Active — visible to assigned users" : "Inactive — hidden from users"}
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
            sx={{
              textTransform: "none",
              fontWeight: 700,
              bgcolor: "#7e22ce",
              "&:hover": { bgcolor: "#6b21a8" },
            }}
          >
            {saving ? "Saving..." : editingId ? "Save Changes" : "Create Notice"}
          </Button>
        </DialogActions>
      </Dialog>

      {/* PREVIEW DIALOG */}
      <Dialog open={!!previewNotice} onClose={() => setPreviewNotice(null)} maxWidth="sm" fullWidth>
        {previewNotice && (
          <>
            <Box
              sx={{
                px: 3,
                py: 2.5,
                bgcolor: getTypeConfig(previewNotice.type).color,
                color: "white",
                position: "relative",
              }}
            >
              <IconButton
                onClick={() => setPreviewNotice(null)}
                sx={{ position: "absolute", top: 10, right: 10, color: "white" }}
              >
                <Close />
              </IconButton>
              <Chip
                size="small"
                label={getTypeConfig(previewNotice.type).label}
                sx={{ mb: 1, bgcolor: "rgba(255,255,255,0.2)", color: "white", fontWeight: 700 }}
              />
              <Typography variant="h6" fontWeight={700} sx={{ pr: 4 }}>
                {previewNotice.title}
              </Typography>
              {previewNotice.subtitle && (
                <Typography variant="body2" sx={{ opacity: 0.85, mt: 0.5 }}>
                  {previewNotice.subtitle}
                </Typography>
              )}
              <Chip
                size="small"
                icon={previewNotice.targetType === "all" ? <PublicOutlined sx={{ fontSize: "14px !important" }} /> : <PersonOutline sx={{ fontSize: "14px !important" }} />}
                label={targetSummary(previewNotice)}
                sx={{ mt: 1, bgcolor: "rgba(255,255,255,0.15)", color: "white" }}
              />
            </Box>
            <DialogContent sx={{ bgcolor: "#fafafa" }}>
              <Stack spacing={1.5}>
                {previewNotice.caption && (
                  <Typography variant="body2" fontStyle="italic" color="#7e22ce">
                    {previewNotice.caption}
                  </Typography>
                )}
                <Typography variant="body2" sx={{ whiteSpace: "pre-wrap" }}>
                  {formatNoticeText(previewNotice.information) || "No further details."}
                </Typography>
                {previewNotice.targetType === "specific" && previewNotice.targetUsers?.length > 0 && (
                  <Box>
                    <Typography variant="caption" color="text.secondary" fontWeight={700}>
                      ASSIGNED USERS
                    </Typography>
                    <Stack direction="row" spacing={0.5} flexWrap="wrap" sx={{ mt: 0.5, gap: 0.5 }}>
                      {previewNotice.targetUsers.map((u) => (
                        <Chip key={u._id} size="small" label={u.name} />
                      ))}
                    </Stack>
                  </Box>
                )}
                {previewNotice.buttonLabel && previewNotice.buttonUrl && (
                  <Button
                    variant="outlined"
                    href={previewNotice.buttonUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    sx={{ alignSelf: "flex-start", textTransform: "none", mt: 1 }}
                  >
                    {previewNotice.buttonLabel}
                  </Button>
                )}
              </Stack>
            </DialogContent>
            <DialogActions sx={{ px: 2.5, py: 1.5 }}>
              <Button startIcon={<Share />} onClick={() => shareNotice(previewNotice, setToast)} sx={{ textTransform: "none" }}>
                Share
              </Button>
              <Button
                variant="contained"
                startIcon={<PictureAsPdf />}
                onClick={() => downloadNoticePdf(previewNotice)}
                sx={{ bgcolor: "#1e3a5f", "&:hover": { bgcolor: "#16293f" }, textTransform: "none" }}
              >
                Download PDF
              </Button>
            </DialogActions>
          </>
        )}
      </Dialog>

      {/* DELETE CONFIRM DIALOG */}
      <Dialog
        open={!!deleteTarget}
        onClose={() => !deleting && setDeleteTarget(null)}
        maxWidth="xs"
        fullWidth
        PaperProps={{ sx: { borderRadius: 2.5 } }}
      >
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
            <Typography fontWeight={800}>Delete this notice?</Typography>
            <Typography variant="body2" color="text.secondary">
              "{deleteTarget?.title}" will be permanently removed and no longer visible to assigned users.
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

export default function AdminNoticesPage() {
  return (
    <ProtectedRoute role="superadmin">
      <AdminNoticesInner />
    </ProtectedRoute>
  );
}

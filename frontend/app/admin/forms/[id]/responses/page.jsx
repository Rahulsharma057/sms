"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
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
  IconButton,
  Button,
  Stack,
  CircularProgress,
  LinearProgress,
  Tooltip,
  Dialog,
  DialogTitle,
  DialogContent,
  Divider,
  Pagination,
  Chip,
  Avatar,
  Card,
  CardContent,
  ToggleButtonGroup,
  ToggleButton,
  TextField,
  Menu,
  MenuItem,
  Checkbox,
  ListItemText,
  useMediaQuery,
  useTheme,
} from "@mui/material";
import {
  ArrowBack,
  Visibility,
  Close,
  ListAlt,
  DynamicForm,
  PeopleAltOutlined,
  ScheduleOutlined,
  PublicOutlined,
  PersonOutline,
  ViewList,
  ViewModule,
  ChevronRight,
  Search,
  FilterAltOff,
  ViewColumn,
} from "@mui/icons-material";
import ProtectedRoute from "../../../../../components/ProtectedRoute";
import Navbar from "../../../../../components/Navbar";
import api from "../../../../../lib/api";

const ROWS_PER_PAGE = 15;
const DEFAULT_VISIBLE_COLUMNS = 3;

function formatDate(date) {
  if (!date) return "—";

  return new Date(date).toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatDateShort(date) {
  if (!date) return "—";
  return new Date(date).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function formatTimeShort(date) {
  if (!date) return "";
  return new Date(date).toLocaleTimeString("en-IN", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

const formatAnswerValue = (field, ans) => {
  if (!ans || ans.value === "" || ans.value === undefined || ans.value === null) return "—";
  if (field?.fieldType === "checkbox") return ans.value === true || ans.value === "true" ? "Yes" : "No";
  if (field?.fieldType === "rating") return `${ans.value} / 5`;
  return String(ans.value);
};

const columnsStorageKey = (formId) => `form-responses-columns:${formId}`;

function FormResponsesInner() {
  const { id } = useParams();
  const router = useRouter();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("sm"));

  // initialLoading = very first load (full-page spinner ok here)
  // refreshing = any load after that (page/filter change — table stays visible, thin bar shows)
  const [initialLoading, setInitialLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [formMeta, setFormMeta] = useState(null);
  const [responses, setResponses] = useState([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);

  const [viewMode, setViewMode] = useState(null);
  const [viewing, setViewing] = useState(null);

  // ---- filters ----
  const [search, setSearch] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  // ---- which fields show as table/card columns ----
  const [visibleFieldIds, setVisibleFieldIds] = useState([]);
  const [columnMenuAnchor, setColumnMenuAnchor] = useState(null);

  const load = (targetPage = 1, overrides = {}) => {
    const isFirst = formMeta === null;
    if (isFirst) setInitialLoading(true);
    else setRefreshing(true);

    const s = overrides.search !== undefined ? overrides.search : search;
    const from = overrides.dateFrom !== undefined ? overrides.dateFrom : dateFrom;
    const to = overrides.dateTo !== undefined ? overrides.dateTo : dateTo;

    const params = { page: targetPage, limit: ROWS_PER_PAGE };
    if (s) params.search = s;
    if (from) params.from = from;
    if (to) params.to = to;

    api
      .get(`/forms/${id}/responses`, { params })
      .then((res) => {
        setFormMeta(res.data.form);
        setResponses(res.data.responses || []);
        setTotalPages(res.data.pagination?.totalPages || 1);
        setTotal(res.data.pagination?.total || 0);
        setPage(res.data.pagination?.page || 1);
      })
      .finally(() => {
        setInitialLoading(false);
        setRefreshing(false);
      });
  };

  // initial load
  useEffect(() => {
    if (id) load(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  // debounced search — skip on first mount, initial load already handles it
  useEffect(() => {
    if (formMeta === null) return;
    const t = setTimeout(() => load(1, { search }), 400);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  // date filters — instant, no debounce needed
  useEffect(() => {
    if (formMeta === null) return;
    load(1, { dateFrom, dateTo });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dateFrom, dateTo]);

  const clearFilters = () => {
    setSearch("");
    setDateFrom("");
    setDateTo("");
  };

  useEffect(() => {
    if (viewMode === null) setViewMode(isMobile ? "card" : "table");
  }, [isMobile, viewMode]);

  // ---- initialize / re-sync visible columns whenever form fields are known ----
  useEffect(() => {
    if (!formMeta?.fields || formMeta.fields.length === 0) return;

    const allIds = formMeta.fields.map((f) => String(f._id));

    setVisibleFieldIds((prev) => {
      if (prev.length > 0) {
        // keep whatever the user already chose, but drop ids for fields that no longer exist
        const stillValid = prev.filter((pid) => allIds.includes(String(pid)));
        if (stillValid.length > 0) return stillValid;
      }

      // nothing chosen yet — try localStorage, else default to first N fields
      try {
        const saved = JSON.parse(localStorage.getItem(columnsStorageKey(id)) || "null");
        if (Array.isArray(saved) && saved.length > 0) {
          const validSaved = saved.filter((sid) => allIds.includes(String(sid)));
          if (validSaved.length > 0) return validSaved;
        }
      } catch {
        // ignore malformed localStorage value
      }

      return allIds.slice(0, DEFAULT_VISIBLE_COLUMNS);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [formMeta?.fields, id]);

  const toggleColumn = (fieldId) => {
    setVisibleFieldIds((prev) => {
      const idStr = String(fieldId);
      const next = prev.includes(idStr) ? prev.filter((f) => f !== idStr) : [...prev, idStr];

      // keep at least one column visible
      if (next.length === 0) return prev;

      try {
        localStorage.setItem(columnsStorageKey(id), JSON.stringify(next));
      } catch {
        // storage might be unavailable — safe to ignore
      }

      return next;
    });
  };

  const previewFields =
    formMeta?.fields?.filter((f) => visibleFieldIds.includes(String(f._id))) || [];

  const answerFor = (response, fieldId) =>
    response.answers?.find((a) => String(a.fieldId) === String(fieldId));

  const getInitial = (name) => (name || "P").charAt(0).toUpperCase();

  const effectiveViewMode = viewMode || (isMobile ? "card" : "table");
  const hasActiveFilters = !!(search || dateFrom || dateTo);
  const totalFieldCount = formMeta?.fields?.length || 0;

  return (
    <Box sx={{ bgcolor: "#faf9fb", minHeight: "100vh" }}>
      <Navbar />

      <Container maxWidth="lg" sx={{ py: { xs: 1.5, md: 3 }, px: { xs: 1, sm: 2, md: 3 } }}>
        {/* PAGE HEADER */}
        <Stack
          direction={{ xs: "column", sm: "row" }}
          justifyContent="space-between"
          alignItems={{ xs: "stretch", sm: "center" }}
          spacing={1.5}
          sx={{ mb: { xs: 2, sm: 3 } }}
        >
          <Stack direction="row" spacing={1.25} alignItems="center">
            <IconButton
              onClick={() => router.push("/admin/forms")}
              sx={{
                width: { xs: 36, sm: 42 },
                height: { xs: 36, sm: 42 },
                border: "1px solid #e2e8f0",
                bgcolor: "#fff",
                borderRadius: 2,
                flexShrink: 0,
                "&:hover": { bgcolor: "#f8fafc", borderColor: "#cbd5e1" },
              }}
            >
              <ArrowBack fontSize="small" />
            </IconButton>

            <Box
              sx={{
                width: { xs: 38, sm: 44 },
                height: { xs: 38, sm: 44 },
                borderRadius: 2.2,
                bgcolor: "#7e22ce",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
                boxShadow: "0 4px 12px rgba(126,34,206,0.18)",
              }}
            >
              <DynamicForm sx={{ color: "#fff", fontSize: { xs: 19, sm: 23 } }} />
            </Box>

            <Box sx={{ minWidth: 0 }}>
              <Typography
                variant="h5"
                fontWeight={800}
                sx={{ color: "#0f172a", lineHeight: 1.2, fontSize: { xs: "1.05rem", sm: "1.5rem" } }}
                noWrap
              >
                {formMeta?.title || "Responses"}
              </Typography>

              <Stack direction="row" spacing={0.8} alignItems="center" sx={{ mt: 0.4 }}>
                <Typography variant="body2" color="text.secondary" fontSize={{ xs: "0.75rem", sm: "0.875rem" }}>
                  Form responses
                </Typography>
                <Box sx={{ width: 4, height: 4, borderRadius: "50%", bgcolor: "#94a3b8" }} />
                <Typography variant="body2" fontWeight={700} fontSize={{ xs: "0.75rem", sm: "0.875rem" }} sx={{ color: "#7e22ce" }}>
                  {total} response{total === 1 ? "" : "s"}
                </Typography>
              </Stack>
            </Box>
          </Stack>

          <Button
            variant="outlined"
            startIcon={<ArrowBack fontSize="small" />}
            onClick={() => router.push("/admin/forms")}
            sx={{
              textTransform: "none",
              borderRadius: 2,
              fontWeight: 700,
              color: "#475569",
              borderColor: "#cbd5e1",
              bgcolor: "#fff",
              display: { xs: "none", sm: "inline-flex" },
              "&:hover": { borderColor: "#94a3b8", bgcolor: "#f8fafc" },
            }}
          >
            Back to Forms
          </Button>
        </Stack>

        {/* SUMMARY CARDS */}
        {!initialLoading && formMeta && (
          <Box
            sx={{
              display: "grid",
              gridTemplateColumns: { xs: "repeat(3, 1fr)", sm: "repeat(3, 1fr)" },
              gap: { xs: 0.75, sm: 1.5 },
              mb: { xs: 2, sm: 2.5 },
            }}
          >
            <Paper elevation={0} sx={{ p: { xs: 1, sm: 2 }, border: "1px solid #e2e8f0", borderRadius: 2.5, bgcolor: "#fff" }}>
              <Stack direction={{ xs: "column", sm: "row" }} spacing={{ xs: 0.5, sm: 1.5 }} alignItems={{ xs: "flex-start", sm: "center" }}>
                <Box sx={{ width: { xs: 30, sm: 40 }, height: { xs: 30, sm: 40 }, borderRadius: 2, bgcolor: "#f3e8ff", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <PeopleAltOutlined sx={{ color: "#7e22ce", fontSize: { xs: 16, sm: 21 } }} />
                </Box>
                <Box sx={{ minWidth: 0 }}>
                  <Typography variant="caption" color="text.secondary" fontWeight={600} sx={{ fontSize: { xs: "0.55rem", sm: "0.75rem" }, whiteSpace: "nowrap" }}>
                    TOTAL
                  </Typography>
                  <Typography variant="h6" fontWeight={800} sx={{ lineHeight: 1.2, fontSize: { xs: "1rem", sm: "1.25rem" } }}>
                    {total}
                  </Typography>
                </Box>
              </Stack>
            </Paper>

            <Paper elevation={0} sx={{ p: { xs: 1, sm: 2 }, border: "1px solid #e2e8f0", borderRadius: 2.5, bgcolor: "#fff" }}>
              <Stack direction={{ xs: "column", sm: "row" }} spacing={{ xs: 0.5, sm: 1.5 }} alignItems={{ xs: "flex-start", sm: "center" }}>
                <Box sx={{ width: { xs: 30, sm: 40 }, height: { xs: 30, sm: 40 }, borderRadius: 2, bgcolor: "#eef2ff", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <ListAlt sx={{ color: "#4338ca", fontSize: { xs: 16, sm: 21 } }} />
                </Box>
                <Box sx={{ minWidth: 0 }}>
                  <Typography variant="caption" color="text.secondary" fontWeight={600} sx={{ fontSize: { xs: "0.55rem", sm: "0.75rem" }, whiteSpace: "nowrap" }}>
                    FIELDS
                  </Typography>
                  <Typography variant="h6" fontWeight={800} sx={{ lineHeight: 1.2, fontSize: { xs: "1rem", sm: "1.25rem" } }}>
                    {formMeta.fields?.length || 0}
                  </Typography>
                </Box>
              </Stack>
            </Paper>

            <Paper elevation={0} sx={{ p: { xs: 1, sm: 2 }, border: "1px solid #e2e8f0", borderRadius: 2.5, bgcolor: "#fff" }}>
              <Stack direction={{ xs: "column", sm: "row" }} spacing={{ xs: 0.5, sm: 1.5 }} alignItems={{ xs: "flex-start", sm: "center" }}>
                <Box sx={{ width: { xs: 30, sm: 40 }, height: { xs: 30, sm: 40 }, borderRadius: 2, bgcolor: "#ecfdf5", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <ScheduleOutlined sx={{ color: "#059669", fontSize: { xs: 16, sm: 21 } }} />
                </Box>
                <Box sx={{ minWidth: 0 }}>
                  <Typography variant="caption" color="text.secondary" fontWeight={600} sx={{ fontSize: { xs: "0.55rem", sm: "0.75rem" }, whiteSpace: "nowrap" }}>
                    STATUS
                  </Typography>
                  <Typography
                    variant="body1"
                    fontWeight={800}
                    sx={{ fontSize: { xs: "0.8rem", sm: "1rem" }, color: formMeta.isPublished ? "#059669" : "#64748b" }}
                  >
                    {formMeta.isPublished ? "Published" : "Draft"}
                  </Typography>
                </Box>
              </Stack>
            </Paper>
          </Box>
        )}

        {/* RESPONSES */}
        <Paper elevation={0} sx={{ border: "1px solid #e2e8f0", borderRadius: 2.5, overflow: "hidden", bgcolor: "#fff" }}>
          <Box sx={{ px: { xs: 1.25, sm: 2.5 }, py: { xs: 1.25, sm: 1.8 }, borderBottom: "1px solid #e2e8f0", bgcolor: "#fff" }}>
            <Stack
              direction={{ xs: "column", sm: "row" }}
              justifyContent="space-between"
              alignItems={{ xs: "flex-start", sm: "center" }}
              spacing={1}
            >
              <Box>
                <Typography fontWeight={800} sx={{ color: "#0f172a", fontSize: { xs: "0.9rem", sm: "1rem" } }}>
                  All Responses
                </Typography>
                <Typography variant="caption" color="text.secondary" sx={{ display: { xs: "none", sm: "block" } }}>
                  View and inspect submitted form responses
                </Typography>
              </Box>

              <Stack direction="row" spacing={1} alignItems="center" sx={{ alignSelf: { xs: "stretch", sm: "auto" }, justifyContent: "space-between", flexWrap: "wrap", gap: 1 }}>
                {total > 0 && (
                  <Chip
                    size="small"
                    icon={<ListAlt sx={{ fontSize: "15px !important" }} />}
                    label={`${total} total`}
                    sx={{ bgcolor: "#faf5ff", color: "#6b21a8", fontWeight: 700, border: "1px solid #e9d5ff" }}
                  />
                )}

                {/* COLUMN PICKER — choose which fields show as table/card preview columns */}
                {totalFieldCount > 0 && (
                  <>
                    <Button
                      size="small"
                      variant="outlined"
                      startIcon={<ViewColumn fontSize="small" />}
                      onClick={(e) => setColumnMenuAnchor(e.currentTarget)}
                      sx={{
                        textTransform: "none",
                        fontWeight: 600,
                        borderColor: "#e2e8f0",
                        color: "#475569",
                        "&:hover": { borderColor: "#cbd5e1", bgcolor: "#f8fafc" },
                      }}
                    >
                      Columns ({visibleFieldIds.length}/{totalFieldCount})
                    </Button>

                    <Menu
                      anchorEl={columnMenuAnchor}
                      open={!!columnMenuAnchor}
                      onClose={() => setColumnMenuAnchor(null)}
                      PaperProps={{
                        sx: { mt: 0.5, maxHeight: 340, minWidth: 240, border: "1px solid #e2e8f0", borderRadius: 2 },
                      }}
                    >
                      <Box sx={{ px: 2, py: 1 }}>
                        <Typography variant="caption" fontWeight={700} color="text.secondary">
                          SHOW AS COLUMNS
                        </Typography>
                      </Box>
                      {formMeta.fields.map((f) => {
                        const checked = visibleFieldIds.includes(String(f._id));
                        return (
                          <MenuItem key={f._id} onClick={() => toggleColumn(f._id)} dense sx={{ py: 0.4 }}>
                            <Checkbox
                              size="small"
                              checked={checked}
                              sx={{ p: 0.5, mr: 1, color: "#7e22ce", "&.Mui-checked": { color: "#7e22ce" } }}
                            />
                            <ListItemText
                              primary={f.label}
                              primaryTypographyProps={{ fontSize: "0.85rem" }}
                            />
                          </MenuItem>
                        );
                      })}
                    </Menu>
                  </>
                )}

                <ToggleButtonGroup
                  value={effectiveViewMode}
                  exclusive
                  size="small"
                  onChange={(e, val) => val && setViewMode(val)}
                  sx={{
                    "& .MuiToggleButton-root": { px: 1, py: 0.4 },
                    "& .MuiToggleButton-root.Mui-selected": {
                      bgcolor: "#7e22ce",
                      color: "white",
                      "&:hover": { bgcolor: "#6b21a8" },
                    },
                  }}
                >
                  <ToggleButton value="table">
                    <Tooltip title="Table view">
                      <ViewList fontSize="small" />
                    </Tooltip>
                  </ToggleButton>
                  <ToggleButton value="card">
                    <Tooltip title="Card view">
                      <ViewModule fontSize="small" />
                    </Tooltip>
                  </ToggleButton>
                </ToggleButtonGroup>
              </Stack>
            </Stack>

            {/* FILTER BAR */}
            <Stack direction={{ xs: "column", sm: "row" }} spacing={1} sx={{ mt: 1.5 }}>
              <TextField
                size="small"
                placeholder="Search responses..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                InputProps={{
                  startAdornment: <Search fontSize="small" sx={{ color: "text.disabled", mr: 0.5 }} />,
                }}
                sx={{ flex: 1 }}
              />
              <TextField
                size="small"
                type="date"
                label="From"
                InputLabelProps={{ shrink: true }}
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                sx={{ minWidth: { xs: "100%", sm: 150 } }}
              />
              <TextField
                size="small"
                type="date"
                label="To"
                InputLabelProps={{ shrink: true }}
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                sx={{ minWidth: { xs: "100%", sm: 150 } }}
              />
              {hasActiveFilters && (
                <Button
                  size="small"
                  color="inherit"
                  startIcon={<FilterAltOff fontSize="small" />}
                  onClick={clearFilters}
                  sx={{ textTransform: "none", flexShrink: 0 }}
                >
                  Clear
                </Button>
              )}
            </Stack>
          </Box>

          {/* thin progress bar on refresh — table stays visible underneath */}
          {refreshing && <LinearProgress sx={{ height: 2 }} />}

          {initialLoading ? (
            <Box sx={{ display: "flex", justifyContent: "center", alignItems: "center", py: 8 }}>
              <Stack alignItems="center" spacing={1.5}>
                <CircularProgress size={28} thickness={4} sx={{ color: "#7e22ce" }} />
                <Typography variant="body2" color="text.secondary">
                  Loading responses...
                </Typography>
              </Stack>
            </Box>
          ) : responses.length === 0 ? (
            <Box sx={{ py: 8, px: 2, textAlign: "center" }}>
              <Box
                sx={{
                  width: 64,
                  height: 64,
                  mx: "auto",
                  mb: 1.5,
                  borderRadius: "50%",
                  bgcolor: "#f3e8ff",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <ListAlt sx={{ fontSize: 30, color: "#7e22ce" }} />
              </Box>
              <Typography fontWeight={800} sx={{ mb: 0.5 }}>
                {hasActiveFilters ? "No matching responses" : "No responses yet"}
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ maxWidth: 360, mx: "auto" }}>
                {hasActiveFilters
                  ? "Try adjusting your search or date range."
                  : "Once someone submits this form, their response will appear here."}
              </Typography>
            </Box>
          ) : effectiveViewMode === "table" ? (
            <>
              <TableContainer sx={{ overflowX: "auto" }}>
                <Table size="small" sx={{ minWidth: 760 }}>
                  <TableHead>
                    <TableRow
                      sx={{
                        "& th": {
                          bgcolor: "#faf5ff",
                          color: "#4c1d95",
                          fontWeight: 800,
                          fontSize: 12,
                          textTransform: "uppercase",
                          letterSpacing: "0.03em",
                          borderBottom: "1px solid #e9d5ff",
                          py: 1.4,
                        },
                      }}
                    >
                      <TableCell>Submitted</TableCell>
                      {previewFields.map((f) => (
                        <TableCell key={f._id}>{f.label}</TableCell>
                      ))}
                      <TableCell>Submitted By</TableCell>
                      <TableCell align="right">Action</TableCell>
                    </TableRow>
                  </TableHead>

                  <TableBody>
                    {responses.map((r) => (
                      <TableRow
                        key={r._id}
                        hover
                        sx={{
                          "& td": { borderBottom: "1px solid #f1f5f9", py: 1.5 },
                          "&:hover": { bgcolor: "#fcfaff" },
                        }}
                      >
                        <TableCell sx={{ whiteSpace: "nowrap" }}>
                          <Stack direction="row" spacing={1} alignItems="center">
                            <Box
                              sx={{
                                width: 30,
                                height: 30,
                                borderRadius: 1.5,
                                bgcolor: "#f8fafc",
                                border: "1px solid #e2e8f0",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                              }}
                            >
                              <ScheduleOutlined sx={{ fontSize: 16, color: "#64748b" }} />
                            </Box>
                            <Typography variant="body2" fontWeight={600} color="#334155">
                              {formatDate(r.createdAt)}
                            </Typography>
                          </Stack>
                        </TableCell>

                        {previewFields.map((f) => {
                          const ans = answerFor(r, f._id);
                          return (
                            <TableCell key={f._id} sx={{ maxWidth: 190 }}>
                              <Typography variant="body2" noWrap sx={{ color: ans?.value !== "" && ans?.value !== undefined && ans?.value !== null ? "#334155" : "#94a3b8" }}>
                                {formatAnswerValue(f, ans)}
                              </Typography>
                            </TableCell>
                          );
                        })}

                        <TableCell>
                          {r.submittedBy ? (
                            <Stack direction="row" spacing={1} alignItems="center">
                              <Avatar sx={{ width: 30, height: 30, bgcolor: "#ede9fe", color: "#6b21a8", fontSize: 12, fontWeight: 800 }}>
                                {getInitial(r.submittedBy.name)}
                              </Avatar>
                              <Box sx={{ minWidth: 0 }}>
                                <Typography variant="body2" fontWeight={700} noWrap sx={{ maxWidth: 120 }}>
                                  {r.submittedBy.name}
                                </Typography>
                                <Stack direction="row" spacing={0.4} alignItems="center">
                                  <PersonOutline sx={{ fontSize: 12, color: "#64748b" }} />
                                  <Typography variant="caption" color="text.secondary">
                                    User
                                  </Typography>
                                </Stack>
                              </Box>
                            </Stack>
                          ) : (
                            <Chip
                              size="small"
                              icon={<PublicOutlined sx={{ fontSize: "14px !important" }} />}
                              label="Public"
                              sx={{ bgcolor: "#eff6ff", color: "#1d4ed8", fontWeight: 700 }}
                            />
                          )}
                        </TableCell>

                        <TableCell align="right">
                          <Tooltip title="View full response">
                            <IconButton
                              size="small"
                              onClick={() => setViewing(r)}
                              sx={{
                                width: 34,
                                height: 34,
                                color: "#7e22ce",
                                bgcolor: "#faf5ff",
                                border: "1px solid #e9d5ff",
                                "&:hover": { bgcolor: "#f3e8ff", borderColor: "#d8b4fe" },
                              }}
                            >
                              <Visibility fontSize="small" />
                            </IconButton>
                          </Tooltip>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>

              <Stack
                direction={{ xs: "column", sm: "row" }}
                justifyContent="space-between"
                alignItems={{ xs: "flex-start", sm: "center" }}
                gap={1.5}
                sx={{ px: { xs: 1.5, sm: 2.5 }, py: 1.7, borderTop: "1px solid #e2e8f0" }}
              >
                <Typography variant="caption" color="text.secondary">
                  Showing page {page} of {totalPages}
                </Typography>
                <Pagination
                  count={totalPages}
                  page={page}
                  onChange={(_e, value) => load(value)}
                  size="small"
                  shape="rounded"
                  sx={{
                    "& .MuiPaginationItem-root": { fontWeight: 600 },
                    "& .Mui-selected": { bgcolor: "#7e22ce !important", color: "#fff", "&:hover": { bgcolor: "#6b21a8 !important" } },
                  }}
                />
              </Stack>
            </>
          ) : (
            <>
              <Stack spacing={1.25} sx={{ p: { xs: 1.25, sm: 2 } }}>
                {responses.map((r) => (
                  <Card
                    key={r._id}
                    elevation={0}
                    sx={{
                      border: "1px solid #e2e8f0",
                      borderRadius: 2.5,
                      cursor: "pointer",
                      transition: "box-shadow 0.15s, border-color 0.15s",
                      "&:hover": { boxShadow: "0 4px 14px rgba(15,23,42,0.08)", borderColor: "#d8b4fe" },
                    }}
                    onClick={() => setViewing(r)}
                  >
                    <CardContent sx={{ p: { xs: 1.5, sm: 2 }, "&:last-child": { pb: { xs: 1.5, sm: 2 } } }}>
                      <Stack direction="row" justifyContent="space-between" alignItems="flex-start" spacing={1} sx={{ mb: 1 }}>
                        <Stack direction="row" spacing={0.6} alignItems="center">
                          <ScheduleOutlined sx={{ fontSize: 14, color: "#64748b" }} />
                          <Typography variant="caption" fontWeight={700} color="#334155">
                            {formatDateShort(r.createdAt)}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            · {formatTimeShort(r.createdAt)}
                          </Typography>
                        </Stack>
                        <ChevronRight sx={{ color: "text.disabled", fontSize: 20, flexShrink: 0 }} />
                      </Stack>

                      <Stack spacing={0.6} sx={{ mb: 1.25 }}>
                        {previewFields.map((f) => {
                          const ans = answerFor(r, f._id);
                          return (
                            <Box key={f._id} sx={{ minWidth: 0 }}>
                              <Typography
                                variant="caption"
                                color="text.secondary"
                                sx={{ textTransform: "uppercase", fontSize: "0.62rem", fontWeight: 700, letterSpacing: "0.03em" }}
                              >
                                {f.label}
                              </Typography>
                              <Typography variant="body2" noWrap sx={{ color: ans?.value !== "" && ans?.value !== undefined && ans?.value !== null ? "#334155" : "#94a3b8", fontWeight: 500 }}>
                                {formatAnswerValue(f, ans)}
                              </Typography>
                            </Box>
                          );
                        })}
                      </Stack>

                      <Divider sx={{ mb: 1.25 }} />

                      <Stack direction="row" justifyContent="space-between" alignItems="center">
                        {r.submittedBy ? (
                          <Stack direction="row" spacing={1} alignItems="center" sx={{ minWidth: 0 }}>
                            <Avatar sx={{ width: 26, height: 26, bgcolor: "#ede9fe", color: "#6b21a8", fontSize: 11, fontWeight: 800, flexShrink: 0 }}>
                              {getInitial(r.submittedBy.name)}
                            </Avatar>
                            <Typography variant="body2" fontWeight={700} noWrap>
                              {r.submittedBy.name}
                            </Typography>
                          </Stack>
                        ) : (
                          <Chip
                            size="small"
                            icon={<PublicOutlined sx={{ fontSize: "13px !important" }} />}
                            label="Public"
                            sx={{ bgcolor: "#eff6ff", color: "#1d4ed8", fontWeight: 700, height: 22, fontSize: "0.68rem" }}
                          />
                        )}

                        <Button
                          size="small"
                          startIcon={<Visibility fontSize="small" />}
                          onClick={(e) => {
                            e.stopPropagation();
                            setViewing(r);
                          }}
                          sx={{ textTransform: "none", fontWeight: 700, color: "#7e22ce", flexShrink: 0 }}
                        >
                          View
                        </Button>
                      </Stack>
                    </CardContent>
                  </Card>
                ))}
              </Stack>

              <Stack
                direction={{ xs: "column", sm: "row" }}
                justifyContent="space-between"
                alignItems={{ xs: "flex-start", sm: "center" }}
                gap={1.5}
                sx={{ px: { xs: 1.5, sm: 2.5 }, py: 1.7, borderTop: "1px solid #e2e8f0" }}
              >
                <Typography variant="caption" color="text.secondary">
                  Showing page {page} of {totalPages}
                </Typography>
                <Pagination
                  count={totalPages}
                  page={page}
                  onChange={(_e, value) => load(value)}
                  size="small"
                  shape="rounded"
                  sx={{
                    "& .MuiPaginationItem-root": { fontWeight: 600 },
                    "& .Mui-selected": { bgcolor: "#7e22ce !important", color: "#fff", "&:hover": { bgcolor: "#6b21a8 !important" } },
                  }}
                />
              </Stack>
            </>
          )}
        </Paper>
      </Container>

      {/* RESPONSE DETAIL DIALOG */}
      <Dialog
        open={!!viewing}
        onClose={() => setViewing(null)}
        maxWidth="sm"
        fullWidth
        fullScreen={isMobile}
        PaperProps={{ sx: { borderRadius: { xs: 0, sm: 3 }, overflow: "hidden" } }}
      >
        {viewing && (
          <>
            <Box sx={{ bgcolor: "#faf5ff", borderBottom: "1px solid #e9d5ff" }}>
              <DialogTitle
                sx={{ px: { xs: 2, sm: 3 }, pt: { xs: 2, sm: 2.5 }, pb: 1.5, fontWeight: 800, display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}
              >
                <Box sx={{ minWidth: 0 }}>
                  <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 0.5 }}>
                    <Box sx={{ width: 34, height: 34, borderRadius: 1.5, bgcolor: "#7e22ce", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                      <ListAlt sx={{ color: "#fff", fontSize: 18 }} />
                    </Box>
                    <Typography variant="h6" fontWeight={800} sx={{ fontSize: { xs: "1rem", sm: "1.25rem" } }}>
                      Response Detail
                    </Typography>
                  </Stack>
                  <Typography variant="body2" color="text.secondary" sx={{ fontSize: { xs: "0.75rem", sm: "0.875rem" } }}>
                    Submitted on {formatDate(viewing.createdAt)}
                  </Typography>
                </Box>

                <IconButton
                  size="small"
                  onClick={() => setViewing(null)}
                  sx={{ bgcolor: "#fff", border: "1px solid #e2e8f0", flexShrink: 0, "&:hover": { bgcolor: "#f8fafc" } }}
                >
                  <Close fontSize="small" />
                </IconButton>
              </DialogTitle>

              <Box sx={{ px: { xs: 2, sm: 3 }, pb: 2 }}>
                {viewing.submittedBy ? (
                  <Stack direction="row" spacing={1} alignItems="center">
                    <Avatar sx={{ width: 36, height: 36, bgcolor: "#ede9fe", color: "#6b21a8", fontWeight: 800 }}>
                      {getInitial(viewing.submittedBy.name)}
                    </Avatar>
                    <Box>
                      <Typography variant="body2" fontWeight={800}>
                        {viewing.submittedBy.name}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        Submitted by user
                      </Typography>
                    </Box>
                  </Stack>
                ) : (
                  <Chip
                    size="small"
                    icon={<PublicOutlined sx={{ fontSize: "15px !important" }} />}
                    label="Submitted through public link"
                    sx={{ bgcolor: "#eff6ff", color: "#1d4ed8", fontWeight: 700 }}
                  />
                )}
              </Box>
            </Box>

            <DialogContent dividers sx={{ p: { xs: 1.5, sm: 3 }, bgcolor: "#fff" }}>
              <Stack spacing={1.3}>
                {formMeta?.fields?.map((f, index) => {
                  const ans = answerFor(viewing, f._id);
                  const value = formatAnswerValue(f, ans);
                  const isEmpty = value === "—";

                  return (
                    <Paper
                      key={f._id}
                      elevation={0}
                      sx={{ p: { xs: 1.4, sm: 1.8 }, borderRadius: 2, border: "1px solid #e2e8f0", bgcolor: isEmpty ? "#f8fafc" : "#fff" }}
                    >
                      <Stack direction="row" spacing={1.2} alignItems="flex-start">
                        <Box
                          sx={{
                            width: 28,
                            height: 28,
                            borderRadius: 1.2,
                            bgcolor: "#f3e8ff",
                            color: "#7e22ce",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            flexShrink: 0,
                            fontSize: 12,
                            fontWeight: 800,
                          }}
                        >
                          {index + 1}
                        </Box>

                        <Box sx={{ minWidth: 0, flex: 1 }}>
                          <Typography
                            variant="caption"
                            color="text.secondary"
                            fontWeight={800}
                            sx={{ display: "block", mb: 0.5, textTransform: "uppercase", letterSpacing: "0.04em", fontSize: "0.68rem" }}
                          >
                            {f.label}
                          </Typography>
                          <Typography
                            variant="body2"
                            sx={{ whiteSpace: "pre-wrap", color: isEmpty ? "#94a3b8" : "#1e293b", lineHeight: 1.6, fontWeight: isEmpty ? 400 : 500 }}
                          >
                            {value}
                          </Typography>

                          {ans?.remark && (
                            <Typography
                              variant="caption"
                              color="text.secondary"
                              sx={{ display: "block", mt: 0.7, fontStyle: "italic", lineHeight: 1.5 }}
                            >
                              Remark: {ans.remark}
                            </Typography>
                          )}
                        </Box>
                      </Stack>
                    </Paper>
                  );
                })}
              </Stack>
            </DialogContent>
          </>
        )}
      </Dialog>
    </Box>
  );
}

export default function FormResponsesPage() {
  return (
    <ProtectedRoute role="superadmin">
      <FormResponsesInner />
    </ProtectedRoute>
  );
}
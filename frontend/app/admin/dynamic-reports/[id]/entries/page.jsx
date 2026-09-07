"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  Box,
  Container,
  Typography,
  Paper,
  Stack,
  Chip,
  IconButton,
  Table,
  TableHead,
  TableRow,
  TableCell,
  TableBody,
  TableContainer,
  CircularProgress,
  Alert,
  Pagination,
  Tooltip,
  Rating,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Divider,
  Popover,
  Checkbox,
  FormControlLabel,
  TextField,
  InputAdornment,
  ToggleButton,
  ToggleButtonGroup,
  Avatar,
  useMediaQuery,
} from "@mui/material";
import { useTheme } from "@mui/material/styles";
import {
  ArrowBack,
  Assessment,
  CheckCircle,
  HighlightOff,
  Visibility,
  DeleteOutline,
  ViewColumn,
  Search,
  FilterAltOff,
  PictureAsPdf,
  Close,
} from "@mui/icons-material";
import ProtectedRoute from "../../../../../components/ProtectedRoute";
import Navbar from "../../../../../components/Navbar";
import api from "../../../../../lib/api";

const ROWS_PER_PAGE = 20;
const VISIBLE_COLS_STORAGE_PREFIX = "dynamicReport:visibleCols:";
const ENTRIES_CACHE_PREFIX = "dynamicReport:entriesCache:";
const SEARCH_DEBOUNCE_MS = 350;

const formatAnswerValue = (field, value) => {
  if (value === undefined || value === null || value === "") return "—";

  if (field.fieldType === "checkbox") return value ? "Yes" : "No";

  if (field.fieldType === "checkbox_remark") {
    const obj = typeof value === "object" ? value : {};
    return `${obj.checked ? "Yes" : "No"}${obj.remark ? ` — ${obj.remark}` : ""}`;
  }

  if (field.fieldType === "rating") return `${value} / ${field.maxRating || 5}`;

  if (field.fieldType === "multiselect")
    return Array.isArray(value) ? value.join(", ") : String(value);

  return String(value);
};

const renderAnswerCell = (field, answer) => {
  const value = answer?.value;

  if (value === undefined || value === null || value === "") {
    return (
      <Typography variant="body2" color="text.disabled">
        —
      </Typography>
    );
  }

  if (field.fieldType === "checkbox") {
    return value ? (
      <CheckCircle fontSize="small" sx={{ color: "success.main" }} />
    ) : (
      <HighlightOff fontSize="small" sx={{ color: "text.disabled" }} />
    );
  }

  if (field.fieldType === "checkbox_remark") {
    const obj = typeof value === "object" ? value : {};
    return (
      <Stack direction="row" spacing={0.7} alignItems="center">
        {obj.checked ? (
          <CheckCircle fontSize="small" sx={{ color: "success.main" }} />
        ) : (
          <HighlightOff fontSize="small" sx={{ color: "text.disabled" }} />
        )}
        {obj.remark && (
          <Tooltip title={obj.remark}>
            <Typography variant="body2" noWrap sx={{ maxWidth: 160 }}>
              {obj.remark}
            </Typography>
          </Tooltip>
        )}
      </Stack>
    );
  }

  if (field.fieldType === "rating") {
    return (
      <Rating
        size="small"
        value={Number(value) || 0}
        max={field.maxRating || 5}
        readOnly
      />
    );
  }

  if (field.fieldType === "multiselect") {
    const arr = Array.isArray(value) ? value : [];
    return (
      <Stack direction="row" spacing={0.4} flexWrap="wrap" useFlexGap>
        {arr.map((v) => (
          <Chip key={v} label={v} size="small" />
        ))}
      </Stack>
    );
  }

  return (
    <Typography variant="body2" noWrap sx={{ maxWidth: 220 }}>
      {String(value)}
    </Typography>
  );
};

function DynamicReportEntriesInner() {
  const { id } = useParams();
  const router = useRouter();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("sm"));

  const [report, setReport] = useState(null);
  const [entries, setEntries] = useState([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [toast, setToast] = useState("");

  const [viewEntry, setViewEntry] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);

  // Which field keys are shown as columns in the table
  const [visibleKeys, setVisibleKeys] = useState(null); // null = not initialised yet
  const [colsAnchor, setColsAnchor] = useState(null);

  // Search (by submitter name/email) and date filter — either one exact date,
  // or a from/to range — both applied server-side.
  const [search, setSearch] = useState("");
  const [dateMode, setDateMode] = useState("exact"); // "exact" | "range"
  const [dateFilter, setDateFilter] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [downloadingPdf, setDownloadingPdf] = useState(false);
  const didInit = useRef(false);

  const applyResult = (data) => {
    setReport(data?.report || null);
    setEntries(data?.entries || []);
    setTotalPages(data?.pagination?.totalPages || 1);
    setTotal(data?.pagination?.total || 0);
    setPage(data?.pagination?.page || 1);
  };

  // Loads a page of entries. Shows a cached copy instantly (if we have one for
  // these exact filters) so switching pages/filters we've already seen doesn't
  // flash a blank loading state — then quietly refreshes from the server.
  const load = (opts = {}) => {
    const nextPage = opts.page ?? page;
    const nextSearch = opts.search !== undefined ? opts.search : search;
    const nextMode = opts.dateMode !== undefined ? opts.dateMode : dateMode;
    const nextDate = opts.date !== undefined ? opts.date : dateFilter;
    const nextFrom = opts.dateFrom !== undefined ? opts.dateFrom : dateFrom;
    const nextTo = opts.dateTo !== undefined ? opts.dateTo : dateTo;

    const dateSig = nextMode === "range" ? `${nextFrom}:${nextTo}` : nextDate;
    const cacheKey = `${ENTRIES_CACHE_PREFIX}${id}:${nextPage}:${nextSearch}:${nextMode}:${dateSig}`;

    let hasCache = false;
    try {
      const raw = sessionStorage.getItem(cacheKey);
      if (raw) {
        applyResult(JSON.parse(raw));
        hasCache = true;
      }
    } catch (e) {
      /* ignore bad cache entries */
    }

    setLoading(!hasCache);
    setError("");

    const params = { page: nextPage, limit: ROWS_PER_PAGE };
    if (nextSearch) params.search = nextSearch;
    if (nextMode === "range") {
      if (nextFrom) params.dateFrom = nextFrom;
      if (nextTo) params.dateTo = nextTo;
    } else if (nextDate) {
      params.date = nextDate;
    }

    api
      .get(`/dynamic-reports/${id}/entries`, { params })
      .then((res) => {
        applyResult(res.data);
        try {
          sessionStorage.setItem(cacheKey, JSON.stringify(res.data));
        } catch (e) {
          /* storage full / unavailable — safe to ignore */
        }
      })
      .catch((err) => {
        if (!hasCache) {
          setError(err?.response?.data?.message || "Could not load entries.");
        }
      })
      .finally(() => setLoading(false));
  };

  // Initial load for this report.
  useEffect(() => {
    if (!id) return;
    load({ page: 1 });
    didInit.current = true;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  // Debounced reload whenever the search text or date filter changes.
  useEffect(() => {
    if (!didInit.current) return;
    const t = setTimeout(() => {
      load({ page: 1 });
    }, SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, dateMode, dateFilter, dateFrom, dateTo]);

  const resetFilters = () => {
    setSearch("");
    setDateFilter("");
    setDateFrom("");
    setDateTo("");
  };

  // Downloads the current (filtered) entries as a PDF, matching whichever
  // columns are currently visible in the table.
  const handleDownloadPdf = async () => {
    setDownloadingPdf(true);
    try {
      const params = {};
      if (search) params.search = search;
      if (dateMode === "range") {
        if (dateFrom) params.dateFrom = dateFrom;
        if (dateTo) params.dateTo = dateTo;
      } else if (dateFilter) {
        params.date = dateFilter;
      }
      if (visibleKeys) params.columns = visibleKeys.join(",");

      const res = await api.get(`/dynamic-reports/${id}/entries/pdf`, {
        params,
        responseType: "blob",
      });
      const blob = new Blob([res.data], { type: "application/pdf" });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${(report?.title || "report").replace(/[^a-z0-9]+/gi, "_")}_entries.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      setToast(err?.response?.data?.message || "Could not download PDF.");
    } finally {
      setDownloadingPdf(false);
    }
  };

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(""), 2500);
    return () => clearTimeout(t);
  }, [toast]);

  const fields = report?.fields || [];

  // Initialise / restore visible columns once the report's fields are known.
  useEffect(() => {
    if (!report?._id || fields.length === 0) return;
    const storageKey = `${VISIBLE_COLS_STORAGE_PREFIX}${report._id}`;
    let saved = null;
    try {
      const raw = window.localStorage.getItem(storageKey);
      if (raw) saved = JSON.parse(raw);
    } catch (e) {
      saved = null;
    }
    const allKeys = fields.map((f) => f.key);
    // Default (no saved preference yet): keep it minimal — Date, Submitted by,
    // Actions are always shown anyway, so just add the first field to start.
    const defaultKeys = allKeys.slice(0, 1);
    if (Array.isArray(saved)) {
      // Keep only keys that still exist on the report, in the report's field order
      const filtered = allKeys.filter((k) => saved.includes(k));
      setVisibleKeys(filtered);
    } else {
      setVisibleKeys(defaultKeys);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [report?._id, fields.length]);

  const persistVisibleKeys = (keys) => {
    setVisibleKeys(keys);
    if (report?._id) {
      try {
        window.localStorage.setItem(
          `${VISIBLE_COLS_STORAGE_PREFIX}${report._id}`,
          JSON.stringify(keys),
        );
      } catch (e) {
        /* ignore storage errors */
      }
    }
  };

  const toggleColumn = (key) => {
    const current = visibleKeys || fields.map((f) => f.key);
    const next = current.includes(key)
      ? current.filter((k) => k !== key)
      : [...current, key];
    persistVisibleKeys(next);
  };

  const showAllColumns = () => persistVisibleKeys(fields.map((f) => f.key));
  const hideAllColumns = () => persistVisibleKeys([]);

  const visibleFields = useMemo(() => {
    if (!visibleKeys) return fields;
    return fields.filter((f) => visibleKeys.includes(f.key));
  }, [fields, visibleKeys]);

  const answerMapFor = (entry) => {
    const map = {};
    (entry.answers || []).forEach((a) => (map[a.fieldKey] = a));
    return map;
  };

  const handleDeleteConfirmed = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await api.delete(`/dynamic-reports/${id}/entries/${deleteTarget._id}`);
      setToast("Entry deleted successfully.");
      setDeleteTarget(null);
      const isLastItemOnPage = entries.length === 1 && page > 1;
      load({ page: isLastItemOnPage ? page - 1 : page });
    } catch (err) {
      setToast(err?.response?.data?.message || "Could not delete entry.");
    } finally {
      setDeleting(false);
    }
  };

  const columnsOpen = Boolean(colsAnchor);

  return (
    <Box sx={{ bgcolor: "#faf9fb", minHeight: "100vh" }}>
      <Navbar />
      <Container
        maxWidth="lg"
        sx={{ py: { xs: 2, sm: 3 }, px: { xs: 1.5, sm: 3 } }}
      >
        <Stack
          direction={{ xs: "column", sm: "row" }}
          spacing={1.2}
          alignItems={{ xs: "flex-start", sm: "center" }}
          justifyContent="space-between"
          sx={{ mb: 2.5 }}
        >
          <Stack
            direction="row"
            spacing={1.2}
            alignItems="center"
            sx={{ minWidth: 0 }}
          >
            <IconButton onClick={() => router.push("/admin/dynamic-reports")}>
              <ArrowBack />
            </IconButton>
            <Box
              sx={{
                width: 40,
                height: 40,
                borderRadius: 1,
                bgcolor: "#1c28ce",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
              }}
            >
              <Assessment sx={{ color: "white", fontSize: 22 }} />
            </Box>
            <Box sx={{ minWidth: 0 }}>
              <Typography variant="h5" fontWeight={800} noWrap>
                {report?.title || "Report entries"}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {total} submission{total === 1 ? "" : "s"}
              </Typography>
            </Box>
          </Stack>

          <Stack direction="row" spacing={1} sx={{ alignSelf: { xs: "stretch", sm: "auto" } }}>
            <Button
              size="small"
              variant="outlined"
              startIcon={
                downloadingPdf ? (
                  <CircularProgress size={14} sx={{ color: "#0f766e" }} />
                ) : (
                  <PictureAsPdf fontSize="small" />
                )
              }
              onClick={handleDownloadPdf}
              disabled={downloadingPdf || total === 0}
              sx={{
                textTransform: "none",
                fontWeight: 700,
                borderRadius: 2,
                borderColor: "#99f6e4",
                color: "#0f766e",
                flex: { xs: 1, sm: "none" },
                "&:hover": { borderColor: "#0f766e", bgcolor: "#f0fdfa" },
              }}
            >
              {downloadingPdf ? "Preparing..." : "Download PDF"}
            </Button>

            {fields.length > 0 && (
              <Button
                size="small"
                variant="outlined"
                startIcon={<ViewColumn fontSize="small" />}
                onClick={(e) => setColsAnchor(e.currentTarget)}
                sx={{
                  textTransform: "none",
                  fontWeight: 700,
                  borderRadius: 2,
                  borderColor: "#d8b4fe",
                  color: "#6b21a8",
                  flex: { xs: 1, sm: "none" },
                  "&:hover": { borderColor: "#7e22ce", bgcolor: "#faf5ff" },
                }}
              >
                Columns
                {visibleKeys && visibleKeys.length !== fields.length && (
                  <Chip
                    size="small"
                    label={`${visibleKeys.length}/${fields.length}`}
                    sx={{
                      ml: 1,
                      height: 18,
                      fontSize: 11,
                      bgcolor: "#f3e8ff",
                      color: "#6b21a8",
                    }}
                  />
                )}
              </Button>
            )}
          </Stack>
        </Stack>

        <Popover
          open={columnsOpen}
          anchorEl={colsAnchor}
          onClose={() => setColsAnchor(null)}
          anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
          transformOrigin={{ vertical: "top", horizontal: "right" }}
        >
          <Box sx={{ p: 1.5, width: 260, maxHeight: 360, overflowY: "auto" }}>
            <Stack
              direction="row"
              justifyContent="space-between"
              alignItems="center"
              sx={{ mb: 0.5 }}
            >
              <Typography
                variant="caption"
                fontWeight={700}
                color="text.secondary"
              >
                SHOW COLUMNS
              </Typography>
              <Stack direction="row" spacing={0.5}>
                <Button
                  size="small"
                  onClick={showAllColumns}
                  sx={{ textTransform: "none", minWidth: "auto", p: 0.4 }}
                >
                  All
                </Button>
                <Button
                  size="small"
                  onClick={hideAllColumns}
                  sx={{ textTransform: "none", minWidth: "auto", p: 0.4 }}
                >
                  None
                </Button>
              </Stack>
            </Stack>
            <Divider sx={{ mb: 0.5 }} />
            <Stack spacing={0}>
              {fields.map((f) => (
                <FormControlLabel
                  key={f.key}
                  sx={{ mx: 0, py: 0.1 }}
                  control={
                    <Checkbox
                      size="small"
                      checked={!visibleKeys || visibleKeys.includes(f.key)}
                      onChange={() => toggleColumn(f.key)}
                    />
                  }
                  label={
                    <Typography variant="body2" noWrap>
                      {f.label}
                    </Typography>
                  }
                />
              ))}
            </Stack>
          </Box>
        </Popover>

        <Paper
          elevation={0}
          sx={{
            p: { xs: 1.2, sm: 1.5 },
            border: "1px solid #e2e8f0",
            borderRadius: 1.5,
            mb: 2,
          }}
        >
          <Stack direction="row" spacing={1} sx={{ flexWrap: "wrap", gap: 1 }} alignItems="center">
            <TextField
              size="small"
              placeholder="Search by name or email..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <Search fontSize="small" sx={{ color: "text.disabled" }} />
                  </InputAdornment>
                ),
              }}
              sx={{ flex: { xs: "1 1 100%", sm: "1 1 220px" } }}
            />

            <ToggleButtonGroup
              value={dateMode}
              exclusive
              size="small"
              onChange={(_e, val) => val && setDateMode(val)}
            >
              <ToggleButton value="exact" sx={{ textTransform: "none", px: 1.2 }}>
                Exact date
              </ToggleButton>
              <ToggleButton value="range" sx={{ textTransform: "none", px: 1.2 }}>
                Date range
              </ToggleButton>
            </ToggleButtonGroup>

            {dateMode === "exact" ? (
              <TextField
                size="small"
                type="date"
                label="Date"
                value={dateFilter}
                onChange={(e) => setDateFilter(e.target.value)}
                InputLabelProps={{ shrink: true }}
                sx={{ flex: { xs: "1 1 100%", sm: "0 0 170px" } }}
              />
            ) : (
              <>
                <TextField
                  size="small"
                  type="date"
                  label="From"
                  value={dateFrom}
                  onChange={(e) => setDateFrom(e.target.value)}
                  InputLabelProps={{ shrink: true }}
                  sx={{ flex: { xs: "1 1 48%", sm: "0 0 160px" } }}
                />
                <TextField
                  size="small"
                  type="date"
                  label="To"
                  value={dateTo}
                  onChange={(e) => setDateTo(e.target.value)}
                  InputLabelProps={{ shrink: true }}
                  sx={{ flex: { xs: "1 1 48%", sm: "0 0 160px" } }}
                />
              </>
            )}

            <Button
              size="small"
              startIcon={<FilterAltOff fontSize="small" />}
              onClick={resetFilters}
              color="inherit"
              disabled={!search && !dateFilter && !dateFrom && !dateTo}
              sx={{ textTransform: "none" }}
            >
              Reset filters
            </Button>
          </Stack>
        </Paper>

        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}
        {toast && (
          <Alert severity="info" sx={{ mb: 2 }} onClose={() => setToast("")}>
            {toast}
          </Alert>
        )}

        <Paper
          elevation={0}
          sx={{
            p: { xs: 0, sm: 0 },
            border: "1px solid #e2e8f0",
            borderRadius: 1.5,
          }}
        >
          {loading ? (
            <Box sx={{ display: "flex", justifyContent: "center", py: 5 }}>
              <CircularProgress size={24} sx={{ color: "#7e22ce" }} />
            </Box>
          ) : entries.length === 0 ? (
            <Box sx={{ py: 4, textAlign: "center" }}>
              <Assessment sx={{ fontSize: 40, color: "#c4b5fd", mb: 1 }} />
              <Typography color="text.secondary">
                {search || dateFilter || dateFrom || dateTo
                  ? "No submissions match your filters."
                  : "No submissions yet."}
              </Typography>
            </Box>
          ) : (
            <TableContainer
              sx={{
                overflowX: "auto",
                p: 0,
                m: 0,
              }}
            >
              <Table
                size="small"
                sx={{
                  minWidth: 480,
                  borderCollapse: "collapse",
                  m: 0,
                  p: 0,
                  "& .MuiTableCell-root": {
                    py: 1,
                  },
                }}
              >
                <TableHead
                  sx={{
                    m: 0,
                    p: 0,
                    "& .MuiTableRow-root": {
                      m: 0,
                      p: 0,
                    },
                  }}
                >
                  <TableRow
                    sx={{
                      m: 0,
                      p: 0,
                      "& th": {
                        bgcolor: "#391ea4",
                        fontWeight: 700,
                        color: "#fdfdfd",
                        whiteSpace: "nowrap",
                        py: 1,
                        px: 1.5,
                        borderTop: "none",
                      },
                    }}
                  >
                    <TableCell>Date</TableCell>

                    <TableCell>Submitted by</TableCell>

                    {visibleFields.map((f) => (
                      <TableCell key={f.key}>{f.label}</TableCell>
                    ))}

                    <TableCell align="right">Actions</TableCell>
                  </TableRow>
                </TableHead>

                <TableBody
                  sx={{
                    m: 0,
                    p: 0,
                  }}
                >
                  {entries.map((entry) => {
                    const amap = answerMapFor(entry);

                    return (
                      <TableRow
                        key={entry._id}
                        hover
                        sx={{
                          m: 0,
                          p: 0,
                        }}
                      >
                        <TableCell>
                          <Chip
                            size="small"
                            label={entry.date}
                            sx={{ fontWeight: 600 }}
                          />
                        </TableCell>

                        <TableCell>
                          <Typography variant="body2" fontWeight={600} noWrap>
                            {entry.submittedBy?.name || "—"}
                          </Typography>

                          <Typography
                            variant="caption"
                            color="text.secondary"
                            noWrap
                            sx={{ display: "block" }}
                          >
                            {entry.submittedBy?.email || ""}
                          </Typography>
                        </TableCell>

                        {visibleFields.map((f) => (
                          <TableCell key={f.key}>
                            {renderAnswerCell(f, amap[f.key])}
                          </TableCell>
                        ))}

                        <TableCell align="right">
                          <Tooltip title="View full entry">
                            <IconButton
                              size="small"
                              onClick={() => setViewEntry(entry)}
                              sx={{ color: "#1e3a5f" }}
                            >
                              <Visibility fontSize="small" />
                            </IconButton>
                          </Tooltip>

                          <Tooltip title="Delete entry">
                            <IconButton
                              size="small"
                              onClick={() => setDeleteTarget(entry)}
                              sx={{ color: "#dc2626" }}
                            >
                              <DeleteOutline fontSize="small" />
                            </IconButton>
                          </Tooltip>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </TableContainer>
          )}

          {!loading && entries.length > 0 && (
            <Stack
              direction="row"
              justifyContent="space-between"
              alignItems="center"
              flexWrap="wrap"
              gap={1}
              sx={{
                mt: 0,
                pt: 1.5,
                pb: { xs: 1.5, sm: 2 },
                px: { xs: 1.5, sm: 2 },
                borderTop: "1px solid #e2e8f0",
              }}
            >
              <Typography variant="caption" color="text.secondary">
                Page {page} of {totalPages} ({total} total)
              </Typography>
              <Pagination
                count={totalPages}
                page={page}
                onChange={(_e, value) => load({ page: value })}
                size="small"
                shape="rounded"
                siblingCount={isMobile ? 0 : 1}
                sx={{
                  "& .Mui-selected": {
                    bgcolor: "#7e22ce !important",
                    color: "white",
                  },
                }}
              />
            </Stack>
          )}
        </Paper>
      </Container>

      {/* VIEW ENTRY DIALOG */}
      <Dialog
        open={!!viewEntry}
        onClose={() => setViewEntry(null)}
        maxWidth="sm"
        fullWidth
        fullScreen={isMobile}
        PaperProps={{ sx: { borderRadius: isMobile ? 0 : 2.5, overflow: "hidden" } }}
      >
        <DialogTitle
          sx={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 1,
            bgcolor: "#391ea4",
            color: "#fff",
            py: 1.5,
          }}
        >
          <Box sx={{ minWidth: 0 }}>
            <Typography variant="subtitle1" fontWeight={800} noWrap sx={{ color: "inherit" }}>
              {report?.title || "Report entry"}
            </Typography>
            <Typography variant="caption" sx={{ color: "rgba(255,255,255,0.75)" }}>
              Submitted on {viewEntry?.date}
            </Typography>
          </Box>
          <IconButton onClick={() => setViewEntry(null)} size="small" sx={{ color: "#fff" }}>
            <Close fontSize="small" />
          </IconButton>
        </DialogTitle>

        <DialogContent dividers sx={{ bgcolor: "#faf9fb", p: { xs: 1.5, sm: 2.5 } }}>
          <Paper
            variant="outlined"
            sx={{ p: 1.4, mb: 2, borderRadius: 2, borderColor: "#e2e8f0", bgcolor: "#fff" }}
          >
            <Stack direction="row" spacing={1.4} alignItems="center">
              <Avatar sx={{ bgcolor: "#391ea4", width: 38, height: 38, fontSize: 15, fontWeight: 700 }}>
                {(viewEntry?.submittedBy?.name || "?").charAt(0).toUpperCase()}
              </Avatar>
              <Box sx={{ minWidth: 0 }}>
                <Typography variant="caption" color="text.secondary" fontWeight={700}>
                  SUBMITTED BY
                </Typography>
                <Typography fontWeight={700} noWrap>
                  {viewEntry?.submittedBy?.name || "—"}
                </Typography>
                <Typography variant="body2" color="text.secondary" noWrap>
                  {viewEntry?.submittedBy?.email}
                </Typography>
              </Box>
            </Stack>
          </Paper>

          <Stack spacing={1}>
            {fields.map((f) => {
              const amap = viewEntry ? answerMapFor(viewEntry) : {};
              return (
                <Paper
                  key={f.key}
                  variant="outlined"
                  sx={{ p: 1.3, borderRadius: 2, borderColor: "#e2e8f0", bgcolor: "#fff" }}
                >
                  <Typography
                    variant="caption"
                    color="text.secondary"
                    fontWeight={700}
                    sx={{ display: "block", mb: 0.4, letterSpacing: 0.3 }}
                  >
                    {f.label.toUpperCase()}
                  </Typography>
                  <Typography fontSize="0.92rem" sx={{ wordBreak: "break-word" }}>
                    {formatAnswerValue(f, amap[f.key]?.value)}
                  </Typography>
                </Paper>
              );
            })}
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, py: 2 }}>
          <Button
            onClick={() => setViewEntry(null)}
            variant="outlined"
            sx={{ textTransform: "none", fontWeight: 700 }}
          >
            Close
          </Button>
        </DialogActions>
      </Dialog>

      {/* DELETE CONFIRM */}
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
            <Typography fontWeight={800}>Delete this entry?</Typography>
            <Typography variant="body2" color="text.secondary">
              The submission from "{deleteTarget?.submittedBy?.name}" for{" "}
              {deleteTarget?.date} will be permanently removed.
            </Typography>
          </Stack>
        </DialogContent>
        <DialogActions
          sx={{ px: 3, pb: 2.5, justifyContent: "center", gap: 1 }}
        >
          <Button
            onClick={() => setDeleteTarget(null)}
            disabled={deleting}
            sx={{ textTransform: "none" }}
          >
            Cancel
          </Button>
          <Button
            variant="contained"
            color="error"
            onClick={handleDeleteConfirmed}
            disabled={deleting}
            startIcon={
              deleting ? (
                <CircularProgress size={16} color="inherit" />
              ) : (
                <DeleteOutline />
              )
            }
            sx={{ textTransform: "none", fontWeight: 700 }}
          >
            {deleting ? "Deleting..." : "Delete"}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

export default function DynamicReportEntriesPage() {
  return (
    <ProtectedRoute role="superadmin">
      <DynamicReportEntriesInner />
    </ProtectedRoute>
  );
}
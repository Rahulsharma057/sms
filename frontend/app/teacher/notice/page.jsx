"use client";

import { useEffect, useRef, useState } from "react";
import {
  Box,
  Container,
  Typography,
  Paper,
  Stack,
  TextField,
  InputAdornment,
  Card,
  CardContent,
  CircularProgress,
  Button,
  Dialog,
  DialogContent,
  DialogActions,
  IconButton,
  Divider,
  Alert,
  Chip,
  Pagination,
  Badge,
  Snackbar,
  MenuItem,
  Tooltip,
} from "@mui/material";
import {
  Search,
  CampaignOutlined,
  PictureAsPdf,
  Share,
  Close,
  ChevronRight,
  PublicOutlined,
  PersonOutline,
  WarningAmberOutlined,
  NotificationsActiveOutlined,
  UpdateOutlined,
  NotificationsOutlined,
} from "@mui/icons-material";
import ProtectedRoute from "../../../components/ProtectedRoute";
import Navbar from "../../../components/Navbar";
import api from "../../../lib/api";

const ROWS_PER_PAGE = 10;

// How often to poll for newly-created notices, in ms.
const POLL_INTERVAL = 20000;
const LAST_SEEN_KEY = "notices:lastSeenAt";

/* =====================================================
   NOTICE TYPES — shared config for color/icon/label
===================================================== */

const NOTICE_TYPES = {
  warning: { label: "Warning", color: "#dc2626", bg: "#fee2e2", icon: WarningAmberOutlined },
  notice: { label: "Notice", color: "#7e22ce", bg: "#f3e8ff", icon: CampaignOutlined },
  announcement: { label: "Announcement", color: "#0369a1", bg: "#e0f2fe", icon: NotificationsActiveOutlined },
  update: { label: "Update", color: "#0f766e", bg: "#d1fae5", icon: UpdateOutlined },
};

const getTypeConfig = (type) => NOTICE_TYPES[type] || NOTICE_TYPES.notice;

function TypeChip({ type, size = "small", inverted = false }) {
  const cfg = getTypeConfig(type);
  const Icon = cfg.icon;
  return (
    <Chip
      size={size}
      icon={<Icon sx={{ fontSize: "13px !important" }} />}
      label={cfg.label}
      sx={
        inverted
          ? { fontWeight: 700, bgcolor: "rgba(255,255,255,0.2)", color: "white" }
          : { fontWeight: 700, bgcolor: cfg.bg, color: cfg.color }
      }
    />
  );
}

/* =====================================================
   LIGHTWEIGHT TEXT FORMATTING — **bold** and *italic*
===================================================== */

function formatNoticeText(text) {
  if (!text) return null;
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

const stripMarkdown = (text = "") => text.replace(/\*\*([^*]+)\*\*/g, "$1").replace(/\*([^*]+)\*/g, "$1");

/* PDF + share logic mirrors the admin notices page so downloads look identical */

const PAGE_WIDTH = 210;
const MARGIN_X = 16;
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN_X * 2;

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

function NoticesInner() {
  const [notices, setNotices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("");

  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);

  const [selectedNotice, setSelectedNotice] = useState(null);
  const [toast, setToast] = useState("");

  // NEW-NOTICE NOTIFICATION
  // lastSeenAt: the timestamp up to which the user has "checked" notices —
  // persisted so the badge doesn't reappear on every page reload for
  // notices they've already opened this page for.
  const [lastSeenAt, setLastSeenAt] = useState(null);
  const [unseenCount, setUnseenCount] = useState(0);
  const [newNoticeToast, setNewNoticeToast] = useState(false);
  const pollRef = useRef(null);

  const loadNotices = (overrides = {}) => {
    setLoading(true);
    const params = { page: overrides.page || 1, limit: ROWS_PER_PAGE };
    const s = overrides.search !== undefined ? overrides.search : search;
    const ty = overrides.type !== undefined ? overrides.type : typeFilter;
    if (s) params.search = s;
    if (ty) params.type = ty;

    // The backend already filters to only notices visible to this user
    // (targetType "all", or "specific" ones that include their id) — so
    // whatever comes back here is safe to render as-is.
    api
      .get("/notices/active", { params })
      .then((res) => {
        setNotices(res.data?.notices || []);
        setTotalPages(res.data?.pagination?.totalPages || 1);
        setTotal(res.data?.pagination?.total || 0);
        setPage(res.data?.pagination?.page || 1);
      })
      .finally(() => setLoading(false));
  };

  // Checks if anything new has arrived since lastSeenAt, without pulling
  // full notice bodies — cheap poll using the same endpoint + ?since=.
  const checkForNewNotices = (sinceIso) => {
    if (!sinceIso) return;
    api
      .get("/notices/active", { params: { since: sinceIso, limit: 1 } })
      .then((res) => {
        const count = res.data?.pagination?.total || 0;
        if (count > 0) {
          setUnseenCount(count);
          setNewNoticeToast(true);
        }
      })
      .catch(() => {});
  };

  useEffect(() => {
    const stored = typeof window !== "undefined" ? localStorage.getItem(LAST_SEEN_KEY) : null;
    const initialLastSeen = stored || new Date().toISOString();
    setLastSeenAt(initialLastSeen);

    loadNotices({ page: 1 });

    pollRef.current = setInterval(() => {
      checkForNewNotices(initialLastSeen);
    }, POLL_INTERVAL);

    return () => clearInterval(pollRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

  const handleTypeFilterChange = (value) => {
    setTypeFilter(value);
    loadNotices({ type: value, page: 1 });
  };

  const handlePageChange = (_e, value) => {
    loadNotices({ page: value });
  };

  // Marks everything as seen: clears the badge, updates the stored
  // timestamp, and refreshes the list so newly-arrived notices show up.
  const handleMarkSeen = () => {
    const now = new Date().toISOString();
    setLastSeenAt(now);
    if (typeof window !== "undefined") localStorage.setItem(LAST_SEEN_KEY, now);
    setUnseenCount(0);
    setNewNoticeToast(false);
    loadNotices({ page: 1 });
  };

  return (
    <Box sx={{ bgcolor: "#faf9fb", minHeight: "100vh" }}>
      <Navbar />
      <Container maxWidth="md" sx={{ py: 3 }}>
        {/* HEADER */}
        <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2.5 }}>
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
              <CampaignOutlined sx={{ color: "white", fontSize: 22 }} />
            </Box>
            <Box>
              <Typography variant="h5" fontWeight={800}>
                Notices
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Updates and announcements from the admin
              </Typography>
            </Box>
          </Stack>

          {unseenCount > 0 && (
            <Tooltip title={`${unseenCount} new notice${unseenCount > 1 ? "s" : ""} — tap to refresh`}>
              <IconButton onClick={handleMarkSeen} sx={{ bgcolor: "#fef2f2" }}>
                <Badge badgeContent={unseenCount} color="error">
                  <NotificationsActiveOutlined sx={{ color: "#dc2626" }} />
                </Badge>
              </IconButton>
            </Tooltip>
          )}
        </Stack>

        {/* SEARCH + TYPE FILTER */}
        <Stack direction="row" spacing={1} sx={{ mb: 2.5, flexWrap: "wrap", gap: 1 }}>
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
            sx={{ flex: "1 1 200px", bgcolor: "white" }}
          />
          <TextField
            select
            size="small"
            label="Type"
            value={typeFilter}
            onChange={(e) => handleTypeFilterChange(e.target.value)}
            sx={{ flex: "0 1 160px", bgcolor: "white" }}
          >
            <MenuItem value="">All types</MenuItem>
            {Object.entries(NOTICE_TYPES).map(([key, cfg]) => (
              <MenuItem key={key} value={key}>
                {cfg.label}
              </MenuItem>
            ))}
          </TextField>
        </Stack>

        {loading ? (
          <Box sx={{ display: "flex", justifyContent: "center", py: 6 }}>
            <CircularProgress size={26} sx={{ color: "#7e22ce" }} />
          </Box>
        ) : notices.length === 0 ? (
          <Paper elevation={0} sx={{ p: 4, textAlign: "center", border: "1px solid #e2e8f0", borderRadius: 2.5 }}>
            <Typography color="text.secondary">No notices found.</Typography>
          </Paper>
        ) : (
          <Stack spacing={1.5}>
            {notices.map((n) => (
              <Card
                key={n._id}
                elevation={0}
                sx={{
                  border: n.type === "warning" ? "1px solid #fecaca" : "1px solid #e2e8f0",
                  borderRadius: 2.5,
                  cursor: "pointer",
                  transition: "box-shadow 0.15s",
                  "&:hover": { boxShadow: "0 4px 14px rgba(15,23,42,0.08)" },
                }}
                onClick={() => setSelectedNotice(n)}
              >
                <CardContent sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" sx={{ gap: 0.5 }}>
                      <TypeChip type={n.type} />
                      <Typography fontWeight={700} noWrap>
                        {n.title}
                      </Typography>
                      <Chip
                        size="small"
                        icon={
                          n.targetType === "all"
                            ? <PublicOutlined sx={{ fontSize: "13px !important" }} />
                            : <PersonOutline sx={{ fontSize: "13px !important" }} />
                        }
                        label={n.targetType === "all" ? "For everyone" : "Assigned to you"}
                        sx={{
                          height: 20,
                          fontSize: "0.65rem",
                          bgcolor: n.targetType === "all" ? "#eef2ff" : "#fef3c7",
                          color: n.targetType === "all" ? "#4338ca" : "#92400e",
                        }}
                      />
                      {n.createdAt && (
                        <Chip
                          size="small"
                          label={new Date(n.createdAt).toLocaleDateString("en-IN")}
                          sx={{ height: 20, fontSize: "0.68rem" }}
                        />
                      )}
                    </Stack>
                    {n.subtitle && (
                      <Typography variant="body2" color="text.secondary" noWrap sx={{ mt: 0.25 }}>
                        {n.subtitle}
                      </Typography>
                    )}
                  </Box>
                  <ChevronRight sx={{ color: "text.disabled", flexShrink: 0 }} />
                </CardContent>
              </Card>
            ))}
          </Stack>
        )}

        {/* PAGINATION */}
        {!loading && notices.length > 0 && (
          <Stack
            direction="row"
            justifyContent="space-between"
            alignItems="center"
            flexWrap="wrap"
            gap={1}
            sx={{ mt: 2.5 }}
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
      </Container>

      {/* VIEW DIALOG */}
      <Dialog open={!!selectedNotice} onClose={() => setSelectedNotice(null)} maxWidth="sm" fullWidth>
        {selectedNotice && (
          <>
            <Box
              sx={{
                px: 3,
                py: 2.5,
                bgcolor: getTypeConfig(selectedNotice.type).color,
                color: "white",
                position: "relative",
              }}
            >
              <IconButton
                onClick={() => setSelectedNotice(null)}
                sx={{ position: "absolute", top: 10, right: 10, color: "white" }}
              >
                <Close />
              </IconButton>
              <TypeChip type={selectedNotice.type} inverted />
              <Typography variant="h6" fontWeight={700} sx={{ pr: 4, mt: 1 }}>
                {selectedNotice.title}
              </Typography>
              {selectedNotice.subtitle && (
                <Typography variant="body2" sx={{ opacity: 0.85, mt: 0.5 }}>
                  {selectedNotice.subtitle}
                </Typography>
              )}
            </Box>
            <DialogContent sx={{ bgcolor: "#fafafa" }}>
              <Stack spacing={1.5}>
                {selectedNotice.caption && (
                  <Typography variant="body2" fontStyle="italic" color="#7e22ce">
                    {selectedNotice.caption}
                  </Typography>
                )}
                <Divider />
                <Typography variant="body2" sx={{ whiteSpace: "pre-wrap" }}>
                  {formatNoticeText(selectedNotice.information) || "No further details."}
                </Typography>
                {selectedNotice.buttonLabel && selectedNotice.buttonUrl && (
                  <Button
                    variant="contained"
                    href={selectedNotice.buttonUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    sx={{
                      alignSelf: "flex-start",
                      textTransform: "none",
                      mt: 1,
                      bgcolor: "#7e22ce",
                      "&:hover": { bgcolor: "#6b21a8" },
                    }}
                  >
                    {selectedNotice.buttonLabel}
                  </Button>
                )}
              </Stack>
            </DialogContent>
            <DialogActions sx={{ px: 2.5, py: 1.5 }}>
              <Button
                startIcon={<Share />}
                onClick={() => shareNotice(selectedNotice, setToast)}
                sx={{ textTransform: "none" }}
              >
                Share
              </Button>
              <Button
                variant="contained"
                startIcon={<PictureAsPdf />}
                onClick={() => downloadNoticePdf(selectedNotice)}
                sx={{ bgcolor: "#1e3a5f", "&:hover": { bgcolor: "#16293f" }, textTransform: "none" }}
              >
                Download PDF
              </Button>
            </DialogActions>
          </>
        )}
      </Dialog>

      {/* NEW NOTICE TOAST */}
      <Snackbar
        open={newNoticeToast}
        autoHideDuration={6000}
        onClose={() => setNewNoticeToast(false)}
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
      >
        <Alert
          onClose={() => setNewNoticeToast(false)}
          severity="info"
          variant="filled"
          icon={<NotificationsOutlined />}
          action={
            <Button color="inherit" size="small" onClick={handleMarkSeen} sx={{ textTransform: "none", fontWeight: 700 }}>
              View
            </Button>
          }
          sx={{ bgcolor: "#7e22ce" }}
        >
          {unseenCount > 1 ? `${unseenCount} new notices posted` : "A new notice was posted"}
        </Alert>
      </Snackbar>
    </Box>
  );
}

export default function NoticesPage() {
  return (
    <ProtectedRoute>
      <NoticesInner />
    </ProtectedRoute>
  );
}

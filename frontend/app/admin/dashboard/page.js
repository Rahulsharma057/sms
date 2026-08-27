"use client";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Box, Container, Typography, Paper, Grid, Card, CardContent,
  Table, TableHead, TableRow, TableCell, TableBody, TableContainer,
  TextField, MenuItem, Chip, Dialog, DialogTitle, DialogContent, DialogActions, IconButton,
  Stack, Avatar, Skeleton, Divider, Button, Pagination, CircularProgress, Tooltip,
} from "@mui/material";
import {
  Close, DescriptionOutlined, WarningAmberOutlined, GroupsOutlined,
  CalendarMonthOutlined, PersonOutline, DeleteOutline, ArrowForward, FilterAltOff,
} from "@mui/icons-material";
import ProtectedRoute from "../../../components/ProtectedRoute";
import Navbar from "../../../components/Navbar";
import api from "../../../lib/api";

const AVATAR_COLORS = ["#6366F1", "#0EA5E9", "#10B981", "#F59E0B", "#EF4444", "#8B5CF6", "#EC4899"];
function colorForName(name = "") {
  const idx = [...name].reduce((sum, ch) => sum + ch.charCodeAt(0), 0);
  return AVATAR_COLORS[idx % AVATAR_COLORS.length];
}
function initials(name = "") {
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] || "") + (parts[1]?.[0] || "")).toUpperCase() || "?";
}

const getToday = () => new Date().toISOString().slice(0, 10);

const STATS = [
  { key: "total", label: "Total reports", icon: DescriptionOutlined, color: "#6366F1" },
  { key: "urgent", label: "Urgent matters", icon: WarningAmberOutlined, color: "#EF4444" },
  { key: "active", label: "Active teachers", icon: GroupsOutlined, color: "#10B981" },
];

// Rows per page for the dashboard's own (compact) table.
const ROWS_PER_PAGE = 10;

function DetailRow({ label, value }) {
  return (
    <Box>
      <Typography variant="caption" sx={{ color: "text.secondary", fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.4 }}>
        {label}
      </Typography>
      <Typography variant="body2" sx={{ mt: 0.25 }}>{value || "—"}</Typography>
    </Box>
  );
}

function AdminDashboardInner() {
  const router = useRouter();

  const [reports, setReports] = useState([]);
  const [teachers, setTeachers] = useState([]);
  const [filterTeacher, setFilterTeacher] = useState("");
  const [selectedReport, setSelectedReport] = useState(null);
  const [loading, setLoading] = useState(true);

  // Date range filter — defaults to "all dates" so the dashboard still
  // shows a useful overview on first load, same as before.
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");

  // Backend-reported totals, independent of the current page — keeps the
  // stat cards accurate no matter how many rows are on screen.
  const [totalCount, setTotalCount] = useState(0);
  const [urgentCount, setUrgentCount] = useState(0);

  // Pagination
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  // Delete
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const buildParams = (overrides = {}) => {
    const teacher = overrides.teacher !== undefined ? overrides.teacher : filterTeacher;
    const from = overrides.from !== undefined ? overrides.from : fromDate;
    const to = overrides.to !== undefined ? overrides.to : toDate;
    const pageNum = overrides.page !== undefined ? overrides.page : page;

    const params = { page: pageNum, limit: ROWS_PER_PAGE };
    if (teacher) params.teacher = teacher;
    if (from) params.from = from;
    if (to) params.to = to;
    return params;
  };

  const loadReports = (overrides = {}) => {
    setLoading(true);

    const tableParams = buildParams(overrides);
    const totalParams = { ...tableParams, limit: 1, page: 1 };
    const urgentParams = { ...totalParams, urgent: "true" };

    Promise.all([
      api.get("/reports", { params: tableParams }),
      api.get("/reports", { params: totalParams }),
      api.get("/reports", { params: urgentParams }),
    ])
      .then(([tableRes, totalRes, urgentRes]) => {
        setReports(tableRes.data?.reports || []);
        setTotalPages(tableRes.data?.pagination?.totalPages || 1);
        setPage(tableRes.data?.pagination?.page || 1);
        setTotalCount(totalRes.data?.pagination?.total || 0);
        setUrgentCount(urgentRes.data?.pagination?.total || 0);
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadReports({ page: 1 });
    api.get("/users/teachers").then((res) => setTeachers(res.data));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const activeTeacherCount = useMemo(() => teachers.filter((t) => t.active).length, [teachers]);
  const statValues = { total: totalCount, urgent: urgentCount, active: activeTeacherCount };

  const handleTeacherChange = (value) => {
    setFilterTeacher(value);
    loadReports({ teacher: value, page: 1 });
  };

  const handleFromChange = (value) => {
    setFromDate(value);
    loadReports({ from: value, page: 1 });
  };

  const handleToChange = (value) => {
    setToDate(value);
    loadReports({ to: value, page: 1 });
  };

  const handleResetFilters = () => {
    setFilterTeacher("");
    setFromDate("");
    setToDate("");
    loadReports({ teacher: "", from: "", to: "", page: 1 });
  };

  const handlePageChange = (_e, value) => {
    loadReports({ page: value });
  };

  const handleDeleteConfirmed = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await api.delete(`/reports/${deleteTarget._id}`);
      setDeleteTarget(null);
      // Step back a page if we just deleted the last row on this page.
      const isLastItemOnPage = reports.length === 1 && page > 1;
      loadReports({ page: isLastItemOnPage ? page - 1 : page });
    } catch (err) {
      console.error("Failed to delete report:", err);
    } finally {
      setDeleting(false);
    }
  };

  return (
    <Box sx={{ bgcolor: "#F7F8FA", minHeight: "100vh" }}>
      <Navbar />
      <Container maxWidth="lg" sx={{ py: { xs: 2, sm: 3 } }}>
        <Stack
          direction={{ xs: "column", sm: "row" }}
          justifyContent="space-between"
          alignItems={{ xs: "stretch", sm: "center" }}
          spacing={1.5}
          sx={{ mb: 3 }}
        >
          <Box>
            <Typography variant="h5" fontWeight={700} gutterBottom>
              Superadmin dashboard
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Overview of daily duty reports across all centres.
            </Typography>
          </Box>
          <Button
            variant="outlined"
            endIcon={<ArrowForward fontSize="small" />}
            onClick={() => router.push("/admin/reports")}
            sx={{ textTransform: "none", fontWeight: 700, borderRadius: 2, alignSelf: { xs: "stretch", sm: "auto" } }}
          >
            All Reports
          </Button>
        </Stack>

        {/* Stat cards */}
        <Grid container spacing={{ xs: 1.5, sm: 2 }} sx={{ mb: { xs: 2.5, sm: 3 } }}>
          {STATS.map(({ key, label, icon: Icon, color }) => (
            <Grid item xs={4} sm={4} key={key}>
              <Card
                variant="outlined"
                sx={{
                  borderRadius: 3,
                  height: "100%",
                  border: "1px solid",
                  borderColor: "divider",
                  boxShadow: "none",
                }}
              >
                <CardContent sx={{ p: { xs: 1.25, sm: 2.5 }, "&:last-child": { pb: { xs: 1.25, sm: 2.5 } } }}>
                <Stack
  direction="row"
  spacing={{ xs: 1, sm: 1.5 }}
  alignItems="center"
  sx={{ width: "100%" }}
>
  {/* ICON */}
  <Box
    sx={{
      width: { xs: 36, sm: 46 },
      height: { xs: 36, sm: 46 },
      borderRadius: 2,
      bgcolor: `${color}1A`,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      flexShrink: 0,
    }}
  >
    <Icon
      sx={{
        color,
        fontSize: { xs: 18, sm: 24 },
      }}
    />
  </Box>

  {/* VALUE + LABEL */}
  <Box
    sx={{
      minWidth: 0,
      flex: 1,
    }}
  >
    <Typography
      fontWeight={800}
      sx={{
        fontSize: { xs: 20, sm: 28 },
        lineHeight: 1.1,
        color: "text.primary",
      }}
    >
      {loading ? (
        <Skeleton width={35} height={32} />
      ) : (
        statValues[key]
      )}
    </Typography>

    <Typography
      variant="caption"
      sx={{
        color: "text.secondary",
        fontWeight: 600,
        display: "block",
        mt: 0.25,
        fontSize: { xs: 10.5, sm: 13 },
        lineHeight: 1.2,
        overflow: "hidden",
        textOverflow: "ellipsis",
        whiteSpace: "nowrap",
      }}
    >
      {label}
    </Typography>
  </Box>
</Stack>
                </CardContent>
              </Card>
            </Grid>
          ))}
        </Grid>

        {/* Reports table */}
        <Paper variant="outlined" sx={{ p: { xs: 1.5, sm: 2.5 }, borderRadius: 3 }}>
          <Stack
            direction={{ xs: "column", sm: "row" }}
            justifyContent="space-between"
            alignItems={{ xs: "stretch", sm: "center" }}
            spacing={1.5}
            mb={2}
          >
            <Typography variant="h6" fontWeight={700}>Recent reports</Typography>
          </Stack>

          {/* FILTERS */}
          <Stack
            direction="row"
            spacing={1}
            sx={{ flexWrap: "wrap", gap: 1, mb: 2 }}
          >
            <TextField
              select
              size="small"
              label="Filter by teacher"
              value={filterTeacher}
              onChange={(e) => handleTeacherChange(e.target.value)}
              sx={{ minWidth: { xs: "100%", sm: 200 }, bgcolor: "white", flex: { xs: "1 1 100%", sm: "0 1 200px" } }}
            >
              <MenuItem value="">All teachers</MenuItem>
              {teachers.map((t) => <MenuItem key={t._id} value={t._id}>{t.name}</MenuItem>)}
            </TextField>

            <TextField
              label="From"
              type="date"
              size="small"
              value={fromDate}
              onChange={(e) => handleFromChange(e.target.value)}
              InputLabelProps={{ shrink: true }}
              inputProps={{ max: toDate || getToday() }}
              sx={{ bgcolor: "white", flex: { xs: "1 1 48%", sm: "0 1 160px" } }}
            />

            <TextField
              label="To"
              type="date"
              size="small"
              value={toDate}
              onChange={(e) => handleToChange(e.target.value)}
              InputLabelProps={{ shrink: true }}
              inputProps={{ min: fromDate || undefined, max: getToday() }}
              sx={{ bgcolor: "white", flex: { xs: "1 1 48%", sm: "0 1 160px" } }}
            />

            <Button
              size="small"
              startIcon={<FilterAltOff fontSize="small" />}
              onClick={handleResetFilters}
              color="inherit"
              disabled={!filterTeacher && !fromDate && !toDate}
              sx={{ textTransform: "none" }}
            >
              Reset filters
            </Button>
          </Stack>

          {loading ? (
            <Stack spacing={1}>
              {[...Array(4)].map((_, i) => <Skeleton key={i} variant="rounded" height={48} />)}
            </Stack>
          ) : (
            <TableContainer sx={{ overflowX: "auto" }}>
              <Table size="small">
                <TableHead>
                  <TableRow sx={{ "& th": { fontWeight: 700, bgcolor: "#FAFAFB", whiteSpace: "nowrap" } }}>
                    <TableCell>Date</TableCell>
                    <TableCell>Teacher</TableCell>
                    <TableCell>Centre Name</TableCell>
                    <TableCell>Urgent</TableCell>
                    <TableCell align="right">Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {reports.map((r) => (
                    <TableRow key={r._id} hover sx={{ cursor: "pointer" }} onClick={() => setSelectedReport(r)}>
                      <TableCell sx={{ whiteSpace: "nowrap" }}>{r.date}</TableCell>
                      <TableCell>
                        <Stack direction="row" spacing={1} alignItems="center">
                          <Avatar sx={{ width: 26, height: 26, fontSize: 11, bgcolor: colorForName(r.teacher?.name) }}>
                            {initials(r.teacher?.name)}
                          </Avatar>
                          <Typography variant="body2" noWrap>{r.teacher?.name}</Typography>
                        </Stack>
                      </TableCell>
                      <TableCell>{r.centreBatch || "—"}</TableCell>
                      <TableCell>
                        {r.urgentMatters
                          ? <Chip size="small" color="error" label="Yes" sx={{ fontWeight: 600 }} />
                          : <Chip size="small" label="No" sx={{ fontWeight: 600 }} />}
                      </TableCell>
                      <TableCell align="right" onClick={(e) => e.stopPropagation()}>
                        <Tooltip title="Delete">
                          <IconButton
                            size="small"
                            onClick={() => setDeleteTarget(r)}
                            sx={{ color: "#dc2626" }}
                          >
                            <DeleteOutline fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      </TableCell>
                    </TableRow>
                  ))}
                  {reports.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={5} align="center" sx={{ py: 5, color: "text.secondary" }}>
                        No reports found.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </TableContainer>
          )}

          {/* PAGINATION */}
          {!loading && reports.length > 0 && (
            <Stack
              direction="row"
              justifyContent="space-between"
              alignItems="center"
              flexWrap="wrap"
              gap={1}
              sx={{ mt: 2, pt: 1.5, borderTop: "1px solid", borderColor: "divider" }}
            >
              <Typography variant="caption" color="text.secondary">
                Page {page} of {totalPages} ({totalCount} total)
              </Typography>
              <Pagination
                count={totalPages}
                page={page}
                onChange={handlePageChange}
                size="small"
                shape="rounded"
              />
            </Stack>
          )}
        </Paper>
      </Container>

      {/* Report detail dialog */}
      <Dialog
        open={!!selectedReport}
        onClose={() => setSelectedReport(null)}
        maxWidth="sm"
        fullWidth
        fullScreen={typeof window !== "undefined" && window.innerWidth < 600}
      >
        <DialogTitle sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", pb: 1.5 }}>
          <Stack direction="row" spacing={1.5} alignItems="center">
            <CalendarMonthOutlined fontSize="small" sx={{ color: "text.secondary" }} />
            <Typography fontWeight={700}>Report — {selectedReport?.date}</Typography>
          </Stack>
          <IconButton onClick={() => setSelectedReport(null)} size="small"><Close /></IconButton>
        </DialogTitle>
        <DialogContent dividers>
          {selectedReport && (
            <Stack spacing={2}>
              <Stack direction="row" spacing={1.5} alignItems="center">
                <Avatar sx={{ bgcolor: colorForName(selectedReport.teacher?.name) }}>
                  {initials(selectedReport.teacher?.name)}
                </Avatar>
                <Box>
                  <Typography fontWeight={700}>{selectedReport.teacher?.name}</Typography>
                  <Typography variant="body2" color="text.secondary">{selectedReport.teacher?.email}</Typography>
                </Box>
              </Stack>

              <Divider />

              <Grid container spacing={2}>
                <Grid item xs={6}>
                  <DetailRow label="Duty officer" value={selectedReport.dutyOfficerName} />
                </Grid>
                <Grid item xs={6}>
                  <DetailRow label="Centre Name" value={selectedReport.centreBatch} />
                </Grid>
                <Grid item xs={6}>
                  <DetailRow label="Signature" value={selectedReport.signature} />
                </Grid>
              </Grid>

              <Divider />

              <DetailRow label="Positive observations" value={selectedReport.positiveObservations} />
              <DetailRow label="Hygiene lapses" value={selectedReport.hygieneLapses} />
              <DetailRow label="Maintenance follow-up" value={selectedReport.maintenanceFollowUp} />

              <Box
                sx={{
                  p: 1.5,
                  borderRadius: 2,
                  bgcolor: selectedReport.urgentMatters ? "#FEF2F2" : "#F7F8FA",
                  border: "1px solid",
                  borderColor: selectedReport.urgentMatters ? "#FCA5A5" : "divider",
                }}
              >
                <DetailRow label="Urgent matters" value={selectedReport.urgentMatters} />
              </Box>

              <DetailRow label="Countersigned by" value={selectedReport.countersignedBy} />
            </Stack>
          )}
        </DialogContent>
      </Dialog>

      {/* Delete confirm dialog */}
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
            <Typography fontWeight={800}>Delete this report?</Typography>
            <Typography variant="body2" color="text.secondary">
              {deleteTarget?.date} — {deleteTarget?.teacher?.name || "Unknown teacher"}. This action cannot be undone.
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

export default function AdminDashboardPage() {
  return (
    <ProtectedRoute role="superadmin">
      <AdminDashboardInner />
    </ProtectedRoute>
  );
}
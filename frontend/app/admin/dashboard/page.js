"use client";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Box, Container, Typography, Paper, Grid, Card, Table, TableHead, 
  TableRow, TableCell, TableBody, TableContainer, TextField, MenuItem, 
  Chip, Dialog, DialogTitle, DialogContent, DialogActions, IconButton,
  Stack, Avatar, Skeleton, Divider, Button, Pagination, CircularProgress, 
  Tooltip, InputAdornment, Zoom
} from "@mui/material";
import {
  Close, DescriptionOutlined, WarningAmberOutlined, GroupsOutlined,
  CalendarMonthOutlined, DeleteOutline, ArrowForward, FilterAltOff,
  Search, Apartment, HistoryEdu, Person
} from "@mui/icons-material";
import ProtectedRoute from "../../../components/ProtectedRoute";
import Navbar from "../../../components/Navbar";
import api from "../../../lib/api";

// --- Theme Constants ---
const COLORS = {
  bg: "#0B0E14",
  surface: "#151921",
  primary: "#A855F7", 
  primaryDark: "#7E22CE",
  secondary: "#3B82F6",
  error: "#EF4444",
  textMain: "#F8FAFC",
  textMuted: "#94A3B8",
  border: "rgba(168, 85, 247, 0.15)",
};

const AVATAR_COLORS = ["#8B5CF6", "#3B82F6", "#10B981", "#F59E0B", "#EF4444"];
function colorForName(name = "") {
  const idx = [...name].reduce((sum, ch) => sum + ch.charCodeAt(0), 0);
  return AVATAR_COLORS[idx % AVATAR_COLORS.length];
}
function initials(name = "") {
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] || "") + (parts[1]?.[0] || "")).toUpperCase() || "?";
}

const STATS = [
  { key: "total", label: "Total Reports", icon: DescriptionOutlined, color: COLORS.primary },
  { key: "urgent", label: "Urgent Matters", icon: WarningAmberOutlined, color: COLORS.error },
  { key: "active", label: "Active Teachers", icon: GroupsOutlined, color: COLORS.secondary },
];

const ROWS_PER_PAGE = 10;

// --- Styled Components ---
const StatCard = ({ label, value, icon: Icon, color, loading }) => (
  <Card sx={{ 
    bgcolor: COLORS.surface, borderRadius: 4, border: `1px solid ${COLORS.border}`,
    position: 'relative', overflow: 'hidden', transition: 'transform 0.2s',
    '&:hover': { transform: 'translateY(-4px)', borderColor: color }
  }}>
    <Box sx={{ p: 3 }}>
      <Stack direction="row" spacing={2.5} alignItems="center">
        <Box sx={{ p: 1.5, borderRadius: 3, bgcolor: `${color}15`, border: `1px solid ${color}30` }}>
          <Icon sx={{ color: color, fontSize: 32 }} />
        </Box>
        <Box>
          <Typography variant="h4" sx={{ color: COLORS.textMain, fontWeight: 800 }}>
            {loading ? <Skeleton width={50} sx={{ bgcolor: 'rgba(255,255,255,0.1)' }} /> : value}
          </Typography>
          <Typography variant="caption" sx={{ color: COLORS.textMuted, fontWeight: 600, textTransform: 'uppercase' }}>
            {label}
          </Typography>
        </Box>
      </Stack>
    </Box>
  </Card>
);

const StyledTableCell = (props) => (
  <TableCell {...props} sx={{ color: COLORS.textMain, borderColor: COLORS.border, py: 2, ...props.sx }} />
);

function AdminDashboardInner() {
  const router = useRouter();
  
  // States
  const [reports, setReports] = useState([]);
  const [teachers, setTeachers] = useState([]);
  const [filterTeacher, setFilterTeacher] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [selectedReport, setSelectedReport] = useState(null);
  const [loading, setLoading] = useState(true);
  const [totalCount, setTotalCount] = useState(0);
  const [urgentCount, setUrgentCount] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);

  // Load Data
  const loadReports = (overrides = {}) => {
    setLoading(true);
    const teacher = overrides.teacher !== undefined ? overrides.teacher : filterTeacher;
    const from = overrides.from !== undefined ? overrides.from : fromDate;
    const to = overrides.to !== undefined ? overrides.to : toDate;
    const pageNum = overrides.page !== undefined ? overrides.page : page;

    const params = { page: pageNum, limit: ROWS_PER_PAGE, teacher, from, to };

    Promise.all([
      api.get("/reports", { params }),
      api.get("/reports", { params: { limit: 1 } }), // Total stats
      api.get("/reports", { params: { limit: 1, urgent: "true" } }), // Urgent stats
    ])
      .then(([tableRes, totalRes, urgentRes]) => {
        setReports(tableRes.data?.reports || []);
        setTotalPages(tableRes.data?.pagination?.totalPages || 1);
        setPage(tableRes.data?.pagination?.page || 1);
        setTotalCount(totalRes.data?.pagination?.total || 0);
        setUrgentCount(urgentRes.data?.pagination?.total || 0);
      })
      .catch(err => console.error("Error loading reports:", err))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadReports({ page: 1 });
    api.get("/users/teachers").then((res) => setTeachers(res.data));
  }, []);

  // --- Logic Functions ---

  const handleDeleteConfirmed = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await api.delete(`/reports/${deleteTarget._id}`);
      setDeleteTarget(null);
      // If we delete the last item on a page, go back one page
      const nextPage = reports.length === 1 && page > 1 ? page - 1 : page;
      loadReports({ page: nextPage });
    } catch (err) {
      console.error("Failed to delete report:", err);
      alert("Error deleting report. Please try again.");
    } finally {
      setDeleting(false);
    }
  };

  const handleResetFilters = () => {
    setFilterTeacher("");
    setFromDate("");
    setToDate("");
    loadReports({ teacher: "", from: "", to: "", page: 1 });
  };

  const activeTeacherCount = useMemo(() => teachers.filter((t) => t.active).length, [teachers]);
  const statValues = { total: totalCount, urgent: urgentCount, active: activeTeacherCount };

  return (
    <Box sx={{ bgcolor: COLORS.bg, minHeight: "100vh", pb: 6 }}>
      <Navbar />
      
      {/* Header */}
      <Box sx={{ borderBottom: `1px solid ${COLORS.border}`, bgcolor: COLORS.surface, py: 4 }}>
        <Container maxWidth="lg">
          <Stack direction={{ xs: "column", sm: "row" }} justifyContent="space-between" alignItems="center" spacing={2}>
            <Box>
              <Typography variant="h4" sx={{ fontWeight: 900, color: COLORS.textMain }}>
                Superadmin <span style={{ color: COLORS.primary }}>Dashboard</span>
              </Typography>
              <Typography variant="body2" sx={{ color: COLORS.textMuted }}>Overview of all centre activities.</Typography>
            </Box>
            <Button
              variant="contained"
              onClick={() => router.push("/admin/reports")}
              endIcon={<ArrowForward />}
              sx={{ bgcolor: COLORS.primary, borderRadius: 3, px: 3, fontWeight: 700, textTransform: 'none', "&:hover": { bgcolor: COLORS.primaryDark } }}
            >
              History
            </Button>
          </Stack>
        </Container>
      </Box>

      <Container maxWidth="lg" sx={{ mt: -4 }}>
        {/* Stats */}
        <Grid container spacing={3} sx={{ mb: 4 }}>
          {STATS.map((s) => (
            <Grid item xs={12} sm={4} key={s.key}>
              <StatCard {...s} value={statValues[s.key]} loading={loading} />
            </Grid>
          ))}
        </Grid>

        {/* Table Paper */}
        <Paper elevation={0} sx={{ bgcolor: COLORS.surface, borderRadius: 5, border: `1px solid ${COLORS.border}`, overflow: 'hidden' }}>
          
          {/* Filters */}
          <Box sx={{ p: 3, borderBottom: `1px solid ${COLORS.border}` }}>
            <Grid container spacing={2} alignItems="center">
              <Grid item xs={12} md={4}>
                <TextField
                  select fullWidth size="small" label="Teacher" value={filterTeacher}
                  onChange={(e) => { setFilterTeacher(e.target.value); loadReports({ teacher: e.target.value, page: 1 }); }}
                  InputProps={{ startAdornment: <InputAdornment position="start"><Search sx={{ color: COLORS.primary }} /></InputAdornment> }}
                  sx={filterStyles}
                >
                  <MenuItem value="">All Teachers</MenuItem>
                  {teachers.map((t) => <MenuItem key={t._id} value={t._id}>{t.name}</MenuItem>)}
                </TextField>
              </Grid>
              <Grid item xs={6} md={3}>
                <TextField type="date" fullWidth size="small" label="From" value={fromDate} onChange={(e) => { setFromDate(e.target.value); loadReports({ from: e.target.value, page: 1 }); }} InputLabelProps={{ shrink: true }} sx={filterStyles} />
              </Grid>
              <Grid item xs={6} md={3}>
                <TextField type="date" fullWidth size="small" label="To" value={toDate} onChange={(e) => { setToDate(e.target.value); loadReports({ to: e.target.value, page: 1 }); }} InputLabelProps={{ shrink: true }} sx={filterStyles} />
              </Grid>
              <Grid item xs={12} md={2}>
                <Button fullWidth onClick={handleResetFilters} sx={{ color: COLORS.textMuted, textTransform: 'none' }}>Clear</Button>
              </Grid>
            </Grid>
          </Box>

          {/* Table */}
          <TableContainer>
            <Table>
              <TableHead sx={{ bgcolor: 'rgba(255,255,255,0.02)' }}>
                <TableRow>
                  <StyledTableCell>DATE</StyledTableCell>
                  <StyledTableCell>TEACHER</StyledTableCell>
                  <StyledTableCell>CENTRE</StyledTableCell>
                  <StyledTableCell>STATUS</StyledTableCell>
                  <StyledTableCell align="right">ACTION</StyledTableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {loading ? (
                   [...Array(5)].map((_, i) => <TableRow key={i}><StyledTableCell colSpan={5}><Skeleton sx={{ bgcolor: 'rgba(255,255,255,0.05)' }} /></StyledTableCell></TableRow>)
                ) : reports.map((r) => (
                  <TableRow key={r._id} hover onClick={() => setSelectedReport(r)} sx={{ cursor: 'pointer', '&:hover': { bgcolor: 'rgba(255,255,255,0.02)' } }}>
                    <StyledTableCell>{r.date}</StyledTableCell>
                    <StyledTableCell>
                      <Stack direction="row" spacing={1} alignItems="center">
                        <Avatar sx={{ width: 28, height: 28, fontSize: 10, bgcolor: colorForName(r.teacher?.name) }}>{initials(r.teacher?.name)}</Avatar>
                        <Typography variant="body2" sx={{ fontWeight: 600 }}>{r.teacher?.name}</Typography>
                      </Stack>
                    </StyledTableCell>
                    <StyledTableCell>{r.centreBatch}</StyledTableCell>
                    <StyledTableCell>
                      {r.urgentMatters ? (
                        <Chip label="Urgent" size="small" sx={{ bgcolor: `${COLORS.error}20`, color: COLORS.error, fontWeight: 700 }} />
                      ) : (
                        <Chip label="Normal" size="small" sx={{ color: COLORS.textMuted, border: `1px solid ${COLORS.border}` }} />
                      )}
                    </StyledTableCell>
                    <StyledTableCell align="right" onClick={(e) => e.stopPropagation()}>
                      <IconButton size="small" onClick={() => setDeleteTarget(r)} sx={{ color: COLORS.textMuted, "&:hover": { color: COLORS.error } }}>
                        <DeleteOutline fontSize="small" />
                      </IconButton>
                    </StyledTableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>

          {/* Pagination */}
          <Box sx={{ p: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Typography variant="caption" sx={{ color: COLORS.textMuted }}>Total: {totalCount}</Typography>
            <Pagination count={totalPages} page={page} onChange={(_e, v) => loadReports({ page: v })} sx={paginationStyles} />
          </Box>
        </Paper>
      </Container>

      {/* Delete Confirmation Dialog */}
      <Dialog open={!!deleteTarget} onClose={() => !deleting && setDeleteTarget(null)} PaperProps={{ sx: { bgcolor: COLORS.surface, borderRadius: 4, border: `1px solid ${COLORS.border}` } }}>
        <DialogContent sx={{ textAlign: 'center', pt: 4 }}>
          <Avatar sx={{ bgcolor: `${COLORS.error}20`, color: COLORS.error, width: 60, height: 60, mx: 'auto', mb: 2 }}>
            <DeleteOutline fontSize="large" />
          </Avatar>
          <Typography variant="h6" sx={{ color: COLORS.textMain, fontWeight: 800 }}>Confirm Deletion</Typography>
          <Typography variant="body2" sx={{ color: COLORS.textMuted, mt: 1 }}>This report will be permanently removed.</Typography>
        </DialogContent>
        <DialogActions sx={{ p: 3, gap: 1 }}>
          <Button onClick={() => setDeleteTarget(null)} disabled={deleting} sx={{ color: COLORS.textMuted }}>Cancel</Button>
          <Button onClick={handleDeleteConfirmed} variant="contained" color="error" disabled={deleting} sx={{ borderRadius: 2, fontWeight: 700 }}>
            {deleting ? <CircularProgress size={20} /> : "Delete"}
          </Button>
        </DialogActions>
      </Dialog>
      
      {/* Detail View (Simplified for Demo) */}
      <Dialog open={!!selectedReport} onClose={() => setSelectedReport(null)} maxWidth="sm" fullWidth PaperProps={{ sx: { bgcolor: COLORS.surface, borderRadius: 4, color: COLORS.textMain } }}>
         <DialogTitle sx={{ display: 'flex', justifyContent: 'space-between' }}>
            Report Details <IconButton onClick={() => setSelectedReport(null)} sx={{ color: COLORS.textMuted }}><Close /></IconButton>
         </DialogTitle>
         <DialogContent dividers sx={{ borderColor: COLORS.border }}>
            {selectedReport && (
              <Stack spacing={2}>
                 <Typography variant="subtitle2" color={COLORS.primary}>Teacher: {selectedReport.teacher?.name}</Typography>
                 <Typography variant="body2">Observations: {selectedReport.positiveObservations || "None"}</Typography>
                 <Typography variant="body2">Hygiene: {selectedReport.hygieneLapses || "None"}</Typography>
                 {selectedReport.urgentMatters && <Box sx={{ p: 1.5, bgcolor: 'rgba(239, 68, 68, 0.1)', borderRadius: 2, color: COLORS.error }}>Urgent: {selectedReport.urgentMatters}</Box>}
              </Stack>
            )}
         </DialogContent>
      </Dialog>
    </Box>
  );
}

// --- Specific Styles ---
const filterStyles = {
  '& .MuiOutlinedInput-root': {
    color: COLORS.textMain,
    '& fieldset': { borderColor: COLORS.border },
    '&:hover fieldset': { borderColor: COLORS.primary },
    borderRadius: 2.5,
    bgcolor: 'rgba(0,0,0,0.2)'
  },
  '& .MuiInputLabel-root': { color: COLORS.textMuted },
};

const paginationStyles = {
  '& .MuiPaginationItem-root': { color: COLORS.textMuted },
  '& .Mui-selected': { bgcolor: `${COLORS.primary}40 !important`, color: COLORS.primary }
};

export default function AdminDashboardPage() {
  return (
    <ProtectedRoute role="superadmin">
      <AdminDashboardInner />
    </ProtectedRoute>
  );
}
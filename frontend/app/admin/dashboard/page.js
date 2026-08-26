"use client";
import { useEffect, useMemo, useState } from "react";
import {
  Box, Container, Typography, Paper, Grid, Card, CardContent,
  Table, TableHead, TableRow, TableCell, TableBody, TableContainer,
  TextField, MenuItem, Chip, Dialog, DialogTitle, DialogContent, IconButton,
  Stack, Avatar, Skeleton, Divider,
} from "@mui/material";
import {
  Close, DescriptionOutlined, WarningAmberOutlined, GroupsOutlined,
  CalendarMonthOutlined, PersonOutline,
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

const STATS = [
  { key: "total", label: "Total reports", icon: DescriptionOutlined, color: "#6366F1" },
  { key: "urgent", label: "Urgent matters", icon: WarningAmberOutlined, color: "#EF4444" },
  { key: "active", label: "Active teachers", icon: GroupsOutlined, color: "#10B981" },
];

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
  const [reports, setReports] = useState([]);
  const [teachers, setTeachers] = useState([]);
  const [filterTeacher, setFilterTeacher] = useState("");
  const [selectedReport, setSelectedReport] = useState(null);
  const [loading, setLoading] = useState(true);

  const loadReports = (teacherId) => {
    setLoading(true);
    const params = teacherId ? { teacher: teacherId } : {};
    api.get("/reports", { params }).then((res) => setReports(res.data)).finally(() => setLoading(false));
  };

  useEffect(() => {
    loadReports();
    api.get("/users/teachers").then((res) => setTeachers(res.data));
  }, []);

  const urgentCount = useMemo(() => reports.filter((r) => r.urgentMatters?.trim()).length, [reports]);
  const activeTeacherCount = useMemo(() => teachers.filter((t) => t.active).length, [teachers]);

  const statValues = { total: reports.length, urgent: urgentCount, active: activeTeacherCount };

  return (
    <Box sx={{ bgcolor: "#F7F8FA", minHeight: "100vh" }}>
      <Navbar />
      <Container maxWidth="lg" sx={{ py: { xs: 2, sm: 3 } }}>
        <Typography variant="h5" fontWeight={700} gutterBottom>
          Superadmin dashboard
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
          Overview of daily duty reports across all centres.
        </Typography>

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
            <Typography variant="h6" fontWeight={700}>All reports</Typography>
            <TextField
              select
              size="small"
              label="Filter by teacher"
              value={filterTeacher}
              onChange={(e) => { setFilterTeacher(e.target.value); loadReports(e.target.value); }}
              sx={{ minWidth: { xs: "100%", sm: 220 }, bgcolor: "white" }}
            >
              <MenuItem value="">All teachers</MenuItem>
              {teachers.map((t) => <MenuItem key={t._id} value={t._id}>{t.name}</MenuItem>)}
            </TextField>
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
                    <TableCell>Centre/Batch</TableCell>
                    <TableCell>Shift</TableCell>
                    <TableCell>Urgent</TableCell>
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
                      <TableCell>{r.shiftTiming || "—"}</TableCell>
                      <TableCell>
                        {r.urgentMatters
                          ? <Chip size="small" color="error" label="Yes" sx={{ fontWeight: 600 }} />
                          : <Chip size="small" label="No" sx={{ fontWeight: 600 }} />}
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
                  <DetailRow label="Shift" value={selectedReport.shiftTiming} />
                </Grid>
                <Grid item xs={6}>
                  <DetailRow label="Centre/Batch" value={selectedReport.centreBatch} />
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
"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Alert, Box, Button, Chip, CircularProgress, Divider, Paper,
  Stack, TextField, Typography,
} from "@mui/material";
import { CalendarMonth, Description, Visibility, FilterAltOff, Assessment } from "@mui/icons-material";
import ProtectedRoute from "../../../../components/ProtectedRoute";
import Navbar from "../../../../components/Navbar";
import api from "../../../../lib/api";

const todayIST = () => {
  const now = new Date();
  return new Date(now.getTime() + 5.5 * 60 * 60 * 1000).toISOString().slice(0, 10);
};

const getSections = (report) => {
  if (Array.isArray(report?.sections) && report.sections.length) return report.sections;
  const meta = report?.sectionMeta || {};
  const base = ["morningChecks", "middayChecks", "afternoonChecks"].map((key) => ({
    key,
    title: meta?.[key]?.title || key,
    timing: meta?.[key]?.timing || "",
    items: Array.isArray(report?.[key]) ? report[key] : [],
  }));
  return [...base, ...(report?.customSections || [])];
};

function ReportsPageInner() {
  const router = useRouter();
  const [reports, setReports] = useState([]);
  const [dynamicEntries, setDynamicEntries] = useState([]);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = async (nextFrom = from, nextTo = to) => {
    try {
      setLoading(true); setError("");
      const params = {};
      if (nextFrom) params.from = nextFrom;
      if (nextTo) params.to = nextTo;
      const [regularRes, dynamicRes] = await Promise.all([
        api.get("/reports/mine", { params }),
        api.get("/dynamic-reports/mine").catch(() => ({ data: { entries: [] } })),
      ]);
      setReports(regularRes?.data?.reports || regularRes?.data || []);
      setDynamicEntries(dynamicRes?.data?.entries || []);
    } catch (err) {
      setError(err?.response?.data?.message || "Could not load your reports.");
    } finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const adminRemarkCount = useMemo(() => reports.reduce((sum, report) => sum + getSections(report).reduce((n, section) => n + (section.items || []).filter((item) => item.adminRemark).length, 0), 0), [reports]);

  const combinedList = useMemo(() => {
    const regular = reports.map((r) => ({ type: "regular", date: r.date, data: r }));
    const dynamic = dynamicEntries
      .filter((e) => (!from || e.date >= from) && (!to || e.date <= to))
      .map((e) => ({ type: "dynamic", date: e.date, data: e }));
    return [...regular, ...dynamic].sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
  }, [reports, dynamicEntries, from, to]);

  const reset = () => { setFrom(""); setTo(""); load("", ""); };

  return (
    <Box>
      <Navbar />
      <Box sx={{ maxWidth: 1050, mx: "auto", p: { xs: 1.25, sm: 3 }, pb: 4 }}>
        <Stack spacing={2}>
          <Paper elevation={0} sx={{ p: { xs: 2, sm: 2.6 }, border: "1px solid #e2e8f0", borderRadius: 3 }}>
            <Stack direction={{ xs: "column", sm: "row" }} justifyContent="space-between" gap={1.5}>
              <Box>
                <Stack direction="row" spacing={1} alignItems="center"><Description sx={{ color: "#7e22ce" }} /><Typography fontWeight={800} fontSize="1.25rem">My Daily Reports</Typography></Stack>
                <Typography variant="body2" color="text.secondary" mt={0.5}>Date-wise submitted reports, including admin remarks and follow-up.</Typography>
              </Box>
              <Chip icon={<CalendarMonth />} label={`${combinedList.length} report${combinedList.length === 1 ? "" : "s"}`} />
            </Stack>
          </Paper>

          <Paper elevation={0} sx={{ p: { xs: 1.4, sm: 1.8 }, border: "1px solid #e2e8f0", borderRadius: 2.5 }}>
            <Stack direction={{ xs: "column", sm: "row" }} spacing={1} alignItems={{ sm: "center" }}>
              <TextField fullWidth size="small" label="From date" type="date" value={from} onChange={(e) => setFrom(e.target.value)} InputLabelProps={{ shrink: true }} inputProps={{ max: to || todayIST() }} />
              <TextField fullWidth size="small" label="To date" type="date" value={to} onChange={(e) => setTo(e.target.value)} InputLabelProps={{ shrink: true }} inputProps={{ min: from || undefined, max: todayIST() }} />
              <Button variant="contained" onClick={() => load()} sx={{ minWidth: 100, textTransform: "none" }}>Apply</Button>
              <Button startIcon={<FilterAltOff />} onClick={reset} sx={{ textTransform: "none" }}>Reset</Button>
            </Stack>
          </Paper>

          {adminRemarkCount > 0 && <Alert severity="info">You have <b>{adminRemarkCount}</b> admin remark{adminRemarkCount === 1 ? "" : "s"} across your daily reports. Open a report to read the complete remarks.</Alert>}
          {error && <Alert severity="error">{error}</Alert>}

          {loading ? <Box sx={{ display: "flex", justifyContent: "center", py: 6 }}><CircularProgress /></Box> : combinedList.length === 0 ? (
            <Paper elevation={0} sx={{ p: 5, textAlign: "center", border: "1px dashed #cbd5e1", borderRadius: 3 }}>
              <Description sx={{ fontSize: 42, color: "#94a3b8" }} /><Typography fontWeight={800} mt={1}>No reports found</Typography><Typography variant="body2" color="text.secondary">Try another date range.</Typography>
            </Paper>
          ) : (
            <Stack spacing={1.2}>
              {combinedList.map((item) => {
                if (item.type === "dynamic") {
                  const entry = item.data;
                  return (
                    <Paper key={`dyn-${entry._id}`} elevation={0} sx={{ p: { xs: 1.5, sm: 2 }, border: "1px solid #e9d8fd", borderRadius: 2.5, bgcolor: "#faf5ff" }}>
                      <Stack direction={{ xs: "column", sm: "row" }} justifyContent="space-between" alignItems={{ sm: "center" }} gap={1.3}>
                        <Box sx={{ minWidth: 0 }}>
                          <Stack direction="row" spacing={0.8} alignItems="center">
                            <Typography fontWeight={800}>{entry.date}</Typography>
                            <Chip size="small" icon={<Assessment sx={{ fontSize: "14px !important" }} />} label="Dynamic Report" sx={{ bgcolor: "#ede9fe", color: "#6d28d9", fontWeight: 700 }} />
                          </Stack>
                          <Typography variant="body2" color="text.secondary" noWrap>
                            {entry.report?.title || "Report"}
                          </Typography>
                        </Box>
                        <Button
                          variant="outlined"
                          startIcon={<Visibility />}
                          onClick={() => entry.report?._id && router.push(`/reports/${entry.report._id}`)}
                          disabled={!entry.report?._id}
                          sx={{ textTransform: "none", flexShrink: 0 }}
                        >
                          View Report
                        </Button>
                      </Stack>
                    </Paper>
                  );
                }

                const report = item.data;
                const sections = getSections(report);
                const items = sections.flatMap((s) => s.items || []);
                const completed = items.filter((i) => i.checked).length;
                const adminRemarks = items.filter((i) => i.adminRemark).length;
                const open = items.filter((i) => i.status !== "resolved").length;
                return (
                  <Paper key={report._id} elevation={0} sx={{ p: { xs: 1.5, sm: 2 }, border: "1px solid #e2e8f0", borderRadius: 2.5 }}>
                    <Stack direction={{ xs: "column", sm: "row" }} justifyContent="space-between" alignItems={{ sm: "center" }} gap={1.3}>
                      <Box sx={{ minWidth: 0 }}>
                        <Typography fontWeight={800}>{report.date}</Typography>
                        <Typography variant="body2" color="text.secondary" noWrap>{report.centreBatch || "Centre / batch not specified"}{report.shiftTiming ? ` • ${report.shiftTiming}` : ""}</Typography>
                        <Divider sx={{ my: 1 }} />
                        <Stack direction="row" spacing={0.7} flexWrap="wrap" useFlexGap>
                          <Chip size="small" label={`${completed}/${items.length} completed`} />
                          <Chip size="small" label={`${open} open`} color={open ? "warning" : "success"} variant="outlined" />
                          {adminRemarks > 0 && <Chip size="small" label={`${adminRemarks} admin remark${adminRemarks === 1 ? "" : "s"}`} color="secondary" />}
                        </Stack>
                      </Box>
                      <Button variant="outlined" startIcon={<Visibility />} onClick={() => router.push(`/teacher/report/${report._id}`)} sx={{ textTransform: "none", flexShrink: 0 }}>View Report</Button>
                    </Stack>
                  </Paper>
                );
              })}
            </Stack>
          )}
        </Stack>
      </Box>
    </Box>
  );
}

export default function TeacherReportsPage() {
  return <ProtectedRoute role="teacher"><ReportsPageInner /></ProtectedRoute>;
}
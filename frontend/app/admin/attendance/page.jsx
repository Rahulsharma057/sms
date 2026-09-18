"use client";
import { useEffect, useState } from "react";
import {
  Box, Container, Typography, Paper, Table, TableHead, TableRow, TableCell,
  TableBody, TableContainer, TextField, MenuItem, Button, Stack, Chip, Tabs, Tab,
} from "@mui/material";
import { GetApp, PictureAsPdf, Male, Female } from "@mui/icons-material";
import ProtectedRoute from "../../../components/ProtectedRoute";
import Navbar from "../../../components/Navbar";
import api from "../../../lib/api";

const getToday = () => new Date().toISOString().slice(0, 10);

function AdminAttendanceInner() {
  const [tab, setTab] = useState(0); // 0 = Range view, 1 = Daily Sheet

  // ---- range view ----
  const [records, setRecords] = useState([]);
  const [batches, setBatches] = useState([]);
  const [batchFilter, setBatchFilter] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  // ---- daily sheet ----
  const [sheetDate, setSheetDate] = useState(getToday());
  const [sheetRows, setSheetRows] = useState([]);
  const [sheetLoading, setSheetLoading] = useState(false);

  const loadRecords = () => {
    const params = {};
    if (batchFilter) params.batch = batchFilter;
    if (from) params.from = from;
    if (to) params.to = to;
    api.get("/attendance", { params }).then((res) => setRecords(res.data));
  };

  const loadSheet = () => {
    setSheetLoading(true);
    api.get("/attendance/daily-sheet", { params: { date: sheetDate } })
      .then((res) => setSheetRows(res.data.rows))
      .finally(() => setSheetLoading(false));
  };

  useEffect(() => {
    api.get("/batches").then((res) => setBatches(res.data));
    loadRecords();
    loadSheet();
  }, []);

  // ---- exports ----

  const exportRangeExcel = async () => {
    const XLSX = await import("xlsx");
    const rows = records.map((r) => ({
      Date: r.date, Course: r.batch?.course?.name, Batch: r.batch?.batchName,
      Sanctioned: r.batch?.sanctionedSeats, Registered: r.batch?.registeredCount,
      "Boys Present": r.boysPresent, "Girls Present": r.girlsPresent,
      "Total Present": r.totalPresent, "Attendance %": `${r.percentage}%`,
      Remarks: r.remarks || "", "Marked By": r.markedBy?.name,
    }));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows), "Attendance");
    XLSX.writeFile(wb, `attendance-${Date.now()}.xlsx`);
  };

  const exportSheetExcel = async () => {
    const XLSX = await import("xlsx");
    const rows = sheetRows.map((r) => ({
      "S.No.": r.sNo, Faculty: r.faculty, Course: r.course, Batch: r.batch,
      Sanctioned: r.sanctioned, Registered: r.registered,
      "Boys Present": r.boysPresent ?? "-", "Girls Present": r.girlsPresent ?? "-",
      "Total Present": r.totalPresent ?? "-",
      "%": r.percentage !== null ? `${r.percentage}%` : "-",
      Remarks: r.remarks || (r.marked ? "" : "Not marked"),
    }));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows), `Sheet-${sheetDate}`);
    XLSX.writeFile(wb, `attendance-daily-sheet-${sheetDate}.xlsx`);
  };

  const exportSheetPdf = async () => {
    const { default: jsPDF } = await import("jspdf");
    const doc = new jsPDF({ orientation: "landscape" });
    doc.setFontSize(13);
    doc.text(`Attendance Daily Sheet — ${sheetDate}`, 12, 12);
    doc.setFontSize(8);
    let y = 20;
    sheetRows.forEach((r) => {
      if (y > 195) { doc.addPage(); y = 15; }
      doc.text(
        `${r.sNo}. ${r.faculty} | ${r.course}-${r.batch} | Sanct:${r.sanctioned} Reg:${r.registered} | B:${r.boysPresent ?? "-"} G:${r.girlsPresent ?? "-"} | ${r.percentage !== null ? r.percentage + "%" : "-"} | ${r.remarks || (r.marked ? "" : "Not marked")}`,
        12, y
      );
      y += 5;
    });
    doc.save(`attendance-daily-sheet-${sheetDate}.pdf`);
  };

  return (
    <Box sx={{ bgcolor: "#faf9fb", minHeight: "100vh" }}>
      <Navbar />
      <Container maxWidth="lg" sx={{ py: 3 }}>
        <Typography variant="h5" fontWeight={800} mb={2}>Attendance</Typography>

        <Paper elevation={0} sx={{ border: "1px solid #e2e8f0", borderRadius: 2.5, overflow: "hidden" }}>
          <Tabs
            value={tab} onChange={(e, v) => setTab(v)}
            sx={{ borderBottom: "1px solid #e2e8f0", "& .Mui-selected": { color: "#7e22ce !important" }, "& .MuiTabs-indicator": { bgcolor: "#7e22ce" } }}
          >
            <Tab label="Records (date range)" sx={{ textTransform: "none", fontWeight: 600 }} />
            <Tab label="Daily Sheet" sx={{ textTransform: "none", fontWeight: 600 }} />
          </Tabs>

          {/* ===================== RANGE VIEW ===================== */}
          {tab === 0 && (
            <Box sx={{ p: 2 }}>
              <Stack direction="row" spacing={1.5} flexWrap="wrap" useFlexGap alignItems="center" sx={{ mb: 2 }}>
                <TextField select size="small" label="Batch" value={batchFilter}
                  onChange={(e) => setBatchFilter(e.target.value)} sx={{ minWidth: 200 }}>
                  <MenuItem value="">All batches</MenuItem>
                  {batches.map((b) => <MenuItem key={b._id} value={b._id}>{b.course?.name} — {b.batchName}</MenuItem>)}
                </TextField>
                <TextField size="small" label="From" type="date" value={from} onChange={(e) => setFrom(e.target.value)} InputLabelProps={{ shrink: true }} />
                <TextField size="small" label="To" type="date" value={to} onChange={(e) => setTo(e.target.value)} InputLabelProps={{ shrink: true }} />
                <Button variant="outlined" size="small" onClick={loadRecords}>Apply</Button>
                <Box sx={{ flexGrow: 1 }} />
                <Button size="small" startIcon={<GetApp />} onClick={exportRangeExcel}>Excel</Button>
              </Stack>

              <TableContainer sx={{ overflowX: "auto" }}>
                <Table size="small">
                  <TableHead>
                    <TableRow sx={{ "& th": { bgcolor: "#faf5ff", fontWeight: 700 } }}>
                      <TableCell>Date</TableCell>
                      <TableCell>Course/Batch</TableCell>
                      <TableCell>Registered</TableCell>
                      <TableCell>Boys</TableCell>
                      <TableCell>Girls</TableCell>
                      <TableCell>%</TableCell>
                      <TableCell>Remarks</TableCell>
                      <TableCell>Marked By</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {records.map((r) => (
                      <TableRow key={r._id} hover>
                        <TableCell>{r.date}</TableCell>
                        <TableCell>{r.batch?.course?.name} — {r.batch?.batchName}</TableCell>
                        <TableCell>{r.batch?.registeredCount}</TableCell>
                        <TableCell><Chip size="small" icon={<Male sx={{ fontSize: "14px !important" }} />} label={r.boysPresent} sx={{ bgcolor: "#eff6ff", color: "#1d4ed8" }} /></TableCell>
                        <TableCell><Chip size="small" icon={<Female sx={{ fontSize: "14px !important" }} />} label={r.girlsPresent} sx={{ bgcolor: "#fdf2f8", color: "#be185d" }} /></TableCell>
                        <TableCell><Chip size="small" label={`${r.percentage}%`} color={r.percentage >= 75 ? "success" : "warning"} /></TableCell>
                        <TableCell sx={{ maxWidth: 160 }}><Typography noWrap fontSize="0.8rem">{r.remarks || "-"}</Typography></TableCell>
                        <TableCell>{r.markedBy?.name}</TableCell>
                      </TableRow>
                    ))}
                    {records.length === 0 && <TableRow><TableCell colSpan={8} align="center">No records found.</TableCell></TableRow>}
                  </TableBody>
                </Table>
              </TableContainer>
            </Box>
          )}

          {/* ===================== DAILY SHEET ===================== */}
          {tab === 1 && (
            <Box sx={{ p: 2 }}>
              <Stack direction="row" spacing={1.5} alignItems="center" sx={{ mb: 2 }}>
                <TextField size="small" label="Date" type="date" value={sheetDate}
                  onChange={(e) => setSheetDate(e.target.value)} InputLabelProps={{ shrink: true }} />
                <Button variant="outlined" size="small" onClick={loadSheet}>Load Sheet</Button>
                <Box sx={{ flexGrow: 1 }} />
                <Button size="small" startIcon={<GetApp />} onClick={exportSheetExcel}>Excel</Button>
                <Button size="small" startIcon={<PictureAsPdf />} onClick={exportSheetPdf}>PDF</Button>
              </Stack>

              <TableContainer sx={{ overflowX: "auto" }}>
                <Table size="small">
                  <TableHead>
                    <TableRow sx={{ "& th": { bgcolor: "#fef2f2", fontWeight: 700 } }}>
                      <TableCell>S.No.</TableCell>
<TableCell>Faculty/Coordinator</TableCell>
                      <TableCell>Course</TableCell>
                      <TableCell>Batch</TableCell>
                      <TableCell>Sanctioned</TableCell>
                      <TableCell>Registered</TableCell>
                      <TableCell>Boys</TableCell>
                      <TableCell>Girls</TableCell>
                      <TableCell>%</TableCell>
                      <TableCell>Remarks</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {sheetRows.map((r) => (
                      <TableRow key={r.sNo} hover sx={{ bgcolor: r.marked ? "inherit" : "#fffbeb" }}>
                        <TableCell>{r.sNo}</TableCell>
                        <TableCell>{r.faculty}</TableCell>
                        <TableCell>{r.course}</TableCell>
                        <TableCell>{r.batch}</TableCell>
                        <TableCell>{r.sanctioned}</TableCell>
                        <TableCell>{r.registered}</TableCell>
                        <TableCell>{r.boysPresent ?? "-"}</TableCell>
                        <TableCell>{r.girlsPresent ?? "-"}</TableCell>
                        <TableCell>
                          {r.percentage !== null ? (
                            <Chip size="small" label={`${r.percentage}%`} color={r.percentage >= 75 ? "success" : "warning"} />
                          ) : (
                            <Chip size="small" label="Not marked" sx={{ bgcolor: "#fef3c7", color: "#92400e" }} />
                          )}
                        </TableCell>
                        <TableCell sx={{ maxWidth: 160 }}><Typography noWrap fontSize="0.8rem">{r.remarks || "-"}</Typography></TableCell>
                      </TableRow>
                    ))}
                    {!sheetLoading && sheetRows.length === 0 && (
                      <TableRow><TableCell colSpan={10} align="center">No batches configured yet.</TableCell></TableRow>
                    )}
                  </TableBody>
                </Table>
              </TableContainer>
            </Box>
          )}
        </Paper>
      </Container>
    </Box>
  );
}

export default function AdminAttendancePage() {
  return (
    <ProtectedRoute role="superadmin">
      <AdminAttendanceInner />
    </ProtectedRoute>
  );
}
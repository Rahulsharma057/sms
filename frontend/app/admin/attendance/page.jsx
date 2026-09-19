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
  const [tab, setTab] = useState(0);

  const [records, setRecords] = useState([]);
  const [batches, setBatches] = useState([]);
  const [batchFilter, setBatchFilter] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  const [sheetDate, setSheetDate] = useState(getToday());
  const [sheetRows, setSheetRows] = useState([]);
  const [sheetTotals, setSheetTotals] = useState(null);
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
      .then((res) => {
        setSheetRows(res.data.rows);
        setSheetTotals(res.data.totals);
      })
      .finally(() => setSheetLoading(false));
  };

  useEffect(() => {
    api.get("/batches").then((res) => setBatches(res.data));
    loadRecords();
    loadSheet();
  }, []);

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
      "S.No.": r.sNo, "Faculty/Coordinator": r.faculty, Course: r.course, Batch: r.batch,
      Sanctioned: r.sanctioned, Registered: r.registered,
      Admission: r.admission, "Dropout/Completion": r.dropoutCompletion,
      Male: r.maleRegistered, Female: r.femaleRegistered,
      "Boys Present": r.boysPresent ?? "-", "Girls Present": r.girlsPresent ?? "-",
      "Total Present": r.totalPresent ?? "-",
      "%": r.percentage !== null ? `${r.percentage}%` : "-",
      Remarks: r.remarks || (r.marked ? "" : "Not marked"),
    }));
    if (sheetTotals) {
      rows.push({
        "S.No.": "", "Faculty/Coordinator": "TOTAL", Course: "", Batch: "",
        Sanctioned: sheetTotals.sanctioned, Registered: sheetTotals.registered,
        Admission: sheetTotals.admission, "Dropout/Completion": sheetTotals.dropoutCompletion,
        Male: sheetTotals.maleRegistered, Female: sheetTotals.femaleRegistered,
        "Boys Present": sheetTotals.boysPresent, "Girls Present": sheetTotals.girlsPresent,
        "Total Present": sheetTotals.totalPresent, "%": `${sheetTotals.percentage}%`,
        Remarks: `${sheetTotals.batchesMarked}/${sheetTotals.batchesTotal} batches marked`,
      });
    }
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows), `Sheet-${sheetDate}`);
    XLSX.writeFile(wb, `sleepwell-attendance-${sheetDate}.xlsx`);
  };

  const exportSheetPdf = async () => {
    const { default: jsPDF } = await import("jspdf");
    const doc = new jsPDF({ orientation: "landscape" });
    doc.setFontSize(14);
    doc.text("Sleepwell Foundation", 12, 12);
    doc.setFontSize(11);
    doc.text(`Attendance Daily Sheet — ${sheetDate}`, 12, 19);
    doc.setFontSize(7.5);
    let y = 27;
    sheetRows.forEach((r) => {
      if (y > 195) { doc.addPage(); y = 15; }
      doc.text(
        `${r.sNo}. ${r.faculty} | ${r.course}-${r.batch} | Sanct:${r.sanctioned} Reg:${r.registered} Adm:${r.admission} Drop:${r.dropoutCompletion} M:${r.maleRegistered} F:${r.femaleRegistered} | B:${r.boysPresent ?? "-"} G:${r.girlsPresent ?? "-"} | ${r.percentage !== null ? r.percentage + "%" : "-"} | ${r.remarks || (r.marked ? "" : "Not marked")}`,
        12, y
      );
      y += 5;
    });
    if (sheetTotals) {
      y += 3;
      doc.setFontSize(8.5);
      doc.text(
        `TOTAL | Sanct:${sheetTotals.sanctioned} Reg:${sheetTotals.registered} Adm:${sheetTotals.admission} Drop:${sheetTotals.dropoutCompletion} M:${sheetTotals.maleRegistered} F:${sheetTotals.femaleRegistered} | B:${sheetTotals.boysPresent} G:${sheetTotals.girlsPresent} | ${sheetTotals.percentage}% | ${sheetTotals.batchesMarked}/${sheetTotals.batchesTotal} batches marked`,
        12, y
      );
    }
    doc.save(`sleepwell-attendance-${sheetDate}.pdf`);
  };

  return (
    <Box sx={{ bgcolor: "#faf9fb", minHeight: "100vh" }}>
      <Navbar />
      <Container maxWidth="lg" sx={{ py: 3 }}>
        <Typography variant="overline" color="text.secondary" sx={{ letterSpacing: 1 }}>
          Sleepwell Foundation
        </Typography>
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
              <Stack direction="row" alignItems="center" mb={1.5}>
                <Typography fontWeight={700} fontSize="0.95rem" color="#7e22ce">Sleepwell Foundation</Typography>
              </Stack>

              <Stack direction="row" spacing={1.5} alignItems="center" sx={{ mb: 2 }}>
                <TextField size="small" label="Date" type="date" value={sheetDate}
                  onChange={(e) => setSheetDate(e.target.value)} InputLabelProps={{ shrink: true }} />
                <Button variant="outlined" size="small" onClick={loadSheet}>Load Sheet</Button>
                <Box sx={{ flexGrow: 1 }} />
                {sheetTotals && (
                  <Chip size="small" label={`${sheetTotals.batchesMarked}/${sheetTotals.batchesTotal} batches marked`}
                    sx={{ bgcolor: "#f3e8ff", color: "#6b21a8", fontWeight: 600 }} />
                )}
                <Button size="small" startIcon={<GetApp />} onClick={exportSheetExcel}>Excel</Button>
                <Button size="small" startIcon={<PictureAsPdf />} onClick={exportSheetPdf}>PDF</Button>
              </Stack>

              <TableContainer sx={{ overflowX: "auto" }}>
                <Table size="small">
                  <TableHead>
                    <TableRow sx={{ "& th": { bgcolor: "#fef2f2", fontWeight: 700, whiteSpace: "nowrap" } }}>
                      <TableCell>S.No.</TableCell>
                      <TableCell>Faculty/Coordinator</TableCell>
                      <TableCell>Course</TableCell>
                      <TableCell>Batch</TableCell>
                      <TableCell>Sanctioned</TableCell>
                      <TableCell>Registered</TableCell>
                      <TableCell>Admission</TableCell>
                      <TableCell>Dropout/Completion</TableCell>
                      <TableCell>Male</TableCell>
                      <TableCell>Female</TableCell>
                      <TableCell>Boys Present</TableCell>
                      <TableCell>Girls Present</TableCell>
                      <TableCell>%</TableCell>
                      <TableCell>Remarks</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {sheetRows.map((r) => (
                      <TableRow key={r.sNo} hover sx={{ bgcolor: r.marked ? "inherit" : "#fffbeb" }}>
                        <TableCell>{r.sNo}</TableCell>
                        <TableCell sx={{ whiteSpace: "nowrap" }}>{r.faculty}</TableCell>
                        <TableCell>{r.course}</TableCell>
                        <TableCell>{r.batch}</TableCell>
                        <TableCell>{r.sanctioned}</TableCell>
                        <TableCell>{r.registered}</TableCell>
                        <TableCell>{r.admission || "-"}</TableCell>
                        <TableCell>{r.dropoutCompletion || "-"}</TableCell>
                        <TableCell>{r.maleRegistered || "-"}</TableCell>
                        <TableCell>{r.femaleRegistered || "-"}</TableCell>
                        <TableCell>{r.boysPresent ?? "-"}</TableCell>
                        <TableCell>{r.girlsPresent ?? "-"}</TableCell>
                        <TableCell>
                          {r.percentage !== null ? (
                            <Chip size="small" label={`${r.percentage}%`} color={r.percentage >= 75 ? "success" : "warning"} />
                          ) : (
                            <Chip size="small" label="Not marked" sx={{ bgcolor: "#fef3c7", color: "#92400e" }} />
                          )}
                        </TableCell>
                        <TableCell sx={{ maxWidth: 140 }}><Typography noWrap fontSize="0.8rem">{r.remarks || "-"}</Typography></TableCell>
                      </TableRow>
                    ))}
                    {!sheetLoading && sheetRows.length === 0 && (
                      <TableRow><TableCell colSpan={14} align="center">No batches configured yet.</TableCell></TableRow>
                    )}

                    {/* ===================== TOTALS ROW ===================== */}
                    {sheetTotals && sheetRows.length > 0 && (
                      <TableRow sx={{ "& td": { fontWeight: 800, bgcolor: "#f3e8ff", borderTop: "2px solid #7e22ce" } }}>
                        <TableCell colSpan={4}>TOTAL</TableCell>
                        <TableCell>{sheetTotals.sanctioned}</TableCell>
                        <TableCell>{sheetTotals.registered}</TableCell>
                        <TableCell>{sheetTotals.admission}</TableCell>
                        <TableCell>{sheetTotals.dropoutCompletion}</TableCell>
                        <TableCell>{sheetTotals.maleRegistered}</TableCell>
                        <TableCell>{sheetTotals.femaleRegistered}</TableCell>
                        <TableCell>{sheetTotals.boysPresent}</TableCell>
                        <TableCell>{sheetTotals.girlsPresent}</TableCell>
                        <TableCell>
                          <Chip size="small" label={`${sheetTotals.percentage}%`} color={sheetTotals.percentage >= 75 ? "success" : "warning"} sx={{ fontWeight: 800 }} />
                        </TableCell>
                        <TableCell>-</TableCell>
                      </TableRow>
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
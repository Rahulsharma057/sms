"use client";
import { useEffect, useState } from "react";
import {
  Box, Container, Typography, Paper, Stack, TextField, MenuItem,
  Button, CircularProgress, Chip, Grid, Dialog, DialogTitle, DialogContent,
  DialogActions, IconButton, Badge,
} from "@mui/material";
import { Save, Male, Female, Visibility, Edit, CheckCircle, Close } from "@mui/icons-material";
import { toast } from "react-toastify";
import ProtectedRoute from "../../../components/ProtectedRoute";
import Navbar from "../../../components/Navbar";
import api from "../../../lib/api";

const getToday = () => new Date().toISOString().slice(0, 10);

function TeacherAttendanceInner() {
  const [batches, setBatches] = useState([]);
  const [pendingStatus, setPendingStatus] = useState({}); // { batchId: submitted boolean }
  const [batchId, setBatchId] = useState("");
  const [date, setDate] = useState(getToday());

  const [boysPresent, setBoysPresent] = useState("");
  const [girlsPresent, setGirlsPresent] = useState("");
  const [remarks, setRemarks] = useState("");

  const [existing, setExisting] = useState(null);
  const [editMode, setEditMode] = useState(true); // false = show the "Thank you" card
  const [viewDialogOpen, setViewDialogOpen] = useState(false);

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const loadMyBatches = () => {
    api.get("/batches/mine").then((res) => {
      setBatches(res.data);
      if (res.data.length && !batchId) setBatchId(res.data[0]._id);
    });
  };

  const loadPendingStatus = (d) => {
    api.get("/attendance/my-status", { params: { date: d } })
      .then((res) => setPendingStatus(res.data))
      .catch(() => {});
  };

  useEffect(() => { loadMyBatches(); }, []);
  useEffect(() => { loadPendingStatus(date); }, [date]);

  useEffect(() => {
    if (!batchId) return;
    setLoading(true);
    api.get("/attendance/status", { params: { batch: batchId, date } })
      .then((res) => {
        setExisting(res.data);
        if (res.data) {
          setBoysPresent(String(res.data.boysPresent));
          setGirlsPresent(String(res.data.girlsPresent));
          setRemarks(res.data.remarks || "");
          setEditMode(false); // already submitted → show the card
        } else {
          setBoysPresent("");
          setGirlsPresent("");
          setRemarks("");
          setEditMode(true); // nothing yet → show the form
        }
      })
      .finally(() => setLoading(false));
  }, [batchId, date]);

  const selectedBatch = batches.find((b) => b._id === batchId);
  const registered = selectedBatch?.registeredCount || 0;
  const totalPresent = (Number(boysPresent) || 0) + (Number(girlsPresent) || 0);
  const percentage = registered > 0 ? ((totalPresent / registered) * 100).toFixed(1) : 0;

  const submit = async () => {
    if (boysPresent === "" || girlsPresent === "") {
      return toast.error("Please enter both boys and girls present count");
    }
    try {
      setSaving(true);
      const payload = { boysPresent: Number(boysPresent), girlsPresent: Number(girlsPresent), remarks };
      if (existing) {
        await api.put(`/attendance/${existing._id}`, payload);
        toast.success("Attendance updated");
      } else {
        await api.post("/attendance", { batch: batchId, date, ...payload });
        toast.success("Attendance submitted");
      }
      const { data } = await api.get("/attendance/status", { params: { batch: batchId, date } });
      setExisting(data);
      setEditMode(false); // form → card
      loadPendingStatus(date); // refresh the dot in the dropdown
    } catch (err) {
      toast.error(err?.response?.data?.message || "Could not save attendance");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Box sx={{ bgcolor: "#faf9fb", minHeight: "100vh" }}>
      <Navbar />
      <Container maxWidth="sm" sx={{ py: 3 }}>
        <Typography variant="h5" fontWeight={800} mb={2}>Mark Attendance</Typography>

        <Paper elevation={0} sx={{ p: 2, border: "1px solid #e2e8f0", borderRadius: 2.5, mb: 2 }}>
          <Stack spacing={1.5}>
            <TextField select label="Batch" value={batchId} onChange={(e) => setBatchId(e.target.value)}>
              {batches.map((b) => {
                const isPending = pendingStatus[b._id] === false;
                return (
                  <MenuItem key={b._id} value={b._id}>
                    <Stack direction="row" alignItems="center" spacing={1} sx={{ width: "100%" }}>
                      {isPending && (
                        <Box sx={{ width: 8, height: 8, borderRadius: "50%", bgcolor: "#f59e0b", flexShrink: 0 }} />
                      )}
                      <Typography fontSize="0.9rem">{b.course?.name} — {b.batchName}</Typography>
                    </Stack>
                  </MenuItem>
                );
              })}
            </TextField>
            <TextField
              label="Date" type="date" value={date}
              onChange={(e) => setDate(e.target.value)}
              InputLabelProps={{ shrink: true }}
              inputProps={{ max: getToday() }}
            />
          </Stack>
        </Paper>

        {loading ? (
          <Box sx={{ display: "flex", justifyContent: "center", py: 4 }}><CircularProgress size={22} /></Box>
        ) : !editMode && existing ? (
          /* ===================== SUBMITTED — CARD VIEW ===================== */
          <Paper elevation={0} sx={{ p: 2.5, border: "1px solid #bbf7d0", bgcolor: "#f0fdf4", borderRadius: 2.5, textAlign: "center" }}>
            <CheckCircle sx={{ fontSize: 40, color: "#16a34a", mb: 1 }} />
            <Typography fontWeight={700} fontSize="1.05rem" mb={0.3}>
              Thank you for submitting attendance for
            </Typography>
            <Typography fontWeight={800} fontSize="1.1rem" color="#166534" mb={1.5}>
              {selectedBatch?.course?.name} — {selectedBatch?.batchName}
            </Typography>

            <Stack direction="row" spacing={1} justifyContent="center" flexWrap="wrap" sx={{ mb: 2 }}>
              <Chip icon={<Male sx={{ fontSize: "14px !important" }} />} label={`${existing.boysPresent} boys`} sx={{ bgcolor: "#eff6ff", color: "#1d4ed8" }} />
              <Chip icon={<Female sx={{ fontSize: "14px !important" }} />} label={`${existing.girlsPresent} girls`} sx={{ bgcolor: "#fdf2f8", color: "#be185d" }} />
              <Chip label={`${percentage}% present`} color={percentage >= 75 ? "success" : "warning"} sx={{ fontWeight: 700 }} />
            </Stack>

            <Stack direction="row" spacing={1.2} justifyContent="center">
              <Button variant="outlined" startIcon={<Visibility />} onClick={() => setViewDialogOpen(true)}>
                View
              </Button>
              <Button variant="contained" startIcon={<Edit />} onClick={() => setEditMode(true)}
                sx={{ bgcolor: "#7e22ce", "&:hover": { bgcolor: "#6b21a8" } }}>
                Edit
              </Button>
            </Stack>
          </Paper>
        ) : (
          /* ===================== FORM (new or editing) ===================== */
          <>
            {batchId && (
              <Paper elevation={0} sx={{ p: 1.5, border: "1px solid #e2e8f0", borderRadius: 2.5, mb: 2, bgcolor: "#faf5ff" }}>
                <Typography fontSize="0.85rem" color="text.secondary">
                  Registered students in this batch: <b>{registered}</b>
                </Typography>
              </Paper>
            )}

            <Paper elevation={0} sx={{ p: 2, border: "1px solid #e2e8f0", borderRadius: 2.5 }}>
              <Grid container spacing={1.5}>
                <Grid item xs={6}>
                  <TextField
                    fullWidth type="number" label="Boys Present"
                    value={boysPresent}
                    onChange={(e) => setBoysPresent(e.target.value)}
                    InputProps={{ startAdornment: <Male sx={{ fontSize: 18, color: "#1d4ed8", mr: 0.5 }} /> }}
                  />
                </Grid>
                <Grid item xs={6}>
                  <TextField
                    fullWidth type="number" label="Girls Present"
                    value={girlsPresent}
                    onChange={(e) => setGirlsPresent(e.target.value)}
                    InputProps={{ startAdornment: <Female sx={{ fontSize: 18, color: "#be185d", mr: 0.5 }} /> }}
                  />
                </Grid>
                <Grid item xs={12}>
                  <TextField
                    fullWidth multiline minRows={2} label="Remarks (optional)"
                    value={remarks}
                    onChange={(e) => setRemarks(e.target.value)}
                    placeholder="Any note about today's attendance..."
                  />
                </Grid>
              </Grid>

              <Stack direction="row" spacing={1} justifyContent="center" sx={{ mt: 2 }}>
                <Chip label={`Total present: ${totalPresent}`} sx={{ fontWeight: 700 }} />
                <Chip label={`${percentage}%`} color={percentage >= 75 ? "success" : "warning"} sx={{ fontWeight: 700 }} />
              </Stack>

              <Stack direction="row" spacing={1.2} sx={{ mt: 2 }}>
                {existing && (
                  <Button fullWidth variant="outlined" onClick={() => setEditMode(false)}>Cancel</Button>
                )}
                <Button
                  fullWidth variant="contained" startIcon={<Save />}
                  disabled={saving} onClick={submit}
                  sx={{ bgcolor: "#7e22ce", "&:hover": { bgcolor: "#6b21a8" } }}
                >
                  {saving ? "Saving..." : existing ? "Update Attendance" : "Submit Attendance"}
                </Button>
              </Stack>
            </Paper>
          </>
        )}
      </Container>

      {/* VIEW DIALOG */}
      <Dialog open={viewDialogOpen} onClose={() => setViewDialogOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          Attendance Details
          <IconButton onClick={() => setViewDialogOpen(false)}><Close /></IconButton>
        </DialogTitle>
        <DialogContent dividers>
          <Stack spacing={1.2}>
            <Typography fontSize="0.85rem"><b>Batch:</b> {selectedBatch?.course?.name} — {selectedBatch?.batchName}</Typography>
            <Typography fontSize="0.85rem"><b>Date:</b> {date}</Typography>
            <Typography fontSize="0.85rem"><b>Registered:</b> {registered}</Typography>
            <Typography fontSize="0.85rem"><b>Boys Present:</b> {existing?.boysPresent}</Typography>
            <Typography fontSize="0.85rem"><b>Girls Present:</b> {existing?.girlsPresent}</Typography>
            <Typography fontSize="0.85rem"><b>Total Present:</b> {totalPresent}</Typography>
            <Typography fontSize="0.85rem"><b>Percentage:</b> {percentage}%</Typography>
            <Typography fontSize="0.85rem"><b>Remarks:</b> {existing?.remarks || "-"}</Typography>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setViewDialogOpen(false)}>Close</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

export default function TeacherAttendancePage() {
  return (
    <ProtectedRoute role="teacher">
      <TeacherAttendanceInner />
    </ProtectedRoute>
  );
}
"use client";
import { useEffect, useState } from "react";
import {
  Box, Container, Typography, Paper, Tabs, Tab, Table, TableHead, TableRow,
  TableCell, TableBody, TableContainer, Button, Dialog, DialogTitle,
  DialogContent, DialogActions, TextField, Chip, Stack, IconButton, MenuItem,
  Select, Checkbox, ListItemText as MuiListItemText,
} from "@mui/material";
import { Add, DeleteOutline, Edit } from "@mui/icons-material";
import { toast } from "react-toastify";
import ProtectedRoute from "../../../components/ProtectedRoute";
import Navbar from "../../../components/Navbar";
import api from "../../../lib/api";

const emptyBatchForm = {
  course: "", batchName: "", sanctionedSeats: "", registeredCount: "", assignedTeachers: [],
};

function ConfigInner() {
  const [tab, setTab] = useState(0);

  const [courses, setCourses] = useState([]);
  const [batches, setBatches] = useState([]);
  const [teachers, setTeachers] = useState([]);
  const [loading, setLoading] = useState(true);

  const [courseDialogOpen, setCourseDialogOpen] = useState(false);
  const [editingCourse, setEditingCourse] = useState(null);
  const [courseName, setCourseName] = useState("");

  const [batchDialogOpen, setBatchDialogOpen] = useState(false);
  const [editingBatch, setEditingBatch] = useState(null);
  const [batchForm, setBatchForm] = useState(emptyBatchForm);

  const load = async () => {
    setLoading(true);
    try {
      const [c, b, t] = await Promise.all([
        api.get("/courses"),
        api.get("/batches"),
        api.get("/users/teachers"),
      ]);
      setCourses(c.data);
      setBatches(b.data);
      setTeachers(t.data);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  // ===================== COURSES =====================

  const openCourseDialog = (course = null) => {
    setEditingCourse(course);
    setCourseName(course?.name || "");
    setCourseDialogOpen(true);
  };

  const saveCourse = async () => {
    if (!courseName.trim()) return toast.error("Course name is required");
    try {
      if (editingCourse) {
        await api.put(`/courses/${editingCourse._id}`, { name: courseName.trim() });
        toast.success("Course updated");
      } else {
        await api.post("/courses", { name: courseName.trim() });
        toast.success("Course added");
      }
      setCourseDialogOpen(false);
      load();
    } catch (err) {
      toast.error(err?.response?.data?.message || "Could not save course");
    }
  };

  const deleteCourse = async (id) => {
    if (!confirm("Delete this course?")) return;
    try {
      await api.delete(`/courses/${id}`);
      toast.success("Course deleted");
      load();
    } catch (err) {
      toast.error(err?.response?.data?.message || "Could not delete course");
    }
  };

  // ===================== BATCHES =====================

  const openBatchDialog = (batch = null) => {
    setEditingBatch(batch);
    setBatchForm(
      batch
        ? {
            course: batch.course?._id || "",
            batchName: batch.batchName,
            sanctionedSeats: batch.sanctionedSeats,
            registeredCount: batch.registeredCount,
            assignedTeachers: batch.assignedTeachers?.map((t) => t._id) || [],
          }
        : emptyBatchForm
    );
    setBatchDialogOpen(true);
  };

  const saveBatch = async () => {
    if (!batchForm.course || !batchForm.batchName.trim()) {
      return toast.error("Course and batch name are required");
    }
    const payload = {
      course: batchForm.course,
      batchName: batchForm.batchName.trim(),
      sanctionedSeats: Number(batchForm.sanctionedSeats) || 0,
      registeredCount: Number(batchForm.registeredCount) || 0,
      assignedTeachers: batchForm.assignedTeachers,
    };
    try {
      if (editingBatch) {
        await api.put(`/batches/${editingBatch._id}`, payload);
        toast.success("Batch updated");
      } else {
        await api.post("/batches", payload);
        toast.success("Batch created");
      }
      setBatchDialogOpen(false);
      load();
    } catch (err) {
      toast.error(err?.response?.data?.message || "Could not save batch");
    }
  };

  const deleteBatch = async (id) => {
    if (!confirm("Delete this batch?")) return;
    try {
      await api.delete(`/batches/${id}`);
      toast.success("Batch deleted");
      load();
    } catch (err) {
      toast.error(err?.response?.data?.message || "Could not delete batch");
    }
  };

  return (
    <Box sx={{ bgcolor: "#faf9fb", minHeight: "100vh" }}>
      <Navbar />
      <Container maxWidth="lg" sx={{ py: 3 }}>
        <Typography variant="h5" fontWeight={800} mb={2}>Attendance Configuration</Typography>

        <Paper elevation={0} sx={{ border: "1px solid #e2e8f0", borderRadius: 2.5, overflow: "hidden" }}>
          <Tabs
            value={tab}
            onChange={(e, v) => setTab(v)}
            sx={{ borderBottom: "1px solid #e2e8f0", "& .Mui-selected": { color: "#7e22ce !important" }, "& .MuiTabs-indicator": { bgcolor: "#7e22ce" } }}
          >
            <Tab label="Courses" sx={{ textTransform: "none", fontWeight: 600 }} />
            <Tab label="Batches" sx={{ textTransform: "none", fontWeight: 600 }} />
          </Tabs>

          {/* ===================== COURSES TAB ===================== */}
          {tab === 0 && (
            <Box sx={{ p: 2 }}>
              <Stack direction="row" justifyContent="flex-end" mb={1.5}>
                <Button size="small" variant="contained" startIcon={<Add />} onClick={() => openCourseDialog()}
                  sx={{ bgcolor: "#7e22ce", "&:hover": { bgcolor: "#6b21a8" } }}>
                  Add Course
                </Button>
              </Stack>
              <TableContainer>
                <Table size="small">
                  <TableHead>
                    <TableRow sx={{ "& th": { bgcolor: "#faf5ff", fontWeight: 700 } }}>
                      <TableCell>Course Name</TableCell>
                      <TableCell>Batches</TableCell>
                      <TableCell align="right">Actions</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {courses.map((c) => (
                      <TableRow key={c._id} hover>
                        <TableCell>{c.name}</TableCell>
                        <TableCell>{batches.filter((b) => b.course?._id === c._id).length}</TableCell>
                        <TableCell align="right">
                          <IconButton size="small" onClick={() => openCourseDialog(c)}><Edit fontSize="small" /></IconButton>
                          <IconButton size="small" color="error" onClick={() => deleteCourse(c._id)}><DeleteOutline fontSize="small" /></IconButton>
                        </TableCell>
                      </TableRow>
                    ))}
                    {!loading && courses.length === 0 && (
                      <TableRow><TableCell colSpan={3} align="center">No courses yet.</TableCell></TableRow>
                    )}
                  </TableBody>
                </Table>
              </TableContainer>
            </Box>
          )}

          {/* ===================== BATCHES TAB ===================== */}
          {tab === 1 && (
            <Box sx={{ p: 2 }}>
              <Stack direction="row" justifyContent="flex-end" mb={1.5}>
                <Button size="small" variant="contained" startIcon={<Add />} onClick={() => openBatchDialog()}
                  sx={{ bgcolor: "#7e22ce", "&:hover": { bgcolor: "#6b21a8" } }}>
                  Add Batch
                </Button>
              </Stack>
              <TableContainer sx={{ overflowX: "auto" }}>
                <Table size="small">
                  <TableHead>
                    <TableRow sx={{ "& th": { bgcolor: "#faf5ff", fontWeight: 700 } }}>
                      <TableCell>Course</TableCell>
                      <TableCell>Batch</TableCell>
                      <TableCell>Sanctioned</TableCell>
                      <TableCell>Registered</TableCell>
                      <TableCell>Teachers</TableCell>
                      <TableCell align="right">Actions</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {batches.map((b) => (
                      <TableRow key={b._id} hover>
                        <TableCell>{b.course?.name}</TableCell>
                        <TableCell>{b.batchName}</TableCell>
                        <TableCell>{b.sanctionedSeats}</TableCell>
                        <TableCell>{b.registeredCount}</TableCell>
                        <TableCell>
                          <Stack direction="row" spacing={0.5} flexWrap="wrap" useFlexGap>
                            {b.assignedTeachers?.map((t) => <Chip key={t._id} size="small" label={t.name} />)}
                            {!b.assignedTeachers?.length && <Typography variant="caption" color="text.secondary">Unassigned</Typography>}
                          </Stack>
                        </TableCell>
                        <TableCell align="right" sx={{ whiteSpace: "nowrap" }}>
                          <IconButton size="small" onClick={() => openBatchDialog(b)}><Edit fontSize="small" /></IconButton>
                          <IconButton size="small" color="error" onClick={() => deleteBatch(b._id)}><DeleteOutline fontSize="small" /></IconButton>
                        </TableCell>
                      </TableRow>
                    ))}
                    {!loading && batches.length === 0 && (
                      <TableRow><TableCell colSpan={6} align="center">No batches yet.</TableCell></TableRow>
                    )}
                  </TableBody>
                </Table>
              </TableContainer>
            </Box>
          )}
        </Paper>
      </Container>

      {/* COURSE DIALOG */}
      <Dialog open={courseDialogOpen} onClose={() => setCourseDialogOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle>{editingCourse ? "Edit Course" : "Add Course"}</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus fullWidth label="Course name" sx={{ mt: 1 }}
            value={courseName} onChange={(e) => setCourseName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && saveCourse()}
            placeholder="e.g. Fashion Design, Tally, NIIT-CCAB"
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCourseDialogOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={saveCourse}>{editingCourse ? "Update" : "Add"}</Button>
        </DialogActions>
      </Dialog>

      {/* BATCH DIALOG */}
      <Dialog open={batchDialogOpen} onClose={() => setBatchDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>{editingBatch ? "Edit Batch" : "New Batch"}</DialogTitle>
        <DialogContent>
          <Stack spacing={1.8} sx={{ mt: 1 }}>
            <TextField select label="Course" fullWidth value={batchForm.course}
              onChange={(e) => setBatchForm((p) => ({ ...p, course: e.target.value }))}>
              {courses.map((c) => <MenuItem key={c._id} value={c._id}>{c.name}</MenuItem>)}
            </TextField>
            <TextField label="Batch Name" fullWidth value={batchForm.batchName}
              onChange={(e) => setBatchForm((p) => ({ ...p, batchName: e.target.value }))} />
            <TextField label="Sanctioned Seats" type="number" fullWidth value={batchForm.sanctionedSeats}
              onChange={(e) => setBatchForm((p) => ({ ...p, sanctionedSeats: e.target.value }))} />
            <TextField label="Registered Students" type="number" fullWidth value={batchForm.registeredCount}
              onChange={(e) => setBatchForm((p) => ({ ...p, registeredCount: e.target.value }))} />
            <Select
              multiple
              value={batchForm.assignedTeachers}
              onChange={(e) => setBatchForm((p) => ({ ...p, assignedTeachers: e.target.value }))}
              renderValue={(selected) => teachers.filter((t) => selected.includes(t._id)).map((t) => t.name).join(", ")}
              displayEmpty
            >
              {teachers.map((t) => (
                <MenuItem key={t._id} value={t._id}>
                  <Checkbox checked={batchForm.assignedTeachers.includes(t._id)} />
                  <MuiListItemText primary={t.name} />
                </MenuItem>
              ))}
            </Select>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setBatchDialogOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={saveBatch}>{editingBatch ? "Update" : "Create"}</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

export default function ConfigPage() {
  return (
    <ProtectedRoute role="superadmin">
      <ConfigInner />
    </ProtectedRoute>
  );
}
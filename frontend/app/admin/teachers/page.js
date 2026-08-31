"use client";
import { useEffect, useMemo, useState } from "react";
import {
  Box,
  Container,
  Typography,
  Paper,
  Table,
  TableHead,
  TableRow,
  TableCell,
  TableBody,
  TableContainer,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Chip,
  Switch,
  Alert,
  ToggleButton,
  ToggleButtonGroup,
  Avatar,
  Stack,
  InputAdornment,
  Skeleton,
  useMediaQuery,
  IconButton,
  Tooltip,
} from "@mui/material";
import { useTheme } from "@mui/material/styles";
import {
  PersonAdd,
  ViewList,
  ViewModule,
  Search,
  MailOutline,
  LocationOn,
  GroupsOutlined,
  Edit,
  DeleteOutline,
} from "@mui/icons-material";
import { toast } from "react-toastify";
import ProtectedRoute from "../../../components/ProtectedRoute";
import Navbar from "../../../components/Navbar";
import api from "../../../lib/api";

const AVATAR_COLORS = [
  "#6366F1",
  "#0EA5E9",
  "#10B981",
  "#F59E0B",
  "#EF4444",
  "#8B5CF6",
  "#EC4899",
];

function colorForName(name = "") {
  const idx = [...name].reduce((sum, ch) => sum + ch.charCodeAt(0), 0);
  return AVATAR_COLORS[idx % AVATAR_COLORS.length];
}

function initials(name = "") {
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] || "") + (parts[1]?.[0] || "")).toUpperCase() || "?";
}

const emptyForm = { name: "", email: "", password: "", centre: "" };

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function AdminTeachersInner() {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("sm"));

  const [teachers, setTeachers] = useState([]);
  const [loading, setLoading] = useState(true);

  /* ADD */
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [error, setError] = useState("");
  const [emailFieldError, setEmailFieldError] = useState("");
  const [saving, setSaving] = useState(false);

  /* EDIT */
  const [editOpen, setEditOpen] = useState(false);
  const [editTeacher, setEditTeacher] = useState(null);
  const [editForm, setEditForm] = useState(emptyForm);
  const [editError, setEditError] = useState("");
  const [editEmailFieldError, setEditEmailFieldError] = useState("");
  const [editSaving, setEditSaving] = useState(false);

  /* DELETE */
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const [search, setSearch] = useState("");
  const [view, setView] = useState(null); // null = follow screen size, else user override

  const effectiveView = view || (isMobile ? "card" : "table");

  const load = () => {
    setLoading(true);
    api
      .get("/users/teachers")
      .then((res) => setTeachers(res.data))
      .catch(() => toast.error("Could not load teachers."))
      .finally(() => setLoading(false));
  };
  useEffect(() => {
    load();
  }, []);

  /* =====================================================
     DUPLICATE EMAIL CHECK (client-side)
     excludeId: pass the teacher's own id while editing so
     they aren't flagged as a duplicate of themselves.
  ===================================================== */

  const isEmailTaken = (email, excludeId = null) => {
    const normalized = email.trim().toLowerCase();

    return teachers.some(
      (t) =>
        t.email?.toLowerCase() === normalized &&
        String(t._id) !== String(excludeId),
    );
  };

  /* =====================================================
     CREATE
  ===================================================== */

  const handleCreate = async () => {
    setError("");
    setEmailFieldError("");

    if (!form.name || !form.email || !form.password) {
      const msg = "Name, email and password are required.";
      setError(msg);
      toast.error(msg);
      return;
    }

    if (!EMAIL_REGEX.test(form.email.trim())) {
      const msg = "Please enter a valid email address.";
      setError(msg);
      setEmailFieldError(msg);
      toast.error(msg);
      return;
    }

    if (isEmailTaken(form.email)) {
      const msg = "A teacher with this email already exists.";
      setError(msg);
      setEmailFieldError(msg);
      toast.error(msg);
      return;
    }

    try {
      setSaving(true);

      await api.post("/users", form);

      setOpen(false);
      setForm(emptyForm);

      toast.success("Teacher account created.");

      load();
    } catch (err) {
      const msg =
        err?.response?.data?.message || "Could not create teacher account.";

      // Backend is still the source of truth — if it comes back
      // with a duplicate-email error (race condition, stale list,
      // etc.) surface it the same way as the client-side check.
      if (/email/i.test(msg)) {
        setEmailFieldError(msg);
      }

      setError(msg);
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  };

  /* =====================================================
     EDIT
  ===================================================== */

  const openEdit = (teacher) => {
    setEditTeacher(teacher);

    setEditForm({
      name: teacher.name || "",
      email: teacher.email || "",
      password: "",
      centre: teacher.centre || "",
    });

    setEditError("");
    setEditEmailFieldError("");
    setEditOpen(true);
  };

  const closeEdit = () => {
    if (editSaving) return;

    setEditOpen(false);
    setEditTeacher(null);
    setEditForm(emptyForm);
    setEditError("");
    setEditEmailFieldError("");
  };

  const handleUpdate = async () => {
    if (!editTeacher) return;

    setEditError("");
    setEditEmailFieldError("");

    if (!editForm.name || !editForm.email) {
      const msg = "Name and email are required.";
      setEditError(msg);
      toast.error(msg);
      return;
    }

    if (!EMAIL_REGEX.test(editForm.email.trim())) {
      const msg = "Please enter a valid email address.";
      setEditError(msg);
      setEditEmailFieldError(msg);
      toast.error(msg);
      return;
    }

    if (isEmailTaken(editForm.email, editTeacher._id)) {
      const msg = "Another teacher is already using this email.";
      setEditError(msg);
      setEditEmailFieldError(msg);
      toast.error(msg);
      return;
    }

    try {
      setEditSaving(true);

      const payload = {
        name: editForm.name,
        email: editForm.email,
        centre: editForm.centre,
      };

      // Only send a password if the admin actually typed a new one.
      if (editForm.password) {
        payload.password = editForm.password;
      }

      await api.put(`/users/${editTeacher._id}`, payload);

      toast.success("Teacher updated successfully.");

      closeEdit();
      load();
    } catch (err) {
      const msg = err?.response?.data?.message || "Could not update teacher.";

      if (/email/i.test(msg)) {
        setEditEmailFieldError(msg);
      }

      setEditError(msg);
      toast.error(msg);
    } finally {
      setEditSaving(false);
    }
  };

  /* =====================================================
     DELETE
  ===================================================== */

  const handleDelete = async () => {
    if (!deleteTarget) return;

    try {
      setDeleting(true);

      await api.delete(`/users/${deleteTarget._id}`);

      toast.success(`${deleteTarget.name} has been removed.`);

      setTeachers((prev) => prev.filter((t) => t._id !== deleteTarget._id));

      setDeleteTarget(null);
    } catch (err) {
      toast.error(err?.response?.data?.message || "Could not delete teacher.");
    } finally {
      setDeleting(false);
    }
  };

  /* =====================================================
     TOGGLE ACTIVE
  ===================================================== */

  const toggleActive = async (id) => {
    setTeachers((prev) =>
      prev.map((t) => (t._id === id ? { ...t, active: !t.active } : t)),
    );
    try {
      await api.patch(`/users/${id}/toggle-active`);
    } catch {
      toast.error("Could not update status. Reverting.");
      load(); // revert on failure
    }
  };

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return teachers;
    return teachers.filter(
      (t) =>
        t.name?.toLowerCase().includes(q) ||
        t.email?.toLowerCase().includes(q) ||
        t.centre?.toLowerCase().includes(q),
    );
  }, [teachers, search]);

  return (
    <Box sx={{ bgcolor: "#F7F8FA", minHeight: "100vh" }}>
      <Navbar />
      <Container maxWidth="lg" sx={{ py: { xs: 2, sm: 3 } }}>
        {/* Header */}
        <Stack
          direction={{ xs: "column", sm: "row" }}
          justifyContent="space-between"
          alignItems={{ xs: "stretch", sm: "center" }}
          spacing={2}
          mb={3}
        >
          <Box>
            <Typography variant="h5" fontWeight={700}>
              Teachers
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {loading
                ? "Loading…"
                : `${teachers.length} teacher${teachers.length === 1 ? "" : "s"} on record`}
            </Typography>
          </Box>
          <Button
            variant="contained"
            startIcon={<PersonAdd />}
            onClick={() => setOpen(true)}
            sx={{
              bgcolor: "#1d35ab",
              "&:hover": { bgcolor: "#18a952" },
              borderRadius: 2,
              textTransform: "none",
              fontWeight: 600,
              boxShadow: "none",
            }}
          >
            Add teacher
          </Button>
        </Stack>

        {/* Toolbar: search + view toggle */}
        <Stack
          direction={{ xs: "column", sm: "row" }}
          spacing={2}
          alignItems={{ xs: "stretch", sm: "center" }}
          justifyContent="space-between"
          mb={2}
        >
          <TextField
            size="small"
            placeholder="Search by name, email or centre"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            sx={{ bgcolor: "white", borderRadius: 2, maxWidth: { sm: 340 } }}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <Search fontSize="small" sx={{ color: "text.secondary" }} />
                </InputAdornment>
              ),
            }}
          />
          <ToggleButtonGroup
            size="small"
            exclusive
            value={effectiveView}
            onChange={(_, val) => val && setView(val)}
            sx={{
              alignSelf: { xs: "flex-end", sm: "auto" },
              bgcolor: "white",
              borderRadius: 2,
            }}
          >
            <ToggleButton value="table" sx={{ textTransform: "none", px: 2 }}>
              <ViewList fontSize="small" sx={{ mr: 0.75 }} /> Table
            </ToggleButton>
            <ToggleButton value="card" sx={{ textTransform: "none", px: 2 }}>
              <ViewModule fontSize="small" sx={{ mr: 0.75 }} /> Cards
            </ToggleButton>
          </ToggleButtonGroup>
        </Stack>

        {/* Loading skeletons */}
        {loading && (
          <Stack spacing={1.5}>
            {[...Array(4)].map((_, i) => (
              <Skeleton
                key={i}
                variant="rounded"
                height={effectiveView === "card" ? 96 : 52}
              />
            ))}
          </Stack>
        )}

        {/* Empty state */}
        {!loading && filtered.length === 0 && (
          <Paper
            variant="outlined"
            sx={{
              p: 5,
              textAlign: "center",
              borderRadius: 3,
              borderStyle: "dashed",
            }}
          >
            <GroupsOutlined
              sx={{ fontSize: 40, color: "text.disabled", mb: 1 }}
            />
            <Typography fontWeight={600}>
              {teachers.length === 0
                ? "No teachers added yet"
                : "No matches found"}
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              {teachers.length === 0
                ? "Add your first teacher to get started."
                : "Try a different search term."}
            </Typography>
            {teachers.length === 0 && (
              <Button
                variant="outlined"
                startIcon={<PersonAdd />}
                onClick={() => setOpen(true)}
              >
                Add teacher
              </Button>
            )}
          </Paper>
        )}

        {/* TABLE VIEW */}
        {!loading && filtered.length > 0 && effectiveView === "table" && (
          <Paper
            sx={{ borderRadius: 3, overflow: "hidden" }}
            variant="outlined"
          >
            <TableContainer sx={{ overflowX: "auto" }}>
              <Table size="small">
     <TableHead>
  <TableRow
    sx={{
      bgcolor: "rgba(25, 47, 159, 0.98)",

      "& th": {
        bgcolor: "rgba(23, 43, 143, 0.98)",
        color: "#FFFFFF",
        fontWeight: 700,
        fontSize: 11,
        letterSpacing: "0.5px",
        py: 1.25,
        borderBottom: "none",
        whiteSpace: "nowrap",
      },
    }}
  >
    <TableCell>Name</TableCell>
    <TableCell>Email</TableCell>
    <TableCell>Centre</TableCell>
    <TableCell>Status</TableCell>
    <TableCell align="right">Active</TableCell>
    <TableCell align="right">Actions</TableCell>
  </TableRow>
</TableHead>
                <TableBody>
                  {filtered.map((t) => (
                    <TableRow key={t._id} hover>
                      <TableCell>
                        <Stack
                          direction="row"
                          spacing={1.5}
                          alignItems="center"
                        >
                          <Avatar
                            sx={{
                              width: 32,
                              height: 32,
                              fontSize: 13,
                              bgcolor: colorForName(t.name),
                            }}
                          >
                            {initials(t.name)}
                          </Avatar>
                          <Typography variant="body2" fontWeight={600}>
                            {t.name}
                          </Typography>
                        </Stack>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2" color="text.secondary">
                          {t.email}
                        </Typography>
                      </TableCell>
                      <TableCell>{t.centre || "—"}</TableCell>
                      <TableCell>
                        <Chip
                          size="small"
                          label={t.active ? "Active" : "Disabled"}
                          color={t.active ? "success" : "default"}
                          sx={{ fontWeight: 600 }}
                        />
                      </TableCell>
                      <TableCell align="right">
                        <Tooltip
                          title={
                            t.active ? "Disable account" : "Enable account"
                          }
                        >
                          <Switch
                            checked={t.active}
                            onChange={() => toggleActive(t._id)}
                          />
                        </Tooltip>
                      </TableCell>
                      <TableCell align="right">
                        <Stack
                          direction="row"
                          spacing={0.5}
                          justifyContent="flex-end"
                        >
                          <Tooltip title="Edit teacher">
                            <IconButton
                              size="small"
                              onClick={() => openEdit(t)}
                            >
                              <Edit fontSize="small" />
                            </IconButton>
                          </Tooltip>
                          <Tooltip title="Delete teacher">
                            <IconButton
                              size="small"
                              color="error"
                              onClick={() => setDeleteTarget(t)}
                            >
                              <DeleteOutline fontSize="small" />
                            </IconButton>
                          </Tooltip>
                        </Stack>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          </Paper>
        )}

        {/* CARD VIEW */}
        {!loading && filtered.length > 0 && effectiveView === "card" && (
          <Box
            sx={{
              display: "grid",
              gridTemplateColumns: {
                xs: "1fr",
                sm: "1fr 1fr",
                md: "1fr 1fr 1fr",
              },
              gap: 2,
            }}
          >
            {filtered.map((t) => (
              <Paper
                key={t._id}
                variant="outlined"
                sx={{
                  p: 2,
                  borderRadius: 3,
                  display: "flex",
                  flexDirection: "column",
                  gap: 1.25,
                }}
              >
                <Stack direction="row" spacing={1.5} alignItems="center">
                  <Avatar
                    sx={{
                      width: 44,
                      height: 44,
                      bgcolor: colorForName(t.name),
                    }}
                  >
                    {initials(t.name)}
                  </Avatar>
                  <Box sx={{ minWidth: 0, flex: 1 }}>
                    <Typography fontWeight={700} noWrap>
                      {t.name}
                    </Typography>
                    <Chip
                      size="small"
                      label={t.active ? "Active" : "Disabled"}
                      color={t.active ? "success" : "default"}
                      sx={{ fontWeight: 600, height: 20, fontSize: 11 }}
                    />
                  </Box>
                  <Switch
                    checked={t.active}
                    onChange={() => toggleActive(t._id)}
                  />
                </Stack>

                <Stack direction="row" spacing={1} alignItems="center">
                  <MailOutline
                    fontSize="small"
                    sx={{ color: "text.disabled" }}
                  />
                  <Typography variant="body2" color="text.secondary" noWrap>
                    {t.email}
                  </Typography>
                </Stack>

                <Stack direction="row" spacing={1} alignItems="center">
                  <LocationOn
                    fontSize="small"
                    sx={{ color: "text.disabled" }}
                  />
                  <Typography variant="body2" color="text.secondary">
                    {t.centre || "No centre assigned"}
                  </Typography>
                </Stack>

                <Stack direction="row" spacing={1} justifyContent="flex-end">
                  <Button
                    size="small"
                    startIcon={<Edit fontSize="small" />}
                    onClick={() => openEdit(t)}
                    sx={{ textTransform: "none" }}
                  >
                    Edit
                  </Button>
                  <Button
                    size="small"
                    color="error"
                    startIcon={<DeleteOutline fontSize="small" />}
                    onClick={() => setDeleteTarget(t)}
                    sx={{ textTransform: "none" }}
                  >
                    Delete
                  </Button>
                </Stack>
              </Paper>
            ))}
          </Box>
        )}
      </Container>

      {/* =====================================================
          ADD TEACHER DIALOG
      ===================================================== */}
      <Dialog
        open={open}
        onClose={() => !saving && setOpen(false)}
        maxWidth="xs"
        fullWidth
      >
        <DialogTitle sx={{ fontWeight: 700 }}>Add teacher</DialogTitle>
        <DialogContent
          sx={{ display: "flex", flexDirection: "column", gap: 2, pt: 1 }}
        >
          {error && <Alert severity="error">{error}</Alert>}
          <TextField
            label="Full name"
            fullWidth
            autoFocus
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
          />
          <TextField
            label="Email"
            type="email"
            fullWidth
            value={form.email}
            onChange={(e) => {
              setForm({ ...form, email: e.target.value });
              setEmailFieldError("");
            }}
            error={!!emailFieldError}
            helperText={emailFieldError}
          />
          <TextField
            label="Temporary password"
            fullWidth
            value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })}
          />
          <TextField
            label="Centre (optional)"
            fullWidth
            value={form.centre}
            onChange={(e) => setForm({ ...form, centre: e.target.value })}
          />
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button
            onClick={() => setOpen(false)}
            disabled={saving}
            sx={{ textTransform: "none" }}
          >
            Cancel
          </Button>
          <Button
            variant="contained"
            onClick={handleCreate}
            disabled={saving}
            sx={{ textTransform: "none", fontWeight: 600, boxShadow: "none" }}
          >
            {saving ? "Creating…" : "Create"}
          </Button>
        </DialogActions>
      </Dialog>

      {/* =====================================================
          EDIT TEACHER DIALOG
      ===================================================== */}
      <Dialog open={editOpen} onClose={closeEdit} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ fontWeight: 700 }}>Edit teacher</DialogTitle>
        <DialogContent
          sx={{ display: "flex", flexDirection: "column", gap: 2, pt: 1 }}
        >
          {editError && <Alert severity="error">{editError}</Alert>}
          <TextField
            label="Full name"
            fullWidth
            autoFocus
            value={editForm.name}
            onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
          />
          <TextField
            label="Email"
            type="email"
            fullWidth
            value={editForm.email}
            onChange={(e) => {
              setEditForm({ ...editForm, email: e.target.value });
              setEditEmailFieldError("");
            }}
            error={!!editEmailFieldError}
            helperText={editEmailFieldError}
          />
          <TextField
            label="New password"
            placeholder="Leave blank to keep current password"
            fullWidth
            value={editForm.password}
            onChange={(e) =>
              setEditForm({ ...editForm, password: e.target.value })
            }
          />
          <TextField
            label="Centre (optional)"
            fullWidth
            value={editForm.centre}
            onChange={(e) =>
              setEditForm({ ...editForm, centre: e.target.value })
            }
          />
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button
            onClick={closeEdit}
            disabled={editSaving}
            sx={{ textTransform: "none" }}
          >
            Cancel
          </Button>
          <Button
            variant="contained"
            onClick={handleUpdate}
            disabled={editSaving}
            sx={{ textTransform: "none", fontWeight: 600, boxShadow: "none" }}
          >
            {editSaving ? "Saving…" : "Save changes"}
          </Button>
        </DialogActions>
      </Dialog>

      {/* =====================================================
          DELETE CONFIRMATION DIALOG
      ===================================================== */}
      <Dialog
        open={!!deleteTarget}
        onClose={() => !deleting && setDeleteTarget(null)}
        maxWidth="xs"
        fullWidth
      >
        <DialogTitle sx={{ fontWeight: 700 }}>Delete teacher</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary">
            Are you sure you want to permanently delete{" "}
            <strong>{deleteTarget?.name}</strong>? This action cannot be undone.
          </Typography>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
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
            onClick={handleDelete}
            disabled={deleting}
            sx={{ textTransform: "none", fontWeight: 600, boxShadow: "none" }}
          >
            {deleting ? "Deleting…" : "Delete"}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

export default function AdminTeachersPage() {
  return (
    <ProtectedRoute role="superadmin">
      <AdminTeachersInner />
    </ProtectedRoute>
  );
}

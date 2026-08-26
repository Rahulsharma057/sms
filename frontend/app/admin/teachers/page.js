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
} from "@mui/icons-material";
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

function AdminTeachersInner() {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("sm"));

  const [teachers, setTeachers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    name: "",
    email: "",
    password: "",
    centre: "",
  });
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [view, setView] = useState(null); // null = follow screen size, else user override

  const effectiveView = view || (isMobile ? "card" : "table");

  const load = () => {
    setLoading(true);
    api
      .get("/users/teachers")
      .then((res) => setTeachers(res.data))
      .finally(() => setLoading(false));
  };
  useEffect(() => {
    load();
  }, []);

  const handleCreate = async () => {
    setError("");
    try {
      await api.post("/users", form);
      setOpen(false);
      setForm({ name: "", email: "", password: "", centre: "" });
      load();
    } catch (err) {
      setError(
        err?.response?.data?.message || "Could not create teacher account.",
      );
    }
  };

  const toggleActive = async (id) => {
    setTeachers((prev) =>
      prev.map((t) => (t._id === id ? { ...t, active: !t.active } : t)),
    );
    try {
      await api.patch(`/users/${id}/toggle-active`);
    } catch {
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
                    sx={{ "& th": { fontWeight: 700, bgcolor: "#FAFAFB" } }}
                  >
                    <TableCell>Name</TableCell>
                    <TableCell>Email</TableCell>
                    <TableCell>Centre</TableCell>
                    <TableCell>Status</TableCell>
                    <TableCell align="right">Active</TableCell>
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
              </Paper>
            ))}
          </Box>
        )}
      </Container>

      {/* Add teacher dialog */}
      <Dialog
        open={open}
        onClose={() => setOpen(false)}
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
            onChange={(e) => setForm({ ...form, email: e.target.value })}
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
          <Button onClick={() => setOpen(false)} sx={{ textTransform: "none" }}>
            Cancel
          </Button>
          <Button
            variant="contained"
            onClick={handleCreate}
            sx={{ textTransform: "none", fontWeight: 600, boxShadow: "none" }}
          >
            Create
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

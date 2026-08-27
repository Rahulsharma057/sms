"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Alert,
  Avatar,
  Box,
  Button,
  Chip,
  CircularProgress,
  Container,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Grid,
  IconButton,
  List,
  ListItemButton,
  Menu,
  MenuItem,
  Paper,
  Select,
  Stack,
  TextField,
  Typography,
  useMediaQuery,
  useTheme,
} from "@mui/material";
import {
  Add,
  ArrowBack,
  AssignmentOutlined,
  CheckCircleOutline,
  AccessTimeOutlined,
  PendingActionsOutlined,
  ExpandMore,
  FilterListOutlined,
  PersonOutline,
} from "@mui/icons-material";
import ProtectedRoute from "../../../components/ProtectedRoute";
import Navbar from "../../../components/Navbar";
import TaskChat from "../../../components/TaskChat";
import api from "../../../lib/api";
import { useAuth } from "../../../context/AuthContext";

const STATUS_CONFIG = {
  pending: {
    label: "Pending",
    color: "warning",
    icon: <PendingActionsOutlined fontSize="small" />,
  },
  "in-progress": {
    label: "In Progress",
    color: "info",
    icon: <AccessTimeOutlined fontSize="small" />,
  },
  completed: {
    label: "Completed",
    color: "success",
    icon: <CheckCircleOutline fontSize="small" />,
  },
};
const STATUS_ORDER = ["pending", "in-progress", "completed"];
const EMPTY_FORM = { title: "", description: "", assignedTo: "", dueDate: "" };
const ALL_TEACHERS = "__all__";

const getStatusConfig = (status) =>
  STATUS_CONFIG[status] || {
    label: status || "Unknown",
    color: "default",
    icon: <AssignmentOutlined fontSize="small" />,
  };

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

function formatDueDate(date) {
  if (!date) return "No due date";
  const parsed = new Date(date);
  if (Number.isNaN(parsed.getTime())) return "No due date";
  return parsed.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

// Count messages in a task that weren't sent by me and that I haven't seen yet
function getUnreadCount(task, myId) {
  if (!Array.isArray(task?.messages) || !myId) return 0;
  return task.messages.filter((m) => {
    const senderId = String(m.sender?._id || m.sender);
    if (senderId === String(myId)) return false;
    return !m.seenBy?.some((id) => String(id) === String(myId));
  }).length;
}

function AdminTasksInner() {
  const { user } = useAuth();
  const myId = user?.id || user?._id;
  const theme = useTheme();
  // Matches the Grid breakpoint where the overlay actually renders (xs/sm only).
  const isMobile = useMediaQuery(theme.breakpoints.down("md"));

  const [tasks, setTasks] = useState([]);
  const [teachers, setTeachers] = useState([]);
  const [selected, setSelected] = useState(null);
  const [open, setOpen] = useState(false);
  const [mobileChatOpen, setMobileChatOpen] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const [teacherFilter, setTeacherFilter] = useState(ALL_TEACHERS);
  const [error, setError] = useState("");
  const [loadError, setLoadError] = useState("");

  const loadTasks = async () => {
    try {
      setLoadError("");
      const res = await api.get("/tasks");
      setTasks(Array.isArray(res.data) ? res.data : res.data?.data || []);
    } catch (err) {
      setLoadError(err?.response?.data?.message || "Unable to load tasks.");
    } finally {
      setLoading(false);
    }
  };

  const loadTeachers = async () => {
    try {
      const res = await api.get("/users/teachers");
      setTeachers(Array.isArray(res.data) ? res.data : res.data?.data || []);
    } catch (err) {
      console.error("Failed to load teachers:", err);
    }
  };

  useEffect(() => {
    loadTasks();
    loadTeachers();
  }, []);

  // Lightly re-poll the task list so unread badges update even when a chat isn't open
  useEffect(() => {
    const interval = setInterval(loadTasks, 8000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Lock background scroll ONLY while the full-screen mobile overlay is actually
  // showing (xs/sm). On desktop the chat renders inline with no back button, so
  // locking here unconditionally left the page permanently unscrollable and
  // clipped the sidebar/navbar out of view once a task was selected.
  useEffect(() => {
    const shouldLock = mobileChatOpen && isMobile;
    document.body.style.overflow = shouldLock ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [mobileChatOpen, isMobile]);

  // If the viewport crosses from mobile to desktop (e.g. rotating a tablet,
  // resizing a browser window) while the overlay is open, drop the mobile
  // overlay state so we don't leave stale "open" state lying around.
  useEffect(() => {
    if (!isMobile && mobileChatOpen) setMobileChatOpen(false);
  }, [isMobile, mobileChatOpen]);

  // Filtered by selected teacher
  const filteredTasks = useMemo(() => {
    if (teacherFilter === ALL_TEACHERS) return tasks;
    return tasks.filter((t) => t.assignedTo?._id === teacherFilter);
  }, [tasks, teacherFilter]);

  const selectedTask = useMemo(
    () => tasks.find((t) => t._id === selected),
    [tasks, selected],
  );

  const stats = useMemo(
    () => ({
      total: filteredTasks.length,
      pending: filteredTasks.filter((t) => t.status === "pending").length,
      inProgress: filteredTasks.filter((t) => t.status === "in-progress")
        .length,
      completed: filteredTasks.filter((t) => t.status === "completed").length,
    }),
    [filteredTasks],
  );

  const handleSelectTask = (id) => {
    setSelected(id);
    // Only trigger the full-screen mobile overlay on small viewports —
    // on desktop the chat is already shown inline in the right-hand pane.
    if (isMobile) setMobileChatOpen(true);
    // Optimistically clear the unread badge for this task; TaskChat will
    // persist the real "seen" state to the server as soon as it opens.
    setTasks((prev) =>
      prev.map((t) =>
        t._id === id
          ? {
              ...t,
              messages: (t.messages || []).map((m) => ({
                ...m,
                seenBy: m.seenBy?.some((sid) => String(sid) === String(myId))
                  ? m.seenBy
                  : [...(m.seenBy || []), myId],
              })),
            }
          : t,
      ),
    );
  };
  const handleBack = () => setMobileChatOpen(false);

  const handleOpenCreate = () => {
    setError("");
    setForm(EMPTY_FORM);
    setOpen(true);
  };
  const handleCloseCreate = () => {
    if (creating) return;
    setOpen(false);
    setError("");
    setForm(EMPTY_FORM);
  };

  const handleCreate = async () => {
    setError("");
    if (!form.title.trim()) return setError("Task title is required.");
    if (!form.assignedTo) return setError("Please select a teacher.");
    try {
      setCreating(true);
      await api.post("/tasks", {
        title: form.title.trim(),
        description: form.description.trim(),
        assignedTo: form.assignedTo,
        dueDate: form.dueDate || undefined,
      });
      handleCloseCreate();
      await loadTasks();
    } catch (err) {
      setError(
        err?.response?.data?.message ||
          "Could not create task. Please try again.",
      );
    } finally {
      setCreating(false);
    }
  };

  const handleStatusChange = async (taskId, newStatus) => {
    const prevTasks = tasks;
    setTasks((prev) =>
      prev.map((t) => (t._id === taskId ? { ...t, status: newStatus } : t)),
    );
    setUpdatingStatus(true);
    try {
      await api.patch(`/tasks/${taskId}/status`, { status: newStatus });
    } catch (err) {
      setTasks(prevTasks);
      setLoadError(err?.response?.data?.message || "Could not update status.");
    } finally {
      setUpdatingStatus(false);
    }
  };

  return (
    <Box sx={{ minHeight: "100dvh", bgcolor: "#f7f8fc" }}>
      <Navbar />
      <Container
        maxWidth="xl"
        sx={{ py: { xs: 1.5, sm: 2 }, px: { xs: 1, sm: 2, md: 3 } }}
      >
        {/* HEADER */}
        <Stack
          direction={{ xs: "column", sm: "row" }}
          justifyContent="space-between"
          alignItems={{ xs: "stretch", sm: "center" }}
          spacing={1.25}
          mb={1.75}
        >
          <Box>
            <Typography
              fontWeight={800}
              sx={{ fontSize: { xs: "1.2rem", sm: "1.4rem" } }}
            >
              Tasks
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Assign and track teacher work
            </Typography>
          </Box>
          <Button
            variant="contained"
            startIcon={<Add />}
            onClick={handleOpenCreate}
            sx={{
              minHeight: 38,
              px: 2,
              borderRadius: 2,
              textTransform: "none",
              fontWeight: 700,
              alignSelf: { xs: "stretch", sm: "auto" },
              boxShadow: "none",
            }}
          >
            Assign Task
          </Button>
        </Stack>

        {/* STATS */}
        <Grid container spacing={1} mb={1.75}>
          <Grid item xs={6} sm={3}>
            <StatCard
              label="Total"
              value={stats.total}
              icon={<AssignmentOutlined fontSize="small" />}
            />
          </Grid>
          <Grid item xs={6} sm={3}>
            <StatCard
              label="Pending"
              value={stats.pending}
              icon={<PendingActionsOutlined fontSize="small" />}
            />
          </Grid>
          <Grid item xs={6} sm={3}>
            <StatCard
              label="In Progress"
              value={stats.inProgress}
              icon={<AccessTimeOutlined fontSize="small" />}
            />
          </Grid>
          <Grid item xs={6} sm={3}>
            <StatCard
              label="Completed"
              value={stats.completed}
              icon={<CheckCircleOutline fontSize="small" />}
            />
          </Grid>
        </Grid>

        {loadError && (
          <Alert
            severity="error"
            sx={{ mb: 1.75, borderRadius: 2 }}
            action={
              <Button color="inherit" size="small" onClick={loadTasks}>
                Retry
              </Button>
            }
          >
            {loadError}
          </Alert>
        )}

        {/* MAIN AREA */}
        <Paper
          elevation={0}
          sx={{
            border: "1px solid",
            borderColor: "divider",
            borderRadius: 2,
            overflow: "hidden",
            height: {
              xs: "calc(100dvh - 250px)",
              sm: "calc(100dvh - 260px)",
              md: "calc(100dvh - 265px)",
            },
            minHeight: { xs: 420, sm: 480, md: 580 },
          }}
        >
          <Grid container sx={{ height: "100%" }}>
            {/* TASK LIST — always visible on mobile (chat opens as an overlay on top of it) */}
            <Grid
              item
              xs={12}
              md={4}
              sx={{
                height: "100%",
                display: "flex",
                flexDirection: "column",
                borderRight: { md: "1px solid" },
                borderColor: { md: "divider" },
              }}
            >
              {/* LIST HEADER + TEACHER FILTER */}
              <Box
                sx={{
                  px: { xs: 1.25, sm: 1.75 },
                  py: 1.25,
                  borderBottom: "1px solid",
                  borderColor: "divider",
                  flexShrink: 0,
                }}
              >
                <Stack
                  direction="row"
                  justifyContent="space-between"
                  alignItems="center"
                  mb={1}
                >
                  <Typography fontWeight={700} fontSize="0.95rem">
                    Assigned Tasks
                  </Typography>
                  <Chip
                    size="small"
                    label={filteredTasks.length}
                    sx={{ height: 22, fontWeight: 700 }}
                  />
                </Stack>

                <Select
                  size="small"
                  fullWidth
                  value={teacherFilter}
                  onChange={(e) => setTeacherFilter(e.target.value)}
                  displayEmpty
                  startAdornment={
                    <FilterListOutlined
                      fontSize="small"
                      sx={{ mr: 1, color: "text.disabled" }}
                    />
                  }
                  sx={{
                    borderRadius: 1.5,
                    fontSize: "0.85rem",
                    bgcolor: "action.hover",
                  }}
                  MenuProps={{ PaperProps: { sx: { maxHeight: 320 } } }}
                >
                  <MenuItem value={ALL_TEACHERS}>All teachers</MenuItem>
                  {teachers.map((t) => (
                    <MenuItem key={t._id} value={t._id}>
                      <Stack
                        direction="row"
                        spacing={1}
                        alignItems="center"
                        sx={{ minWidth: 0 }}
                      >
                        <Avatar
                          sx={{
                            width: 20,
                            height: 20,
                            fontSize: 10,
                            bgcolor: colorForName(t.name),
                            flexShrink: 0,
                          }}
                        >
                          {initials(t.name)}
                        </Avatar>
                        <Box
                          component="span"
                          sx={{
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                          }}
                        >
                          {t.name}
                        </Box>
                      </Stack>
                    </MenuItem>
                  ))}
                </Select>
              </Box>

              <Box sx={{ flex: 1, minHeight: 0, overflowY: "auto" }}>
                {loading ? (
                  <Box
                    sx={{ py: 8, display: "flex", justifyContent: "center" }}
                  >
                    <CircularProgress size={26} />
                  </Box>
                ) : filteredTasks.length === 0 ? (
                  <EmptyTasks
                    onAdd={handleOpenCreate}
                    filtered={teacherFilter !== ALL_TEACHERS}
                  />
                ) : (
                  <List disablePadding>
                    {filteredTasks.map((task) => (
                      <TaskListItem
                        key={task._id}
                        task={task}
                        selected={selected === task._id}
                        unread={getUnreadCount(task, myId)}
                        onClick={() => handleSelectTask(task._id)}
                      />
                    ))}
                  </List>
                )}
              </Box>
            </Grid>

            {/* CHAT — desktop: inline panel. Mobile: rendered as full-screen overlay below (hidden here). */}
            <Grid
              item
              xs={false}
              md={8}
              sx={{
                height: "100%",
                display: { xs: "none", md: "flex" },
                flexDirection: "column",
                minWidth: 0,
              }}
            >
              <ChatPane
                task={selectedTask}
                updatingStatus={updatingStatus}
                onStatusChange={handleStatusChange}
                onBack={handleBack}
                showBack={false}
              />
            </Grid>
          </Grid>
        </Paper>
      </Container>

      {/* MOBILE FULL-SCREEN CHAT OVERLAY — WhatsApp style */}
      {mobileChatOpen && selectedTask && (
        <Box
          sx={{
            display: { xs: "flex", md: "none" },
            flexDirection: "column",
            position: "fixed",
            inset: 0,
            height: "100dvh",
            width: "100vw",
            zIndex: 1300,
            bgcolor: "background.paper",
          }}
        >
          <ChatPane
            task={selectedTask}
            updatingStatus={updatingStatus}
            onStatusChange={handleStatusChange}
            onBack={handleBack}
            showBack
          />
        </Box>
      )}

      {/* CREATE TASK DIALOG */}
      <Dialog
        open={open}
        onClose={handleCloseCreate}
        fullWidth
        maxWidth="sm"
        PaperProps={{
          sx: {
            borderRadius: { xs: 0, sm: 2.5 },
            mx: { xs: 0, sm: 1.5 },
            my: { xs: 0, sm: "auto" },
            height: { xs: "100%", sm: "auto" },
            maxHeight: { xs: "100%", sm: "calc(100% - 64px)" },
          },
        }}
        sx={{
          "& .MuiDialog-container": {
            alignItems: { xs: "stretch", sm: "center" },
          },
        }}
      >
        <DialogTitle sx={{ pb: 1, fontWeight: 800 }}>
          Assign New Task
        </DialogTitle>
        <DialogContent sx={{ pt: "8px !important" }}>
          {error && (
            <Alert severity="error" sx={{ mb: 2, borderRadius: 1.5 }}>
              {error}
            </Alert>
          )}
          <Stack spacing={1.5}>
            <TextField
              label="Task title"
              placeholder="e.g. Complete attendance report"
              fullWidth
              size="small"
              autoFocus
              value={form.title}
              onChange={(e) =>
                setForm((p) => ({ ...p, title: e.target.value }))
              }
            />
            <TextField
              label="Description"
              placeholder="Add task instructions..."
              fullWidth
              multiline
              minRows={3}
              size="small"
              value={form.description}
              onChange={(e) =>
                setForm((p) => ({ ...p, description: e.target.value }))
              }
            />
            <TextField
              select
              label="Assign to teacher"
              fullWidth
              size="small"
              value={form.assignedTo}
              onChange={(e) =>
                setForm((p) => ({ ...p, assignedTo: e.target.value }))
              }
              SelectProps={{
                MenuProps: { PaperProps: { sx: { maxHeight: 320 } } },
              }}
            >
              <MenuItem value="" disabled>
                Select teacher
              </MenuItem>
              {teachers.map((t) => (
                <MenuItem key={t._id} value={t._id}>
                  <Stack
                    direction="row"
                    spacing={1}
                    alignItems="center"
                    sx={{ minWidth: 0 }}
                  >
                    <Avatar
                      sx={{
                        width: 22,
                        height: 22,
                        fontSize: 10,
                        bgcolor: colorForName(t.name),
                        flexShrink: 0,
                      }}
                    >
                      {initials(t.name)}
                    </Avatar>
                    <Box
                      component="span"
                      sx={{
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {t.name}
                    </Box>
                  </Stack>
                </MenuItem>
              ))}
            </TextField>
            <TextField
              label="Due date"
              type="date"
              fullWidth
              size="small"
              InputLabelProps={{ shrink: true }}
              value={form.dueDate}
              onChange={(e) =>
                setForm((p) => ({ ...p, dueDate: e.target.value }))
              }
            />
          </Stack>
        </DialogContent>
        <DialogActions
          sx={{ px: 2.5, pb: { xs: 2.5, sm: 2 }, gap: 1, flexWrap: "wrap" }}
        >
          <Button
            onClick={handleCloseCreate}
            disabled={creating}
            sx={{ textTransform: "none", fontWeight: 600 }}
          >
            Cancel
          </Button>
          <Button
            variant="contained"
            onClick={handleCreate}
            disabled={creating}
            startIcon={
              creating ? (
                <CircularProgress size={16} color="inherit" />
              ) : (
                <Add />
              )
            }
            sx={{
              minWidth: 110,
              textTransform: "none",
              fontWeight: 700,
              borderRadius: 1.5,
              boxShadow: "none",
            }}
          >
            {creating ? "Assigning..." : "Assign Task"}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

// Shared chat panel — used both inline (desktop) and as a full-screen overlay (mobile).
function ChatPane({ task, updatingStatus, onStatusChange, onBack, showBack }) {
  if (!task) {
    return (
      <Box
        sx={{
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          px: 3,
          textAlign: "center",
        }}
      >
        <Box>
          <Box
            sx={{
              width: 54,
              height: 54,
              borderRadius: "50%",
              bgcolor: "action.hover",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              mx: "auto",
              mb: 1.25,
            }}
          >
            <AssignmentOutlined sx={{ fontSize: 26, color: "text.disabled" }} />
          </Box>
          <Typography fontWeight={800}>Select a task</Typography>
          <Typography
            variant="body2"
            color="text.secondary"
            sx={{ mt: 0.5, maxWidth: 280 }}
          >
            Select a task from the left to open its full conversation.
          </Typography>
        </Box>
      </Box>
    );
  }

  return (
    <>
      <Box
        sx={{
          px: 1.5,
          py: 1,
          borderBottom: "1px solid",
          borderColor: "divider",
          flexShrink: 0,
        }}
      >
        <Stack direction="row" alignItems="center" spacing={1}>
          {showBack && (
            <IconButton size="small" onClick={onBack} sx={{ flexShrink: 0 }}>
              <ArrowBack fontSize="small" />
            </IconButton>
          )}
          <Avatar
            sx={{
              width: { xs: 30, sm: 34 },
              height: { xs: 30, sm: 34 },
              fontSize: 13,
              bgcolor: colorForName(task.assignedTo?.name),
              flexShrink: 0,
            }}
          >
            {initials(task.assignedTo?.name)}
          </Avatar>
          <Box sx={{ minWidth: 0, flex: 1 }}>
            <Typography fontWeight={800} fontSize="0.9rem" noWrap>
              {task.title}
            </Typography>
            <Stack direction="row" spacing={0.5} alignItems="center">
              <PersonOutline
                sx={{ fontSize: 13, color: "text.disabled", flexShrink: 0 }}
              />
              <Typography variant="caption" color="text.secondary" noWrap>
                {task.assignedTo?.name || "Unassigned"}
              </Typography>
            </Stack>
          </Box>
          <StatusSelect
            status={task.status}
            disabled={updatingStatus}
            onChange={(s) => onStatusChange(task._id, s)}
          />
        </Stack>
      </Box>

      {task.description && (
        <Box
          sx={{
            px: 1.75,
            py: 0.85,
            bgcolor: "action.hover",
            borderBottom: "1px solid",
            borderColor: "divider",
            flexShrink: 0,
          }}
        >
          <Typography
            variant="caption"
            color="text.secondary"
            sx={{
              lineHeight: 1.5,
              display: "-webkit-box",
              WebkitLineClamp: { xs: 2, sm: 3 },
              WebkitBoxOrient: "vertical",
              overflow: "hidden",
            }}
          >
            <b>Task:</b> {task.description}
          </Typography>
        </Box>
      )}

      <Box sx={{ flex: 1, minHeight: 0, overflow: "hidden" }}>
        <TaskChat taskId={task._id} />
      </Box>
    </>
  );
}

function StatCard({ label, value, icon }) {
  return (
    <Paper
      elevation={0}
      sx={{
        p: 1.1,
        border: "1px solid",
        borderColor: "divider",
        borderRadius: 2,
        height: "100%",
      }}
    >
      <Stack direction="row" alignItems="center" spacing={1}>
        <Box
          sx={{
            width: 28,
            height: 28,
            borderRadius: 1.5,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            bgcolor: "action.hover",
            color: "text.secondary",
            flexShrink: 0,
          }}
        >
          {icon}
        </Box>
        <Box sx={{ minWidth: 0 }}>
          <Typography variant="caption" color="text.secondary" noWrap>
            {label}
          </Typography>
          <Typography
            fontWeight={800}
            lineHeight={1.1}
            sx={{ fontSize: { xs: "0.95rem", sm: "1.1rem" } }}
          >
            {value}
          </Typography>
        </Box>
      </Stack>
    </Paper>
  );
}

function StatusChip({ status }) {
  const config = getStatusConfig(status);
  return (
    <Chip
      size="small"
      color={config.color}
      icon={config.icon}
      label={config.label}
      sx={{
        fontWeight: 700,
        height: 26,
        flexShrink: 0,
        fontSize: { xs: "0.68rem", sm: "0.75rem" },
        "& .MuiChip-label": { px: { xs: 0.6, sm: 1 } },
      }}
    />
  );
}

function StatusSelect({ status, onChange, disabled }) {
  const [anchorEl, setAnchorEl] = useState(null);
  const config = getStatusConfig(status);

  return (
    <>
      <Chip
        size="small"
        color={config.color}
        icon={config.icon}
        label={config.label}
        deleteIcon={<ExpandMore fontSize="small" />}
        onDelete={(e) => setAnchorEl(e.currentTarget)}
        onClick={(e) => setAnchorEl(e.currentTarget)}
        disabled={disabled}
        sx={{
          fontWeight: 700,
          height: 26,
          flexShrink: 0,
          cursor: "pointer",
          fontSize: { xs: "0.68rem", sm: "0.75rem" },
          "& .MuiChip-label": { px: { xs: 0.6, sm: 1 } },
        }}
      />
      <Menu
        anchorEl={anchorEl}
        open={!!anchorEl}
        onClose={() => setAnchorEl(null)}
      >
        {STATUS_ORDER.map((s) => {
          const c = STATUS_CONFIG[s];
          return (
            <MenuItem
              key={s}
              selected={s === status}
              onClick={() => {
                onChange(s);
                setAnchorEl(null);
              }}
            >
              <Stack direction="row" spacing={1} alignItems="center">
                {c.icon}
                <span>{c.label}</span>
              </Stack>
            </MenuItem>
          );
        })}
      </Menu>
    </>
  );
}

function TaskListItem({ task, selected, unread, onClick }) {
  return (
    <ListItemButton
      selected={selected}
      onClick={onClick}
      sx={{
        px: { xs: 1.25, sm: 1.75 },
        py: 1.15,
        alignItems: "flex-start",
        gap: { xs: 1, sm: 1.25 },
        borderBottom: "1px solid",
        borderColor: "divider",
        "&.Mui-selected": { bgcolor: "action.selected" },
        "&.Mui-selected:hover": { bgcolor: "action.hover" },
      }}
    >
      <Box sx={{ position: "relative", flexShrink: 0, mt: 0.25 }}>
        <Avatar
          sx={{
            width: 34,
            height: 34,
            fontSize: 12,
            bgcolor: colorForName(task.assignedTo?.name),
          }}
        >
          {initials(task.assignedTo?.name)}
        </Avatar>
        {unread > 0 && (
          <Box
            sx={{
              position: "absolute",
              top: -4,
              right: -4,
              minWidth: 18,
              height: 18,
              px: 0.4,
              borderRadius: "50%",
              bgcolor: "error.main",
              color: "white",
              fontSize: 10,
              fontWeight: 800,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              border: "2px solid #fff",
            }}
          >
            {unread > 9 ? "9+" : unread}
          </Box>
        )}
      </Box>
      <Box sx={{ width: "100%", minWidth: 0 }}>
        <Stack
          direction="row"
          justifyContent="space-between"
          alignItems="flex-start"
          spacing={0.75}
          flexWrap="wrap"
        >
          <Typography
            fontWeight={unread > 0 ? 800 : 700}
            sx={{
              fontSize: "0.88rem",
              lineHeight: 1.3,
              minWidth: 0,
              flex: "1 1 140px",
              overflow: "hidden",
              display: "-webkit-box",
              WebkitLineClamp: 2,
              WebkitBoxOrient: "vertical",
            }}
          >
            {task.title || "Untitled task"}
          </Typography>
          <StatusChip status={task.status} />
        </Stack>
        <Typography
          variant="caption"
          color="text.secondary"
          sx={{ display: "block", mt: 0.5 }}
          noWrap
        >
          {task.assignedTo?.name || "Unassigned"}
        </Typography>
        <Typography
          variant="caption"
          color="text.secondary"
          sx={{ display: "block", mt: 0.15 }}
        >
          Due: {formatDueDate(task.dueDate)}
        </Typography>
      </Box>
    </ListItemButton>
  );
}

function EmptyTasks({ onAdd, filtered }) {
  return (
    <Box sx={{ px: 2, py: 6, textAlign: "center" }}>
      <AssignmentOutlined
        sx={{ fontSize: 36, color: "text.disabled", mb: 1 }}
      />
      <Typography fontWeight={700}>
        {filtered ? "No tasks for this teacher" : "No tasks yet"}
      </Typography>
      <Typography
        variant="body2"
        color="text.secondary"
        sx={{ mt: 0.5, mb: filtered ? 0 : 1.75 }}
      >
        {filtered
          ? "Try selecting a different teacher, or all teachers."
          : "Assign your first task to a teacher."}
      </Typography>
      {!filtered && (
        <Button
          size="small"
          variant="outlined"
          startIcon={<Add />}
          onClick={onAdd}
          sx={{ textTransform: "none", borderRadius: 1.5, mt: 1.75 }}
        >
          Assign Task
        </Button>
      )}
    </Box>
  );
}

export default function AdminTasksPage() {
  return (
    <ProtectedRoute role="superadmin">
      <AdminTasksInner />
    </ProtectedRoute>
  );
}

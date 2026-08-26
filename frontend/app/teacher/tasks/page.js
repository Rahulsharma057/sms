"use client";
import { useEffect, useMemo, useState } from "react";
import {
  Box, Container, Typography, Paper, List, ListItemButton, ListItemText,
  Chip, Grid, Stack, Avatar, IconButton, Skeleton, ListItemAvatar, Divider,
  Menu, MenuItem,
} from "@mui/material";
import {
  ArrowBack, AssignmentOutlined, ChatBubbleOutline, ExpandMore,
  CheckCircleOutline, AccessTimeOutlined, PendingActionsOutlined,
} from "@mui/icons-material";
import ProtectedRoute from "../../../components/ProtectedRoute";
import Navbar from "../../../components/Navbar";
import TaskChat from "../../../components/TaskChat";
import api from "../../../lib/api";

const STATUS_CONFIG = {
  pending: { label: "Pending", color: "warning", icon: <PendingActionsOutlined fontSize="small" /> },
  "in-progress": { label: "In progress", color: "info", icon: <AccessTimeOutlined fontSize="small" /> },
  completed: { label: "Completed", color: "success", icon: <CheckCircleOutline fontSize="small" /> },
};
const STATUS_ORDER = ["pending", "in-progress", "completed"];
const getStatusConfig = (status) =>
  STATUS_CONFIG[status] || { label: status || "Unknown", color: "default", icon: <AssignmentOutlined fontSize="small" /> };

const AVATAR_COLORS = ["#6366F1", "#0EA5E9", "#10B981", "#F59E0B", "#EF4444", "#8B5CF6", "#EC4899"];
function colorForName(name = "") {
  const idx = [...name].reduce((sum, ch) => sum + ch.charCodeAt(0), 0);
  return AVATAR_COLORS[idx % AVATAR_COLORS.length];
}
function initials(name = "") {
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] || "") + (parts[1]?.[0] || "")).toUpperCase() || "?";
}

function TeacherTasksInner() {
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);
  const [mobileChatOpen, setMobileChatOpen] = useState(false);
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const [error, setError] = useState("");

  const load = () => {
    setLoading(true);
    api.get("/tasks/mine").then((res) => setTasks(res.data)).finally(() => setLoading(false));
  };
  useEffect(() => { load(); }, []);

  // Lock background scroll while the full-screen mobile chat is open (WhatsApp-style)
  useEffect(() => {
    document.body.style.overflow = mobileChatOpen ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [mobileChatOpen]);

  const selectedTask = useMemo(() => tasks.find((t) => t._id === selected) || null, [tasks, selected]);
  const pendingCount = useMemo(() => tasks.filter((t) => t.status !== "completed").length, [tasks]);

  const handleSelectTask = (id) => { setSelected(id); setMobileChatOpen(true); };
  const handleBack = () => setMobileChatOpen(false);

  // Status change: optimistic update so the UI reflects it immediately, revert on failure.
  const handleStatusChange = async (taskId, newStatus) => {
    setError("");
    const prevTasks = tasks;
    setTasks((prev) => prev.map((t) => (t._id === taskId ? { ...t, status: newStatus } : t)));
    setUpdatingStatus(true);
    try {
      await api.patch(`/tasks/${taskId}/status`, { status: newStatus });
    } catch (err) {
      setTasks(prevTasks); // revert on failure
      setError(err?.response?.data?.message || "Could not update status.");
    } finally {
      setUpdatingStatus(false);
    }
  };

  return (
    <Box sx={{ bgcolor: "#F7F8FA", minHeight: "100vh" }}>
      <Navbar />
      <Container maxWidth="lg" sx={{ py: { xs: 2, sm: 3 } }}>
        <Box sx={{ mb: { xs: 2, sm: 3 } }}>
          <Typography variant="h5" fontWeight={700}>My tasks</Typography>
          <Typography variant="body2" color="text.secondary">
            {loading
              ? "Loading…"
              : pendingCount > 0
                ? `${pendingCount} task${pendingCount === 1 ? "" : "s"} need${pendingCount === 1 ? "s" : ""} your attention`
                : "You're all caught up."}
          </Typography>
        </Box>

        <Grid container spacing={2}>
          {/* LIST PANE — always visible on mobile; chat opens as a full-screen overlay on top */}
          <Grid item xs={12} md={4}>
            <Paper variant="outlined" sx={{ borderRadius: 3, maxHeight: { xs: "none", md: 620 }, overflowY: "auto" }}>
              {loading ? (
                <Stack spacing={1.5} p={2}>
                  {[...Array(4)].map((_, i) => <Skeleton key={i} variant="rounded" height={64} />)}
                </Stack>
              ) : tasks.length === 0 ? (
                <Box sx={{ p: 4, textAlign: "center" }}>
                  <AssignmentOutlined sx={{ fontSize: 36, color: "text.disabled", mb: 1 }} />
                  <Typography fontWeight={600}>No tasks assigned yet</Typography>
                  <Typography variant="body2" color="text.secondary">
                    New tasks from admins will show up here.
                  </Typography>
                </Box>
              ) : (
                <List disablePadding>
                  {tasks.map((t, i) => (
                    <Box key={t._id}>
                      <ListItemButton
                        selected={selected === t._id}
                        onClick={() => handleSelectTask(t._id)}
                        sx={{ py: 1.5, px: 2, gap: 1.5, "&.Mui-selected": { bgcolor: "action.selected" } }}
                      >
                        <ListItemAvatar sx={{ minWidth: 44 }}>
                          <Avatar sx={{ width: 36, height: 36, fontSize: 13, bgcolor: colorForName(t.assignedBy?.name) }}>
                            {initials(t.assignedBy?.name)}
                          </Avatar>
                        </ListItemAvatar>
                        <ListItemText
                          primary={<Typography fontWeight={600} noWrap>{t.title}</Typography>}
                          secondary={
                            <Typography variant="body2" color="text.secondary" noWrap>
                              From {t.assignedBy?.name || "—"}
                            </Typography>
                          }
                        />
                        <StatusChip status={t.status} />
                      </ListItemButton>
                      {i < tasks.length - 1 && <Divider component="li" />}
                    </Box>
                  ))}
                </List>
              )}
            </Paper>
          </Grid>

          {/* CHAT PANE — desktop only inline (mobile uses the overlay below) */}
          <Grid item xs={false} md={8} sx={{ display: { xs: "none", md: "block" } }}>
            <ChatPane
              task={selectedTask}
              updatingStatus={updatingStatus}
              onStatusChange={handleStatusChange}
              onBack={handleBack}
              showBack={false}
            />
          </Grid>
        </Grid>
      </Container>

      {/* MOBILE FULL-SCREEN CHAT OVERLAY — WhatsApp style */}
      {mobileChatOpen && selectedTask && (
        <Box sx={{
          display: { xs: "flex", md: "none" }, flexDirection: "column",
          position: "fixed", inset: 0, zIndex: 1300, bgcolor: "background.paper",
        }}>
          <ChatPane
            task={selectedTask}
            updatingStatus={updatingStatus}
            onStatusChange={handleStatusChange}
            onBack={handleBack}
            showBack
          />
        </Box>
      )}
    </Box>
  );
}

// Shared chat panel — used both inline (desktop) and as a full-screen overlay (mobile).
function ChatPane({ task, updatingStatus, onStatusChange, onBack, showBack }) {
  if (!task) {
    return (
      <Paper
        variant="outlined"
        sx={{
          p: 5, textAlign: "center", borderRadius: 3, borderStyle: "dashed",
          height: "100%", display: "flex", flexDirection: "column",
          alignItems: "center", justifyContent: "center", minHeight: 300,
        }}
      >
        <ChatBubbleOutline sx={{ fontSize: 36, color: "text.disabled", mb: 1 }} />
        <Typography color="text.secondary">Select a task to view details and chat.</Typography>
      </Paper>
    );
  }

  return (
    <Box sx={{ height: "100%", display: "flex", flexDirection: "column" }}>
      <Stack
        direction="row" spacing={1} alignItems="center"
        sx={{
          p: 1, flexShrink: 0, bgcolor: "white", border: "1px solid", borderColor: "divider",
          borderRadius: showBack ? 0 : 3, mb: showBack ? 0 : 1.5,
        }}
      >
        {showBack && (
          <IconButton size="small" onClick={onBack}>
            <ArrowBack fontSize="small" />
          </IconButton>
        )}
        <Avatar sx={{ width: 32, height: 32, fontSize: 12, bgcolor: colorForName(task.assignedBy?.name) }}>
          {initials(task.assignedBy?.name)}
        </Avatar>
        <Box sx={{ minWidth: 0, flex: 1 }}>
          <Typography fontWeight={700} noWrap fontSize={14}>{task.title}</Typography>
          <Typography variant="caption" color="text.secondary" noWrap>
            From {task.assignedBy?.name || "—"}
          </Typography>
        </Box>
        <StatusSelect status={task.status} disabled={updatingStatus} onChange={(s) => onStatusChange(task._id, s)} />
      </Stack>

      {task.description && (
        <Box sx={{ px: 1.75, py: 0.85, bgcolor: "action.hover", borderBottom: showBack ? "1px solid" : "none", borderColor: "divider", flexShrink: 0 }}>
          <Typography variant="caption" color="text.secondary" sx={{ lineHeight: 1.5 }}>
            <b>Task:</b> {task.description}
          </Typography>
        </Box>
      )}

      <Box sx={{ flex: 1, minHeight: 0, overflow: "hidden" }}>
        <TaskChat taskId={task._id} />
      </Box>
    </Box>
  );
}

function StatusChip({ status }) {
  const config = getStatusConfig(status);
  return <Chip size="small" color={config.color} icon={config.icon} label={config.label} sx={{ fontWeight: 600, ml: 1, flexShrink: 0 }} />;
}

// Lets the teacher change their own task's status directly from the chat header.
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
        sx={{ fontWeight: 700, height: 26, flexShrink: 0, cursor: "pointer" }}
      />
      <Menu anchorEl={anchorEl} open={!!anchorEl} onClose={() => setAnchorEl(null)}>
        {STATUS_ORDER.map((s) => {
          const c = STATUS_CONFIG[s];
          return (
            <MenuItem key={s} selected={s === status} onClick={() => { onChange(s); setAnchorEl(null); }}>
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

export default function TeacherTasksPage() {
  return (
    <ProtectedRoute role="teacher">
      <TeacherTasksInner />
    </ProtectedRoute>
  );
}
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
  Checkbox,
  FormControl,
  InputLabel,
  OutlinedInput,
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
  DeleteOutline,
  GroupsOutlined,
  PersonAddAlt1Outlined,
} from "@mui/icons-material";

import ProtectedRoute from "../../../components/ProtectedRoute";
import Navbar from "../../../components/Navbar";
import TaskChat from "../../../components/TaskChat";
import api from "../../../lib/api";
import { useAuth } from "../../../context/AuthContext";

/* ======================================================
   STATUS
====================================================== */

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

/* ======================================================
   TASK MODES
====================================================== */

const TASK_MODES = {
  INDIVIDUAL: {
    label: "Individual",
    description: "Assign the task to one teacher.",
    icon: <PersonOutline fontSize="small" />,
  },

  SEPARATE: {
    label: "Separate",
    description:
      "Assign the same task to multiple teachers. Each teacher gets a separate task and chat.",
    icon: <PersonAddAlt1Outlined fontSize="small" />,
  },

  GROUP: {
    label: "Group",
    description: "Create one shared task and one common group conversation.",
    icon: <GroupsOutlined fontSize="small" />,
  },
};

const EMPTY_FORM = {
  title: "",
  description: "",
  mode: "INDIVIDUAL",
  assignedTo: "",
  assignedToList: [],
  dueDate: "",
};

const ALL_TEACHERS = "__all__";

/* ======================================================
   HELPERS
====================================================== */

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

  if (Number.isNaN(parsed.getTime())) {
    return "No due date";
  }

  return parsed.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

/* ======================================================
   GET PARTICIPANTS
====================================================== */

function getTaskPeople(task) {
  if (!task) return [];

  if (task.mode === "GROUP") {
    return Array.isArray(task.participants) ? task.participants : [];
  }

  return task.assignedTo ? [task.assignedTo] : [];
}

function getTaskPeopleNames(task) {
  const people = getTaskPeople(task);

  if (!people.length) return "Unassigned";

  if (people.length === 1) {
    return people[0]?.name || "Teacher";
  }

  return `${people[0]?.name || "Teacher"} + ${people.length - 1} more`;
}

/* ======================================================
   UNREAD
====================================================== */

function getUnreadCount(task, myId) {
  if (!Array.isArray(task?.messages) || !myId) return 0;

  return task.messages.filter((m) => {
    const senderId = String(m.sender?._id || m.sender);

    if (senderId === String(myId)) {
      return false;
    }

    return !m.seenBy?.some((id) => String(id) === String(myId));
  }).length;
}

/* ======================================================
   MAIN
====================================================== */

function AdminTasksInner() {
  const { user } = useAuth();

  const myId = user?.id || user?._id;

  const theme = useTheme();

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

  const [deleting, setDeleting] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);

  /* ====================================================
     LOAD TASKS
  ==================================================== */

  const loadTasks = async () => {
    try {
      setLoadError("");

      const res = await api.get("/tasks");

      const data = Array.isArray(res.data) ? res.data : res.data?.data || [];

      setTasks(data);
    } catch (err) {
      setLoadError(err?.response?.data?.message || "Unable to load tasks.");
    } finally {
      setLoading(false);
    }
  };

  /* ====================================================
     LOAD TEACHERS
  ==================================================== */

  const loadTeachers = async () => {
    try {
      const res = await api.get("/users/teachers");

      const data = Array.isArray(res.data) ? res.data : res.data?.data || [];

      setTeachers(data);
    } catch (err) {
      console.error("Failed to load teachers:", err);
    }
  };

  useEffect(() => {
    loadTasks();
    loadTeachers();
  }, []);

  /* ====================================================
     POLLING
  ==================================================== */

  useEffect(() => {
    const interval = setInterval(loadTasks, 8000);

    return () => clearInterval(interval);

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ====================================================
     MOBILE SCROLL LOCK
  ==================================================== */

  useEffect(() => {
    const shouldLock = mobileChatOpen && isMobile;

    document.body.style.overflow = shouldLock ? "hidden" : "";

    return () => {
      document.body.style.overflow = "";
    };
  }, [mobileChatOpen, isMobile]);

  useEffect(() => {
    if (!isMobile && mobileChatOpen) {
      setMobileChatOpen(false);
    }
  }, [isMobile, mobileChatOpen]);

  /* ====================================================
     FILTER
  ==================================================== */

  const filteredTasks = useMemo(() => {
    if (teacherFilter === ALL_TEACHERS) {
      return tasks;
    }

    return tasks.filter((task) => {
      if (task.mode === "GROUP") {
        return task.participants?.some(
          (teacher) => String(teacher?._id) === String(teacherFilter),
        );
      }

      return String(task.assignedTo?._id) === String(teacherFilter);
    });
  }, [tasks, teacherFilter]);

  /* ====================================================
     SELECTED TASK
  ==================================================== */

  const selectedTask = useMemo(
    () => tasks.find((task) => task._id === selected),
    [tasks, selected],
  );

  /* ====================================================
     STATS
  ==================================================== */

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

  /* ====================================================
     SELECT TASK
  ==================================================== */

  const handleSelectTask = (id) => {
    setSelected(id);

    if (isMobile) {
      setMobileChatOpen(true);
    }

    setTasks((prev) =>
      prev.map((task) =>
        task._id === id
          ? {
              ...task,
              messages: (task.messages || []).map((message) => ({
                ...message,
                seenBy: message.seenBy?.some(
                  (sid) => String(sid) === String(myId),
                )
                  ? message.seenBy
                  : [...(message.seenBy || []), myId],
              })),
            }
          : task,
      ),
    );
  };

  const handleBack = () => {
    setMobileChatOpen(false);
  };

  /* ====================================================
     CREATE DIALOG
  ==================================================== */

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

  /* ====================================================
     MODE CHANGE
  ==================================================== */

  const handleModeChange = (mode) => {
    setForm((prev) => ({
      ...prev,
      mode,
      assignedTo: mode === "INDIVIDUAL" ? prev.assignedTo : "",
      assignedToList: mode === "INDIVIDUAL" ? [] : prev.assignedToList,
    }));

    setError("");
  };

  /* ====================================================
     MULTI TEACHER CHANGE
  ==================================================== */

  const handleTeacherListChange = (event) => {
    const value = event.target.value;

    setForm((prev) => ({
      ...prev,
      assignedToList: typeof value === "string" ? value.split(",") : value,
    }));

    setError("");
  };

  /* ====================================================
     CREATE TASK
  ==================================================== */

  const handleCreate = async () => {
    setError("");

    if (!form.title.trim()) {
      return setError("Task title is required.");
    }

    /* INDIVIDUAL */

    if (form.mode === "INDIVIDUAL" && !form.assignedTo) {
      return setError("Please select a teacher.");
    }

    /* SEPARATE / GROUP */

    if (["SEPARATE", "GROUP"].includes(form.mode)) {
      if (!form.assignedToList.length) {
        return setError("Please select at least one teacher.");
      }

      if (form.assignedToList.length < 2) {
        return setError(
          `Select at least two teachers for ${
            form.mode === "GROUP" ? "group" : "separate"
          } assignment.`,
        );
      }
    }

    try {
      setCreating(true);

      const payload = {
        title: form.title.trim(),

        description: form.description.trim(),

        mode: form.mode,

        dueDate: form.dueDate || undefined,
      };

      if (form.mode === "INDIVIDUAL") {
        payload.assignedTo = form.assignedTo;
      }

      if (form.mode === "SEPARATE" || form.mode === "GROUP") {
        payload.assignedToList = form.assignedToList;
      }

      const res = await api.post("/tasks", payload);

      handleCloseCreate();

      await loadTasks();

      /* Automatically select newly created GROUP task */

      if (form.mode === "GROUP" && res?.data?._id) {
        setSelected(res.data._id);

        if (isMobile) {
          setMobileChatOpen(true);
        }
      }

      /* Separate returns { tasks: [] } */

      if (form.mode === "SEPARATE" && Array.isArray(res?.data?.tasks)) {
        const firstTask = res.data.tasks[0];

        if (firstTask?._id) {
          setSelected(firstTask._id);

          if (isMobile) {
            setMobileChatOpen(true);
          }
        }
      }
    } catch (err) {
      setError(
        err?.response?.data?.message ||
          "Could not create task. Please try again.",
      );
    } finally {
      setCreating(false);
    }
  };

  /* ====================================================
     STATUS
  ==================================================== */

  const handleStatusChange = async (taskId, newStatus) => {
    const prevTasks = tasks;

    setTasks((prev) =>
      prev.map((task) =>
        task._id === taskId
          ? {
              ...task,
              status: newStatus,
            }
          : task,
      ),
    );

    setUpdatingStatus(true);

    try {
      await api.patch(`/tasks/${taskId}/status`, {
        status: newStatus,
      });
    } catch (err) {
      setTasks(prevTasks);

      setLoadError(err?.response?.data?.message || "Could not update status.");
    } finally {
      setUpdatingStatus(false);
    }
  };

  /* ====================================================
     DELETE
  ==================================================== */

  const handleDeleteTask = async () => {
    if (!selectedTask?._id) return;

    try {
      setDeleting(true);

      setLoadError("");

      await api.delete(`/tasks/${selectedTask._id}`);

      setTasks((prev) => prev.filter((task) => task._id !== selectedTask._id));

      setSelected(null);

      setMobileChatOpen(false);

      setDeleteDialogOpen(false);
    } catch (err) {
      setLoadError(
        err?.response?.data?.message ||
          "Could not delete task. Please try again.",
      );
    } finally {
      setDeleting(false);
    }
  };

  /* ====================================================
     RENDER
  ==================================================== */

  return (
    <Box
      sx={{
        minHeight: "100dvh",
        bgcolor: "#f7f8fc",
      }}
    >
      <Navbar />

      <Container
        maxWidth="xl"
        sx={{
          py: {
            xs: 1.5,
            sm: 2,
          },

          px: {
            xs: 1,
            sm: 2,
            md: 3,
          },
        }}
      >
        {/* HEADER */}

        <Stack
          direction={{
            xs: "column",
            sm: "row",
          }}
          justifyContent="space-between"
          alignItems={{
            xs: "stretch",
            sm: "center",
          }}
          spacing={1.25}
          mb={1.75}
        >
          <Box>
            <Typography
              fontWeight={800}
              sx={{
                fontSize: {
                  xs: "1.2rem",
                  sm: "1.4rem",
                },
              }}
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
              alignSelf: {
                xs: "stretch",
                sm: "auto",
              },
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

        {/* ERROR */}

        {loadError && (
          <Alert
            severity="error"
            sx={{
              mb: 1.75,
              borderRadius: 2,
            }}
            action={
              <Button color="inherit" size="small" onClick={loadTasks}>
                Retry
              </Button>
            }
          >
            {loadError}
          </Alert>
        )}

        {/* MAIN */}

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

            minHeight: {
              xs: 420,
              sm: 480,
              md: 580,
            },
          }}
        >
          <Grid
            container
            sx={{
              height: "100%",
            }}
          >
            {/* TASK LIST */}

            <Grid
              item
              xs={12}
              md={4}
              sx={{
                height: "100%",
                display: "flex",
                flexDirection: "column",
                borderRight: {
                  md: "1px solid",
                },
                borderColor: {
                  md: "divider",
                },
              }}
            >
              {/* LIST HEADER */}

              <Box
                sx={{
                  px: {
                    xs: 1.25,
                    sm: 1.75,
                  },
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
                    sx={{
                      height: 22,
                      fontWeight: 700,
                    }}
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
                      sx={{
                        mr: 1,
                        color: "text.disabled",
                      }}
                    />
                  }
                  sx={{
                    borderRadius: 1.5,
                    fontSize: "0.85rem",
                    bgcolor: "action.hover",
                  }}
                  MenuProps={{
                    PaperProps: {
                      sx: {
                        maxHeight: 320,
                      },
                    },
                  }}
                >
                  <MenuItem value={ALL_TEACHERS}>All teachers</MenuItem>

                  {teachers.map((teacher) => (
                    <MenuItem key={teacher._id} value={teacher._id}>
                      <Stack direction="row" spacing={1} alignItems="center">
                        <Avatar
                          sx={{
                            width: 20,
                            height: 20,
                            fontSize: 10,
                            bgcolor: colorForName(teacher.name),
                          }}
                        >
                          {initials(teacher.name)}
                        </Avatar>

                        <Box
                          component="span"
                          sx={{
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                          }}
                        >
                          {teacher.name}
                        </Box>
                      </Stack>
                    </MenuItem>
                  ))}
                </Select>
              </Box>

              {/* LIST */}

              <Box
                sx={{
                  flex: 1,
                  minHeight: 0,
                  overflowY: "auto",
                }}
              >
                {loading ? (
                  <Box
                    sx={{
                      py: 8,
                      display: "flex",
                      justifyContent: "center",
                    }}
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

            {/* DESKTOP CHAT */}

            <Grid
              item
              xs={false}
              md={8}
              sx={{
                height: "100%",
                display: {
                  xs: "none",
                  md: "flex",
                },
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
                onDelete={() => setDeleteDialogOpen(true)}
                deleting={deleting}
              />
            </Grid>
          </Grid>
        </Paper>
      </Container>

      {/* MOBILE CHAT */}

      {mobileChatOpen && selectedTask && (
        <Box
          sx={{
            display: {
              xs: "flex",
              md: "none",
            },
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
            onDelete={() => setDeleteDialogOpen(true)}
            deleting={deleting}
          />
        </Box>
      )}

      {/* ==================================================
          CREATE TASK DIALOG
      ================================================== */}

      <Dialog
        open={open}
        onClose={handleCloseCreate}
        fullWidth
        maxWidth="sm"
        PaperProps={{
          sx: {
            borderRadius: {
              xs: 0,
              sm: 2.5,
            },

            mx: {
              xs: 0,
              sm: 1.5,
            },

            my: {
              xs: 0,
              sm: "auto",
            },

            height: {
              xs: "100%",
              sm: "auto",
            },

            maxHeight: {
              xs: "100%",
              sm: "calc(100% - 64px)",
            },
          },
        }}
        sx={{
          "& .MuiDialog-container": {
            alignItems: {
              xs: "stretch",
              sm: "center",
            },
          },
        }}
      >
        <DialogTitle
          sx={{
            pb: 1,
            fontWeight: 800,
          }}
        >
          Assign New Task
        </DialogTitle>

        <DialogContent
          sx={{
            pt: "8px !important",
          }}
        >
          {error && (
            <Alert
              severity="error"
              sx={{
                mb: 2,
                borderRadius: 1.5,
              }}
            >
              {error}
            </Alert>
          )}

          <Stack spacing={1.5}>
            {/* TITLE */}

            <TextField
              label="Task title"
              placeholder="e.g. Complete attendance report"
              fullWidth
              size="small"
              autoFocus
              value={form.title}
              onChange={(e) =>
                setForm((prev) => ({
                  ...prev,
                  title: e.target.value,
                }))
              }
            />

            {/* DESCRIPTION */}

            <TextField
              label="Description"
              placeholder="Add task instructions..."
              fullWidth
              multiline
              minRows={3}
              size="small"
              value={form.description}
              onChange={(e) =>
                setForm((prev) => ({
                  ...prev,
                  description: e.target.value,
                }))
              }
            />

            {/* MODE */}

            <FormControl fullWidth size="small">
              <InputLabel>Assignment type</InputLabel>

              <Select
                value={form.mode}
                label="Assignment type"
                onChange={(e) => handleModeChange(e.target.value)}
              >
                {Object.entries(TASK_MODES).map(([value, config]) => (
                  <MenuItem key={value} value={value}>
                    <Stack direction="row" spacing={1.2} alignItems="center">
                      {config.icon}

                      <Box>
                        <Typography fontSize="0.86rem" fontWeight={700}>
                          {config.label}
                        </Typography>

                        <Typography variant="caption" color="text.secondary">
                          {config.description}
                        </Typography>
                      </Box>
                    </Stack>
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            {/* INDIVIDUAL */}

            {form.mode === "INDIVIDUAL" && (
              <TextField
                select
                label="Assign to teacher"
                fullWidth
                size="small"
                value={form.assignedTo}
                onChange={(e) =>
                  setForm((prev) => ({
                    ...prev,
                    assignedTo: e.target.value,
                  }))
                }
                SelectProps={{
                  MenuProps: {
                    PaperProps: {
                      sx: {
                        maxHeight: 320,
                      },
                    },
                  },
                }}
              >
                <MenuItem value="" disabled>
                  Select teacher
                </MenuItem>

                {teachers.map((teacher) => (
                  <MenuItem key={teacher._id} value={teacher._id}>
                    <Stack direction="row" spacing={1} alignItems="center">
                      <Avatar
                        sx={{
                          width: 22,
                          height: 22,
                          fontSize: 10,
                          bgcolor: colorForName(teacher.name),
                        }}
                      >
                        {initials(teacher.name)}
                      </Avatar>

                      <span>{teacher.name}</span>
                    </Stack>
                  </MenuItem>
                ))}
              </TextField>
            )}

            {/* SEPARATE / GROUP */}

            {(form.mode === "SEPARATE" || form.mode === "GROUP") && (
              <FormControl fullWidth size="small">
                <InputLabel>Select teachers</InputLabel>

                <Select
                  multiple
                  value={form.assignedToList}
                  onChange={handleTeacherListChange}
                  input={<OutlinedInput label="Select teachers" />}
                  renderValue={(selectedIds) => {
                    const selectedTeachers = teachers.filter((teacher) =>
                      selectedIds.includes(teacher._id),
                    );

                    return (
                      <Box
                        sx={{
                          display: "flex",
                          flexWrap: "wrap",
                          gap: 0.5,
                        }}
                      >
                        {selectedTeachers.map((teacher) => (
                          <Chip
                            key={teacher._id}
                            size="small"
                            avatar={<Avatar>{initials(teacher.name)}</Avatar>}
                            label={teacher.name}
                          />
                        ))}
                      </Box>
                    );
                  }}
                  MenuProps={{
                    PaperProps: {
                      sx: {
                        maxHeight: 360,
                      },
                    },
                  }}
                >
                  {teachers.map((teacher) => (
                    <MenuItem key={teacher._id} value={teacher._id}>
                      <Checkbox
                        checked={form.assignedToList.includes(teacher._id)}
                      />

                      <Avatar
                        sx={{
                          width: 26,
                          height: 26,
                          fontSize: 11,
                          mr: 1,
                          bgcolor: colorForName(teacher.name),
                        }}
                      >
                        {initials(teacher.name)}
                      </Avatar>

                      <Box>
                        <Typography fontSize="0.86rem" fontWeight={600}>
                          {teacher.name}
                        </Typography>

                        {teacher.email && (
                          <Typography variant="caption" color="text.secondary">
                            {teacher.email}
                          </Typography>
                        )}
                      </Box>
                    </MenuItem>
                  ))}
                </Select>

                <Typography
                  variant="caption"
                  color="text.secondary"
                  sx={{
                    mt: 0.75,
                    display: "block",
                  }}
                >
                  {form.mode === "GROUP"
                    ? "Minimum 2 teachers. Everyone will share the same task and conversation."
                    : "Minimum 2 teachers. Each teacher will receive a separate task and conversation."}
                </Typography>
              </FormControl>
            )}

            {/* DUE DATE */}

            <TextField
              label="Due date"
              type="date"
              fullWidth
              size="small"
              InputLabelProps={{
                shrink: true,
              }}
              value={form.dueDate}
              onChange={(e) =>
                setForm((prev) => ({
                  ...prev,
                  dueDate: e.target.value,
                }))
              }
            />
          </Stack>
        </DialogContent>

        <DialogActions
          sx={{
            px: 2.5,
            pb: {
              xs: 2.5,
              sm: 2,
            },
            gap: 1,
            flexWrap: "wrap",
          }}
        >
          <Button
            onClick={handleCloseCreate}
            disabled={creating}
            sx={{
              textTransform: "none",
              fontWeight: 600,
            }}
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
              minWidth: 120,
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

      {/* ==================================================
          DELETE
      ================================================== */}

      <Dialog
        open={deleteDialogOpen}
        onClose={() => {
          if (!deleting) {
            setDeleteDialogOpen(false);
          }
        }}
        maxWidth="xs"
        fullWidth
      >
        <DialogTitle
          sx={{
            fontWeight: 800,
          }}
        >
          Delete Task?
        </DialogTitle>

        <DialogContent>
          <Typography variant="body2" color="text.secondary">
            Are you sure you want to delete{" "}
            <Box
              component="span"
              sx={{
                fontWeight: 700,
                color: "text.primary",
              }}
            >
              "{selectedTask?.title}"
            </Box>
            ?
          </Typography>

          <Typography
            variant="body2"
            color="error.main"
            sx={{
              mt: 1,
            }}
          >
            This action cannot be undone. The task and its conversation will be
            permanently deleted.
          </Typography>
        </DialogContent>

        <DialogActions
          sx={{
            px: 2.5,
            pb: 2,
          }}
        >
          <Button
            onClick={() => setDeleteDialogOpen(false)}
            disabled={deleting}
            sx={{
              textTransform: "none",
              fontWeight: 600,
            }}
          >
            Cancel
          </Button>

          <Button
            variant="contained"
            color="error"
            onClick={handleDeleteTask}
            disabled={deleting}
            startIcon={
              deleting ? (
                <CircularProgress size={16} color="inherit" />
              ) : (
                <DeleteOutline />
              )
            }
            sx={{
              textTransform: "none",
              fontWeight: 700,
              borderRadius: 1.5,
              boxShadow: "none",
            }}
          >
            {deleting ? "Deleting..." : "Delete Task"}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

/* ======================================================
   CHAT PANE
====================================================== */

function ChatPane({
  task,
  updatingStatus,
  onStatusChange,
  onBack,
  showBack,
  onDelete,
  deleting,
}) {
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
            <AssignmentOutlined
              sx={{
                fontSize: 26,
                color: "text.disabled",
              }}
            />
          </Box>

          <Typography fontWeight={800}>Select a task</Typography>

          <Typography
            variant="body2"
            color="text.secondary"
            sx={{
              mt: 0.5,
              maxWidth: 280,
            }}
          >
            Select a task from the left to open its full conversation.
          </Typography>
        </Box>
      </Box>
    );
  }

  const people = getTaskPeople(task);

  const isGroup = task.mode === "GROUP";

  const displayName = getTaskPeopleNames(task);

  const avatarName = people[0]?.name || "Task";

  return (
    <>
      {/* HEADER */}

      <Box
        sx={{
          position: "relative",
          px: {
            xs: 1,
            sm: 1.5,
          },
          py: 1,
          borderBottom: "1px solid",
          borderColor: "divider",
          flexShrink: 0,
          width: "100%",
          boxSizing: "border-box",
        }}
      >
        <Stack
          direction="row"
          alignItems="center"
          spacing={1}
          sx={{
            width: "100%",
            minWidth: 0,
            pr: {
              xs: 5,
              sm: 12,
            },
          }}
        >
          {showBack && (
            <IconButton
              size="small"
              onClick={onBack}
              sx={{
                flexShrink: 0,
              }}
            >
              <ArrowBack fontSize="small" />
            </IconButton>
          )}

          <Avatar
            sx={{
              width: {
                xs: 30,
                sm: 34,
              },
              height: {
                xs: 30,
                sm: 34,
              },
              fontSize: 13,
              bgcolor: isGroup ? "primary.main" : colorForName(avatarName),
              flexShrink: 0,
            }}
          >
            {isGroup ? (
              <GroupsOutlined fontSize="small" />
            ) : (
              initials(avatarName)
            )}
          </Avatar>

          <Box
            sx={{
              minWidth: 0,
              flex: 1,
              overflow: "hidden",
            }}
          >
            <Stack
              direction="row"
              spacing={0.75}
              alignItems="center"
              sx={{
                minWidth: 0,
              }}
            >
              <Typography
                fontWeight={800}
                fontSize="0.9rem"
                noWrap
                sx={{
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                }}
              >
                {task.title}
              </Typography>

              <Chip
                size="small"
                variant="outlined"
                label={isGroup ? "GROUP" : task.mode || "INDIVIDUAL"}
                sx={{
                  height: 20,
                  fontSize: 9,
                  fontWeight: 800,
                  flexShrink: 0,
                }}
              />
            </Stack>

            <Stack
              direction="row"
              spacing={0.5}
              alignItems="center"
              sx={{
                minWidth: 0,
              }}
            >
              {isGroup ? (
                <GroupsOutlined
                  sx={{
                    fontSize: 13,
                    color: "text.disabled",
                    flexShrink: 0,
                  }}
                />
              ) : (
                <PersonOutline
                  sx={{
                    fontSize: 13,
                    color: "text.disabled",
                    flexShrink: 0,
                  }}
                />
              )}

              <Typography
                variant="caption"
                color="text.secondary"
                noWrap
                sx={{
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                }}
              >
                {displayName}
              </Typography>
            </Stack>
          </Box>

          {/* STATUS */}

          <Box
            sx={{
              position: "absolute",
              right: {
                xs: 42,
                sm: 50,
              },
              top: "50%",
              transform: "translateY(-50%)",
              zIndex: 5,
            }}
          >
            <StatusSelect
              status={task.status}
              disabled={updatingStatus}
              onChange={(status) => onStatusChange(task._id, status)}
            />
          </Box>

          {/* DELETE */}

          <IconButton
            onClick={onDelete}
            disabled={deleting}
            aria-label="Delete task"
            title="Delete task"
            sx={{
              position: "absolute",
              right: {
                xs: 6,
                sm: 10,
              },
              top: "50%",
              transform: "translateY(-50%)",
              zIndex: 10,

              width: 34,
              height: 34,

              color: "error.main",

              border: "1px solid",

              borderColor: "error.main",

              backgroundColor: "rgba(211, 47, 47, 0.08)",

              "&:hover": {
                backgroundColor: "rgba(211, 47, 47, 0.16)",
              },
            }}
          >
            {deleting ? (
              <CircularProgress size={17} color="inherit" />
            ) : (
              <DeleteOutline
                sx={{
                  fontSize: 20,
                }}
              />
            )}
          </IconButton>
        </Stack>
      </Box>

      {/* DESCRIPTION */}

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
              WebkitLineClamp: {
                xs: 2,
                sm: 3,
              },
              WebkitBoxOrient: "vertical",
              overflow: "hidden",
            }}
          >
            <b>Task:</b> {task.description}
          </Typography>
        </Box>
      )}

      {/* GROUP PARTICIPANTS */}

      {isGroup && people.length > 0 && (
        <Box
          sx={{
            px: 1.5,
            py: 0.75,
            borderBottom: "1px solid",
            borderColor: "divider",
            overflowX: "auto",
            flexShrink: 0,
          }}
        >
          <Stack
            direction="row"
            spacing={0.6}
            alignItems="center"
            sx={{
              minWidth: "max-content",
            }}
          >
            {people.map((person) => (
              <Chip
                key={person._id}
                size="small"
                avatar={<Avatar>{initials(person.name)}</Avatar>}
                label={person.name}
                variant="outlined"
                sx={{
                  height: 28,
                  fontSize: 11,
                }}
              />
            ))}
          </Stack>
        </Box>
      )}

      {/* CHAT */}

      <Box
        sx={{
          flex: 1,
          minHeight: 0,
          overflow: "hidden",
        }}
      >
        <TaskChat taskId={task._id} />
      </Box>
    </>
  );
}

/* ======================================================
   STAT CARD
====================================================== */

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

        <Box
          sx={{
            minWidth: 0,
          }}
        >
          <Typography variant="caption" color="text.secondary" noWrap>
            {label}
          </Typography>

          <Typography
            fontWeight={800}
            lineHeight={1.1}
            sx={{
              fontSize: {
                xs: "0.95rem",
                sm: "1.1rem",
              },
            }}
          >
            {value}
          </Typography>
        </Box>
      </Stack>
    </Paper>
  );
}

/* ======================================================
   STATUS CHIP
====================================================== */

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
        fontSize: {
          xs: "0.68rem",
          sm: "0.75rem",
        },
        "& .MuiChip-label": {
          px: {
            xs: 0.6,
            sm: 1,
          },
        },
      }}
    />
  );
}

/* ======================================================
   STATUS SELECT
====================================================== */

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
        onDelete={(event) => setAnchorEl(event.currentTarget)}
        onClick={(event) => setAnchorEl(event.currentTarget)}
        disabled={disabled}
        sx={{
          fontWeight: 700,
          height: 26,
          flexShrink: 0,
          cursor: "pointer",
          fontSize: {
            xs: "0.68rem",
            sm: "0.75rem",
          },
          "& .MuiChip-label": {
            px: {
              xs: 0.6,
              sm: 1,
            },
          },
        }}
      />

      <Menu
        anchorEl={anchorEl}
        open={!!anchorEl}
        onClose={() => setAnchorEl(null)}
      >
        {STATUS_ORDER.map((statusValue) => {
          const configValue = STATUS_CONFIG[statusValue];

          return (
            <MenuItem
              key={statusValue}
              selected={statusValue === status}
              onClick={() => {
                onChange(statusValue);

                setAnchorEl(null);
              }}
            >
              <Stack direction="row" spacing={1} alignItems="center">
                {configValue.icon}

                <span>{configValue.label}</span>
              </Stack>
            </MenuItem>
          );
        })}
      </Menu>
    </>
  );
}

/* ======================================================
   TASK LIST ITEM
====================================================== */

function TaskListItem({ task, selected, unread, onClick }) {
  const people = getTaskPeople(task);

  const isGroup = task.mode === "GROUP";

  const avatarName = people[0]?.name || "Task";

  return (
    <ListItemButton
      selected={selected}
      onClick={onClick}
      sx={{
        px: {
          xs: 1.25,
          sm: 1.75,
        },
        py: 1.15,
        alignItems: "flex-start",
        gap: {
          xs: 1,
          sm: 1.25,
        },
        borderBottom: "1px solid",
        borderColor: "divider",

        "&.Mui-selected": {
          bgcolor: "action.selected",
        },

        "&.Mui-selected:hover": {
          bgcolor: "action.hover",
        },
      }}
    >
      {/* AVATAR */}

      <Box
        sx={{
          position: "relative",
          flexShrink: 0,
          mt: 0.25,
        }}
      >
        <Avatar
          sx={{
            width: 34,
            height: 34,
            fontSize: 12,
            bgcolor: isGroup ? "primary.main" : colorForName(avatarName),
          }}
        >
          {isGroup ? <GroupsOutlined fontSize="small" /> : initials(avatarName)}
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

      <Box
        sx={{
          width: "100%",
          minWidth: 0,
        }}
      >
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

        {/* MODE */}

        <Stack
          direction="row"
          spacing={0.5}
          alignItems="center"
          sx={{
            mt: 0.5,
          }}
        >
          {isGroup ? (
            <GroupsOutlined
              sx={{
                fontSize: 13,
                color: "text.disabled",
              }}
            />
          ) : (
            <PersonOutline
              sx={{
                fontSize: 13,
                color: "text.disabled",
              }}
            />
          )}

          <Typography variant="caption" color="text.secondary" noWrap>
            {getTaskPeopleNames(task)}
          </Typography>
        </Stack>

        {/* MODE CHIP */}

        <Chip
          size="small"
          variant="outlined"
          label={
            isGroup
              ? "Group Task"
              : task.mode === "SEPARATE"
                ? "Separate"
                : "Individual"
          }
          sx={{
            mt: 0.5,
            height: 20,
            fontSize: 9,
            fontWeight: 700,
          }}
        />

        <Typography
          variant="caption"
          color="text.secondary"
          sx={{
            display: "block",
            mt: 0.25,
          }}
        >
          Due: {formatDueDate(task.dueDate)}
        </Typography>
      </Box>
    </ListItemButton>
  );
}

/* ======================================================
   EMPTY
====================================================== */

function EmptyTasks({ onAdd, filtered }) {
  return (
    <Box
      sx={{
        px: 2,
        py: 6,
        textAlign: "center",
      }}
    >
      <AssignmentOutlined
        sx={{
          fontSize: 36,
          color: "text.disabled",
          mb: 1,
        }}
      />

      <Typography fontWeight={700}>
        {filtered ? "No tasks for this teacher" : "No tasks yet"}
      </Typography>

      <Typography
        variant="body2"
        color="text.secondary"
        sx={{
          mt: 0.5,
          mb: filtered ? 0 : 1.75,
        }}
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
          sx={{
            textTransform: "none",
            borderRadius: 1.5,
            mt: 1.75,
          }}
        >
          Assign Task
        </Button>
      )}
    </Box>
  );
}

/* ======================================================
   EXPORT
====================================================== */

export default function AdminTasksPage() {
  return (
    <ProtectedRoute role="superadmin">
      <AdminTasksInner />
    </ProtectedRoute>
  );
}

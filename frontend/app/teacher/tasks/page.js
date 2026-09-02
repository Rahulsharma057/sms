"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import {
  Alert,
  Avatar,
  Box,
  Chip,
  Container,
  Divider,
  Grid,
  IconButton,
  List,
  ListItemAvatar,
  ListItemButton,
  ListItemText,
  Menu,
  MenuItem,
  Paper,
  Skeleton,
  Stack,
  Typography,
  useMediaQuery,
  useTheme,
} from "@mui/material";

import {
  AccessTimeOutlined,
  ArrowBack,
  AssignmentOutlined,
  CheckCircleOutline,
  ChatBubbleOutline,
  ExpandMore,
  PendingActionsOutlined,
} from "@mui/icons-material";

import ProtectedRoute from "../../../components/ProtectedRoute";
import Navbar from "../../../components/Navbar";
import TaskChat from "../../../components/TaskChat";
import api from "../../../lib/api";
import { useAuth } from "../../../context/AuthContext";

/* =========================================================
   STATUS
========================================================= */

const STATUS_CONFIG = {
  pending: {
    label: "Pending",
    color: "warning",
    icon: <PendingActionsOutlined fontSize="small" />,
  },

  "in-progress": {
    label: "In progress",
    color: "info",
    icon: <AccessTimeOutlined fontSize="small" />,
  },

  completed: {
    label: "Completed",
    color: "success",
    icon: <CheckCircleOutline fontSize="small" />,
  },
};

const STATUS_ORDER = [
  "pending",
  "in-progress",
  "completed",
];

const getStatusConfig = (status) =>
  STATUS_CONFIG[status] || {
    label: status || "Unknown",
    color: "default",
    icon: <AssignmentOutlined fontSize="small" />,
  };

/* =========================================================
   AVATAR
========================================================= */

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
  const idx = [...String(name)].reduce(
    (sum, ch) => sum + ch.charCodeAt(0),
    0,
  );

  return AVATAR_COLORS[idx % AVATAR_COLORS.length];
}

function initials(name = "") {
  const cleanName = String(name || "").trim();

  if (!cleanName) return "?";

  const parts = cleanName.split(/\s+/);

  if (parts.length === 1) {
    return parts[0].slice(0, 2).toUpperCase();
  }

  return (
    `${parts[0]?.[0] || ""}${parts[1]?.[0] || ""}`.toUpperCase() ||
    "?"
  );
}

/* =========================================================
   UNREAD
========================================================= */

function getUnreadCount(task, myId) {
  if (!Array.isArray(task?.messages) || !myId) {
    return 0;
  }

  return task.messages.filter((message) => {
    const senderId = String(
      message.sender?._id ||
        message.sender ||
        "",
    );

    if (senderId === String(myId)) {
      return false;
    }

    const seenBy = Array.isArray(message.seenBy)
      ? message.seenBy
      : [];

    return !seenBy.some(
      (id) => String(id) === String(myId),
    );
  }).length;
}

/* =========================================================
   TEACHER TASK PAGE
========================================================= */

function TeacherTasksInner() {
  const { user } = useAuth();

  const theme = useTheme();

  const isMobile = useMediaQuery(
    theme.breakpoints.down("md"),
  );

  const myId = user?.id || user?._id;

  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);

  const [selected, setSelected] = useState(null);
  const [mobileChatOpen, setMobileChatOpen] =
    useState(false);

  const [updatingStatus, setUpdatingStatus] =
    useState(false);

  const [error, setError] = useState("");

  /* =======================================================
     LOAD TASKS
  ======================================================= */

  const loadTasks = useCallback(
    async (silent = false) => {
      if (!silent) {
        setLoading(true);
      }

      try {
        const { data } = await api.get("/tasks/mine");

        const nextTasks = Array.isArray(data)
          ? data
          : [];

        setTasks(nextTasks);

        return nextTasks;
      } catch (err) {
        if (!silent) {
          setError(
            err?.response?.data?.message ||
              "Unable to load your tasks.",
          );
        }

        return [];
      } finally {
        if (!silent) {
          setLoading(false);
        }
      }
    },
    [],
  );

  /* =======================================================
     INITIAL LOAD
  ======================================================= */

  useEffect(() => {
    loadTasks();
  }, [loadTasks]);

  /* =======================================================
     TASK LIST POLLING
  ======================================================= */

  useEffect(() => {
    const interval = setInterval(() => {
      loadTasks(true);
    }, 10000);

    return () => clearInterval(interval);
  }, [loadTasks]);

  /* =======================================================
     MOBILE BODY LOCK
  ======================================================= */

  useEffect(() => {
    if (!isMobile || !mobileChatOpen) {
      document.body.style.overflow = "";
      return;
    }

    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = "";
    };
  }, [isMobile, mobileChatOpen]);

  /* =======================================================
     SELECTED TASK
  ======================================================= */

  const selectedTask = useMemo(() => {
    if (!selected) return null;

    return (
      tasks.find(
        (task) =>
          String(task._id) === String(selected),
      ) || null
    );
  }, [tasks, selected]);

  /* =======================================================
     COUNTS
  ======================================================= */

  const pendingCount = useMemo(() => {
    return tasks.filter(
      (task) => task.status !== "completed",
    ).length;
  }, [tasks]);

  const totalUnread = useMemo(() => {
    return tasks.reduce(
      (total, task) =>
        total + getUnreadCount(task, myId),
      0,
    );
  }, [tasks, myId]);

  /* =======================================================
     SELECT TASK
  ======================================================= */

  const handleSelectTask = useCallback(
    (taskId) => {
      setSelected(taskId);
      setError("");

      if (isMobile) {
        setMobileChatOpen(true);
      }

      /*
       * Optimistically mark messages as seen.
       */

      setTasks((previous) =>
        previous.map((task) => {
          if (
            String(task._id) !==
            String(taskId)
          ) {
            return task;
          }

          const messages = Array.isArray(
            task.messages,
          )
            ? task.messages
            : [];

          return {
            ...task,

            messages: messages.map(
              (message) => {
                const senderId = String(
                  message.sender?._id ||
                    message.sender ||
                    "",
                );

                if (
                  senderId === String(myId)
                ) {
                  return message;
                }

                const seenBy = Array.isArray(
                  message.seenBy,
                )
                  ? message.seenBy
                  : [];

                const alreadySeen =
                  seenBy.some(
                    (id) =>
                      String(id) ===
                      String(myId),
                  );

                if (alreadySeen) {
                  return message;
                }

                return {
                  ...message,
                  seenBy: [
                    ...seenBy,
                    myId,
                  ],
                };
              },
            ),
          };
        }),
      );
    },
    [myId, isMobile],
  );

  /* =======================================================
     BACK
  ======================================================= */

  const handleBack = useCallback(() => {
    setMobileChatOpen(false);
  }, []);

  /* =======================================================
     STATUS CHANGE
  ======================================================= */

  const handleStatusChange =
    useCallback(
      async (taskId, newStatus) => {
        if (!taskId || !newStatus) {
          return;
        }

        setError("");

        const previousTasks = tasks;

        setTasks((previous) =>
          previous.map((task) =>
            String(task._id) ===
            String(taskId)
              ? {
                  ...task,
                  status: newStatus,
                }
              : task,
          ),
        );

        setUpdatingStatus(true);

        try {
          const { data } = await api.patch(
            `/tasks/${taskId}/status`,
            {
              status: newStatus,
            },
          );

          if (
            data &&
            typeof data === "object"
          ) {
            setTasks((previous) =>
              previous.map((task) =>
                String(task._id) ===
                String(taskId)
                  ? {
                      ...task,
                      ...data,
                    }
                  : task,
              ),
            );
          }
        } catch (err) {
          setTasks(previousTasks);

          setError(
            err?.response?.data?.message ||
              "Could not update task status.",
          );
        } finally {
          setUpdatingStatus(false);
        }
      },
      [tasks],
    );

  /* =======================================================
     RENDER
  ======================================================= */

  return (
    <Box
      sx={{
        minHeight: "100dvh",
        bgcolor: "#F7F8FA",
        overflowX: "hidden",
      }}
    >
      <Navbar />

      <Container
        maxWidth="lg"
        sx={{
          py: {
            xs: 1.25,
            sm: 2,
            md: 3,
          },

          px: {
            xs: 1,
            sm: 2,
            md: 3,
          },
        }}
      >
        {/* =================================================
            PAGE HEADER
        ================================================= */}

        <Box
          sx={{
            mb: {
              xs: 1.25,
              sm: 2,
              md: 2.5,
            },
          }}
        >
          <Stack
            direction="row"
            alignItems="center"
            justifyContent="space-between"
            spacing={1}
          >
            <Box sx={{ minWidth: 0 }}>
              <Typography
                variant="h5"
                fontWeight={800}
                sx={{
                  fontSize: {
                    xs: "1.15rem",
                    sm: "1.35rem",
                    md: "1.5rem",
                  },

                  lineHeight: 1.25,
                }}
              >
                My Tasks
              </Typography>

              <Typography
                variant="body2"
                color="text.secondary"
                noWrap
                sx={{
                  mt: 0.35,
                  fontSize: {
                    xs: "0.75rem",
                    sm: "0.82rem",
                  },
                }}
              >
                {loading
                  ? "Loading your tasks…"
                  : pendingCount > 0
                    ? `${pendingCount} ${
                        pendingCount === 1
                          ? "task needs"
                          : "tasks need"
                      } your attention`
                    : "You're all caught up."}
              </Typography>
            </Box>

            {totalUnread > 0 && (
              <Chip
                size="small"
                color="error"
                label={`${totalUnread} unread`}
                sx={{
                  fontWeight: 700,
                  flexShrink: 0,
                  height: 26,
                  "& .MuiChip-label": {
                    px: 1,
                    fontSize: "0.7rem",
                  },
                }}
              />
            )}
          </Stack>
        </Box>

        {error && (
          <Alert
            severity="error"
            sx={{
              mb: 1.5,
              borderRadius: 2,
              fontSize: {
                xs: "0.78rem",
                sm: "0.85rem",
              },
            }}
            onClose={() => setError("")}
          >
            {error}
          </Alert>
        )}

        {/* =================================================
            DESKTOP LAYOUT
        ================================================= */}

        <Box
          sx={{
            display: {
              xs: "block",
              md: "flex",
            },

            gap: 2,

            height: {
              xs: "auto",
              md: "calc(100dvh - 185px)",
            },

            minHeight: {
              md: 500,
            },
          }}
        >
          {/* =================================================
              TASK LIST
          ================================================= */}

          <Box
            sx={{
              width: {
                xs: "100%",
                md: "34%",
              },

              flexShrink: 0,

              height: {
                xs: "auto",
                md: "100%",
              },

              display: {
                xs:
                  mobileChatOpen
                    ? "none"
                    : "block",

                md: "block",
              },
            }}
          >
            <Paper
              variant="outlined"
              sx={{
                width: "100%",

                height: {
                  xs: "auto",
                  md: "100%",
                },

                maxHeight: {
                  xs: "calc(100dvh - 135px)",
                  md: "none",
                },

                overflowY: "auto",

                borderRadius: {
                  xs: 2.5,
                  md: 3,
                },

                bgcolor: "#fff",

                "&::-webkit-scrollbar": {
                  width: 5,
                },

                "&::-webkit-scrollbar-thumb":
                  {
                    bgcolor:
                      "rgba(0,0,0,0.14)",
                    borderRadius: 10,
                  },
              }}
            >
              {loading ? (
                <Stack
                  spacing={1}
                  p={{
                    xs: 1,
                    sm: 1.5,
                  }}
                >
                  {[1, 2, 3, 4, 5].map(
                    (item) => (
                      <Skeleton
                        key={item}
                        variant="rounded"
                        height={68}
                      />
                    ),
                  )}
                </Stack>
              ) : tasks.length === 0 ? (
                <EmptyTasks />
              ) : (
                <List disablePadding>
                  {tasks.map(
                    (task, index) => {
                      const unread =
                        getUnreadCount(
                          task,
                          myId,
                        );

                      const isSelected =
                        String(
                          selected,
                        ) ===
                        String(task._id);

                      return (
                        <Box
                          key={task._id}
                        >
                          <TaskListItem
                            task={task}
                            unread={unread}
                            selected={
                              isSelected
                            }
                            onClick={() =>
                              handleSelectTask(
                                task._id,
                              )
                            }
                          />

                          {index <
                            tasks.length -
                              1 && (
                            <Divider component="li" />
                          )}
                        </Box>
                      );
                    },
                  )}
                </List>
              )}
            </Paper>
          </Box>

          {/* =================================================
              DESKTOP CHAT
          ================================================= */}

          <Box
            sx={{
              display: {
                xs: "none",
                md: "flex",
              },

              flex: 1,

              minWidth: 0,

              minHeight: 0,

              height: "100%",

              flexDirection: "column",
            }}
          >
            <ChatPane
              task={selectedTask}
              updatingStatus={
                updatingStatus
              }
              onStatusChange={
                handleStatusChange
              }
              onBack={handleBack}
              showBack={false}
            />
          </Box>
        </Box>
      </Container>

      {/* =====================================================
          MOBILE FULL SCREEN CHAT
      ===================================================== */}

      {mobileChatOpen &&
        selectedTask && (
          <Box
            sx={{
              display: {
                xs: "flex",
                md: "none",
              },

              position: "fixed",

              inset: 0,

              zIndex: 1400,

              width: "100vw",

              height: "100dvh",

              maxWidth: "100vw",

              overflow: "hidden",

              bgcolor: "#F8F9FB",

              flexDirection: "column",
            }}
          >
            <ChatPane
              task={selectedTask}
              updatingStatus={
                updatingStatus
              }
              onStatusChange={
                handleStatusChange
              }
              onBack={handleBack}
              showBack
            />
          </Box>
        )}
    </Box>
  );
}

/* ===========================================================
   TASK LIST ITEM
=========================================================== */

function TaskListItem({
  task,
  unread,
  selected,
  onClick,
}) {
  const senderName =
    task.assignedBy?.name ||
    "Admin";

  return (
    <ListItemButton
      selected={selected}
      onClick={onClick}
      sx={{
        py: {
          xs: 1.15,
          sm: 1.4,
        },

        px: {
          xs: 1,
          sm: 1.75,
        },

        gap: {
          xs: 0.75,
          sm: 1.25,
        },

        minHeight: {
          xs: 68,
          sm: 72,
        },

        alignItems: "center",

        "&.Mui-selected": {
          bgcolor:
            "rgba(25,118,210,0.07)",
        },

        "&.Mui-selected:hover": {
          bgcolor:
            "rgba(25,118,210,0.10)",
        },

        "&:hover": {
          bgcolor:
            "rgba(0,0,0,0.025)",
        },
      }}
    >
      <ListItemAvatar
        sx={{
          minWidth: {
            xs: 40,
            sm: 46,
          },
        }}
      >
        <Box
          sx={{
            position: "relative",
            width: {
              xs: 34,
              sm: 38,
            },
          }}
        >
          <Avatar
            sx={{
              width: {
                xs: 34,
                sm: 38,
              },

              height: {
                xs: 34,
                sm: 38,
              },

              fontSize: {
                xs: 10,
                sm: 12,
              },

              fontWeight: 700,

              bgcolor:
                colorForName(
                  senderName,
                ),
            }}
          >
            {initials(senderName)}
          </Avatar>

          {unread > 0 && (
            <Box
              sx={{
                position: "absolute",

                top: -5,

                right: -6,

                minWidth: 17,

                height: 17,

                px: 0.25,

                borderRadius: "50%",

                bgcolor:
                  "error.main",

                color: "#fff",

                fontSize: 9,

                fontWeight: 800,

                display: "flex",

                alignItems: "center",

                justifyContent:
                  "center",

                border:
                  "2px solid #fff",
              }}
            >
              {unread > 9
                ? "9+"
                : unread}
            </Box>
          )}
        </Box>
      </ListItemAvatar>

      <ListItemText
        sx={{
          minWidth: 0,
          flex: 1,
          mr: 0.25,
        }}
        primary={
          <Typography
            fontWeight={
              unread > 0
                ? 800
                : 650
            }
            noWrap
            sx={{
              fontSize: {
                xs: "0.82rem",
                sm: "0.9rem",
              },

              overflow: "hidden",
              textOverflow:
                "ellipsis",
            }}
          >
            {task.title ||
              "Untitled task"}
          </Typography>
        }
        secondary={
          <Typography
            variant="body2"
            color="text.secondary"
            noWrap
            sx={{
              fontSize: {
                xs: "0.7rem",
                sm: "0.8rem",
              },

              mt: 0.15,

              overflow: "hidden",
              textOverflow:
                "ellipsis",
            }}
          >
            From {senderName}
          </Typography>
        }
      />

      <StatusChip
        status={task.status}
      />
    </ListItemButton>
  );
}

/* ===========================================================
   EMPTY TASKS
=========================================================== */

function EmptyTasks() {
  return (
    <Box
      sx={{
        minHeight: 280,

        px: 2.5,

        py: 5,

        display: "flex",

        flexDirection: "column",

        alignItems: "center",

        justifyContent: "center",

        textAlign: "center",
      }}
    >
      <Box
        sx={{
          width: 56,
          height: 56,

          borderRadius: "50%",

          bgcolor:
            "action.hover",

          display: "flex",

          alignItems: "center",

          justifyContent: "center",

          mb: 1.5,
        }}
      >
        <AssignmentOutlined
          sx={{
            fontSize: 27,
            color:
              "text.disabled",
          }}
        />
      </Box>

      <Typography
        fontWeight={700}
      >
        No tasks assigned
      </Typography>

      <Typography
        variant="body2"
        color="text.secondary"
        sx={{
          mt: 0.5,
          maxWidth: 250,
          fontSize: "0.8rem",
        }}
      >
        New tasks from admins
        will appear here.
      </Typography>
    </Box>
  );
}

/* ===========================================================
   CHAT PANE
=========================================================== */

function ChatPane({
  task,
  updatingStatus,
  onStatusChange,
  onBack,
  showBack,
}) {
  if (!task) {
    return (
      <Paper
        variant="outlined"
        sx={{
          height: "100%",

          minHeight: 300,

          borderRadius: 3,

          borderStyle:
            "dashed",

          display: "flex",

          flexDirection:
            "column",

          alignItems:
            "center",

          justifyContent:
            "center",

          textAlign: "center",

          p: 4,
        }}
      >
        <Box
          sx={{
            width: 58,
            height: 58,

            borderRadius: "50%",

            bgcolor:
              "action.hover",

            display: "flex",

            alignItems:
              "center",

            justifyContent:
              "center",

            mb: 1.5,
          }}
        >
          <ChatBubbleOutline
            sx={{
              fontSize: 28,
              color:
                "text.disabled",
            }}
          />
        </Box>

        <Typography
          fontWeight={700}
        >
          Select a task
        </Typography>

        <Typography
          variant="body2"
          color="text.secondary"
          sx={{
            mt: 0.5,
          }}
        >
          Select a task from
          the list to view the
          conversation.
        </Typography>
      </Paper>
    );
  }

  const senderName =
    task.assignedBy?.name ||
    "Admin";

  return (
    <Box
      sx={{
        height: "100%",

        minHeight: 0,

        width: "100%",

        display: "flex",

        flexDirection:
          "column",

        overflow: "hidden",

        bgcolor: {
          xs: "#F8F9FB",
          md: "transparent",
        },
      }}
    >
      {/* =====================================================
          HEADER
      ===================================================== */}

      <Stack
        direction="row"
        spacing={{
          xs: 0.75,
          sm: 1,
        }}
        alignItems="center"
        sx={{
          px: {
            xs: 0.75,
            sm: 1.25,
          },

          py: {
            xs: 0.65,
            sm: 0.9,
          },

          minHeight: {
            xs: 58,
            sm: 60,
          },

          flexShrink: 0,

          bgcolor: "#fff",

          border: {
            xs: "none",
            md: "1px solid",
          },

          borderColor:
            "divider",

          borderRadius: {
            xs: 0,
            md: 3,
          },

          mb: {
            xs: 0,
            md: 1,
          },

          boxShadow: {
            xs:
              "0 1px 4px rgba(0,0,0,0.07)",
            md: "none",
          },
        }}
      >
        {showBack && (
          <IconButton
            size="small"
            onClick={onBack}
            sx={{
              flexShrink: 0,
              width: 36,
              height: 36,
            }}
          >
            <ArrowBack
              fontSize="small"
            />
          </IconButton>
        )}

        <Avatar
          sx={{
            width: {
              xs: 34,
              sm: 36,
            },

            height: {
              xs: 34,
              sm: 36,
            },

            fontSize: 11,

            fontWeight: 700,

            bgcolor:
              colorForName(
                senderName,
              ),

            flexShrink: 0,
          }}
        >
          {initials(senderName)}
        </Avatar>

        <Box
          sx={{
            minWidth: 0,
            flex: 1,
            overflow: "hidden",
          }}
        >
          <Typography
            fontWeight={750}
            noWrap
            sx={{
              fontSize: {
                xs: "0.82rem",
                sm: "0.92rem",
              },

              overflow: "hidden",
              textOverflow:
                "ellipsis",
            }}
          >
            {task.title ||
              "Untitled task"}
          </Typography>

          <Typography
            variant="caption"
            color="text.secondary"
            noWrap
            sx={{
              display: "block",

              mt: 0.1,

              fontSize: {
                xs: "0.67rem",
                sm: "0.72rem",
              },

              overflow: "hidden",
              textOverflow:
                "ellipsis",
            }}
          >
            From {senderName}
          </Typography>
        </Box>

        <StatusSelect
          status={task.status}
          disabled={updatingStatus}
          onChange={(status) =>
            onStatusChange(
              task._id,
              status,
            )
          }
        />
      </Stack>

      {/* =====================================================
          DESCRIPTION
      ===================================================== */}

      {task.description && (
        <Box
          sx={{
            px: {
              xs: 1.25,
              sm: 1.75,
            },

            py: {
              xs: 0.8,
              sm: 1,
            },

            bgcolor:
              "rgba(0,0,0,0.025)",

            borderBottom:
              "1px solid",

            borderColor:
              "divider",

            flexShrink: 0,

            maxHeight: {
              xs: 90,
              sm: 120,
            },

            overflowY: "auto",
          }}
        >
          <Typography
            variant="caption"
            color="text.secondary"
            sx={{
              lineHeight: 1.5,
              display: "block",
              fontSize: {
                xs: "0.7rem",
                sm: "0.75rem",
              },
            }}
          >
            <Box
              component="span"
              sx={{
                fontWeight: 700,
                color:
                  "text.primary",
              }}
            >
              Task:
            </Box>{" "}
            {task.description}
          </Typography>
        </Box>
      )}

      {/* =====================================================
          CHAT
      ===================================================== */}

      <Box
        sx={{
          flex: 1,

          minHeight: 0,

          width: "100%",

          overflow: "hidden",
        }}
      >
        <TaskChat
          taskId={task._id}
        />
      </Box>
    </Box>
  );
}

/* ===========================================================
   STATUS CHIP
=========================================================== */

function StatusChip({ status }) {
  const config =
    getStatusConfig(status);

  return (
    <Chip
      size="small"
      color={config.color}
      icon={config.icon}
      label={config.label}
      sx={{
        fontWeight: 700,

        ml: 0.25,

        flexShrink: 0,

        height: {
          xs: 23,
          sm: 26,
        },

        maxWidth: {
          xs: 82,
          sm: 110,
        },

        "& .MuiChip-label": {
          px: {
            xs: 0.55,
            sm: 0.9,
          },

          fontSize: {
            xs: "0.61rem",
            sm: "0.7rem",
          },

          overflow: "hidden",
          textOverflow:
            "ellipsis",
        },

        "& .MuiChip-icon": {
          fontSize: {
            xs: 13,
            sm: 16,
          },

          ml: {
            xs: 0.5,
            sm: 0.75,
          },
        },
      }}
    />
  );
}

/* ===========================================================
   STATUS SELECT
=========================================================== */

function StatusSelect({
  status,
  onChange,
  disabled,
}) {
  const [anchorEl, setAnchorEl] =
    useState(null);

  const config =
    getStatusConfig(status);

  const open = Boolean(anchorEl);

  const handleOpen = (event) => {
    if (disabled) return;

    setAnchorEl(
      event.currentTarget,
    );
  };

  const handleClose = () => {
    setAnchorEl(null);
  };

  const handleChange = (
    nextStatus,
  ) => {
    if (
      nextStatus === status
    ) {
      handleClose();
      return;
    }

    onChange(nextStatus);

    handleClose();
  };

  return (
    <>
      <Chip
        size="small"
        color={config.color}
        icon={config.icon}
        label={config.label}
        deleteIcon={
          <ExpandMore
            fontSize="small"
          />
        }
        onDelete={handleOpen}
        onClick={handleOpen}
        disabled={disabled}
        sx={{
          fontWeight: 700,

          height: {
            xs: 26,
            sm: 28,
          },

          flexShrink: 0,

          maxWidth: {
            xs: 100,
            sm: 120,
          },

          cursor: disabled
            ? "default"
            : "pointer",

          "& .MuiChip-label": {
            px: {
              xs: 0.6,
              sm: 1,
            },

            fontSize: {
              xs: "0.63rem",
              sm: "0.7rem",
            },
          },

          "& .MuiChip-icon": {
            fontSize: {
              xs: 13,
              sm: 16,
            },
          },
        }}
      />

      <Menu
        anchorEl={anchorEl}
        open={open}
        onClose={handleClose}
        PaperProps={{
          sx: {
            mt: 0.5,

            borderRadius: 2,

            minWidth: 170,
          },
        }}
      >
        {STATUS_ORDER.map(
          (statusKey) => {
            const item =
              STATUS_CONFIG[
                statusKey
              ];

            return (
              <MenuItem
                key={statusKey}
                selected={
                  statusKey ===
                  status
                }
                onClick={() =>
                  handleChange(
                    statusKey,
                  )
                }
                sx={{
                  py: 1,

                  fontSize:
                    "0.85rem",
                }}
              >
                <Stack
                  direction="row"
                  spacing={1}
                  alignItems="center"
                >
                  {item.icon}

                  <Typography
                    variant="body2"
                    fontWeight={
                      statusKey ===
                      status
                        ? 700
                        : 500
                    }
                  >
                    {item.label}
                  </Typography>
                </Stack>
              </MenuItem>
            );
          },
        )}
      </Menu>
    </>
  );
}

/* ===========================================================
   PAGE
=========================================================== */

export default function TeacherTasksPage() {
  return (
    <ProtectedRoute role="teacher">
      <TeacherTasksInner />
    </ProtectedRoute>
  );
}
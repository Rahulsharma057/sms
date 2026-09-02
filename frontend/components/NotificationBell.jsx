"use client";

import { useEffect, useState } from "react";

import {
  Badge,
  Box,
  CircularProgress,
  Divider,
  IconButton,
  List,
  ListItemButton,
  ListItemText,
  Popover,
  Stack,
  Typography,
} from "@mui/material";

import {
  NotificationsNoneOutlined,
  AssignmentOutlined,
  ChatBubbleOutline,
  CheckCircleOutline,
  CampaignOutlined,
  DoneAll,
} from "@mui/icons-material";

import {
  getNotifications,
  getUnreadNotificationCount,
  markNotificationRead,
  markAllNotificationsRead,
} from "../lib/notificationApi";

import { useRouter } from "next/navigation";

const POLL_INTERVAL = 8000;

// ======================================================
// NOTIFICATION ICON
// ======================================================

const getNotificationIcon = (type) => {
  switch (type) {
    case "NEW_TASK":
      return <AssignmentOutlined fontSize="small" />;

    case "NEW_MESSAGE":
      return <ChatBubbleOutline fontSize="small" />;

    case "TASK_STATUS":
      return <CheckCircleOutline fontSize="small" />;

    case "NEW_NOTICE":
      return <CampaignOutlined fontSize="small" />;

    default:
      return <NotificationsNoneOutlined fontSize="small" />;
  }
};

// ======================================================
// NOTIFICATION LABEL
// ======================================================

const getNotificationLabel = (type) => {
  switch (type) {
    case "NEW_TASK":
      return "New Task";

    case "NEW_MESSAGE":
      return "New Message";

    case "TASK_STATUS":
      return "Task Status Updated";

    case "NEW_NOTICE":
      return "New Notice";

    default:
      return "Notification";
  }
};

// ======================================================
// FORMAT TIME
// ======================================================

const formatTime = (date) => {
  if (!date) return "";

  const d = new Date(date);

  if (Number.isNaN(d.getTime())) return "";

  return d.toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
};

export default function NotificationBell() {
  const router = useRouter();

  const [anchorEl, setAnchorEl] = useState(null);
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [markingAll, setMarkingAll] = useState(false);

  const open = Boolean(anchorEl);

  // ======================================================
  // LOAD NOTIFICATIONS
  // ======================================================

  const loadNotifications = async () => {
    try {
      setLoading(true);

      const data = await getNotifications();

      const list = Array.isArray(data)
        ? data
        : data?.notifications ||
          data?.data ||
          [];

      setNotifications(list);
    } catch (error) {
      console.error(
        "Failed to load notifications:",
        error
      );
    } finally {
      setLoading(false);
    }
  };

  // ======================================================
  // LOAD UNREAD COUNT
  // ======================================================

  const loadUnreadCount = async () => {
    try {
      const data = await getUnreadNotificationCount();

      const count =
        typeof data === "number"
          ? data
          : data?.count ??
            data?.unreadCount ??
            data?.data?.count ??
            0;

      setUnreadCount(Number(count) || 0);
    } catch (error) {
      console.error(
        "Failed to load unread count:",
        error
      );
    }
  };

  // ======================================================
  // INITIAL LOAD + POLLING
  // ======================================================

  useEffect(() => {
    loadUnreadCount();

    const interval = setInterval(() => {
      loadUnreadCount();

      if (open) {
        loadNotifications();
      }
    }, POLL_INTERVAL);

    return () => clearInterval(interval);
  }, [open]);

  // ======================================================
  // OPEN BELL
  // ======================================================

  const handleOpen = async (event) => {
    setAnchorEl(event.currentTarget);

    await loadNotifications();
    await loadUnreadCount();
  };

  const handleClose = () => {
    setAnchorEl(null);
  };

  // ======================================================
  // CLICK NOTIFICATION
  // ======================================================

  const handleNotificationClick = async (notification) => {
    try {
      // ----------------------------------------------
      // MARK AS READ
      // ----------------------------------------------

      if (!notification.isRead) {
        await markNotificationRead(notification._id);

        setNotifications((prev) =>
          prev.map((item) =>
            item._id === notification._id
              ? {
                  ...item,
                  isRead: true,
                }
              : item
          )
        );

        setUnreadCount((prev) =>
          Math.max(0, prev - 1)
        );
      }

      handleClose();

      // ==================================================
      // NEW NOTICE
      // ==================================================

      if (notification.type === "NEW_NOTICE") {
        const noticeId =
          typeof notification.notice === "object"
            ? notification.notice?._id
            : notification.notice;

        if (noticeId) {
          router.push(`/notices/${noticeId}`);
          return;
        }

        // Fallback
        router.push("/notices");
        return;
      }

      // ==================================================
      // TASK NOTIFICATION
      // ==================================================

      if (
        notification.type === "NEW_TASK" ||
        notification.type === "TASK_STATUS"
      ) {
        const taskId =
          typeof notification.task === "object"
            ? notification.task?._id
            : notification.task;

        if (taskId) {
          router.push(
            `/teacher/tasks?task=${taskId}`
          );
          return;
        }
      }

      // ==================================================
      // MESSAGE NOTIFICATION
      // ==================================================

      if (notification.type === "NEW_MESSAGE") {
        const taskId =
          typeof notification.task === "object"
            ? notification.task?._id
            : notification.task;

        if (taskId) {
          router.push(
            `/teacher/tasks?task=${taskId}`
          );
          return;
        }
      }

      // ==================================================
      // FALLBACK
      // ==================================================

      router.push("/notifications");
    } catch (error) {
      console.error(
        "Failed to handle notification:",
        error
      );
    }
  };

  // ======================================================
  // MARK ALL READ
  // ======================================================

  const handleMarkAllRead = async () => {
    if (
      markingAll ||
      unreadCount === 0
    ) {
      return;
    }

    try {
      setMarkingAll(true);

      await markAllNotificationsRead();

      setNotifications((prev) =>
        prev.map((notification) => ({
          ...notification,
          isRead: true,
        }))
      );

      setUnreadCount(0);
    } catch (error) {
      console.error(
        "Failed to mark all notifications as read:",
        error
      );
    } finally {
      setMarkingAll(false);
    }
  };

  return (
    <>
      {/* =================================================
          NOTIFICATION BUTTON
      ================================================= */}

      <IconButton
        onClick={handleOpen}
        sx={{
          width: 42,
          height: 42,
          color: "text.primary",
        }}
      >
        <Badge
          badgeContent={
            unreadCount > 99
              ? "99+"
              : unreadCount
          }
          color="error"
          overlap="circular"
        >
          <NotificationsNoneOutlined />
        </Badge>
      </IconButton>

      {/* =================================================
          NOTIFICATION POPUP
      ================================================= */}

      <Popover
        open={open}
        anchorEl={anchorEl}
        onClose={handleClose}
        anchorOrigin={{
          vertical: "bottom",
          horizontal: "right",
        }}
        transformOrigin={{
          vertical: "top",
          horizontal: "right",
        }}
        slotProps={{
          paper: {
            sx: {
              width: {
                xs: "calc(100vw - 24px)",
                sm: 390,
              },
              maxWidth: 390,
              maxHeight: 560,
              mt: 1,
              borderRadius: 3,
              overflow: "hidden",
            },
          },
        }}
      >
        {/* =================================================
            HEADER
        ================================================= */}

        <Box
          sx={{
            px: 2,
            py: 1.5,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <Box>
            <Typography
              variant="subtitle1"
              fontWeight={700}
            >
              Notifications
            </Typography>

            <Typography
              variant="caption"
              color="text.secondary"
            >
              {unreadCount > 0
                ? `${unreadCount} unread`
                : "You're all caught up"}
            </Typography>
          </Box>

          {unreadCount > 0 && (
            <IconButton
              size="small"
              onClick={handleMarkAllRead}
              disabled={markingAll}
              title="Mark all as read"
            >
              {markingAll ? (
                <CircularProgress size={17} />
              ) : (
                <DoneAll fontSize="small" />
              )}
            </IconButton>
          )}
        </Box>

        <Divider />

        {/* =================================================
            LOADING
        ================================================= */}

        {loading &&
        notifications.length === 0 ? (
          <Box
            sx={{
              py: 5,
              display: "flex",
              justifyContent: "center",
            }}
          >
            <CircularProgress size={25} />
          </Box>
        ) : notifications.length === 0 ? (
          /* =================================================
              EMPTY
          ================================================= */

          <Box
            sx={{
              py: 6,
              px: 3,
              textAlign: "center",
            }}
          >
            <Box
              sx={{
                width: 52,
                height: 52,
                mx: "auto",
                mb: 1.5,
                borderRadius: "50%",
                bgcolor: "action.hover",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <NotificationsNoneOutlined
                sx={{
                  fontSize: 26,
                  color: "text.disabled",
                }}
              />
            </Box>

            <Typography
              variant="body2"
              fontWeight={600}
            >
              No notifications
            </Typography>

            <Typography
              variant="caption"
              color="text.secondary"
            >
              New tasks, messages, status updates
              and notices will appear here.
            </Typography>
          </Box>
        ) : (
          /* =================================================
              LIST
          ================================================= */

          <List
            disablePadding
            sx={{
              maxHeight: 470,
              overflowY: "auto",
            }}
          >
            {notifications.map(
              (notification) => (
                <ListItemButton
                  key={notification._id}
                  onClick={() =>
                    handleNotificationClick(
                      notification
                    )
                  }
                  sx={{
                    px: 2,
                    py: 1.5,
                    alignItems: "flex-start",

                    bgcolor:
                      notification.isRead
                        ? "transparent"
                        : "action.hover",

                    "&:hover": {
                      bgcolor:
                        "action.selected",
                    },
                  }}
                >
                  {/* ICON */}

                  <Box
                    sx={{
                      width: 38,
                      height: 38,
                      minWidth: 38,
                      borderRadius: 2,
                      bgcolor:
                        notification.isRead
                          ? "action.hover"
                          : "primary.50",
                      color:
                        "primary.main",
                      display: "flex",
                      alignItems: "center",
                      justifyContent:
                        "center",
                      mr: 1.5,
                    }}
                  >
                    {getNotificationIcon(
                      notification.type
                    )}
                  </Box>

                  {/* CONTENT */}

                  <ListItemText
                    sx={{ m: 0 }}
                    primary={
                      <Stack
                        direction="row"
                        spacing={0.75}
                        alignItems="center"
                      >
                        <Typography
                          variant="body2"
                          fontWeight={
                            notification.isRead
                              ? 600
                              : 800
                          }
                          sx={{
                            flex: 1,
                          }}
                        >
                          {notification.title ||
                            getNotificationLabel(
                              notification.type
                            )}
                        </Typography>

                        {!notification.isRead && (
                          <Box
                            sx={{
                              width: 7,
                              height: 7,
                              borderRadius:
                                "50%",
                              bgcolor:
                                "primary.main",
                              flexShrink: 0,
                            }}
                          />
                        )}
                      </Stack>
                    }
                    secondary={
                      <Box>
                        <Typography
                          variant="caption"
                          color="text.secondary"
                          sx={{
                            display: "block",
                            mt: 0.4,
                            lineHeight: 1.45,
                          }}
                        >
                          {notification.message}
                        </Typography>

                        <Typography
                          variant="caption"
                          color="text.disabled"
                          sx={{
                            display: "block",
                            mt: 0.6,
                            fontSize: 10.5,
                          }}
                        >
                          {formatTime(
                            notification.createdAt
                          )}
                        </Typography>
                      </Box>
                    }
                  />
                </ListItemButton>
              )
            )}
          </List>
        )}
      </Popover>
    </>
  );
}
"use client";

import { useEffect, useState } from "react";

import {
  AppBar,
  Toolbar,
  Typography,
  IconButton,
  Drawer,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Box,
  Avatar,
  Menu,
  MenuItem,
  useMediaQuery,
  Divider,
  Collapse,
  Badge,
  Popover,
  CircularProgress,
  Switch,
  Stack,
} from "@mui/material";

import {
  Menu as MenuIcon,
  Dashboard,
  Assignment,
  People,
  ChecklistRtl,
  Logout,
  ReportProblem,
  DynamicForm,
  Assessment,
  ExpandMore,
  ExpandLess,
  Description,
  NotificationsNone,
  AssignmentOutlined,
  ChatBubbleOutline,
  CheckCircleOutline,
  DeleteOutline,
  SettingsOutlined,
  AppsOutlined,
  SwapHorizOutlined,
  HomeOutlined,
  ReportProblemOutlined as InspectionIcon,
} from "@mui/icons-material";

import Image from "next/image";
import { useRouter, usePathname } from "next/navigation";
import { useAuth } from "../context/AuthContext";
import { useTheme } from "@mui/material/styles";
import api from "../lib/api";

export default function Navbar() {
  const { user, logout } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const theme = useTheme();

  const isMobile = useMediaQuery(theme.breakpoints.down("sm"));

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [anchorEl, setAnchorEl] = useState(null);

  const [visibleForms, setVisibleForms] = useState([]);
  const [formsMenuAnchor, setFormsMenuAnchor] = useState(null);
  const [formsDrawerOpen, setFormsDrawerOpen] = useState(false);

  const [visibleDynamicReports, setVisibleDynamicReports] = useState([]);
  const [reportsMenuAnchor, setReportsMenuAnchor] = useState(null);
  const [reportsDrawerOpen, setReportsDrawerOpen] = useState(false);

  // =========================================================
  // SSO PORTAL SWITCHER
  // =========================================================

  const [portalUrl, setPortalUrl] = useState(null);
  const [switchAnchor, setSwitchAnchor] = useState(null);

  useEffect(() => {
    if (typeof window !== "undefined") {
      setPortalUrl(localStorage.getItem("sso_portal_url"));
    }
  }, []);

  // =========================================================
  // NOTIFICATIONS
  // =========================================================

  const [notificationAnchor, setNotificationAnchor] = useState(null);
  const [notifications, setNotifications] = useState([]);
  const [notificationLoading, setNotificationLoading] = useState(false);

  // =========================================================
  // NOTIFICATION PREFERENCES
  // =========================================================

  const [prefsAnchor, setPrefsAnchor] = useState(null);
  const [mutedTypes, setMutedTypes] = useState([]);

  const NOTIFICATION_CATEGORIES = [
    { key: "TASK", label: "Tasks & Messages" },
    { key: "NOTICE", label: "Notices" },
    { key: "REPORT", label: "Dynamic Reports" },
    { key: "FORM", label: "Forms" },
  ];

  const loadPreferences = async () => {
    try {
      const res = await api.get("/notifications/preferences");
      setMutedTypes(res.data?.mutedTypes || []);
    } catch (error) {
      console.error("Could not load notification preferences:", error);
    }
  };

  const handlePrefsOpen = (event) => {
    setPrefsAnchor(event.currentTarget);
    loadPreferences();
  };

  const handlePrefsClose = () => {
    setPrefsAnchor(null);
  };

  const toggleMute = async (category) => {
    const next = mutedTypes.includes(category)
      ? mutedTypes.filter((c) => c !== category)
      : [...mutedTypes, category];

    const prev = mutedTypes;

    setMutedTypes(next);

    try {
      await api.patch("/notifications/preferences", {
        mutedTypes: next,
      });
    } catch (error) {
      console.error("Could not update notification preferences:", error);

      setMutedTypes(prev);
    }
  };

  const BLUE = "rgba(23, 43, 143, 0.98)";
  const LIGHT_BG = "#FFFFFF";

  // =========================================================
  // LOAD FORMS
  // =========================================================

  useEffect(() => {
    if (!user || user.role === "superadmin") return;

    api
      .get("/forms/visible")
      .then((res) => setVisibleForms(res.data || []))
      .catch(() => {});
  }, [user]);

  // =========================================================
  // LOAD DYNAMIC REPORTS
  // =========================================================

  useEffect(() => {
    if (!user || user.role === "superadmin") return;

    api
      .get("/dynamic-reports/visible")
      .then((res) => setVisibleDynamicReports(res.data || []))
      .catch(() => {});
  }, [user]);

  // =========================================================
  // LOAD NOTIFICATIONS
  // =========================================================

  const loadNotifications = async ({ silent = false } = {}) => {
    if (!user) return;

    try {
      if (!silent) {
        setNotificationLoading(true);
      }

      const res = await api.get("/notifications");

      setNotifications(
        Array.isArray(res.data) ? res.data : res.data?.notifications || [],
      );
    } catch (error) {
      console.error("Could not load notifications:", error);
    } finally {
      if (!silent) {
        setNotificationLoading(false);
      }
    }
  };

  useEffect(() => {
    if (!user) return;

    loadNotifications();

    const interval = setInterval(() => {
      loadNotifications({ silent: true });
    }, 10000);

    return () => clearInterval(interval);
  }, [user]);

  // =========================================================
  // NOTIFICATION HELPERS
  // =========================================================

  const unreadNotifications = notifications.filter(
    (notification) => !notification.isRead,
  );

  const unreadCount = unreadNotifications.length;

  const handleNotificationOpen = (event) => {
    setNotificationAnchor(event.currentTarget);
    loadNotifications();
  };

  const handleNotificationClose = () => {
    setNotificationAnchor(null);
  };

  const markNotificationRead = async (notification) => {
    try {
      if (!notification.isRead) {
        await api.patch(`/notifications/${notification._id}/read`);

        setNotifications((prev) =>
          prev.map((item) =>
            item._id === notification._id ? { ...item, isRead: true } : item,
          ),
        );
      }

      // =====================================================
      // NOTICE NOTIFICATION
      // =====================================================

      if (notification.type === "NEW_NOTICE" && notification.notice) {
        const noticeId = notification.notice?._id || notification.notice;

        if (user.role === "teacher") {
          router.push(`/teacher/notice?notice=${noticeId}`);
        } else if (user.role === "superadmin") {
          router.push(`/admin/notice?notice=${noticeId}`);
        }

        setNotificationAnchor(null);
        return;
      }

      // =====================================================
      // DYNAMIC REPORT NOTIFICATION
      // =====================================================

      if (
        (notification.type === "NEW_DYNAMIC_REPORT" ||
          notification.type === "DYNAMIC_REPORT_SUBMITTED") &&
        notification.dynamicReport
      ) {
        const reportId =
          notification.dynamicReport?._id || notification.dynamicReport;

        if (notification.type === "NEW_DYNAMIC_REPORT") {
          router.push(`/reports/${reportId}`);
        } else if (user.role === "superadmin") {
          router.push(`/admin/dynamic-reports/${reportId}/entries`);
        }

        setNotificationAnchor(null);
        return;
      }
    } catch (error) {
      console.error("Could not mark notification as read:", error);
    }
  };

  const markAllNotificationsRead = async () => {
    try {
      await api.patch("/notifications/read-all");

      setNotifications((prev) =>
        prev.map((item) => ({
          ...item,
          isRead: true,
        })),
      );
    } catch (error) {
      console.error("Could not mark all notifications as read:", error);
    }
  };

  // =========================================================
  // DELETE NOTIFICATION
  // =========================================================

  const deleteNotification = async (notificationId) => {
    if (!notificationId) return;

    try {
      await api.delete(`/notifications/${notificationId}`);

      setNotifications((prev) =>
        prev.filter((item) => item._id !== notificationId),
      );
    } catch (error) {
      console.error("Could not delete notification:", error);
    }
  };

  // =========================================================
  // NOTIFICATION ICON
  // =========================================================

  const getNotificationIcon = (type) => {
    switch (type) {
      case "NEW_TASK":
        return <AssignmentOutlined fontSize="small" />;

      case "NEW_MESSAGE":
        return <ChatBubbleOutline fontSize="small" />;

      case "NEW_INSPECTION_REPORT":
        return <InspectionIcon fontSize="small" />;

      case "TASK_STATUS":
        return <CheckCircleOutline fontSize="small" />;

      case "NEW_NOTICE":
        return <Description fontSize="small" />;

      case "NEW_DYNAMIC_REPORT":
      case "DYNAMIC_REPORT_SUBMITTED":
        return <Assessment fontSize="small" />;

      case "NEW_FORM":
        return <DynamicForm fontSize="small" />;

      default:
        return <NotificationsNone fontSize="small" />;
    }
  };

  const formatNotificationTime = (date) => {
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

  // =========================================================
  // USER CHECK
  // =========================================================

  if (!user) return null;

  // =========================================================
  // LINKS
  // =========================================================

  const teacherLinks = [
    {
      label: "Dashboard",
      href: "/teacher/dashboard",
      icon: <Dashboard />,
    },
    {
      label: "New Report",
      href: "/teacher/report/new",
      icon: <ChecklistRtl />,
    },
    {
      label: "Inspection",
      href: "/teacher/inspection",
      icon: <InspectionIcon />,
    },
    {
      label: "Inspections History",
      href: "/teacher/inspection/history",
      icon: <InspectionIcon />,
    },
    {
      label: "All Reports",
      href: "/teacher/report/teacher-reports",
      icon: <ChecklistRtl />,
    },
    {
      label: "My Tasks",
      href: "/teacher/tasks",
      icon: <Assignment />,
    },
    {
      label: "Notice",
      href: "/teacher/notice",
      icon: <Description />,
    },
  ];

  const adminLinks = [
    {
      label: "Dashboard",
      href: "/admin/dashboard",
      icon: <Dashboard />,
    },
    {
      label: "Inspections",
      href: "/admin/inspection-reports",
      icon: <InspectionIcon />,
    },
    {
      label: "Teachers",
      href: "/admin/teachers",
      icon: <People />,
    },
    {
      label: "Reports",
      href: "/admin/reports",
      icon: <ChecklistRtl />,
    },
    {
      label: "Issue Tracker",
      href: "/admin/issues",
      icon: <ReportProblem />,
    },
    {
      label: "Tasks",
      href: "/admin/tasks",
      icon: <Assignment />,
    },
    {
      label: "Notice",
      href: "/admin/notice",
      icon: <Description />,
    },
    {
      label: "Dynamic Forms",
      href: "/admin/forms",
      icon: <DynamicForm />,
    },
    {
      label: "Dynamic Reports",
      href: "/admin/dynamic-reports",
      icon: <Assessment />,
    },
  ];

  const links = user.role === "superadmin" ? adminLinks : teacherLinks;

  const showFormsMenu = user.role !== "superadmin" && visibleForms.length > 0;

  const showReportsMenu =
    user.role !== "superadmin" && visibleDynamicReports.length > 0;

  const goToForm = (slug) => {
    router.push(`/forms/${slug}`);

    setFormsMenuAnchor(null);
    setFormsDrawerOpen(false);
    setDrawerOpen(false);
  };

  const goToDynamicReport = (reportId) => {
    router.push(`/reports/${reportId}`);

    setReportsMenuAnchor(null);
    setReportsDrawerOpen(false);
    setDrawerOpen(false);
  };

  // =========================================================
  // MOBILE DRAWER
  // =========================================================

  const NavList = (
    <Box
      sx={{
        width: 220,
        height: "100%",
        bgcolor: LIGHT_BG,
      }}
    >
      {/* DRAWER HEADER */}

      <Box
        sx={{
          px: 2,
          py: 1.5,
          bgcolor: "#FFFFFF",
          color: "#171717",
          borderBottom: "1px solid rgba(23, 43, 143, 0.10)",
        }}
      >
        <Box
          sx={{
            display: "flex",
            alignItems: "left",
            gap: 1,
            minWidth: 0,
            flexDirection: "column",
          }}
        >
          <Image
            src="/sleepwell-logo.png"
            alt="Sleepwell Foundation"
            width={185}
            height={44}
            style={{
              width: "165px",
              height: "auto",
              objectFit: "contain",
            }}
          />
        </Box>
      </Box>

      <List sx={{ py: 1.2 }}>
        {links.map((l) => {
          const isActive = pathname === l.href;

          return (
            <ListItemButton
              key={l.href}
              selected={isActive}
              onClick={() => {
                router.push(l.href);
                setDrawerOpen(false);
              }}
              sx={{
                mx: 1,
                my: 0.35,
                minHeight: 44,
                borderRadius: 1.5,

                color: isActive ? "#FFFFFF" : "#202020",

                bgcolor: isActive ? BLUE : "transparent",

                "&:hover": {
                  bgcolor: isActive ? BLUE : "rgba(23, 43, 143, 0.06)",
                },

                "&.Mui-selected": {
                  bgcolor: BLUE,
                  color: "#FFFFFF",

                  "&:hover": {
                    bgcolor: BLUE,
                  },

                  "& .MuiListItemIcon-root": {
                    color: "#FFFFFF",
                  },
                },
              }}
            >
              <ListItemIcon
                sx={{
                  minWidth: 40,
                  color: isActive ? "#FFFFFF" : "rgba(23, 43, 143, 0.85)",
                }}
              >
                {l.icon}
              </ListItemIcon>

              <ListItemText
                primary={l.label}
                primaryTypographyProps={{
                  fontWeight: isActive ? 700 : 500,
                  fontSize: "0.9rem",
                }}
              />
            </ListItemButton>
          );
        })}

        {/* ===================================================
            MOBILE FORMS
        =================================================== */}

        {showFormsMenu && (
          <>
            <ListItemButton
              onClick={() => setFormsDrawerOpen((p) => !p)}
              sx={{
                mx: 1,
                my: 0.35,
                minHeight: 44,
                borderRadius: 1.5,
                color: "#202020",

                "&:hover": {
                  bgcolor: "rgba(23, 43, 143, 0.06)",
                },
              }}
            >
              <ListItemIcon
                sx={{
                  minWidth: 40,
                  color: "rgba(23, 43, 143, 0.85)",
                }}
              >
                <DynamicForm />
              </ListItemIcon>

              <ListItemText
                primary="Forms"
                primaryTypographyProps={{
                  fontWeight: 500,
                  fontSize: "0.9rem",
                }}
              />

              {formsDrawerOpen ? (
                <ExpandLess fontSize="small" sx={{ color: BLUE }} />
              ) : (
                <ExpandMore fontSize="small" sx={{ color: BLUE }} />
              )}
            </ListItemButton>

            <Collapse in={formsDrawerOpen} timeout="auto" unmountOnExit>
              <List component="div" disablePadding>
                {visibleForms.map((f) => (
                  <ListItemButton
                    key={f._id}
                    onClick={() => goToForm(f.slug)}
                    sx={{
                      pl: 5,
                      mx: 1,
                      my: 0.2,
                      minHeight: 40,
                      borderRadius: 1.5,
                      color: "#333333",

                      "&:hover": {
                        bgcolor: "rgba(23, 43, 143, 0.06)",
                      },
                    }}
                  >
                    <ListItemIcon
                      sx={{
                        minWidth: 32,
                        color: BLUE,
                      }}
                    >
                      <Description fontSize="small" />
                    </ListItemIcon>

                    <ListItemText
                      primary={f.title}
                      primaryTypographyProps={{
                        fontSize: "0.85rem",
                      }}
                    />
                  </ListItemButton>
                ))}
              </List>
            </Collapse>
          </>
        )}

        {/* ===================================================
            MOBILE DYNAMIC REPORTS
        =================================================== */}

        {showReportsMenu && (
          <>
            <ListItemButton
              onClick={() => setReportsDrawerOpen((p) => !p)}
              sx={{
                mx: 1,
                my: 0.35,
                minHeight: 44,
                borderRadius: 1.5,
                color: "#202020",

                "&:hover": {
                  bgcolor: "rgba(23, 43, 143, 0.06)",
                },
              }}
            >
              <ListItemIcon
                sx={{
                  minWidth: 40,
                  color: "rgba(23, 43, 143, 0.85)",
                }}
              >
                <Assessment />
              </ListItemIcon>

              <ListItemText
                primary="Reports"
                primaryTypographyProps={{
                  fontWeight: 500,
                  fontSize: "0.9rem",
                }}
              />

              {reportsDrawerOpen ? (
                <ExpandLess fontSize="small" sx={{ color: BLUE }} />
              ) : (
                <ExpandMore fontSize="small" sx={{ color: BLUE }} />
              )}
            </ListItemButton>

            <Collapse in={reportsDrawerOpen} timeout="auto" unmountOnExit>
              <List component="div" disablePadding>
                {visibleDynamicReports.map((r) => (
                  <ListItemButton
                    key={r._id}
                    onClick={() => goToDynamicReport(r._id)}
                    sx={{
                      pl: 5,
                      mx: 1,
                      my: 0.2,
                      minHeight: 40,
                      borderRadius: 1.5,
                      color: "#333333",

                      "&:hover": {
                        bgcolor: "rgba(23, 43, 143, 0.06)",
                      },
                    }}
                  >
                    <ListItemIcon
                      sx={{
                        minWidth: 32,
                        color: BLUE,
                      }}
                    >
                      <Assessment fontSize="small" />
                    </ListItemIcon>

                    <ListItemText
                      primary={r.title}
                      secondary={
                        r.submittedToday
                          ? "Submitted today"
                          : r.dueToday
                            ? "Due today"
                            : null
                      }
                      primaryTypographyProps={{
                        fontSize: "0.85rem",
                      }}
                      secondaryTypographyProps={{
                        fontSize: "0.68rem",
                        color: r.submittedToday ? "success.main" : "error.main",
                      }}
                    />
                  </ListItemButton>
                ))}
              </List>
            </Collapse>
          </>
        )}
      </List>
    </Box>
  );

  // =========================================================
  // NAVBAR
  // =========================================================

  return (
    <>
      <AppBar
        position="sticky"
        elevation={0}
        sx={{
          bgcolor: "#FFFFFF",
          color: "#171717",
          borderRadius: 0,

          boxShadow: "0 3px 12px rgba(0, 0, 0, 0.10)",

          borderBottom: "1px solid rgba(0, 0, 0, 0.06)",

          zIndex: (theme) => theme.zIndex.appBar,
        }}
      >
        <Toolbar
          sx={{
            minHeight: {
              xs: 58,
              sm: 64,
            },

            px: {
              xs: 1.5,
              sm: 2.5,
              md: 3,
            },

            gap: 0,
            overflow: "hidden",
          }}
        >
          {/* =================================================
              MOBILE MENU
          ================================================= */}

          {isMobile && (
            <IconButton
              edge="start"
              onClick={() => setDrawerOpen(true)}
              sx={{
                mr: 1,
                color: BLUE,

                "&:hover": {
                  bgcolor: "rgba(23, 43, 143, 0.06)",
                },
              }}
            >
              <MenuIcon />
            </IconButton>
          )}

          {/* =================================================
              BRAND
          ================================================= */}

          <Box
            sx={{
              flexGrow: 0,
              flexShrink: 0,

              width: {
                xs: "auto",
                sm: user.role === "superadmin" ? 270 : 235,
                md: user.role === "superadmin" ? 295 : 255,
              },

              minWidth: {
                xs: "auto",
                sm: user.role === "superadmin" ? 270 : 235,
                md: user.role === "superadmin" ? 295 : 255,
              },

              pr: {
                xs: 0.5,
                sm: 1.5,
                md: 2,
              },

              overflow: "visible",
            }}
          >
            <Box
              sx={{
                display: "flex",
                alignItems: "center",

                gap: {
                  xs: 0.6,
                  sm: 0.9,
                  md: 1.1,
                },

                whiteSpace: "nowrap",
                width: "max-content",
              }}
            >
              {/* LOGO */}
              <Image
                src="/sleepwell-logo.png"
                alt="Sleepwell Foundation"
                width={150}
                height={52}
                style={{
                  width: "auto",
                  height: "auto",
                  maxWidth: "150px",
                  objectFit: "contain",
                  flexShrink: 0,
                }}
                sizes="(max-width: 600px) 105px, 150px"
              />

              {/* ROLE */}
              <Typography
                component="span"
                sx={{
                  display: "inline-flex",
                  alignItems: "center",

                  fontWeight: 700,

                  fontSize: {
                    xs: "0.72rem",
                    sm: "0.84rem",
                    md: "0.96rem",
                  },

                  color: BLUE,

                  whiteSpace: "nowrap",

                  lineHeight: 1,

                  flexShrink: 0,
                }}
              >
                —&nbsp;
                {user.role === "superadmin"
                  ? "Super Admin"
                  : "Duty Officer Checklist"}
              </Typography>
            </Box>
          </Box>

          {/* =================================================
              DESKTOP NAVIGATION
              HORIZONTAL SCROLL
          ================================================= */}

          {!isMobile && (
            <Box
              sx={{
                flex: 1,
                minWidth: 0,

                display: "flex",
                alignItems: "stretch",

                overflowX: "auto",
                overflowY: "hidden",

                height: 64,

                scrollbarWidth: "none",
                msOverflowStyle: "none",

                "&::-webkit-scrollbar": {
                  display: "none",
                },

                // Keep all nav items in one line
                "& > *": {
                  flexShrink: 0,
                },
              }}
            >
              {/* =================================================
                  MAIN LINKS
              ================================================= */}

              {links.map((l) => {
                const isActive = pathname === l.href;

                return (
                  <Box
                    key={l.href}
                    onClick={() => router.push(l.href)}
                    sx={{
                      position: "relative",

                      cursor: "pointer",

                      display: "flex",
                      alignItems: "center",

                      px: {
                        sm: 1.05,
                        md: 1.25,
                      },

                      height: 64,

                      mx: 0.1,

                      fontSize: {
                        sm: "0.79rem",
                        md: "0.85rem",
                      },

                      fontWeight: isActive ? 700 : 500,

                      color: isActive ? "#28188b" : "#252525",

                      transition: "color 0.2s ease, background-color 0.2s ease",

                      whiteSpace: "nowrap",

                      flexShrink: 0,

                      borderRadius: isActive ? 1.2 : 0,

                      "&::after": {
                        content: '""',

                        position: "absolute",

                        left: 8,
                        right: 8,
                        bottom: 0,

                        height: 3,

                        bgcolor: BLUE,

                        transform: isActive ? "scaleX(1)" : "scaleX(0)",

                        transformOrigin: "center",

                        transition: "transform 0.22s ease",

                        borderRadius: "3px 3px 0 0",
                      },

                      "&:hover": {
                        color: BLUE,
                      },

                      "&:hover::after": {
                        transform: "scaleX(1)",
                      },
                    }}
                  >
                    {l.label}
                  </Box>
                );
              })}

              {/* =================================================
                  DESKTOP FORMS
              ================================================= */}

              {showFormsMenu && (
                <>
                  <Box
                    onClick={(e) => setFormsMenuAnchor(e.currentTarget)}
                    sx={{
                      position: "relative",

                      cursor: "pointer",

                      display: "flex",
                      alignItems: "center",

                      gap: 0.3,

                      px: {
                        sm: 1.05,
                        md: 1.25,
                      },

                      height: 64,

                      mx: 0.1,

                      fontSize: {
                        sm: "0.79rem",
                        md: "0.85rem",
                      },

                      fontWeight: 500,

                      color: "#252525",

                      whiteSpace: "nowrap",

                      flexShrink: 0,

                      "&:hover": {
                        color: BLUE,
                      },

                      "&::after": {
                        content: '""',

                        position: "absolute",

                        left: 8,
                        right: 8,
                        bottom: 0,

                        height: 3,

                        bgcolor: BLUE,

                        transform: formsMenuAnchor ? "scaleX(1)" : "scaleX(0)",

                        transition: "transform 0.22s ease",

                        borderRadius: "3px 3px 0 0",
                      },

                      "&:hover::after": {
                        transform: "scaleX(1)",
                      },
                    }}
                  >
                    Forms
                    {formsMenuAnchor ? (
                      <ExpandLess
                        sx={{
                          fontSize: 18,
                          color: BLUE,
                        }}
                      />
                    ) : (
                      <ExpandMore
                        sx={{
                          fontSize: 18,
                          color: "#555555",
                        }}
                      />
                    )}
                  </Box>

                  <Menu
                    anchorEl={formsMenuAnchor}
                    open={!!formsMenuAnchor}
                    onClose={() => setFormsMenuAnchor(null)}
                    anchorOrigin={{
                      vertical: "bottom",
                      horizontal: "left",
                    }}
                    transformOrigin={{
                      vertical: "top",
                      horizontal: "left",
                    }}
                    PaperProps={{
                      elevation: 4,
                      sx: {
                        mt: 1,

                        minWidth: 210,

                        borderRadius: 1.5,

                        border: "1px solid rgba(0,0,0,0.06)",
                      },
                    }}
                  >
                    {visibleForms.map((f) => (
                      <MenuItem
                        key={f._id}
                        onClick={() => goToForm(f.slug)}
                        sx={{
                          fontSize: "0.87rem",

                          "&:hover": {
                            bgcolor: "rgba(23, 43, 143, 0.07)",
                            color: BLUE,
                          },
                        }}
                      >
                        <ListItemIcon
                          sx={{
                            minWidth: 32,
                            color: BLUE,
                          }}
                        >
                          <Description fontSize="small" />
                        </ListItemIcon>

                        {f.title}
                      </MenuItem>
                    ))}
                  </Menu>
                </>
              )}

              {/* =================================================
                  DESKTOP DYNAMIC REPORTS
              ================================================= */}

              {showReportsMenu && (
                <>
                  <Box
                    onClick={(e) => setReportsMenuAnchor(e.currentTarget)}
                    sx={{
                      position: "relative",

                      cursor: "pointer",

                      display: "flex",
                      alignItems: "center",

                      gap: 0.3,

                      px: {
                        sm: 1.05,
                        md: 1.25,
                      },

                      height: 64,

                      mx: 0.1,

                      fontSize: {
                        sm: "0.79rem",
                        md: "0.85rem",
                      },

                      fontWeight: 500,

                      color: "#252525",

                      whiteSpace: "nowrap",

                      flexShrink: 0,

                      "&:hover": {
                        color: BLUE,
                      },

                      "&::after": {
                        content: '""',

                        position: "absolute",

                        left: 8,
                        right: 8,
                        bottom: 0,

                        height: 3,

                        bgcolor: BLUE,

                        transform: reportsMenuAnchor
                          ? "scaleX(1)"
                          : "scaleX(0)",

                        transition: "transform 0.22s ease",

                        borderRadius: "3px 3px 0 0",
                      },

                      "&:hover::after": {
                        transform: "scaleX(1)",
                      },
                    }}
                  >
                    Reports
                    {reportsMenuAnchor ? (
                      <ExpandLess
                        sx={{
                          fontSize: 18,
                          color: BLUE,
                        }}
                      />
                    ) : (
                      <ExpandMore
                        sx={{
                          fontSize: 18,
                          color: "#555555",
                        }}
                      />
                    )}
                  </Box>

                  <Menu
                    anchorEl={reportsMenuAnchor}
                    open={!!reportsMenuAnchor}
                    onClose={() => setReportsMenuAnchor(null)}
                    anchorOrigin={{
                      vertical: "bottom",
                      horizontal: "left",
                    }}
                    transformOrigin={{
                      vertical: "top",
                      horizontal: "left",
                    }}
                    PaperProps={{
                      elevation: 4,
                      sx: {
                        mt: 1,

                        minWidth: 230,

                        borderRadius: 1.5,

                        border: "1px solid rgba(0,0,0,0.06)",
                      },
                    }}
                  >
                    {visibleDynamicReports.map((r) => (
                      <MenuItem
                        key={r._id}
                        onClick={() => goToDynamicReport(r._id)}
                        sx={{
                          fontSize: "0.87rem",

                          "&:hover": {
                            bgcolor: "rgba(23, 43, 143, 0.07)",
                            color: BLUE,
                          },
                        }}
                      >
                        <ListItemIcon
                          sx={{
                            minWidth: 32,
                            color: BLUE,
                          }}
                        >
                          <Assessment fontSize="small" />
                        </ListItemIcon>

                        <Box>
                          <Typography fontSize="0.87rem">{r.title}</Typography>

                          {(r.submittedToday || r.dueToday) && (
                            <Typography
                              fontSize="0.68rem"
                              color={
                                r.submittedToday ? "success.main" : "error.main"
                              }
                            >
                              {r.submittedToday
                                ? "Submitted today"
                                : "Due today"}
                            </Typography>
                          )}
                        </Box>
                      </MenuItem>
                    ))}
                  </Menu>
                </>
              )}
            </Box>
          )}

          {/* =================================================
              SSO PORTAL SWITCHER
          ================================================= */}

          {portalUrl && (
            <>
              <IconButton
                onClick={(e) => setSwitchAnchor(e.currentTarget)}
                sx={{
                  ml: {
                    xs: 0.2,
                    sm: 0.5,
                  },

                  color: BLUE,

                  flexShrink: 0,

                  "&:hover": {
                    bgcolor: "rgba(23, 43, 143, 0.06)",
                  },
                }}
              >
                <AppsOutlined />
              </IconButton>

              <Menu
                anchorEl={switchAnchor}
                open={!!switchAnchor}
                onClose={() => setSwitchAnchor(null)}
                PaperProps={{
                  elevation: 4,

                  sx: {
                    mt: 1,

                    minWidth: 220,

                    borderRadius: 1.5,

                    border: "1px solid rgba(0,0,0,0.06)",
                  },
                }}
              >
                <MenuItem
                  disabled
                  sx={{
                    opacity: "1 !important",
                  }}
                >
                  <Typography
                    fontWeight={700}
                    fontSize="0.78rem"
                    color="text.secondary"
                  >
                    Signed in via Portal
                  </Typography>
                </MenuItem>

                <Divider />

                <MenuItem
                  onClick={() => {
                    window.location.href = portalUrl;
                  }}
                >
                  <SwapHorizOutlined
                    fontSize="small"
                    sx={{
                      mr: 1.2,
                      color: BLUE,
                    }}
                  />
                  Switch app
                </MenuItem>

                <MenuItem
                  onClick={() => {
                    window.location.href = `${portalUrl}/dashboard`;
                  }}
                >
                  <HomeOutlined
                    fontSize="small"
                    sx={{
                      mr: 1.2,
                      color: BLUE,
                    }}
                  />
                  Portal dashboard
                </MenuItem>
              </Menu>
            </>
          )}

          {/* =================================================
              NOTIFICATION BELL
          ================================================= */}

          <IconButton
            onClick={handleNotificationOpen}
            sx={{
              ml: {
                xs: 0.2,
                sm: 0.5,
              },

              color: BLUE,

              flexShrink: 0,

              "&:hover": {
                bgcolor: "rgba(23, 43, 143, 0.06)",
              },
            }}
          >
            <Badge
              badgeContent={unreadCount > 99 ? "99+" : unreadCount}
              color="error"
              overlap="circular"
              sx={{
                "& .MuiBadge-badge": {
                  fontSize: "0.62rem",

                  minWidth: 17,

                  height: 17,

                  px: 0.4,

                  fontWeight: 700,
                },
              }}
            >
              <NotificationsNone />
            </Badge>
          </IconButton>

          {/* =================================================
              NOTIFICATION POPOVER
          ================================================= */}

          <Popover
            open={Boolean(notificationAnchor)}
            anchorEl={notificationAnchor}
            onClose={handleNotificationClose}
            anchorOrigin={{
              vertical: "bottom",
              horizontal: "right",
            }}
            transformOrigin={{
              vertical: "top",
              horizontal: "right",
            }}
            PaperProps={{
              sx: {
                width: {
                  xs: "calc(100vw - 24px)",
                  sm: 380,
                },

                maxWidth: 380,

                mt: 1,

                borderRadius: 2,

                overflow: "hidden",
              },
            }}
          >
            {/* HEADER */}

            <Box
              sx={{
                px: 2,
                py: 1.5,

                display: "flex",

                alignItems: "center",

                justifyContent: "space-between",

                borderBottom: "1px solid",

                borderColor: "divider",
              }}
            >
              <Box>
                <Typography fontWeight={800} fontSize="0.95rem">
                  Notifications
                </Typography>

                <Typography variant="caption" color="text.secondary">
                  {unreadCount > 0
                    ? `${unreadCount} unread`
                    : "You're all caught up"}
                </Typography>
              </Box>

              <Stack direction="row" spacing={0.3} alignItems="center">
                {unreadCount > 0 && (
                  <Typography
                    component="button"
                    onClick={markAllNotificationsRead}
                    sx={{
                      border: 0,
                      bgcolor: "transparent",

                      color: BLUE,

                      cursor: "pointer",

                      fontSize: "0.75rem",

                      fontWeight: 700,

                      mr: 0.5,
                    }}
                  >
                    Mark all read
                  </Typography>
                )}

                {/* PREFERENCES */}

                <Popover
                  open={!!prefsAnchor}
                  anchorEl={prefsAnchor}
                  onClose={handlePrefsClose}
                  anchorOrigin={{
                    vertical: "bottom",
                    horizontal: "right",
                  }}
                  transformOrigin={{
                    vertical: "top",
                    horizontal: "right",
                  }}
                  PaperProps={{
                    sx: {
                      mt: 1,

                      borderRadius: 2,

                      minWidth: 240,

                      border: "1px solid rgba(0,0,0,0.06)",
                    },
                  }}
                >
                  <Box sx={{ p: 2 }}>
                    <Typography
                      fontWeight={800}
                      fontSize="0.85rem"
                      sx={{ mb: 1.2 }}
                    >
                      Mute notifications for
                    </Typography>

                    <Stack spacing={1}>
                      {NOTIFICATION_CATEGORIES.map((c) => (
                        <Stack
                          key={c.key}
                          direction="row"
                          justifyContent="space-between"
                          alignItems="center"
                        >
                          <Typography fontSize="0.83rem" color="#334155">
                            {c.label}
                          </Typography>

                          <Switch
                            size="small"
                            checked={mutedTypes.includes(c.key)}
                            onChange={() => toggleMute(c.key)}
                          />
                        </Stack>
                      ))}
                    </Stack>
                  </Box>
                </Popover>

                <IconButton
                  size="small"
                  onClick={handlePrefsOpen}
                  sx={{
                    color: BLUE,

                    "&:hover": {
                      bgcolor: "rgba(23, 43, 143, 0.06)",
                    },
                  }}
                >
                  <SettingsOutlined fontSize="small" />
                </IconButton>
              </Stack>
            </Box>

            {/* =================================================
                NOTIFICATION LIST
            ================================================= */}

            <Box
              sx={{
                maxHeight: 430,
                overflowY: "auto",
              }}
            >
              {notificationLoading ? (
                <Box
                  sx={{
                    py: 5,

                    display: "flex",

                    justifyContent: "center",
                  }}
                >
                  <CircularProgress size={24} />
                </Box>
              ) : notifications.length === 0 ? (
                <Box
                  sx={{
                    py: 5,

                    px: 2,

                    textAlign: "center",
                  }}
                >
                  <NotificationsNone
                    sx={{
                      fontSize: 38,

                      color: "text.disabled",

                      mb: 1,
                    }}
                  />

                  <Typography fontWeight={700} fontSize="0.9rem">
                    No notifications
                  </Typography>

                  <Typography variant="caption" color="text.secondary">
                    New task and message notifications will appear here.
                  </Typography>
                </Box>
              ) : (
                notifications.map((notification) => (
                  <Box
                    key={notification._id}
                    onClick={() => markNotificationRead(notification)}
                    sx={{
                      display: "flex",

                      gap: 1.2,

                      px: 1.7,

                      py: 1.35,

                      cursor: "pointer",

                      bgcolor: notification.isRead
                        ? "#FFFFFF"
                        : "rgba(23, 43, 143, 0.055)",

                      borderBottom: "1px solid rgba(0,0,0,0.05)",

                      "&:hover": {
                        bgcolor: "rgba(23, 43, 143, 0.08)",
                      },
                    }}
                  >
                    {/* ICON */}

                    <Box
                      sx={{
                        width: 34,

                        height: 34,

                        minWidth: 34,

                        borderRadius: "50%",

                        display: "flex",

                        alignItems: "center",

                        justifyContent: "center",

                        bgcolor: "rgba(23, 43, 143, 0.09)",

                        color: BLUE,
                      }}
                    >
                      {getNotificationIcon(notification.type)}
                    </Box>

                    {/* CONTENT */}

                    <Box
                      sx={{
                        minWidth: 0,

                        flex: 1,
                      }}
                    >
                      <Box
                        sx={{
                          display: "flex",

                          alignItems: "center",

                          gap: 0.7,
                        }}
                      >
                        {!notification.isRead && (
                          <Box
                            sx={{
                              width: 7,

                              height: 7,

                              borderRadius: "50%",

                              bgcolor: "error.main",

                              flexShrink: 0,
                            }}
                          />
                        )}

                        <Typography
                          fontWeight={notification.isRead ? 600 : 800}
                          fontSize="0.84rem"
                          noWrap
                        >
                          {notification.title}
                        </Typography>
                      </Box>

                      <Typography
                        variant="body2"
                        color="text.secondary"
                        sx={{
                          mt: 0.3,

                          fontSize: "0.78rem",

                          lineHeight: 1.4,

                          display: "-webkit-box",

                          WebkitLineClamp: 2,

                          WebkitBoxOrient: "vertical",

                          overflow: "hidden",
                        }}
                      >
                        {notification.message}
                      </Typography>

                      <Typography
                        variant="caption"
                        color="text.disabled"
                        sx={{
                          display: "block",

                          mt: 0.45,

                          fontSize: "0.68rem",
                        }}
                      >
                        {formatNotificationTime(notification.createdAt)}
                      </Typography>
                    </Box>

                    {/* DELETE */}

                    <IconButton
                      size="small"
                      onClick={(event) => {
                        event.stopPropagation();

                        deleteNotification(notification._id);
                      }}
                      sx={{
                        alignSelf: "center",

                        flexShrink: 0,

                        color: "text.disabled",

                        "&:hover": {
                          color: "error.main",

                          bgcolor: "rgba(211, 47, 47, 0.08)",
                        },
                      }}
                    >
                      <DeleteOutline fontSize="small" />
                    </IconButton>
                  </Box>
                ))
              )}
            </Box>
          </Popover>

          {/* =================================================
              USER AVATAR
          ================================================= */}

          <IconButton
            onClick={(e) => setAnchorEl(e.currentTarget)}
            sx={{
              ml: {
                xs: 0.5,
                sm: 1,
              },

              flexShrink: 0,

              "&:hover": {
                bgcolor: "rgba(23, 43, 143, 0.06)",
              },
            }}
          >
            <Avatar
              sx={{
                width: {
                  xs: 30,
                  sm: 35,
                },

                height: {
                  xs: 30,
                  sm: 35,
                },

                bgcolor: BLUE,

                color: "#FFFFFF",

                fontSize: "0.9rem",

                fontWeight: 700,
              }}
            >
              {user.name?.[0]?.toUpperCase() || "U"}
            </Avatar>
          </IconButton>

          {/* =================================================
              USER MENU
          ================================================= */}

          <Menu
            anchorEl={anchorEl}
            open={!!anchorEl}
            onClose={() => setAnchorEl(null)}
            PaperProps={{
              elevation: 4,

              sx: {
                mt: 1,

                minWidth: 220,

                borderRadius: 1.5,

                border: "1px solid rgba(0,0,0,0.06)",
              },
            }}
          >
            <MenuItem
              disabled
              sx={{
                opacity: "1 !important",
              }}
            >
              <Box>
                <Typography fontWeight={700} fontSize="0.85rem" color="#171717">
                  {user.name}
                </Typography>

                <Typography fontSize="0.75rem" color="text.secondary">
                  {user.email}
                </Typography>
              </Box>
            </MenuItem>

            <Divider />

            <MenuItem
              onClick={logout}
              sx={{
                color: "error.main",

                "&:hover": {
                  bgcolor: "rgba(211, 47, 47, 0.06)",
                },
              }}
            >
              <Logout fontSize="small" sx={{ mr: 1 }} />
              Logout
            </MenuItem>
          </Menu>
        </Toolbar>
      </AppBar>

      {/* =====================================================
          MOBILE DRAWER
      ===================================================== */}

      <Drawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        PaperProps={{
          sx: {
            borderRadius: 0,
            bgcolor: "#FFFFFF",
          },
        }}
      >
        {NavList}
      </Drawer>
    </>
  );
}

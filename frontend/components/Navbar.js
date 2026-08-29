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
  ExpandMore,
  ExpandLess,
  Description,
} from "@mui/icons-material";
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

  // Forms this user can fill — populated below, rendered as a dropdown /
  // expandable list, same visual language as the other nav items.
  const [visibleForms, setVisibleForms] = useState([]);
  const [formsMenuAnchor, setFormsMenuAnchor] = useState(null);
  const [formsDrawerOpen, setFormsDrawerOpen] = useState(false);

  useEffect(() => {
    if (!user || user.role === "superadmin") return; // admins manage forms from /admin/forms instead
    api
      .get("/forms/visible")
      .then((res) => setVisibleForms(res.data || []))
      .catch(() => {});
  }, [user]);

  if (!user) return null;

  const teacherLinks = [
    { label: "Dashboard", href: "/teacher/dashboard", icon: <Dashboard /> },
    {
      label: "New Report",
      href: "/teacher/report/new",
      icon: <ChecklistRtl />,
    },
    { label: "My Tasks", href: "/teacher/tasks", icon: <Assignment /> },
    { label: "Notice", href: "/teacher/notice", icon: <Description /> },
  ];
  const adminLinks = [
    { label: "Dashboard", href: "/admin/dashboard", icon: <Dashboard /> },
    { label: "Teachers", href: "/admin/teachers", icon: <People /> },
    { label: "Reports", href: "/admin/reports", icon: <ChecklistRtl /> },
    { label: "Issue Tracker", href: "/admin/issues", icon: <ReportProblem /> },
    { label: "Tasks", href: "/admin/tasks", icon: <Assignment /> },
    { label: "Notice", href: "/admin/notice", icon: <Description /> },
    { label: "Forms", href: "/admin/forms", icon: <DynamicForm /> },
  ];
  const links = user.role === "superadmin" ? adminLinks : teacherLinks;
  const showFormsMenu = user.role !== "superadmin" && visibleForms.length > 0;

  const goToForm = (slug) => {
    router.push(`/forms/${slug}`);
    setFormsMenuAnchor(null);
    setFormsDrawerOpen(false);
    setDrawerOpen(false);
  };

  const NavList = (
    <Box sx={{ width: 260 }}>
      {/* DRAWER HEADER — branding */}
      <Box sx={{ px: 2.2, py: 2.2, bgcolor: "primary.main", color: "white" }}>
        <Typography
          fontSize="0.68rem"
          letterSpacing={0.5}
          sx={{ opacity: 0.85, textTransform: "uppercase" }}
        >
          Sleepwell Foundation
        </Typography>
        <Typography fontWeight={800} fontSize="1rem" sx={{ mt: 0.3 }}>
          {user.role === "superadmin"
            ? "Super Admin Panel"
            : "Duty Officer Checklist"}
        </Typography>
      </Box>

      <List sx={{ py: 1 }}>
        {links.map((l) => (
          <ListItemButton
            key={l.href}
            selected={pathname === l.href}
            onClick={() => {
              router.push(l.href);
              setDrawerOpen(false);
            }}
            sx={{
              mx: 1,
              my: 0.3,
              borderRadius: 1.5,
              "&.Mui-selected": {
                bgcolor: "#f3e8ff",
                "&:hover": { bgcolor: "#f3e8ff" },
              },
            }}
          >
            <ListItemIcon
              sx={{
                color: pathname === l.href ? "primary.main" : "inherit",
                minWidth: 40,
              }}
            >
              {l.icon}
            </ListItemIcon>
            <ListItemText
              primary={l.label}
              primaryTypographyProps={{
                fontWeight: pathname === l.href ? 700 : 500,
                fontSize: "0.9rem",
              }}
            />
          </ListItemButton>
        ))}

        {/* FORMS — expandable list, one row per form visible to this user */}
        {showFormsMenu && (
          <>
            <ListItemButton
              onClick={() => setFormsDrawerOpen((p) => !p)}
              sx={{ mx: 1, my: 0.3, borderRadius: 1.5 }}
            >
              <ListItemIcon sx={{ minWidth: 40 }}>
                <DynamicForm />
              </ListItemIcon>
              <ListItemText
                primary="Forms"
                primaryTypographyProps={{ fontWeight: 500, fontSize: "0.9rem" }}
              />
              {formsDrawerOpen ? (
                <ExpandLess fontSize="small" />
              ) : (
                <ExpandMore fontSize="small" />
              )}
            </ListItemButton>
            <Collapse in={formsDrawerOpen} timeout="auto" unmountOnExit>
              <List component="div" disablePadding>
                {visibleForms.map((f) => (
                  <ListItemButton
                    key={f._id}
                    onClick={() => goToForm(f.slug)}
                    sx={{ pl: 5, mx: 1, my: 0.2, borderRadius: 1.5 }}
                  >
                    <ListItemIcon sx={{ minWidth: 32 }}>
                      <Description fontSize="small" />
                    </ListItemIcon>
                    <ListItemText
                      primary={f.title}
                      primaryTypographyProps={{ fontSize: "0.85rem" }}
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

  return (
    <>
      <AppBar position="sticky" color="primary" elevation={2}>
        <Toolbar sx={{ minHeight: { xs: 56, sm: 64 } }}>
          {isMobile && (
            <IconButton
              color="inherit"
              edge="start"
              onClick={() => setDrawerOpen(true)}
              sx={{ mr: 1 }}
            >
              <MenuIcon />
            </IconButton>
          )}

          <Box sx={{ flexGrow: 1, minWidth: 0 }}>
            {isMobile ? (
              <>
                <Typography
                  fontSize="0.62rem"
                  letterSpacing={0.4}
                  sx={{
                    opacity: 0.85,
                    textTransform: "uppercase",
                    lineHeight: 1.2,
                  }}
                >
                  Sleepwell Foundation
                </Typography>
                <Typography
                  fontWeight={700}
                  fontSize="0.92rem"
                  noWrap
                  sx={{ lineHeight: 1.3 }}
                >
                  {user.role === "superadmin"
                    ? "Super Admin"
                    : "Duty Officer Checklist"}
                </Typography>
              </>
            ) : (
              <Typography variant="h6" sx={{ fontWeight: 700, fontSize: 20 }}>
                Sleepwell Foundation{" "}
                {user.role === "superadmin"
                  ? "— Super Admin"
                  : "— Duty Officer Checklist"}
              </Typography>
            )}
          </Box>

          {!isMobile &&
            links.map((l) => (
              <Box
                key={l.href}
                onClick={() => router.push(l.href)}
                sx={{
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: 0.6,
                  px: 1.6,
                  py: 0.9,
                  mx: 0.4,
                  borderRadius: 2,
                  fontSize: "0.88rem",
                  fontWeight: pathname === l.href ? 700 : 500,
                  bgcolor:
                    pathname === l.href
                      ? "rgba(255,255,255,0.18)"
                      : "transparent",
                  "&:hover": { bgcolor: "rgba(255,255,255,0.1)" },
                  whiteSpace: "nowrap",
                }}
              >
                {l.label}
              </Box>
            ))}

          {/* FORMS dropdown — desktop topbar version */}
          {!isMobile && showFormsMenu && (
            <>
              <Box
                onClick={(e) => setFormsMenuAnchor(e.currentTarget)}
                sx={{
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: 0.4,
                  px: 1.6,
                  py: 0.9,
                  mx: 0.4,
                  borderRadius: 2,
                  fontSize: "0.88rem",
                  fontWeight: 500,
                  "&:hover": { bgcolor: "rgba(255,255,255,0.1)" },
                  whiteSpace: "nowrap",
                }}
              >
                Forms
                {formsMenuAnchor ? (
                  <ExpandLess fontSize="small" />
                ) : (
                  <ExpandMore fontSize="small" />
                )}
              </Box>
              <Menu
                anchorEl={formsMenuAnchor}
                open={!!formsMenuAnchor}
                onClose={() => setFormsMenuAnchor(null)}
              >
                {visibleForms.map((f) => (
                  <MenuItem key={f._id} onClick={() => goToForm(f.slug)}>
                    <ListItemIcon sx={{ minWidth: 32 }}>
                      <Description fontSize="small" />
                    </ListItemIcon>
                    {f.title}
                  </MenuItem>
                ))}
              </Menu>
            </>
          )}

          <IconButton
            onClick={(e) => setAnchorEl(e.currentTarget)}
            sx={{ ml: { xs: 0.5, sm: 1 } }}
          >
            <Avatar
              sx={{
                width: { xs: 30, sm: 34 },
                height: { xs: 30, sm: 34 },
                bgcolor: "secondary.main",
                fontSize: "0.9rem",
              }}
            >
              {user.name?.[0]?.toUpperCase() || "U"}
            </Avatar>
          </IconButton>
          <Menu
            anchorEl={anchorEl}
            open={!!anchorEl}
            onClose={() => setAnchorEl(null)}
          >
            <MenuItem disabled sx={{ opacity: "1 !important" }}>
              <Box>
                <Typography fontWeight={600} fontSize="0.85rem">
                  {user.name}
                </Typography>
                <Typography fontSize="0.75rem" color="text.secondary">
                  {user.email}
                </Typography>
              </Box>
            </MenuItem>
            <Divider />
            <MenuItem onClick={logout} sx={{ color: "error.main" }}>
              <Logout fontSize="small" sx={{ mr: 1 }} /> Logout
            </MenuItem>
          </Menu>
        </Toolbar>
      </AppBar>
      <Drawer open={drawerOpen} onClose={() => setDrawerOpen(false)}>
        {NavList}
      </Drawer>
    </>
  );
}

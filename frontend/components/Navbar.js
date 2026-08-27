"use client";
import { useState } from "react";
import {
  AppBar, Toolbar, Typography, IconButton, Drawer, List, ListItemButton,
  ListItemIcon, ListItemText, Box, Avatar, Menu, MenuItem, useMediaQuery, Divider,
} from "@mui/material";
import {
  Menu as MenuIcon, Dashboard, Assignment, People, ChecklistRtl, Logout, ReportProblem,
} from "@mui/icons-material";
import { useRouter, usePathname } from "next/navigation";
import { useAuth } from "../context/AuthContext";
import { useTheme } from "@mui/material/styles";

export default function Navbar() {
  const { user, logout } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("sm"));
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [anchorEl, setAnchorEl] = useState(null);

  if (!user) return null;

  const teacherLinks = [
    { label: "Dashboard", href: "/teacher/dashboard", icon: <Dashboard /> },
    { label: "New Report", href: "/teacher/report/new", icon: <ChecklistRtl /> },
    { label: "My Tasks", href: "/teacher/tasks", icon: <Assignment /> },
  ];
  const adminLinks = [
    { label: "Dashboard", href: "/admin/dashboard", icon: <Dashboard /> },
    { label: "Teachers", href: "/admin/teachers", icon: <People /> },
    { label: "Reports", href: "/admin/reports", icon: <ChecklistRtl /> },
    { label: "Issue Tracker", href: "/admin/issues", icon: <ReportProblem /> },
    { label: "Tasks", href: "/admin/tasks", icon: <Assignment /> },
  ];
  const links = user.role === "superadmin" ? adminLinks : teacherLinks;

  const NavList = (
    <Box sx={{ width: 260 }}>
      {/* DRAWER HEADER — branding */}
      <Box sx={{ px: 2.2, py: 2.2, bgcolor: "primary.main", color: "white" }}>
        <Typography fontSize="0.68rem" letterSpacing={0.5} sx={{ opacity: 0.85, textTransform: "uppercase" }}>
          Sleepwell Foundation
        </Typography>
        <Typography fontWeight={800} fontSize="1rem" sx={{ mt: 0.3 }}>
          {user.role === "superadmin" ? "Super Admin Panel" : "Duty Officer Checklist"}
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
              mx: 1, my: 0.3, borderRadius: 1.5,
              "&.Mui-selected": { bgcolor: "#f3e8ff", "&:hover": { bgcolor: "#f3e8ff" } },
            }}
          >
            <ListItemIcon sx={{ color: pathname === l.href ? "primary.main" : "inherit", minWidth: 40 }}>
              {l.icon}
            </ListItemIcon>
            <ListItemText
              primary={l.label}
              primaryTypographyProps={{ fontWeight: pathname === l.href ? 700 : 500, fontSize: "0.9rem" }}
            />
          </ListItemButton>
        ))}
      </List>
    </Box>
  );

  return (
    <>
      <AppBar position="sticky" color="primary" elevation={2}>
        <Toolbar sx={{ minHeight: { xs: 56, sm: 64 } }}>
          {isMobile && (
            <IconButton color="inherit" edge="start" onClick={() => setDrawerOpen(true)} sx={{ mr: 1 }}>
              <MenuIcon />
            </IconButton>
          )}

          <Box sx={{ flexGrow: 1, minWidth: 0 }}>
            {isMobile ? (
              <>
                <Typography fontSize="0.62rem" letterSpacing={0.4} sx={{ opacity: 0.85, textTransform: "uppercase", lineHeight: 1.2 }}>
                  Sleepwell Foundation
                </Typography>
                <Typography fontWeight={700} fontSize="0.92rem" noWrap sx={{ lineHeight: 1.3 }}>
                  {user.role === "superadmin" ? "Super Admin" : "Duty Officer Checklist"}
                </Typography>
              </>
            ) : (
              <Typography variant="h6" sx={{ fontWeight: 700, fontSize: 20 }}>
                Sleepwell Foundation {user.role === "superadmin" ? "— Super Admin" : "— Duty Officer Checklist"}
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
                  bgcolor: pathname === l.href ? "rgba(255,255,255,0.18)" : "transparent",
                  "&:hover": { bgcolor: "rgba(255,255,255,0.1)" },
                  whiteSpace: "nowrap",
                }}
              >
                {l.label}
              </Box>
            ))}

          <IconButton onClick={(e) => setAnchorEl(e.currentTarget)} sx={{ ml: { xs: 0.5, sm: 1 } }}>
            <Avatar sx={{ width: { xs: 30, sm: 34 }, height: { xs: 30, sm: 34 }, bgcolor: "secondary.main", fontSize: "0.9rem" }}>
              {user.name?.[0]?.toUpperCase() || "U"}
            </Avatar>
          </IconButton>
          <Menu anchorEl={anchorEl} open={!!anchorEl} onClose={() => setAnchorEl(null)}>
            <MenuItem disabled sx={{ opacity: "1 !important" }}>
              <Box>
                <Typography fontWeight={600} fontSize="0.85rem">{user.name}</Typography>
                <Typography fontSize="0.75rem" color="text.secondary">{user.email}</Typography>
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
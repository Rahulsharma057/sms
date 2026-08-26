"use client";
import { useState } from "react";
import {
  AppBar, Toolbar, Typography, IconButton, Drawer, List, ListItemButton,
  ListItemIcon, ListItemText, Box, Avatar, Menu, MenuItem, useMediaQuery,
} from "@mui/material";
import {
  Menu as MenuIcon, Dashboard, Assignment, People, ChecklistRtl, Logout,
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
        { label: "Reports", href: "/admin/reports", icon:  <ChecklistRtl /> },
    { label: "Teachers", href: "/admin/teachers", icon: <People /> },
    { label: "Tasks", href: "/admin/tasks", icon: <Assignment /> },
  ];
  const links = user.role === "superadmin" ? adminLinks : teacherLinks;

  const NavList = (
    <List sx={{ width: 250 }}>
      {links.map((l) => (
        <ListItemButton
          key={l.href}
          selected={pathname === l.href}
          onClick={() => {
            router.push(l.href);
            setDrawerOpen(false);
          }}
        >
          <ListItemIcon>{l.icon}</ListItemIcon>
          <ListItemText primary={l.label} />
        </ListItemButton>
      ))}
    </List>
  );

  return (
    <>
      <AppBar position="sticky" color="primary" elevation={2}>
        <Toolbar>
          {isMobile && (
            <IconButton color="inherit" edge="start" onClick={() => setDrawerOpen(true)} sx={{ mr: 1 }}>
              <MenuIcon />
            </IconButton>
          )}
          <Typography variant="h6" sx={{ flexGrow: 1, fontWeight: 700, fontSize: { xs: 16, sm: 20 } }}>
            {user.role === "superadmin" ? "SDC [ Super Admin ]" : "SDC Duty Officer Checklist"}
          </Typography>

          {!isMobile &&
            links.map((l) => (
              <Box
                key={l.href}
                onClick={() => router.push(l.href)}
                sx={{
                  cursor: "pointer",
                  px: 2,
                  py: 1,
                  mx: 0.5,
                  borderRadius: 2,
                  bgcolor: pathname === l.href ? "rgba(255,255,255,0.15)" : "transparent",
                  "&:hover": { bgcolor: "rgba(255,255,255,0.1)" },
                }}
              >
                {l.label}
              </Box>
            ))}

          <IconButton onClick={(e) => setAnchorEl(e.currentTarget)} sx={{ ml: 1 }}>
            <Avatar sx={{ width: 34, height: 34, bgcolor: "secondary.main" }}>
              {user.name?.[0]?.toUpperCase() || "U"}
            </Avatar>
          </IconButton>
          <Menu anchorEl={anchorEl} open={!!anchorEl} onClose={() => setAnchorEl(null)}>
            <MenuItem disabled>{user.name} ({user.email})</MenuItem>
            <MenuItem onClick={logout}>
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

"use client";
import { useEffect, useState } from "react";
import {
  Box,
  Container,
  Typography,
  Paper,
  Grid,
  Card,
  CardContent,
  Button,
  Chip,
  Table,
  TableHead,
  TableRow,
  TableCell,
  TableBody,
  TableContainer,
  Divider,
  Avatar,
  Stack,
  useMediaQuery,
  useTheme,
} from "@mui/material";
import {
  Add,
  Assignment,
  ChecklistRtl,
  TrendingUp,
  PendingActions,
  TaskAlt,
} from "@mui/icons-material";
import { useRouter } from "next/navigation";
import ProtectedRoute from "../../../components/ProtectedRoute";
import Navbar from "../../../components/Navbar";
import { useAuth } from "../../../context/AuthContext";
import api from "../../../lib/api";

// Sleepwell Foundation Theme
const sw = {
  blue: "#1E3A8A",
  blueLight: "#DBEAFE",
  red: "#B91C1C",
  redLight: "#FEE2E2",
  green: "#047857",
  greenLight: "#D1FAE5",
  bg: "#F1F5F9",
  surface: "#FFFFFF",
  text: "#0F172A",
  muted: "#64748B",
  border: "#CBD5E1",
};

// NEW: default label for the urgentMatters fixed field — must match backend DEFAULT_FIXED_FIELDS.
const FIXED_FIELD_DEFAULTS = {
  urgentMatters: "Urgent Matters",
};

function StatCard({ title, value, icon, color, lightColor }) {
  return (
    <Card
      elevation={0}
      sx={{
        bgcolor: sw.surface,
        border: `1.5px solid ${sw.border}`,
        borderRadius: 2,
        height: "100%",
        transition: "all 0.2s",
        "&:hover": {
          transform: "translateY(-2px)",
          borderColor: color,
          boxShadow: `0 4px 12px ${color}22`,
        },
      }}
    >
      <CardContent sx={{ p: 1.5, "&:last-child": { pb: 1.5 } }}>
        <Stack
          direction="column"
          alignItems="center"
          justifyContent="space-between"
          spacing={1}
        >
          <Typography
            fontSize="0.7rem"
            fontWeight={700}
            sx={{
              color: sw.muted,
              textTransform: "uppercase",
              letterSpacing: "0.06em",
              mb: 0.25,
            }}
          >
            {title}
          </Typography>

          <Box
            sx={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              gap: 1.5,
              m: 0,
            }}
          >
            <Typography
              fontWeight={800}
              fontSize="1.35rem"
              sx={{
                color: sw.text,
                lineHeight: 1.1,
              }}
            >
              {value}
            </Typography>
            <Avatar
              sx={{
                bgcolor: lightColor,
                color: color,
                width: 36,
                height: 36,
                flexShrink: 0,
              }}
            >
              {icon}
            </Avatar>
          </Box>
        </Stack>
      </CardContent>
    </Card>
  );
}

function TeacherDashboardInner() {
  const { user } = useAuth();
  const router = useRouter();
  const muiTheme = useTheme();
  const isMobile = useMediaQuery(muiTheme.breakpoints.down("sm"));
  const [reports, setReports] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [template, setTemplate] = useState(null); // NEW

  // NEW: resolve label + enabled state for the urgentMatters fixed field, falling back to defaults.
  const fixedFields = template?.fixedFields || {};
  const fieldLabel = (key) => fixedFields[key]?.label || FIXED_FIELD_DEFAULTS[key];
  const fieldEnabled = (key) => fixedFields[key]?.enabled !== false;

useEffect(() => {
  const loadDashboard = async () => {
    try {
      const [reportsRes, tasksRes, templateRes] = await Promise.all([
        api.get("/reports/mine"),
        api.get("/tasks/mine"),
        api.get("/reports/template"), // NEW
      ]);

      const reportsData = reportsRes?.data;
      const tasksData = tasksRes?.data;

      setReports(
        Array.isArray(reportsData)
          ? reportsData
          : Array.isArray(reportsData?.data)
            ? reportsData.data
            : Array.isArray(reportsData?.reports)
              ? reportsData.reports
              : Array.isArray(reportsData?.data?.reports)
                ? reportsData.data.reports
                : []
      );

      setTasks(
        Array.isArray(tasksData)
          ? tasksData
          : Array.isArray(tasksData?.data)
            ? tasksData.data
            : Array.isArray(tasksData?.tasks)
              ? tasksData.tasks
              : Array.isArray(tasksData?.data?.tasks)
                ? tasksData.data.tasks
                : []
      );

      setTemplate(templateRes?.data || null); // NEW
    } catch (error) {
      console.error("Teacher dashboard load error:", error);
      setReports([]);
      setTasks([]);
    }
  };

  loadDashboard();
}, []);

  const pendingTasks = tasks.filter((t) => t.status !== "completed").length;
  const completedTasks = tasks.filter((t) => t.status === "completed").length;

  return (
    <Box sx={{ bgcolor: sw.bg, minHeight: "100vh" }}>
      <Navbar />
      <Container maxWidth="lg" sx={{ py: { xs: 1.5, sm: 2 } }}>
        {/* Header */}
        <Paper
          elevation={0}
          sx={{
            p: { xs: 2, sm: 2.5 },
            mb: 1.5,
            borderRadius: 2,
            border: `1.5px solid ${sw.border}`,
            background: `linear-gradient(135deg, ${sw.surface} 0%, ${sw.blueLight} 100%)`,
          }}
        >
          <Stack
            direction={{ xs: "column", sm: "row" }}
            alignItems={{ sm: "center" }}
            justifyContent="space-between"
            spacing={1.5}
          >
            <Box>
              <Typography
                variant="h6"
                fontWeight={800}
                sx={{
                  color: sw.blue,
                  mb: 0.25,
                  fontSize: { xs: "1.1rem", sm: "1.25rem" },
                }}
              >
                Welcome, {user?.name}
              </Typography>
              <Typography
                fontSize={{ xs: "0.75rem", sm: "0.8rem" }}
                sx={{ color: sw.muted }}
              >
                Teacher Dashboard · Sleepwell Foundation
              </Typography>
            </Box>
            <Stack direction="row" spacing={1} flexWrap="wrap">
              <Button
                variant="contained"
                size="small"
                startIcon={<Add fontSize="small" />}
                onClick={() => router.push("/teacher/report/new")}
                sx={{
                  bgcolor: sw.blue,
                  textTransform: "none",
                  fontWeight: 700,
                  //  borderRadius: 1.5,
                  fontSize: "0.8rem",
                  boxShadow: "none",
                  px: 1.5,
                  "&:hover": { bgcolor: "#172554", boxShadow: "none" },
                }}
              >
                {isMobile
                  ? "Fill Today' s Checklist"
                  : "Fill Today' s Checklist"}
              </Button>
              <Button
                variant="contained"
                size="small"
                startIcon={<Assignment fontSize="small" />}
                onClick={() => router.push("/teacher/tasks")}
                sx={{
                  bgcolor: "#DC2626",
                  color: "#FFFFFF",
                  textTransform: "none",
                  fontWeight: 700,
                  fontSize: "0.8rem",
                  px: 1.5,
                  boxShadow: "none",

                  "&:hover": {
                    bgcolor: "#B91C1C",
                    boxShadow: "none",
                  },
                }}
              >
                {isMobile ? "Tasks" : "My Tasks"}
              </Button>
            </Stack>
          </Stack>
        </Paper>

        {/* Stats */}
        <Grid container spacing={1} sx={{ mb: 1.5 }}>
          <Grid item xs={4}>
            <StatCard
              title="Report Submissions"
              value={reports.length}
              icon={<TrendingUp sx={{ fontSize: 18 }} />}
              color={sw.blue}
              lightColor={sw.blueLight}
            />
          </Grid>
          <Grid item xs={4}>
            <StatCard
              title="Pending Tasks"
              value={pendingTasks}
              icon={<PendingActions sx={{ fontSize: 18 }} />}
              color={sw.red}
              lightColor={sw.redLight}
            />
          </Grid>
          <Grid item xs={4}>
            <StatCard
              title="Completed Tasks"
              value={completedTasks}
              icon={<TaskAlt sx={{ fontSize: 18 }} />}
              color={sw.green}
              lightColor={sw.greenLight}
            />
          </Grid>
        </Grid>

        {/* Table */}
        <Paper
          elevation={0}
          sx={{
            borderRadius: 2,
            border: `1.5px solid ${sw.border}`,
            overflow: "hidden",
            bgcolor: sw.surface,
          }}
        >
          <Box
            sx={{
              px: { xs: 1.5, sm: 2.5 },
              py: 1.5,
              display: "flex",
              alignItems: "center",
              gap: 1,
            }}
          >
            <Avatar sx={{ bgcolor: sw.blueLight, width: 28, height: 28 }}>
              <ChecklistRtl sx={{ color: sw.blue, fontSize: 16 }} />
            </Avatar>
            <Typography
              variant="subtitle2"
              fontWeight={800}
              sx={{ color: sw.text, fontSize: "0.85rem" }}
            >
              Recent Reports
            </Typography>
          </Box>
          <Divider sx={{ borderColor: sw.border }} />
          <TableContainer sx={{ overflowX: "auto" }}>
            <Table size="small">
              <TableHead>
                <TableRow sx={{ bgcolor: sw.bg }}>
                  <TableCell
                    sx={{
                      fontWeight: 800,
                      color: sw.muted,
                      fontSize: "0.7rem",
                      py: 1,
                      px: { xs: 1, sm: 2 },
                      borderBottom: `1.5px solid ${sw.border}`,
                    }}
                  >
                    DATE
                  </TableCell>
                  <TableCell
                    sx={{
                      fontWeight: 800,
                      color: sw.muted,
                      fontSize: "0.7rem",
                      py: 1,
                      px: { xs: 1, sm: 2 },
                      borderBottom: `1.5px solid ${sw.border}`,
                    }}
                  >
                    CENTRE
                  </TableCell>
                  {/* CHANGED: dynamic label + hide column if disabled */}
                  {fieldEnabled("urgentMatters") && (
                    <TableCell
                      sx={{
                        fontWeight: 800,
                        color: sw.muted,
                        fontSize: "0.7rem",
                        py: 1,
                        px: { xs: 1, sm: 2 },
                        borderBottom: `1.5px solid ${sw.border}`,
                      }}
                    >
                      {fieldLabel("urgentMatters").toUpperCase()}
                    </TableCell>
                  )}
                </TableRow>
              </TableHead>
              <TableBody>
                {reports.map((r) => (
                  <TableRow
                    key={r._id}
                    hover
                    sx={{
                      "&:hover": { bgcolor: sw.blueLight },
                      transition: "background 0.15s",
                    }}
                  >
                    <TableCell
                      sx={{
                        fontSize: "0.8rem",
                        color: sw.text,
                        py: 1,
                        px: { xs: 1, sm: 2 },
                        borderBottom: `1px solid ${sw.border}`,
                        fontWeight: 600,
                      }}
                    >
                      {r.date}
                    </TableCell>
                    <TableCell
                      sx={{
                        fontSize: "0.8rem",
                        color: sw.text,
                        py: 1,
                        px: { xs: 1, sm: 2 },
                        borderBottom: `1px solid ${sw.border}`,
                      }}
                    >
                      {r.centreBatch || "—"}
                    </TableCell>
                    {/* CHANGED: hide cell if urgentMatters disabled, to stay aligned with the header */}
                    {fieldEnabled("urgentMatters") && (
                      <TableCell
                        sx={{
                          py: 1,
                          px: { xs: 1, sm: 2 },
                          borderBottom: `1px solid ${sw.border}`,
                        }}
                      >
                        {r.urgentMatters ? (
                          <Chip
                            size="small"
                            label="YES"
                            sx={{
                              bgcolor: sw.redLight,
                              color: sw.red,
                              fontWeight: 800,
                              fontSize: "0.65rem",
                              borderRadius: 1,
                              height: 22,
                              minWidth: 50,
                            }}
                          />
                        ) : (
                          <Typography
                            fontSize="0.8rem"
                            sx={{ color: sw.muted, fontWeight: 500 }}
                          >
                            —
                          </Typography>
                        )}
                      </TableCell>
                    )}
                  </TableRow>
                ))}
                {reports.length === 0 && (
                  <TableRow>
                    <TableCell
                      colSpan={fieldEnabled("urgentMatters") ? 3 : 2}
                      align="center"
                      sx={{ py: 3, color: sw.muted }}
                    >
                      <Stack alignItems="center" spacing={0.5}>
                        <Assignment sx={{ color: sw.border, fontSize: 28 }} />
                        <Typography fontSize="0.8rem" fontWeight={500}>
                          No reports filed yet.
                        </Typography>
                      </Stack>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </TableContainer>
        </Paper>
      </Container>
    </Box>
  );
}

export default function TeacherDashboard() {
  return (
    <ProtectedRoute role="teacher">
      <TeacherDashboardInner />
    </ProtectedRoute>
  );
}
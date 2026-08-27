"use client";
import { useEffect, useState } from "react";
import {
  Box, Container, Typography, Paper, Grid, Card, CardContent, Button, Chip,
  Table, TableHead, TableRow, TableCell, TableBody, TableContainer,
} from "@mui/material";
import { Add, Assignment, ChecklistRtl } from "@mui/icons-material";
import { useRouter } from "next/navigation";
import ProtectedRoute from "../../../components/ProtectedRoute";
import Navbar from "../../../components/Navbar";
import { useAuth } from "../../../context/AuthContext";
import api from "../../../lib/api";

function TeacherDashboardInner() {
  const { user } = useAuth();
  const router = useRouter();
  const [reports, setReports] = useState([]);
  const [tasks, setTasks] = useState([]);

  useEffect(() => {
    api.get("/reports/mine").then((res) => setReports(res.data));
    api.get("/tasks/mine").then((res) => setTasks(res.data));
  }, []);

  const pendingTasks = tasks.filter((t) => t.status !== "completed").length;

  return (
    <Box>
      <Navbar />
      <Container maxWidth="lg" sx={{ py: 3 }}>
        <Typography variant="h5" fontWeight={700} gutterBottom>
          Welcome, {user?.name}
        </Typography>

       <Grid container spacing={1} sx={{ mb: 3 }}>
  <Grid item xs={4}>
    <Card sx={{ bgcolor: "primary.main", color: "white", height: "100%" }}>
      <CardContent sx={{ p: { xs: 1, sm: 2 }, "&:last-child": { pb: { xs: 1, sm: 2 } } }}>
        <Typography fontSize={{ xs: "0.62rem", sm: "0.875rem" }} sx={{ opacity: 0.9, lineHeight: 1.2 }}>
          Total Reports Filed
        </Typography>
        <Typography fontWeight={700} fontSize={{ xs: "1.15rem", sm: "2.125rem" }}>
          {reports.length}
        </Typography>
      </CardContent>
    </Card>
  </Grid>

  <Grid item xs={4}>
    <Card sx={{ bgcolor: "secondary.main", color: "white", height: "100%" }}>
      <CardContent sx={{ p: { xs: 1, sm: 2 }, "&:last-child": { pb: { xs: 1, sm: 2 } } }}>
        <Typography fontSize={{ xs: "0.62rem", sm: "0.875rem" }} sx={{ opacity: 0.9, lineHeight: 1.2 }}>
          Pending Tasks
        </Typography>
        <Typography fontWeight={700} fontSize={{ xs: "1.15rem", sm: "2.125rem" }}>
          {pendingTasks}
        </Typography>
      </CardContent>
    </Card>
  </Grid>

  <Grid item xs={4}>
    <Card sx={{ bgcolor: "#455a64", color: "white", height: "100%" }}>
      <CardContent sx={{ p: { xs: 1, sm: 2 }, "&:last-child": { pb: { xs: 1, sm: 2 } } }}>
        <Typography fontSize={{ xs: "0.62rem", sm: "0.875rem" }} sx={{ opacity: 0.9, lineHeight: 1.2 }}>
          Total Tasks Assigned
        </Typography>
        <Typography fontWeight={700} fontSize={{ xs: "1.15rem", sm: "2.125rem" }}>
          {tasks.length}
        </Typography>
      </CardContent>
    </Card>
  </Grid>
</Grid>
        <Box sx={{ display: "flex", gap: 2, mb: 3, flexWrap: "wrap" }}>
          <Button variant="contained" startIcon={<Add />} onClick={() => router.push("/teacher/report/new")}>
            Fill Today's Checklist
          </Button>
          <Button variant="outlined" startIcon={<Assignment />} onClick={() => router.push("/teacher/tasks")}>
            View My Tasks
          </Button>
        </Box>

        <Paper sx={{ p: 2 }}>
          <Typography variant="h6" fontWeight={700} sx={{ mb: 2, display: "flex", alignItems: "center", gap: 1 }}>
            <ChecklistRtl fontSize="small" /> My Recent Reports
          </Typography>
          <TableContainer sx={{ overflowX: "auto" }}>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Date</TableCell>
     {/*              <TableCell>Shift</TableCell> */}
                  <TableCell>Centre Name</TableCell>
                  <TableCell>Urgent Matters</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {reports.map((r) => (
                  <TableRow key={r._id} hover>
                    <TableCell>{r.date}</TableCell>
                   {/*  <TableCell>{r.shiftTiming || "-"}</TableCell> */}
                    <TableCell>{r.centreBatch || "-"}</TableCell>
                    <TableCell>
                      {r.urgentMatters ? <Chip size="small" color="warning" label="Yes" /> : "-"}
                    </TableCell>
                  </TableRow>
                ))}
                {reports.length === 0 && (
                  <TableRow><TableCell colSpan={4} align="center">No reports filed yet.</TableCell></TableRow>
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

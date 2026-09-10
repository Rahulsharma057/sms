"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Paper,
  Stack,
  Typography,
} from "@mui/material";
import {
  CalendarMonth,
  ReportProblemOutlined,
  Visibility,
} from "@mui/icons-material";
import Navbar from "../../../../components/Navbar";
import api from "../../../../lib/api";

export default function InspectionHistoryPage() {
  const router = useRouter();

  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    api
      .get("/inspection-reports/mine/history")
      .then((res) => setReports(res.data?.reports || []))
      .catch((err) =>
        setError(
          err?.response?.data?.message ||
            "Could not load your inspection history."
        )
      )
      .finally(() => setLoading(false));
  }, []);

  return (
    <Box sx={{ bgcolor: "#faf9fb", minHeight: "100vh" }}>
      <Navbar />

      <Box
        sx={{
          maxWidth: 760,
          mx: "auto",
          p: { xs: 1.5, sm: 3 },
        }}
      >
        <Stack spacing={2}>
          {/* Header */}
          <Paper
            elevation={0}
            sx={{
              p: { xs: 2, sm: 2.6 },
              border: "1px solid #e2e8f0",
              borderRadius: 3,
              background: "#fff",
            }}
          >
            <Stack direction="row" spacing={1} alignItems="center">
              <ReportProblemOutlined sx={{ color: "#7e22ce" }} />

              <Box>
                <Typography fontWeight={800} fontSize="1.2rem">
                  My Inspection Reports
                </Typography>

                <Typography
                  variant="body2"
                  color="text.secondary"
                  sx={{ mt: 0.2 }}
                >
                  View your previously submitted inspection reports.
                </Typography>
              </Box>
            </Stack>
          </Paper>

          {error && (
            <Alert severity="error" onClose={() => setError("")}>
              {error}
            </Alert>
          )}

          {/* Loading */}
          {loading ? (
            <Box
              sx={{
                display: "flex",
                justifyContent: "center",
                py: 6,
              }}
            >
              <CircularProgress />
            </Box>
          ) : reports.length === 0 ? (
            <Paper
              elevation={0}
              sx={{
                p: 5,
                textAlign: "center",
                border: "1px dashed #cbd5e1",
                borderRadius: 3,
                background: "#fff",
              }}
            >
              <Typography color="text.secondary">
                No submitted inspection reports yet.
              </Typography>
            </Paper>
          ) : (
            <Stack spacing={1.2}>
              {reports.map((r) => (
                <Paper
                  key={r._id}
                  elevation={0}
                  sx={{
                    p: 1.8,
                    border: "1px solid #e2e8f0",
                    borderRadius: 2.5,
                    background: "#fff",
                    transition: "0.2s",
                    "&:hover": {
                      borderColor: "#c4b5fd",
                      boxShadow: "0 4px 14px rgba(0,0,0,0.04)",
                    },
                  }}
                >
                  <Stack
                    direction={{ xs: "column", sm: "row" }}
                    justifyContent="space-between"
                    alignItems={{ xs: "stretch", sm: "center" }}
                    gap={1.2}
                  >
                    {/* Left */}
                    <Box>
                      <Stack
                        direction="row"
                        spacing={1}
                        alignItems="center"
                      >
                        <CalendarMonth
                          fontSize="small"
                          sx={{ color: "text.secondary" }}
                        />

                        <Typography fontWeight={700}>
                          {new Date(r.submittedAt).toLocaleDateString(
                            "en-IN",
                            {
                              day: "2-digit",
                              month: "short",
                              year: "numeric",
                            }
                          )}
                        </Typography>
                      </Stack>

                      <Stack
                        direction="row"
                        spacing={0.8}
                        sx={{ mt: 0.8 }}
                        flexWrap="wrap"
                        useFlexGap
                      >
                        <Chip
                          size="small"
                          label={`${r.issues?.length || 0} issue(s)`}
                        />

                        <Chip
                          size="small"
                          label="Submitted"
                          color="success"
                          variant="outlined"
                        />
                      </Stack>
                    </Box>

                    {/* View */}
                    <Button
                      size="small"
                      variant="outlined"
                      startIcon={<Visibility />}
                      onClick={() =>
                        router.push(
                          `/teacher/inspection/history/${r._id}`
                        )
                      }
                      sx={{
                        textTransform: "none",
                        fontWeight: 700,
                        borderRadius: 1.5,
                        alignSelf: {
                          xs: "flex-start",
                          sm: "center",
                        },
                      }}
                    >
                      View
                    </Button>
                  </Stack>
                </Paper>
              ))}
            </Stack>
          )}
        </Stack>
      </Box>
    </Box>
  );
}
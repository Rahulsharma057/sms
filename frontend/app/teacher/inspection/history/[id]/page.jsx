"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  Alert,
  Avatar,
  Box,
  Button,
  Chip,
  CircularProgress,
  Divider,
  Paper,
  Stack,
  Typography,
} from "@mui/material";
import {
  ArrowBack,
  CalendarMonth,
  CheckCircle,
  PlayArrow,
  ReportProblemOutlined,
} from "@mui/icons-material";

import Navbar from "../../../../../components/Navbar";
import api from "../../../../../lib/api";

export default function InspectionHistoryDetailPage() {
  const params = useParams();
  const router = useRouter();

  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!params?.id) return;

    api
      .get(`/inspection-reports/${params.id}`)
      .then((res) => {
        setReport(res.data);
      })
      .catch((err) => {
        setError(
          err?.response?.data?.message ||
            "Could not load inspection report."
        );
      })
      .finally(() => setLoading(false));
  }, [params?.id]);

  if (loading) {
    return (
      <Box sx={{ bgcolor: "#faf9fb", minHeight: "100vh" }}>
        <Navbar />

        <Box
          sx={{
            display: "flex",
            justifyContent: "center",
            py: 8,
          }}
        >
          <CircularProgress />
        </Box>
      </Box>
    );
  }

  return (
    <Box sx={{ bgcolor: "#faf9fb", minHeight: "100vh" }}>
      <Navbar />

      <Box
        sx={{
          maxWidth: 760,
          mx: "auto",
          p: { xs: 1.5, sm: 3 },
          pb: 5,
        }}
      >
        <Stack spacing={2}>
          {/* Back */}
          <Button
            startIcon={<ArrowBack />}
            onClick={() =>
              router.push("/teacher/inspection/history")
            }
            sx={{
              alignSelf: "flex-start",
              textTransform: "none",
              color: "#475569",
            }}
          >
            Back to History
          </Button>

          {error && <Alert severity="error">{error}</Alert>}

          {report && (
            <>
              {/* Header */}
              <Paper
                elevation={0}
                sx={{
                  border: "1px solid #e2e8f0",
                  borderRadius: 2.5,
                  overflow: "hidden",
                }}
              >
                <Box
                  sx={{
                    p: 2.5,
                    background:
                      "linear-gradient(135deg,#7e22ce,#4c1d95)",
                    color: "white",
                  }}
                >
                  <Stack
                    direction="row"
                    spacing={1.3}
                    alignItems="center"
                  >
                    <ReportProblemOutlined />

                    <Box sx={{ flex: 1 }}>
                      <Typography
                        fontWeight={800}
                        fontSize="1.15rem"
                      >
                        Inspection Report
                      </Typography>

                      <Typography
                        variant="body2"
                        sx={{ opacity: 0.9 }}
                      >
                        Submitted inspection report
                      </Typography>
                    </Box>

                    <Chip
                      size="small"
                      label="Submitted"
                      sx={{
                        color: "white",
                        borderColor: "rgba(255,255,255,0.5)",
                      }}
                      variant="outlined"
                    />
                  </Stack>
                </Box>

                <Box sx={{ p: 2 }}>
                  <Stack
                    direction="row"
                    spacing={1}
                    alignItems="center"
                  >
                    <CalendarMonth
                      fontSize="small"
                      sx={{ color: "text.secondary" }}
                    />

                    <Typography variant="body2">
                      {report.submittedAt
                        ? new Date(
                            report.submittedAt
                          ).toLocaleString("en-IN", {
                            day: "2-digit",
                            month: "short",
                            year: "numeric",
                            hour: "2-digit",
                            minute: "2-digit",
                          })
                        : "-"}
                    </Typography>
                  </Stack>
                </Box>
              </Paper>

              {/* Issues */}
              <Paper
                elevation={0}
                sx={{
                  p: { xs: 1.5, sm: 2.3 },
                  border: "1px solid #e2e8f0",
                  borderRadius: 2.5,
                }}
              >
                <Typography fontWeight={800} mb={1.8}>
                  Issues ({report.issues?.length || 0})
                </Typography>

                <Stack
                  spacing={2}
                  divider={<Divider />}
                >
                  {(report.issues || []).map((issue) => (
                    <Box key={issue._id}>
                      {/* Issue top */}
                      <Stack
                        direction="row"
                        spacing={1.5}
                        alignItems="flex-start"
                      >
                        {issue.photo?.url && (
                          <Avatar
                            src={issue.photo.url}
                            variant="rounded"
                            sx={{
                              width: 72,
                              height: 72,
                              flexShrink: 0,
                            }}
                          />
                        )}

                        <Box sx={{ flex: 1, minWidth: 0 }}>
                          <Typography
                            fontWeight={800}
                            fontSize="0.95rem"
                          >
                            {issue.problemName}
                          </Typography>

                          <Stack
                            direction="row"
                            spacing={0.6}
                            flexWrap="wrap"
                            useFlexGap
                            sx={{ mt: 0.7 }}
                          >
                            {issue.location && (
                              <Chip
                                size="small"
                                label={issue.location}
                              />
                            )}

                            {issue.direction && (
                              <Chip
                                size="small"
                                label={issue.direction}
                              />
                            )}

                            {issue.brokenSince && (
                              <Chip
                                size="small"
                                label={`Since: ${issue.brokenSince}`}
                                color="warning"
                                variant="outlined"
                              />
                            )}

                            <Chip
                              size="small"
                              label={
                                issue.status === "resolved"
                                  ? "Resolved"
                                  : "Open"
                              }
                              color={
                                issue.status === "resolved"
                                  ? "success"
                                  : "error"
                              }
                              variant="outlined"
                            />
                          </Stack>
                        </Box>
                      </Stack>

                      {/* Description */}
                      {issue.description && (
                        <Box
                          sx={{
                            mt: 1.2,
                            p: 1.2,
                            borderRadius: 1.5,
                            bgcolor: "#f8fafc",
                          }}
                        >
                          <Typography
                            variant="caption"
                            fontWeight={700}
                            color="text.secondary"
                          >
                            DESCRIPTION
                          </Typography>

                          <Typography
                            variant="body2"
                            sx={{ mt: 0.3 }}
                          >
                            {issue.description}
                          </Typography>
                        </Box>
                      )}

                      {/* Voice */}
                      {issue.voiceNote?.url && (
                        <Box sx={{ mt: 1.2 }}>
                          <Typography
                            variant="caption"
                            fontWeight={700}
                            color="text.secondary"
                            sx={{
                              display: "block",
                              mb: 0.5,
                            }}
                          >
                            VOICE NOTE
                          </Typography>

                          <Stack
                            direction="row"
                            spacing={1}
                            alignItems="center"
                          >
                            <PlayArrow fontSize="small" />

                            <audio
                              controls
                              src={issue.voiceNote.url}
                              style={{
                                width: "100%",
                                maxWidth: 420,
                                height: 38,
                              }}
                            />
                          </Stack>
                        </Box>
                      )}

                      {/* Admin remark */}
                      {issue.adminRemark && (
                        <Box
                          sx={{
                            mt: 1.2,
                            p: 1.2,
                            borderRadius: 1.5,
                            bgcolor: "#f0fdf4",
                            border:
                              "1px solid #bbf7d0",
                          }}
                        >
                          <Typography
                            variant="caption"
                            fontWeight={700}
                            color="success.dark"
                          >
                            ADMIN REMARK
                          </Typography>

                          <Typography
                            variant="body2"
                            sx={{ mt: 0.3 }}
                          >
                            {issue.adminRemark}
                          </Typography>
                        </Box>
                      )}

                      {/* Resolved info */}
                      {issue.status === "resolved" &&
                        issue.resolvedAt && (
                          <Stack
                            direction="row"
                            spacing={0.6}
                            alignItems="center"
                            sx={{ mt: 1 }}
                          >
                            <CheckCircle
                              sx={{
                                fontSize: 17,
                                color: "success.main",
                              }}
                            />

                            <Typography
                              variant="caption"
                              color="text.secondary"
                            >
                              Resolved on{" "}
                              {new Date(
                                issue.resolvedAt
                              ).toLocaleDateString(
                                "en-IN",
                                {
                                  day: "2-digit",
                                  month: "short",
                                  year: "numeric",
                                }
                              )}
                            </Typography>
                          </Stack>
                        )}
                    </Box>
                  ))}
                </Stack>
              </Paper>
            </>
          )}
        </Stack>
      </Box>
    </Box>
  );
}
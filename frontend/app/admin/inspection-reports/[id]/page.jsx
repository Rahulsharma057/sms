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
  Container,
  Dialog,
  DialogContent,
  IconButton,
  Paper,
  Stack,
  TextField,
  Typography,
} from "@mui/material";

import {
  ArrowBack,
  CheckCircle,
  Close,
  ReportProblemOutlined,
} from "@mui/icons-material";

import ProtectedRoute from "../../../../components/ProtectedRoute";
import Navbar from "../../../../components/Navbar";
import api from "../../../../lib/api";

/* =========================================================
   ISSUE CARD
========================================================= */

function IssueCard({ issue, onResolve, resolving }) {
  const [remark, setRemark] = useState(issue.adminRemark || "");
  const [imageOpen, setImageOpen] = useState(false);

  return (
    <>
      <Paper
        elevation={0}
        sx={{
          p: { xs: 1.25, sm: 1.8 },
          border: "1px solid #e2e8f0",
          borderRadius: 2.5,
          backgroundColor: "#fff",
        }}
      >
        <Stack
          direction={{ xs: "column", sm: "row" }}
          spacing={{ xs: 1.2, sm: 1.5 }}
        >
          {/* =================================================
              ISSUE PHOTO
          ================================================= */}
          {issue.photo?.url && (
            <Box
              onClick={() => setImageOpen(true)}
              sx={{
                width: { xs: "100%", sm: 96 },
                height: { xs: 190, sm: 96 },

                flexShrink: 0,

                borderRadius: 2,
                overflow: "hidden",

                cursor: "pointer",

                position: "relative",

                backgroundColor: "#f1f5f9",

                "&:hover img": {
                  transform: "scale(1.05)",
                },

                "&:hover .image-overlay": {
                  opacity: 1,
                },
              }}
            >
              <Box
                component="img"
                src={issue.photo.url}
                alt={issue.problemName || "Issue photo"}
                sx={{
                  width: "100%",
                  height: "100%",
                  objectFit: "cover",
                  display: "block",

                  transition:
                    "transform 0.25s ease",
                }}
              />

              {/* Hover Overlay */}
              <Box
                className="image-overlay"
                sx={{
                  position: "absolute",
                  inset: 0,

                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",

                  backgroundColor:
                    "rgba(0,0,0,0.35)",

                  opacity: 0,

                  transition:
                    "opacity 0.2s ease",

                  color: "#fff",

                  fontSize: 13,
                  fontWeight: 700,

                  pointerEvents: "none",
                }}
              >
                Click to enlarge
              </Box>
            </Box>
          )}

          {/* =================================================
              ISSUE CONTENT
          ================================================= */}
          <Box
            sx={{
              flex: 1,
              minWidth: 0,
            }}
          >
            {/* Header */}
            <Stack
              direction="row"
              justifyContent="space-between"
              alignItems="flex-start"
              gap={1}
            >
              <Typography
                fontWeight={800}
                sx={{
                  fontSize: {
                    xs: 14,
                    sm: 15,
                  },
                  lineHeight: 1.35,
                }}
              >
                {issue.problemName}
              </Typography>

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
                    : "warning"
                }
                sx={{
                  height: 24,
                  fontSize: 11,
                  flexShrink: 0,
                }}
              />
            </Stack>

            {/* Location / Direction / Since */}
            <Stack
              direction="row"
              spacing={0.6}
              flexWrap="wrap"
              useFlexGap
              sx={{
                mt: 0.6,
              }}
            >
              {issue.location && (
                <Chip
                  size="small"
                  label={`Location: ${issue.location}`}
                  sx={{
                    height: 24,
                    fontSize: 11,
                  }}
                />
              )}

              {issue.direction && (
                <Chip
                  size="small"
                  label={`Direction: ${issue.direction}`}
                  sx={{
                    height: 24,
                    fontSize: 11,
                  }}
                />
              )}

              {issue.brokenSince && (
                <Chip
                  size="small"
                  label={`Since: ${issue.brokenSince}`}
                  color="warning"
                  variant="outlined"
                  sx={{
                    height: 24,
                    fontSize: 11,
                  }}
                />
              )}
            </Stack>

            {/* Description */}
            {issue.description && (
              <Typography
                variant="body2"
                color="text.secondary"
                sx={{
                  mt: 0.8,
                  fontSize: 13,
                  lineHeight: 1.5,
                }}
              >
                {issue.description}
              </Typography>
            )}

            {/* Voice Note */}
            {issue.voiceNote?.url && (
              <Box sx={{ mt: 1 }}>
                <audio
                  controls
                  src={issue.voiceNote.url}
                  style={{
                    height: 32,
                    width: "100%",
                    maxWidth: 320,
                  }}
                />
              </Box>
            )}

            {/* Remark + Resolve */}
            <Stack
              direction={{
                xs: "column",
                sm: "row",
              }}
              spacing={1}
              sx={{
                mt: 1.2,
              }}
              alignItems={{
                sm: "center",
              }}
            >
              <TextField
                size="small"
                fullWidth
                placeholder="Admin remark (optional)"
                value={remark}
                onChange={(e) =>
                  setRemark(e.target.value)
                }
                sx={{
                  "& .MuiOutlinedInput-root": {
                    borderRadius: 1.5,
                    fontSize: 13,
                  },
                }}
              />

              <Button
                size="small"
                variant={
                  issue.status === "resolved"
                    ? "outlined"
                    : "contained"
                }
                onClick={() =>
                  onResolve(
                    issue._id,
                    issue.status === "resolved"
                      ? "open"
                      : "resolved",
                    remark
                  )
                }
                disabled={
                  resolving === issue._id
                }
                startIcon={
                  resolving === issue._id ? (
                    <CircularProgress
                      size={14}
                      color="inherit"
                    />
                  ) : (
                    <CheckCircle fontSize="small" />
                  )
                }
                sx={{
                  textTransform: "none",
                  flexShrink: 0,
                  minWidth: {
                    sm: 125,
                  },
                  borderRadius: 1.5,
                  fontWeight: 700,
                }}
              >
                {issue.status === "resolved"
                  ? "Mark Open"
                  : "Mark Resolved"}
              </Button>
            </Stack>
          </Box>
        </Stack>
      </Paper>

      {/* =====================================================
          LARGE IMAGE PREVIEW
      ===================================================== */}
      <Dialog
        open={imageOpen}
        onClose={() => setImageOpen(false)}
        maxWidth="lg"
        fullWidth
        PaperProps={{
          sx: {
            backgroundColor: "rgba(10, 15, 25, 0.96)",
            boxShadow:
              "0 25px 80px rgba(0,0,0,0.5)",
            borderRadius: {
              xs: 0,
              sm: 2,
            },
            overflow: "hidden",
            m: {
              xs: 0,
              sm: 2,
            },
          },
        }}
      >
        {/* Close Button */}
        <IconButton
          onClick={() => setImageOpen(false)}
          sx={{
            position: "absolute",
            top: 10,
            right: 10,
            zIndex: 5,

            width: 38,
            height: 38,

            color: "#fff",
            backgroundColor:
              "rgba(0,0,0,0.55)",

            "&:hover": {
              backgroundColor:
                "rgba(0,0,0,0.75)",
            },
          }}
        >
          <Close />
        </IconButton>

        <DialogContent
          sx={{
            p: {
              xs: 1,
              sm: 2,
            },

            display: "flex",
            alignItems: "center",
            justifyContent: "center",

            minHeight: {
              xs: "100vh",
              sm: "70vh",
            },
          }}
        >
          <Box
            component="img"
            src={issue.photo?.url}
            alt={
              issue.problemName ||
              "Inspection issue"
            }
            sx={{
              display: "block",

              width: "auto",
              height: "auto",

              maxWidth: "100%",
              maxHeight: {
                xs: "92vh",
                sm: "80vh",
              },

              objectFit: "contain",

              borderRadius: {
                xs: 0,
                sm: 1.5,
              },
            }}
          />
        </DialogContent>
      </Dialog>
    </>
  );
}

/* =========================================================
   DETAIL PAGE
========================================================= */

function AdminInspectionReportDetailInner() {
  const { id } = useParams();
  const router = useRouter();

  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [resolving, setResolving] = useState(null);

  const load = () => {
    setLoading(true);

    api
      .get(`/inspection-reports/${id}`)
      .then((res) => setReport(res.data))
      .catch((err) =>
        setError(
          err?.response?.data?.message ||
            "Could not load this report."
        )
      )
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    if (id) load();
  }, [id]);

  const handleResolve = async (
    issueId,
    status,
    adminRemark
  ) => {
    setResolving(issueId);

    try {
      const res = await api.patch(
        `/inspection-reports/${id}/issues/${issueId}/status`,
        {
          status,
          adminRemark,
        }
      );

      setReport(res.data);
    } catch (err) {
      setError(
        err?.response?.data?.message ||
          "Could not update this issue."
      );
    } finally {
      setResolving(null);
    }
  };

  if (loading) {
    return (
      <Box>
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
    <Box
      sx={{
        bgcolor: "#faf9fb",
        minHeight: "100vh",
      }}
    >
      <Navbar />

      <Container
        maxWidth="md"
        sx={{
          py: {
            xs: 2,
            sm: 3,
          },
          px: {
            xs: 1.5,
            sm: 2,
          },
        }}
      >
        {/* =================================================
            PAGE HEADER
        ================================================= */}
        <Stack
          direction="row"
          spacing={1}
          alignItems="center"
          sx={{
            mb: {
              xs: 1.75,
              sm: 2.5,
            },
          }}
        >
          <IconButton
            size="small"
            onClick={() =>
              router.push(
                "/admin/inspection-reports"
              )
            }
          >
            <ArrowBack />
          </IconButton>

          <Box
            sx={{
              width: {
                xs: 36,
                sm: 40,
              },
              height: {
                xs: 36,
                sm: 40,
              },

              borderRadius: 1.75,

              bgcolor: "#1c28ce",

              display: "flex",
              alignItems: "center",
              justifyContent: "center",

              flexShrink: 0,
            }}
          >
            <ReportProblemOutlined
              sx={{
                color: "white",
                fontSize: {
                  xs: 20,
                  sm: 22,
                },
              }}
            />
          </Box>

          <Box sx={{ minWidth: 0 }}>
            <Typography
              sx={{
                fontSize: {
                  xs: 17,
                  sm: 20,
                },
                fontWeight: 800,
                lineHeight: 1.25,

                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {report?.reportedBy?.name}'s Inspection
            </Typography>

            <Typography
              sx={{
                fontSize: {
                  xs: 11,
                  sm: 12,
                },
                color: "text.secondary",
                mt: 0.2,
              }}
            >
              {report?.submittedAt &&
                new Date(
                  report.submittedAt
                ).toLocaleString("en-IN")}
            </Typography>
          </Box>
        </Stack>

        {/* Error */}
        {error && (
          <Alert
            severity="error"
            sx={{
              mb: 2,
              borderRadius: 1.5,
            }}
          >
            {error}
          </Alert>
        )}

        {/* Issues */}
        <Stack spacing={1.5}>
          {(report?.issues || []).map(
            (issue) => (
              <IssueCard
                key={issue._id}
                issue={issue}
                onResolve={handleResolve}
                resolving={resolving}
              />
            )
          )}
        </Stack>
      </Container>
    </Box>
  );
}

/* =========================================================
   PROTECTED PAGE
========================================================= */

export default function AdminInspectionReportDetailPage() {
  return (
    <ProtectedRoute role="superadmin">
      <AdminInspectionReportDetailInner />
    </ProtectedRoute>
  );
}
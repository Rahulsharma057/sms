"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import {
  Alert,
  Avatar,
  Box,
  Button,
  Chip,
  CircularProgress,
  Dialog,
  DialogContent,
  Divider,
  IconButton,
  Paper,
  Stack,
  TextField,
  Tooltip,
  Typography,
} from "@mui/material";

import {
  AddAPhoto,
  CheckCircle,
  Close,
  Delete,
  OpenInNew,
  PlayArrow,
  ReportProblemOutlined,
  Send,
  Visibility,
} from "@mui/icons-material";

import api from "../../../lib/api";
import Navbar from "../../../components/Navbar";
import VoiceTextField from "../../../components/VoiceTextField";
import VoiceNoteRecorder from "../../../components/VoiceNoteRecorder";

const EMPTY_ISSUE_FORM = {
  problemName: "",
  location: "",
  direction: "",
  brokenSince: "",
  description: "",
};

export default function InspectionReportPage() {
  const router = useRouter();

  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  const [form, setForm] = useState(EMPTY_ISSUE_FORM);

  const [photoFile, setPhotoFile] = useState(null);
  const [photoPreview, setPhotoPreview] = useState(null);

  const [voiceBlob, setVoiceBlob] = useState(null);
  const [voiceDuration, setVoiceDuration] = useState(0);

  const [adding, setAdding] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [deletingId, setDeletingId] = useState(null);

  // Image viewer
  const [viewImage, setViewImage] = useState(null);

  const fileInputRef = useRef(null);

  /* =====================================================
     LOAD CURRENT DRAFT
  ===================================================== */

  const loadDraft = async () => {
    try {
      setLoading(true);
      setError("");

      // Clear old report before loading fresh draft
      setReport(null);

      const res = await api.get("/inspection-reports/mine/draft");

      setReport(res.data || null);
    } catch (err) {
      setError(
        err?.response?.data?.message ||
          "Could not load your inspection report."
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDraft();
  }, []);

  /* =====================================================
     FORM
  ===================================================== */

  const updateField = (key) => (value) => {
    setForm((prev) => ({
      ...prev,
      [key]: value,
    }));
  };

  const handlePhotoSelected = (file) => {
    if (!file) return;

    // Release previous preview URL
    if (photoPreview) {
      URL.revokeObjectURL(photoPreview);
    }

    setPhotoFile(file);
    setPhotoPreview(URL.createObjectURL(file));
  };

  const removeSelectedPhoto = () => {
    if (photoPreview) {
      URL.revokeObjectURL(photoPreview);
    }

    setPhotoFile(null);
    setPhotoPreview(null);

    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const resetIssueForm = () => {
    if (photoPreview) {
      URL.revokeObjectURL(photoPreview);
    }

    setForm({ ...EMPTY_ISSUE_FORM });
    setPhotoFile(null);
    setPhotoPreview(null);
    setVoiceBlob(null);
    setVoiceDuration(0);

    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  /* =====================================================
     ADD ISSUE
  ===================================================== */

  const handleAddIssue = async () => {
    setError("");

    if (!form.problemName.trim()) {
      setError("Problem name is required.");
      return;
    }

    setAdding(true);

    try {
      const formData = new FormData();

      formData.append("problemName", form.problemName.trim());
      formData.append("location", form.location.trim());
      formData.append("direction", form.direction.trim());
      formData.append("brokenSince", form.brokenSince.trim());
      formData.append("description", form.description.trim());

      if (photoFile) {
        formData.append("photo", photoFile);
      }

      if (voiceBlob) {
        formData.append(
          "voiceNote",
          voiceBlob,
          "voice-note.webm"
        );

        formData.append(
          "voiceNoteDuration",
          String(voiceDuration)
        );
      }

      if (report?._id) {
        formData.append("reportId", report._id);
      }

      const res = await api.post(
        "/inspection-reports/issues",
        formData,
        {
          headers: {
            "Content-Type": "multipart/form-data",
          },
        }
      );

      setReport(res.data);

      // Clear fields after successfully adding issue
      resetIssueForm();
    } catch (err) {
      setError(
        err?.response?.data?.message ||
          "Could not add this issue."
      );
    } finally {
      setAdding(false);
    }
  };

  /* =====================================================
     DELETE ISSUE
  ===================================================== */

  const handleDeleteIssue = async (issueId) => {
    if (!report?._id) return;

    const confirmed = window.confirm(
      "Remove this issue from the report?"
    );

    if (!confirmed) return;

    setDeletingId(issueId);
    setError("");

    try {
      const res = await api.delete(
        `/inspection-reports/${report._id}/issues/${issueId}`
      );

      setReport(res.data);
    } catch (err) {
      setError(
        err?.response?.data?.message ||
          "Could not remove this issue."
      );
    } finally {
      setDeletingId(null);
    }
  };

  /* =====================================================
     SUBMIT REPORT
  ===================================================== */

  const handleSubmitReport = async () => {
    if (!report?._id) return;

    if (!report.issues?.length) {
      setError(
        "Add at least one issue before submitting."
      );
      return;
    }

    const confirmed = window.confirm(
      `Submit this report with ${report.issues.length} issue(s)? You won't be able to edit it after submitting.`
    );

    if (!confirmed) return;

    setSubmitting(true);
    setError("");

    try {
      await api.post(
        `/inspection-reports/${report._id}/submit`
      );

      /*
       * IMPORTANT:
       * Clear old report + form immediately after successful submit.
       * This prevents old values from appearing when starting
       * another inspection.
       */
      setReport(null);
      resetIssueForm();

      setSuccess(true);
    } catch (err) {
      setError(
        err?.response?.data?.message ||
          "Could not submit the report."
      );
    } finally {
      setSubmitting(false);
    }
  };

  /* =====================================================
     START NEW INSPECTION
  ===================================================== */

  const startNew = async () => {
    setSuccess(false);
    setError("");

    // Completely clear previous state
    setReport(null);
    resetIssueForm();

    /*
     * Ask backend whether another draft exists.
     * If there is no draft, form remains completely empty.
     */
    await loadDraft();
  };

  /* =====================================================
     IMAGE VIEW
  ===================================================== */

  const openImage = (url) => {
    if (!url) return;
    setViewImage(url);
  };

  const closeImage = () => {
    setViewImage(null);
  };

  /* =====================================================
     LOADING
  ===================================================== */

  if (loading) {
    return (
      <Box
        sx={{
          bgcolor: "#faf9fb",
          minHeight: "100vh",
        }}
      >
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

  /* =====================================================
     SUCCESS SCREEN
  ===================================================== */

  if (success) {
    return (
      <Box
        sx={{
          bgcolor: "#faf9fb",
          minHeight: "100vh",
        }}
      >
        <Navbar />

        <Box
          sx={{
            maxWidth: 560,
            mx: "auto",
            p: { xs: 1.5, sm: 3 },
          }}
        >
          <Paper
            elevation={0}
            sx={{
              p: { xs: 2.5, sm: 3 },
              textAlign: "center",
              border: "1px solid #e2e8f0",
              borderRadius: 3,
              bgcolor: "#fff",
            }}
          >
            <CheckCircle
              sx={{
                fontSize: 50,
                color: "#7e22ce",
                mb: 1,
              }}
            />

            <Typography
              fontWeight={800}
              mb={0.6}
            >
              Inspection report submitted
            </Typography>

            <Typography
              variant="body2"
              color="text.secondary"
              mb={2.5}
            >
              It has been sent to the Super Admin.
            </Typography>

            <Stack
              direction={{ xs: "column", sm: "row" }}
              spacing={1}
              justifyContent="center"
            >
              <Button
                variant="outlined"
                onClick={() =>
                  router.push(
                    "/teacher/inspection/history"
                  )
                }
                sx={{
                  textTransform: "none",
                  fontWeight: 700,
                }}
              >
                View History
              </Button>

              <Button
                variant="contained"
                onClick={startNew}
                sx={{
                  textTransform: "none",
                  fontWeight: 700,
                }}
              >
                Start New Inspection
              </Button>
            </Stack>
          </Paper>
        </Box>
      </Box>
    );
  }

  /* =====================================================
     MAIN PAGE
  ===================================================== */

  return (
    <Box
      sx={{
        bgcolor: "#faf9fb",
        minHeight: "100vh",
      }}
    >
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
          {/* =================================================
              HEADER
          ================================================= */}

          <Paper
            elevation={0}
            sx={{
              border: "1px solid #e5e7eb",
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
                spacing={1.4}
                alignItems="center"
              >
                <ReportProblemOutlined />

                <Box>
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
                    Add issues as you find them — this saves
                    as a draft until you submit.
                  </Typography>
                </Box>
              </Stack>
            </Box>
          </Paper>

          {/* Error */}
          {error && (
            <Alert
              severity="error"
              onClose={() => setError("")}
            >
              {error}
            </Alert>
          )}

          {/* =================================================
              ADD ISSUE
          ================================================= */}

          <Paper
            elevation={0}
            sx={{
              p: { xs: 1.5, sm: 2.3 },
              border: "1px solid #e2e8f0",
              borderRadius: 2.5,
              bgcolor: "#fff",
            }}
          >
            <Typography
              fontWeight={700}
              mb={1.5}
            >
              Add an Issue
            </Typography>

            <Stack spacing={1.5}>
              {/* Photo */}
              <Box>
                {photoPreview ? (
                  <Stack
                    direction="row"
                    spacing={1.5}
                    alignItems="center"
                  >
                    <Box
                      sx={{
                        position: "relative",
                        cursor: "pointer",
                      }}
                      onClick={() =>
                        openImage(photoPreview)
                      }
                    >
                      <Avatar
                        src={photoPreview}
                        variant="rounded"
                        sx={{
                          width: 70,
                          height: 70,
                        }}
                      />

                      <Box
                        sx={{
                          position: "absolute",
                          inset: 0,
                          borderRadius: 1,
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          bgcolor:
                            "rgba(0,0,0,0.35)",
                          opacity: 0,
                          transition: "0.2s",
                          "&:hover": {
                            opacity: 1,
                          },
                        }}
                      >
                        <Visibility
                          sx={{ color: "white" }}
                        />
                      </Box>
                    </Box>

                    <Stack
                      direction="row"
                      spacing={0.5}
                    >
                      <Button
                        size="small"
                        variant="outlined"
                        startIcon={<Visibility />}
                        onClick={() =>
                          openImage(photoPreview)
                        }
                        sx={{
                          textTransform: "none",
                        }}
                      >
                        View
                      </Button>

                      <Button
                        size="small"
                        color="error"
                        onClick={removeSelectedPhoto}
                        sx={{
                          textTransform: "none",
                        }}
                      >
                        Remove
                      </Button>
                    </Stack>
                  </Stack>
                ) : (
                  <Button
                    variant="outlined"
                    component="label"
                    startIcon={<AddAPhoto />}
                    sx={{
                      textTransform: "none",
                    }}
                  >
                    Take / Choose Photo

                    <input
                      ref={fileInputRef}
                      type="file"
                      hidden
                      accept="image/*"
                      capture="environment"
                      onChange={(e) =>
                        handlePhotoSelected(
                          e.target.files?.[0]
                        )
                      }
                    />
                  </Button>
                )}
              </Box>

              {/* Problem */}
              <VoiceTextField
                label="Problem Name"
                value={form.problemName}
                onChange={updateField("problemName")}
                required
              />

              {/* Location + Direction */}
              <Stack
                direction={{
                  xs: "column",
                  sm: "row",
                }}
                spacing={1.5}
              >
                <VoiceTextField
                  label="Location"
                  value={form.location}
                  onChange={updateField("location")}
                />

                <VoiceTextField
                  label="Direction (e.g. near main gate, 2nd floor)"
                  value={form.direction}
                  onChange={updateField("direction")}
                />
              </Stack>

              {/* Broken Since */}
              <TextField
                label="Broken / noticed since"
                size="small"
                fullWidth
                placeholder="e.g. 3 days, since Monday"
                value={form.brokenSince}
                onChange={(e) =>
                  updateField("brokenSince")(
                    e.target.value
                  )
                }
              />

              {/* Description */}
              <VoiceTextField
                label="Description"
                value={form.description}
                onChange={updateField("description")}
                multiline
                minRows={2}
              />

              {/* Voice */}
              <Box>
                <Typography
                  variant="caption"
                  color="text.secondary"
                  fontWeight={700}
                  sx={{
                    display: "block",
                    mb: 0.5,
                  }}
                >
                  VOICE NOTE (optional)
                </Typography>

                <VoiceNoteRecorder
                  onChange={(blob, duration) => {
                    setVoiceBlob(blob);
                    setVoiceDuration(duration);
                  }}
                />
              </Box>

              {/* Add */}
              <Button
                variant="contained"
                onClick={handleAddIssue}
                disabled={adding}
                startIcon={
                  adding ? (
                    <CircularProgress
                      size={16}
                      color="inherit"
                    />
                  ) : null
                }
                sx={{
                  textTransform: "none",
                  fontWeight: 700,
                  alignSelf: "flex-start",
                }}
              >
                {adding
                  ? "Adding..."
                  : "Add Issue to Report"}
              </Button>
            </Stack>
          </Paper>

          {/* =================================================
              ISSUES
          ================================================= */}

          {report?.issues?.length > 0 && (
            <Paper
              elevation={0}
              sx={{
                p: { xs: 1.5, sm: 2.3 },
                border: "1px solid #e2e8f0",
                borderRadius: 2.5,
                bgcolor: "#fff",
              }}
            >
              <Typography
                fontWeight={700}
                mb={1.5}
              >
                Issues in this report (
                {report.issues.length})
              </Typography>

              <Stack
                spacing={1.2}
                divider={<Divider />}
              >
                {report.issues.map((issue) => (
                  <Stack
                    key={issue._id}
                    direction="row"
                    spacing={1.5}
                    alignItems="flex-start"
                  >
                    {/* Issue Photo */}
                    {issue.photo?.url && (
                      <Tooltip title="View photo">
                        <Box
                          onClick={() =>
                            openImage(
                              issue.photo.url
                            )
                          }
                          sx={{
                            position: "relative",
                            flexShrink: 0,
                            cursor: "pointer",
                            borderRadius: 1.5,
                            overflow: "hidden",
                            "&:hover .photo-overlay": {
                              opacity: 1,
                            },
                          }}
                        >
                          <Avatar
                            src={issue.photo.url}
                            variant="rounded"
                            sx={{
                              width: 60,
                              height: 60,
                            }}
                          />

                          <Box
                            className="photo-overlay"
                            sx={{
                              position: "absolute",
                              inset: 0,
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              bgcolor:
                                "rgba(0,0,0,0.4)",
                              opacity: 0,
                              transition: "0.2s",
                            }}
                          >
                            <Visibility
                              sx={{
                                color: "white",
                                fontSize: 20,
                              }}
                            />
                          </Box>
                        </Box>
                      </Tooltip>
                    )}

                    {/* Content */}
                    <Box
                      sx={{
                        flex: 1,
                        minWidth: 0,
                      }}
                    >
                      <Typography
                        fontWeight={700}
                        fontSize="0.9rem"
                      >
                        {issue.problemName}
                      </Typography>

                      <Stack
                        direction="row"
                        spacing={0.6}
                        flexWrap="wrap"
                        useFlexGap
                        sx={{ mt: 0.4 }}
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

                        {issue.voiceNote?.url && (
                          <Chip
                            size="small"
                            icon={
                              <PlayArrow fontSize="small" />
                            }
                            label="Voice note"
                          />
                        )}
                      </Stack>

                      {issue.description && (
                        <Typography
                          variant="body2"
                          color="text.secondary"
                          sx={{ mt: 0.4 }}
                        >
                          {issue.description}
                        </Typography>
                      )}
                    </Box>

                    {/* Delete */}
                    <IconButton
                      size="small"
                      onClick={() =>
                        handleDeleteIssue(
                          issue._id
                        )
                      }
                      disabled={
                        deletingId === issue._id
                      }
                      sx={{
                        color: "error.main",
                      }}
                    >
                      {deletingId === issue._id ? (
                        <CircularProgress size={16} />
                      ) : (
                        <Delete fontSize="small" />
                      )}
                    </IconButton>
                  </Stack>
                ))}
              </Stack>

              {/* Submit */}
              <Button
                variant="contained"
                fullWidth
                onClick={handleSubmitReport}
                disabled={submitting}
                startIcon={
                  submitting ? (
                    <CircularProgress
                      size={16}
                      color="inherit"
                    />
                  ) : (
                    <Send />
                  )
                }
                sx={{
                  textTransform: "none",
                  fontWeight: 700,
                  mt: 2.5,
                }}
              >
                {submitting
                  ? "Submitting..."
                  : "Submit Report"}
              </Button>
            </Paper>
          )}
        </Stack>
      </Box>

      {/* =====================================================
          IMAGE VIEWER
      ===================================================== */}

      <Dialog
        open={Boolean(viewImage)}
        onClose={closeImage}
        maxWidth="md"
        fullWidth
      >
        <Box
          sx={{
            position: "relative",
            bgcolor: "#111",
          }}
        >
          <IconButton
            onClick={closeImage}
            sx={{
              position: "absolute",
              right: 8,
              top: 8,
              zIndex: 2,
              bgcolor: "rgba(255,255,255,0.9)",
              "&:hover": {
                bgcolor: "white",
              },
            }}
          >
            <Close />
          </IconButton>

          <DialogContent
            sx={{
              p: 1,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              minHeight: {
                xs: 300,
                sm: 500,
              },
            }}
          >
            {viewImage && (
              <Box
                component="img"
                src={viewImage}
                alt="Inspection issue"
                sx={{
                  maxWidth: "100%",
                  maxHeight: "75vh",
                  objectFit: "contain",
                  display: "block",
                }}
              />
            )}
          </DialogContent>
        </Box>
      </Dialog>
    </Box>
  );
}
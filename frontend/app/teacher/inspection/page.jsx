"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Alert,
  Avatar,
  Box,
  Button,
  Chip,
  Dialog,
  DialogContent,
  CircularProgress,
  Divider,
  IconButton,
  Paper,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import {
  AddAPhoto,
  CheckCircle,
  Delete,
  Edit,
  PlayArrow,
  ReportProblemOutlined,
  Send,
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
  const [editingId, setEditingId] = useState(null);
  const [viewImage, setViewImage] = useState(null);

  const fileInputRef = useRef(null);

  const loadDraft = async () => {
    try {
      setLoading(true);
      setError("");
      const res = await api.get("/inspection-reports/mine/draft");
      setReport(res.data || null);
    } catch (err) {
      setError(err?.response?.data?.message || "Could not load your inspection report.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDraft();
  }, []);

  const updateField = (key) => (value) => setForm((p) => ({ ...p, [key]: value }));

  const handlePhotoSelected = (file) => {
    if (!file) return;
    setPhotoFile(file);
    setPhotoPreview(URL.createObjectURL(file));
  };

  const handleEditIssue = (issue) => {
    setError("");
    setEditingId(issue._id);

    setForm({
      problemName: issue.problemName || "",
      location: issue.location || "",
      direction: issue.direction || "",
      brokenSince: issue.brokenSince || "",
      description: issue.description || "",
    });

    // Existing photo can be replaced by selecting a new photo.
    setPhotoFile(null);
    setPhotoPreview(issue.photo?.url || null);

    // Existing voice note stays unchanged unless a new recording is made.
    setVoiceBlob(null);
    setVoiceDuration(issue.voiceNote?.durationSeconds || 0);

    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }

    window.scrollTo({
      top: 0,
      behavior: "smooth",
    });
  };

  const cancelEdit = () => {
    setEditingId(null);
    resetIssueForm();
  };

  const resetIssueForm = () => {
    setForm(EMPTY_ISSUE_FORM);
    setPhotoFile(null);
    setPhotoPreview(null);
    setVoiceBlob(null);
    setVoiceDuration(0);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

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
        formData.append("voiceNote", voiceBlob, "voice-note.webm");
        formData.append(
          "voiceNoteDuration",
          String(voiceDuration)
        );
      }

      // EDIT EXISTING ISSUE
      if (editingId && report?._id) {
        const res = await api.patch(
          `/inspection-reports/${report._id}/issues/${editingId}`,
          formData,
          {
            headers: {
              "Content-Type": "multipart/form-data",
            },
          }
        );

        setReport(res.data);
        setEditingId(null);
        resetIssueForm();
        return;
      }

      // ADD NEW ISSUE
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
      resetIssueForm();
    } catch (err) {
      setError(
        err?.response?.data?.message ||
          "Could not save this issue."
      );
    } finally {
      setAdding(false);
    }
  };

  const handleDeleteIssue = async (issueId) => {
    if (!report?._id) return;
    const confirmed = window.confirm("Remove this issue from the report?");
    if (!confirmed) return;

    setDeletingId(issueId);
    try {
      const res = await api.delete(`/inspection-reports/${report._id}/issues/${issueId}`);
      setReport(res.data);
    } catch (err) {
      setError(err?.response?.data?.message || "Could not remove this issue.");
    } finally {
      setDeletingId(null);
    }
  };

  const handleSubmitReport = async () => {
    if (!report?._id) return;
    if (!report.issues?.length) {
      setError("Add at least one issue before submitting.");
      return;
    }
    const confirmed = window.confirm(
      `Submit this report with ${report.issues.length} issue(s)? You won't be able to edit it after submitting.`,
    );
    if (!confirmed) return;

    setSubmitting(true);
    setError("");
    try {
      await api.post(`/inspection-reports/${report._id}/submit`);
      setReport(null);
      setEditingId(null);
      resetIssueForm();
      setSuccess(true);
    } catch (err) {
      setError(err?.response?.data?.message || "Could not submit the report.");
    } finally {
      setSubmitting(false);
    }
  };

  const startNew = () => {
    setSuccess(false);
    setReport(null);
    resetIssueForm();
    loadDraft();
  };

  if (loading) {
    return (
      <Box>
        <Navbar />
        <Box sx={{ display: "flex", justifyContent: "center", py: 8 }}>
          <CircularProgress />
        </Box>
      </Box>
    );
  }

  if (success) {
    return (
      <Box>
        <Navbar />
        <Box sx={{ maxWidth: 560, mx: "auto", p: { xs: 1.5, sm: 3 } }}>
          <Paper elevation={0} sx={{ p: 3, textAlign: "center", border: "1px solid #e2e8f0", borderRadius: 3 }}>
            <CheckCircle sx={{ fontSize: 46, color: "#7e22ce", mb: 1 }} />
            <Typography fontWeight={800} mb={0.6}>Inspection report submitted</Typography>
            <Typography variant="body2" color="text.secondary" mb={2}>
              It has been sent to the Super Admin.
            </Typography>
            <Stack direction="row" spacing={1} justifyContent="center">
              <Button variant="outlined" onClick={() => router.push("/teacher/inspection/history")} sx={{ textTransform: "none" }}>
                View History
              </Button>
              <Button variant="contained" onClick={startNew} sx={{ textTransform: "none" }}>
                Start New Inspection
              </Button>
            </Stack>
          </Paper>
        </Box>
      </Box>
    );
  }

  return (
    <Box>
      <Navbar />
      <Box sx={{ maxWidth: 760, mx: "auto", p: { xs: 1.5, sm: 3 }, pb: 5 }}>
        <Stack spacing={2}>
          <Paper elevation={0} sx={{ border: "1px solid #e5e7eb", borderRadius: 2.5, overflow: "hidden" }}>
            <Box sx={{ p: 2.5, background: "linear-gradient(135deg,#7e22ce,#4c1d95)", color: "white" }}>
              <Stack direction="row" spacing={1.4} alignItems="center">
                <ReportProblemOutlined />
                <Box>
                  <Typography fontWeight={800} fontSize="1.15rem">Inspection Report</Typography>
                  <Typography variant="body2" sx={{ opacity: 0.9 }}>
                    Add issues as you find them — this saves as a draft until you submit.
                  </Typography>
                </Box>
              </Stack>
            </Box>
          </Paper>

          {error && <Alert severity="error" onClose={() => setError("")}>{error}</Alert>}

          <Paper elevation={0} sx={{ p: { xs: 1.5, sm: 2.3 }, border: "1px solid #e2e8f0", borderRadius: 2.5 }}>
            <Stack
              direction="row"
              justifyContent="space-between"
              alignItems="center"
              mb={1.5}
            >
              <Typography fontWeight={700}>
                {editingId ? "Edit Issue" : "Add an Issue"}
              </Typography>

              {editingId && (
                <Button
                  size="small"
                  onClick={cancelEdit}
                  sx={{
                    textTransform: "none",
                    fontWeight: 700,
                  }}
                >
                  Cancel Edit
                </Button>
              )}
            </Stack>

            <Stack spacing={1.5}>
              <Box>
                {photoPreview ? (
                  <Stack
                    direction="row"
                    spacing={1.2}
                    alignItems="center"
                    flexWrap="wrap"
                    useFlexGap
                  >
                    <Avatar
                      src={photoPreview}
                      variant="rounded"
                      sx={{
                        width: 64,
                        height: 64,
                        cursor: "pointer",
                      }}
                      onClick={() => setViewImage(photoPreview)}
                    />

                    <Button
                      size="small"
                      variant="outlined"
                      component="label"
                      startIcon={<AddAPhoto />}
                      sx={{
                        textTransform: "none",
                        fontWeight: 600,
                      }}
                    >
                      Replace Photo
                      <input
                        ref={fileInputRef}
                        type="file"
                        hidden
                        accept="image/*"
                        capture="environment"
                        onChange={(e) =>
                          handlePhotoSelected(e.target.files?.[0])
                        }
                      />
                    </Button>

                    {photoFile && (
                      <Button
                        size="small"
                        color="error"
                        onClick={() => {
                          setPhotoFile(null);
                          setPhotoPreview(
                            editingId
                              ? report?.issues?.find(
                                  (i) => i._id === editingId
                                )?.photo?.url || null
                              : null
                          );

                          if (fileInputRef.current) {
                            fileInputRef.current.value = "";
                          }
                        }}
                        sx={{ textTransform: "none" }}
                      >
                        Cancel New Photo
                      </Button>
                    )}
                  </Stack>
                ) : (
                  <Button
                    variant="outlined"
                    component="label"
                    startIcon={<AddAPhoto />}
                    sx={{ textTransform: "none" }}
                  >
                    Take / Choose Photo
                    <input
                      ref={fileInputRef}
                      type="file"
                      hidden
                      accept="image/*"
                      capture="environment"
                      onChange={(e) =>
                        handlePhotoSelected(e.target.files?.[0])
                      }
                    />
                  </Button>
                )}
              </Box>

              <VoiceTextField label="Problem Name" value={form.problemName} onChange={updateField("problemName")} required />

              <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5}>
                <VoiceTextField label="Location" value={form.location} onChange={updateField("location")} />
                <VoiceTextField
                  label="Direction (e.g. near main gate, 2nd floor)"
                  value={form.direction}
                  onChange={updateField("direction")}
                />
              </Stack>

              <TextField
                label="Broken / noticed since"
                size="small"
                fullWidth
                placeholder="e.g. 3 days, since Monday"
                value={form.brokenSince}
                onChange={(e) => updateField("brokenSince")(e.target.value)}
              />

              <VoiceTextField
                label="Description"
                value={form.description}
                onChange={updateField("description")}
                multiline
                minRows={2}
              />

              <Box>
                <Typography variant="caption" color="text.secondary" fontWeight={700} sx={{ display: "block", mb: 0.5 }}>
                  VOICE NOTE (optional)
                </Typography>
                <VoiceNoteRecorder
                  onChange={(blob, duration) => {
                    setVoiceBlob(blob);
                    setVoiceDuration(duration);
                  }}
                />
              </Box>

              <Button
                variant="contained"
                onClick={handleAddIssue}
                disabled={adding}
                startIcon={
                  adding ? (
                    <CircularProgress size={16} color="inherit" />
                  ) : editingId ? (
                    <Edit />
                  ) : (
                    <AddAPhoto />
                  )
                }
                sx={{
                  textTransform: "none",
                  fontWeight: 700,
                  alignSelf: "flex-start",
                }}
              >
                {adding
                  ? editingId
                    ? "Updating..."
                    : "Adding..."
                  : editingId
                    ? "Update Issue"
                    : "Add Issue to Report"}
              </Button>
            </Stack>
          </Paper>

          {report?.issues?.length > 0 && (
            <Paper elevation={0} sx={{ p: { xs: 1.5, sm: 2.3 }, border: "1px solid #e2e8f0", borderRadius: 2.5 }}>
              <Typography fontWeight={700} mb={1.5}>
                Issues in this report ({report.issues.length})
              </Typography>
              <Stack spacing={1.2} divider={<Divider />}>
                {report.issues.map((issue) => (
                  <Stack key={issue._id} direction="row" spacing={1.5} alignItems="flex-start">
                    {issue.photo?.url && (
                      <Avatar
                        src={issue.photo.url}
                        variant="rounded"
                        sx={{
                          width: 56,
                          height: 56,
                          flexShrink: 0,
                          cursor: "pointer",
                        }}
                        onClick={() =>
                          setViewImage(issue.photo.url)
                        }
                      />
                    )}
                    <Box sx={{ flex: 1, minWidth: 0 }}>
                      <Typography fontWeight={700} fontSize="0.9rem">{issue.problemName}</Typography>
                      <Stack direction="row" spacing={0.6} flexWrap="wrap" useFlexGap sx={{ mt: 0.4 }}>
                        {issue.location && <Chip size="small" label={issue.location} />}
                        {issue.direction && <Chip size="small" label={issue.direction} />}
                        {issue.brokenSince && (
                          <Chip size="small" label={`Since: ${issue.brokenSince}`} color="warning" variant="outlined" />
                        )}
                        {issue.voiceNote?.url && (
                          <Chip size="small" icon={<PlayArrow fontSize="small" />} label="Voice note" />
                        )}
                      </Stack>
                      {issue.description && (
                        <Typography variant="body2" color="text.secondary" sx={{ mt: 0.4 }}>
                          {issue.description}
                        </Typography>
                      )}
                    </Box>
                    <Stack
                      direction="row"
                      spacing={0.2}
                      sx={{ flexShrink: 0 }}
                    >
                      <IconButton
                        size="small"
                        onClick={() => handleEditIssue(issue)}
                        disabled={
                          deletingId === issue._id
                        }
                        sx={{ color: "#1e3a5f" }}
                        aria-label="Edit issue"
                      >
                        <Edit fontSize="small" />
                      </IconButton>

                      <IconButton
                        size="small"
                        onClick={() =>
                          handleDeleteIssue(issue._id)
                        }
                        disabled={
                          deletingId === issue._id
                        }
                        sx={{ color: "error.main" }}
                        aria-label="Delete issue"
                      >
                        {deletingId === issue._id ? (
                          <CircularProgress size={16} />
                        ) : (
                          <Delete fontSize="small" />
                        )}
                      </IconButton>
                    </Stack>
                  </Stack>
                ))}
              </Stack>

              <Button
                variant="contained"
                fullWidth
                onClick={handleSubmitReport}
                disabled={submitting}
                startIcon={submitting ? <CircularProgress size={16} color="inherit" /> : <Send />}
                sx={{ textTransform: "none", fontWeight: 700, mt: 2.5 }}
              >
                {submitting ? "Submitting..." : "Submit Report"}
              </Button>
            </Paper>
          )}
        </Stack>
      </Box>

      <Dialog
        open={Boolean(viewImage)}
        onClose={() => setViewImage(null)}
        maxWidth="md"
        fullWidth
      >
        <DialogContent
          sx={{
            p: { xs: 1, sm: 2 },
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            backgroundColor: "#000",
          }}
        >
          {viewImage && (
            <Box
              component="img"
              src={viewImage}
              alt="Inspection issue"
              onClick={() => setViewImage(null)}
              sx={{
                display: "block",
                maxWidth: "100%",
                maxHeight: "80vh",
                objectFit: "contain",
                cursor: "pointer",
              }}
            />
          )}
        </DialogContent>
      </Dialog>
    </Box>
  );
}
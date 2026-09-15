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
  MenuItem,
  Paper,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import {
  AddAPhoto,
  CheckCircle,
  Close,
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
import { compressImage } from "../../../utils/compressImage";

const UNITS = ["ft", "m", "in", "cm"];

const EMPTY_ISSUE_FORM = {
  problemName: "",
  location: "",
  direction: "",
  brokenSince: "",
  description: "",
  quantity: "",
  length: "",
  height: "",
  unit: "ft",
};

export default function InspectionReportPage() {
  const router = useRouter();

  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  const [form, setForm] = useState(EMPTY_ISSUE_FORM);

  // New photos being added (File objects, already compressed)
  const [newPhotoFiles, setNewPhotoFiles] = useState([]);
  const [newPhotoPreviews, setNewPhotoPreviews] = useState([]);

  // When editing an existing issue: its current photos + which were removed
  const [existingPhotos, setExistingPhotos] = useState([]);
  const [removedPhotoIds, setRemovedPhotoIds] = useState([]);

  const [voiceBlob, setVoiceBlob] = useState(null);
  const [voiceDuration, setVoiceDuration] = useState(0);

  const [adding, setAdding] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [deletingId, setDeletingId] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const [viewImage, setViewImage] = useState(null);
  const [compressing, setCompressing] = useState(false);

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

  const handlePhotosSelected = async (files) => {
    const fileArr = Array.from(files || []);
    if (!fileArr.length) return;

    setCompressing(true);
    try {
      const compressed = await Promise.all(fileArr.map((f) => compressImage(f)));
      setNewPhotoFiles((prev) => [...prev, ...compressed]);
      setNewPhotoPreviews((prev) => [...prev, ...compressed.map((f) => URL.createObjectURL(f))]);
    } finally {
      setCompressing(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const removeNewPhoto = (index) => {
    setNewPhotoFiles((prev) => prev.filter((_, i) => i !== index));
    setNewPhotoPreviews((prev) => prev.filter((_, i) => i !== index));
  };

  const removeExistingPhoto = (publicId) => {
    setExistingPhotos((prev) => prev.filter((p) => p.publicId !== publicId));
    setRemovedPhotoIds((prev) => [...prev, publicId]);
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
      quantity: issue.quantity ?? "",
      length: issue.length ?? "",
      height: issue.height ?? "",
      unit: issue.unit || "ft",
    });

    setExistingPhotos(issue.photos || []);
    setRemovedPhotoIds([]);
    setNewPhotoFiles([]);
    setNewPhotoPreviews([]);

    setVoiceBlob(null);
    setVoiceDuration(issue.voiceNote?.durationSeconds || 0);

    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const cancelEdit = () => {
    setEditingId(null);
    resetIssueForm();
  };

  const resetIssueForm = () => {
    setForm(EMPTY_ISSUE_FORM);
    setNewPhotoFiles([]);
    setNewPhotoPreviews([]);
    setExistingPhotos([]);
    setRemovedPhotoIds([]);
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
      formData.append("quantity", form.quantity);
      formData.append("length", form.length);
      formData.append("height", form.height);
      formData.append("unit", form.unit);

      newPhotoFiles.forEach((file) => formData.append("photos", file));

      if (voiceBlob) {
        formData.append("voiceNote", voiceBlob, "voice-note.webm");
        formData.append("voiceNoteDuration", String(voiceDuration));
      }

      if (editingId && report?._id) {
        if (removedPhotoIds.length) formData.append("removePhotoIds", JSON.stringify(removedPhotoIds));

        const res = await api.patch(
          `/inspection-reports/${report._id}/issues/${editingId}`,
          formData,
          { headers: { "Content-Type": "multipart/form-data" } },
        );

        setReport(res.data);
        setEditingId(null);
        resetIssueForm();
        return;
      }

      if (report?._id) formData.append("reportId", report._id);

      const res = await api.post("/inspection-reports/issues", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });

      setReport(res.data);
      resetIssueForm();
    } catch (err) {
      setError(err?.response?.data?.message || "Could not save this issue.");
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
      `Submit this report with ${report.issues.length} issue(s)?`,
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

  const dimensionsLabel = (issue) => {
    if (!issue.length && !issue.height) return null;
    const parts = [];
    if (issue.length) parts.push(`L: ${issue.length}${issue.unit}`);
    if (issue.height) parts.push(`H: ${issue.height}${issue.unit}`);
    return parts.join(" × ");
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
              It has been sent to the Super Admin. You can still edit it until an admin locks it.
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
            <Stack direction="row" justifyContent="space-between" alignItems="center" mb={1.5}>
              <Typography fontWeight={700}>{editingId ? "Edit Issue" : "Add an Issue"}</Typography>
              {editingId && (
                <Button size="small" onClick={cancelEdit} sx={{ textTransform: "none", fontWeight: 700 }}>
                  Cancel Edit
                </Button>
              )}
            </Stack>

            <Stack spacing={1.5}>
              <Box>
                <Typography variant="caption" color="text.secondary" fontWeight={700} sx={{ display: "block", mb: 0.5 }}>
                  PHOTOS
                </Typography>
                <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                  {existingPhotos.map((p) => (
                    <Box key={p.publicId} sx={{ position: "relative" }}>
                      <Avatar
                        src={p.url}
                        variant="rounded"
                        sx={{ width: 64, height: 64, cursor: "pointer" }}
                        onClick={() => setViewImage(p.url)}
                      />
                      <IconButton
                        size="small"
                        onClick={() => removeExistingPhoto(p.publicId)}
                        sx={{ position: "absolute", top: -8, right: -8, bgcolor: "white", boxShadow: 1, "&:hover": { bgcolor: "#fee2e2" } }}
                      >
                        <Close sx={{ fontSize: 14 }} />
                      </IconButton>
                    </Box>
                  ))}
                  {newPhotoPreviews.map((url, i) => (
                    <Box key={url} sx={{ position: "relative" }}>
                      <Avatar
                        src={url}
                        variant="rounded"
                        sx={{ width: 64, height: 64, border: "2px solid", borderColor: "success.main", cursor: "pointer" }}
                        onClick={() => setViewImage(url)}
                      />
                      <IconButton
                        size="small"
                        onClick={() => removeNewPhoto(i)}
                        sx={{ position: "absolute", top: -8, right: -8, bgcolor: "white", boxShadow: 1 }}
                      >
                        <Close sx={{ fontSize: 14 }} />
                      </IconButton>
                    </Box>
                  ))}
                  <Button
                    variant="outlined"
                    component="label"
                    startIcon={compressing ? <CircularProgress size={14} /> : <AddAPhoto />}
                    disabled={compressing}
                    sx={{ textTransform: "none", height: 64 }}
                  >
                    {compressing ? "Preparing..." : "Add Photo(s)"}
                    <input
                      ref={fileInputRef}
                      type="file"
                      hidden
                      multiple
                      accept="image/*"
                      capture="environment"
                      onChange={(e) => handlePhotosSelected(e.target.files)}
                    />
                  </Button>
                </Stack>
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

              <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5}>
                <TextField
                  label="Quantity"
                  type="number"
                  size="small"
                  fullWidth
                  placeholder="optional"
                  value={form.quantity}
                  onChange={(e) => setForm((p) => ({ ...p, quantity: e.target.value }))}
                />
                <TextField
                  label="Length"
                  type="number"
                  size="small"
                  fullWidth
                  placeholder="optional"
                  value={form.length}
                  onChange={(e) => setForm((p) => ({ ...p, length: e.target.value }))}
                />
                <TextField
                  label="Height"
                  type="number"
                  size="small"
                  fullWidth
                  placeholder="optional"
                  value={form.height}
                  onChange={(e) => setForm((p) => ({ ...p, height: e.target.value }))}
                />
                <TextField
                  select
                  label="Unit"
                  size="small"
                  sx={{ minWidth: 90 }}
                  value={form.unit}
                  onChange={(e) => setForm((p) => ({ ...p, unit: e.target.value }))}
                >
                  {UNITS.map((u) => (
                    <MenuItem key={u} value={u}>{u}</MenuItem>
                  ))}
                </TextField>
              </Stack>

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
                disabled={adding || compressing}
                startIcon={adding ? <CircularProgress size={16} color="inherit" /> : editingId ? <Edit /> : null}
                sx={{ textTransform: "none", fontWeight: 700, alignSelf: "flex-start" }}
              >
                {adding
                  ? editingId ? "Updating..." : "Adding..."
                  : editingId ? "Update Issue" : "Add Issue to Report"}
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
                    {issue.photos?.length > 0 && (
                      <Stack direction="row" spacing={0.5} sx={{ flexShrink: 0 }}>
                        {issue.photos.slice(0, 2).map((p) => (
                          <Avatar
                            key={p.publicId}
                            src={p.url}
                            variant="rounded"
                            sx={{ width: 56, height: 56, cursor: "pointer" }}
                            onClick={() => setViewImage(p.url)}
                          />
                        ))}
                        {issue.photos.length > 2 && (
                          <Avatar variant="rounded" sx={{ width: 56, height: 56, bgcolor: "grey.200", color: "text.secondary", fontSize: 12 }}>
                            +{issue.photos.length - 2}
                          </Avatar>
                        )}
                      </Stack>
                    )}
                    <Box sx={{ flex: 1, minWidth: 0 }}>
                      <Typography fontWeight={700} fontSize="0.9rem">{issue.problemName}</Typography>
                      <Stack direction="row" spacing={0.6} flexWrap="wrap" useFlexGap sx={{ mt: 0.4 }}>
                        {issue.location && <Chip size="small" label={issue.location} />}
                        {issue.direction && <Chip size="small" label={issue.direction} />}
                        {issue.brokenSince && <Chip size="small" label={`Since: ${issue.brokenSince}`} color="warning" variant="outlined" />}
                        {issue.quantity != null && <Chip size="small" label={`Qty: ${issue.quantity}`} />}
                        {dimensionsLabel(issue) && <Chip size="small" label={dimensionsLabel(issue)} />}
                        {issue.voiceNote?.url && <Chip size="small" icon={<PlayArrow fontSize="small" />} label="Voice note" />}
                      </Stack>
                      {issue.description && (
                        <Typography variant="body2" color="text.secondary" sx={{ mt: 0.4 }}>
                          {issue.description}
                        </Typography>
                      )}
                    </Box>
                    <Stack direction="row" spacing={0.2} sx={{ flexShrink: 0 }}>
                      <IconButton size="small" onClick={() => handleEditIssue(issue)} disabled={deletingId === issue._id} sx={{ color: "#1e3a5f" }}>
                        <Edit fontSize="small" />
                      </IconButton>
                      <IconButton size="small" onClick={() => handleDeleteIssue(issue._id)} disabled={deletingId === issue._id} sx={{ color: "error.main" }}>
                        {deletingId === issue._id ? <CircularProgress size={16} /> : <Delete fontSize="small" />}
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

      <Dialog open={Boolean(viewImage)} onClose={() => setViewImage(null)} maxWidth="md" fullWidth>
        <DialogContent sx={{ p: { xs: 1, sm: 2 }, display: "flex", justifyContent: "center", alignItems: "center", backgroundColor: "#000" }}>
          {viewImage && (
            <Box
              component="img"
              src={viewImage}
              alt="Inspection issue"
              onClick={() => setViewImage(null)}
              sx={{ display: "block", maxWidth: "100%", maxHeight: "80vh", objectFit: "contain", cursor: "pointer" }}
            />
          )}
        </DialogContent>
      </Dialog>
    </Box>
  );
}
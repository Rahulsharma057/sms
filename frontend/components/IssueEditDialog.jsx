"use client";

import { useEffect, useState } from "react";
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Stack,
  TextField,
  MenuItem,
  Box,
  Avatar,
  IconButton,
  Alert,
  CircularProgress,
  Typography,
} from "@mui/material";
import { AddAPhoto, Close } from "@mui/icons-material";
import api from "../lib/api";
import VoiceTextField from "./VoiceTextField";
import VoiceNoteRecorder from "./VoiceNoteRecorder";
import { compressImage } from "../utils/compressImage";

const UNITS = ["ft", "m", "in", "cm"];

export default function IssueEditDialog({ open, onClose, reportId, issue, onSaved }) {
  const [form, setForm] = useState({
    problemName: "",
    location: "",
    direction: "",
    brokenSince: "",
    description: "",
    quantity: "",
    length: "",
    height: "",
    unit: "ft",
  });

  const [existingPhotos, setExistingPhotos] = useState([]);
  const [removedPhotoIds, setRemovedPhotoIds] = useState([]);
  const [newPhotoFiles, setNewPhotoFiles] = useState([]);
  const [newPhotoPreviews, setNewPhotoPreviews] = useState([]);

  const [voiceBlob, setVoiceBlob] = useState(null);
  const [voiceDuration, setVoiceDuration] = useState(0);
  const [removeVoiceNote, setRemoveVoiceNote] = useState(false);

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!issue || !open) return;

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
    setRemoveVoiceNote(false);
    setError("");
  }, [issue, open]);

  const updateField = (key) => (value) => setForm((p) => ({ ...p, [key]: value }));

  const handleAddPhotos = async (files) => {
    const fileArr = Array.from(files || []);
    if (!fileArr.length) return;
    const compressed = await Promise.all(fileArr.map((f) => compressImage(f)));
    setNewPhotoFiles((prev) => [...prev, ...compressed]);
    setNewPhotoPreviews((prev) => [...prev, ...compressed.map((f) => URL.createObjectURL(f))]);
  };

  const removeNewPhoto = (index) => {
    setNewPhotoFiles((prev) => prev.filter((_, i) => i !== index));
    setNewPhotoPreviews((prev) => prev.filter((_, i) => i !== index));
  };

  const removeExistingPhoto = (publicId) => {
    setExistingPhotos((prev) => prev.filter((p) => p.publicId !== publicId));
    setRemovedPhotoIds((prev) => [...prev, publicId]);
  };

  const handleSave = async () => {
    setError("");
    if (!form.problemName.trim()) {
      setError("Problem name is required.");
      return;
    }

    setSaving(true);
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
      if (removedPhotoIds.length) formData.append("removePhotoIds", JSON.stringify(removedPhotoIds));
      newPhotoFiles.forEach((file) => formData.append("photos", file));
      if (voiceBlob) {
        formData.append("voiceNote", voiceBlob, "voice-note.webm");
        formData.append("voiceNoteDuration", String(voiceDuration));
      }
      if (removeVoiceNote) formData.append("removeVoiceNote", "true");

      const res = await api.patch(
        `/inspection-reports/${reportId}/issues/${issue._id}`,
        formData,
        { headers: { "Content-Type": "multipart/form-data" } },
      );

      onSaved?.(res.data);
      onClose();
    } catch (err) {
      setError(err?.response?.data?.message || "Could not save changes.");
    } finally {
      setSaving(false);
    }
  };

  if (!issue) return null;

  return (
    <Dialog open={open} onClose={saving ? undefined : onClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ fontWeight: 800 }}>Edit Issue</DialogTitle>
      <DialogContent dividers>
        <Stack spacing={1.5}>
          {error && <Alert severity="error">{error}</Alert>}

          <VoiceTextField label="Problem Name" value={form.problemName} onChange={updateField("problemName")} required />

          <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5}>
            <VoiceTextField label="Location" value={form.location} onChange={updateField("location")} />
            <VoiceTextField label="Direction" value={form.direction} onChange={updateField("direction")} />
          </Stack>

          <TextField
            label="Broken / noticed since"
            size="small"
            fullWidth
            value={form.brokenSince}
            onChange={(e) => updateField("brokenSince")(e.target.value)}
          />

          <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5}>
            <TextField
              label="Quantity"
              type="number"
              size="small"
              fullWidth
              value={form.quantity}
              onChange={(e) => setForm((p) => ({ ...p, quantity: e.target.value }))}
            />
            <TextField
              label="Length"
              type="number"
              size="small"
              fullWidth
              value={form.length}
              onChange={(e) => setForm((p) => ({ ...p, length: e.target.value }))}
            />
            <TextField
              label="Height"
              type="number"
              size="small"
              fullWidth
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
            <Typography variant="caption" fontWeight={700} color="text.secondary" sx={{ display: "block", mb: 0.5 }}>
              PHOTOS
            </Typography>
            <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
              {existingPhotos.map((p) => (
                <Box key={p.publicId} sx={{ position: "relative" }}>
                  <Avatar src={p.url} variant="rounded" sx={{ width: 64, height: 64 }} />
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
                  <Avatar src={url} variant="rounded" sx={{ width: 64, height: 64, border: "2px solid", borderColor: "success.main" }} />
                  <IconButton
                    size="small"
                    onClick={() => removeNewPhoto(i)}
                    sx={{ position: "absolute", top: -8, right: -8, bgcolor: "white", boxShadow: 1 }}
                  >
                    <Close sx={{ fontSize: 14 }} />
                  </IconButton>
                </Box>
              ))}
              <Button component="label" variant="outlined" startIcon={<AddAPhoto />} sx={{ textTransform: "none", height: 64 }}>
                Add
                <input type="file" hidden multiple accept="image/*" onChange={(e) => handleAddPhotos(e.target.files)} />
              </Button>
            </Stack>
          </Box>

          <Box>
            <Typography variant="caption" fontWeight={700} color="text.secondary" sx={{ display: "block", mb: 0.5 }}>
              VOICE NOTE
            </Typography>
            {issue.voiceNote?.url && !removeVoiceNote && !voiceBlob && (
              <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1 }}>
                <audio controls src={issue.voiceNote.url} style={{ height: 32 }} />
                <Button size="small" color="error" onClick={() => setRemoveVoiceNote(true)} sx={{ textTransform: "none" }}>
                  Remove
                </Button>
              </Stack>
            )}
            <VoiceNoteRecorder
              onChange={(blob, duration) => {
                setVoiceBlob(blob);
                setVoiceDuration(duration);
                setRemoveVoiceNote(false);
              }}
            />
          </Box>
        </Stack>
      </DialogContent>
      <DialogActions sx={{ px: 3, py: 2 }}>
        <Button onClick={onClose} disabled={saving} sx={{ textTransform: "none" }}>
          Cancel
        </Button>
        <Button
          variant="contained"
          onClick={handleSave}
          disabled={saving}
          startIcon={saving ? <CircularProgress size={16} color="inherit" /> : null}
          sx={{ textTransform: "none", fontWeight: 700 }}
        >
          {saving ? "Saving..." : "Save Changes"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
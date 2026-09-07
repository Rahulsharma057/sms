"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  Alert,
  Box,
  Button,
  Checkbox,
  Chip,
  CircularProgress,
  FormControl,
  InputLabel,
  ListItemText,
  MenuItem,
  OutlinedInput,
  Paper,
  Rating,
  Select,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import { CheckCircle, Description } from "@mui/icons-material";
import api from "../../../lib/api";
import Navbar from "../../../components/Navbar";

export default function DynamicReportFillPage() {
  const { id } = useParams();
  const router = useRouter();

  const [data, setData] = useState(null);
  const [answers, setAnswers] = useState({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    if (!id) return;
    api
      .get(`/dynamic-reports/${id}/fill`)
      .then((res) => {
        setData(res.data);
        const initial = {};
        (res.data?.existingEntry?.answers || []).forEach((a) => {
          initial[a.fieldKey] = a.value;
        });
        setAnswers(initial);
      })
      .catch((err) => setError(err?.response?.data?.message || "Could not load this report."))
      .finally(() => setLoading(false));
  }, [id]);

  const updateAnswer = (key, value) => setAnswers((p) => ({ ...p, [key]: value }));

  const handleSubmit = async () => {
    setError("");
    setSaving(true);
    try {
      const payload = {
        answers: Object.entries(answers).map(([fieldKey, value]) => ({ fieldKey, value })),
      };
      await api.post(`/dynamic-reports/${id}/submit`, payload);
      setSuccess(true);
    } catch (err) {
      setError(err?.response?.data?.message || "Could not submit report.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <Box sx={{ display: "flex", justifyContent: "center", py: 8 }}>
        <CircularProgress />
      </Box>
    );
  }

  if (error && !data) {
    return (
      <Box sx={{ maxWidth: 600, mx: "auto", p: 3 }}>
        <Alert severity="error">{error}</Alert>
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
            <Typography fontWeight={800} mb={0.6}>Report submitted successfully</Typography>
            <Button fullWidth variant="contained" onClick={() => router.push("/teacher/dashboard")}>
              Back to Dashboard
            </Button>
          </Paper>
        </Box>
      </Box>
    );
  }

  const { report } = data;

  return (
    <Box>
      <Navbar />
      <Box sx={{ maxWidth: 720, mx: "auto", p: { xs: 1.5, sm: 3 } }}>
        <Stack spacing={2}>
          <Paper elevation={0} sx={{ border: "1px solid #e5e7eb", borderRadius: 2.5, overflow: "hidden" }}>
            <Box sx={{ p: 2.5, background: "linear-gradient(135deg,#7e22ce,#4c1d95)", color: "white" }}>
              <Stack direction="row" spacing={1.4} alignItems="center">
                <Description />
                <Box>
                  <Typography fontWeight={800} fontSize="1.15rem">{report.title}</Typography>
                  {report.description && (
                    <Typography variant="body2" sx={{ opacity: 0.9 }}>{report.description}</Typography>
                  )}
                </Box>
              </Stack>
            </Box>
          </Paper>

          {data.existingEntry && (
            <Alert severity="info">You already submitted this today. Saving again will update your entry.</Alert>
          )}
          {error && <Alert severity="error">{error}</Alert>}

          <Paper elevation={0} sx={{ p: { xs: 1.5, sm: 2.3 }, border: "1px solid #e2e8f0", borderRadius: 2.5 }}>
            <Stack spacing={2}>
              {report.fields.map((field) => (
                <Box key={field.key}>
                  {field.fieldType === "checkbox" ? (
                    <Stack direction="row" alignItems="center">
                      <Checkbox
                        checked={!!answers[field.key]}
                        onChange={(e) => updateAnswer(field.key, e.target.checked)}
                      />
                      <Typography fontSize="0.85rem" fontWeight={600}>
                        {field.label}{field.required ? " *" : ""}
                      </Typography>
                    </Stack>
                  ) : field.fieldType === "checkbox_remark" ? (
                    <Stack spacing={0.7}>
                      <Stack direction="row" alignItems="center">
                        <Checkbox
                          checked={!!answers[field.key]?.checked}
                          onChange={(e) =>
                            updateAnswer(field.key, {
                              ...(answers[field.key] || {}),
                              checked: e.target.checked,
                            })
                          }
                        />
                        <Typography fontSize="0.85rem" fontWeight={600}>
                          {field.label}{field.required ? " *" : ""}
                        </Typography>
                      </Stack>
                      <TextField
                        fullWidth
                        size="small"
                        placeholder="Remark (optional)"
                        value={answers[field.key]?.remark ?? ""}
                        onChange={(e) =>
                          updateAnswer(field.key, {
                            checked: !!answers[field.key]?.checked,
                            remark: e.target.value,
                          })
                        }
                      />
                    </Stack>
                  ) : field.fieldType === "rating" ? (
                    <Box>
                      <Typography fontSize="0.85rem" fontWeight={600} mb={0.5}>
                        {field.label}{field.required ? " *" : ""}
                      </Typography>
                      <Rating
                        value={Number(answers[field.key]) || 0}
                        max={field.maxRating || 5}
                        onChange={(_e, val) => updateAnswer(field.key, val)}
                      />
                    </Box>
                  ) : field.fieldType === "multiselect" ? (
                    <FormControl fullWidth size="small">
                      <InputLabel>{field.label}{field.required ? " *" : ""}</InputLabel>
                      <Select
                        multiple
                        value={Array.isArray(answers[field.key]) ? answers[field.key] : []}
                        onChange={(e) => updateAnswer(field.key, e.target.value)}
                        input={<OutlinedInput label={`${field.label}${field.required ? " *" : ""}`} />}
                        renderValue={(selected) => (
                          <Stack direction="row" spacing={0.5} flexWrap="wrap" useFlexGap>
                            {selected.map((v) => (
                              <Chip key={v} label={v} size="small" />
                            ))}
                          </Stack>
                        )}
                      >
                        {(field.options || []).map((opt) => (
                          <MenuItem key={opt} value={opt}>
                            <Checkbox checked={(answers[field.key] || []).includes(opt)} size="small" />
                            <ListItemText primary={opt} />
                          </MenuItem>
                        ))}
                      </Select>
                    </FormControl>
                  ) : field.fieldType === "select" ? (
                    <TextField
                      select
                      fullWidth
                      size="small"
                      label={field.label}
                      required={field.required}
                      value={answers[field.key] ?? ""}
                      onChange={(e) => updateAnswer(field.key, e.target.value)}
                    >
                      {(field.options || []).map((opt) => (
                        <MenuItem key={opt} value={opt}>{opt}</MenuItem>
                      ))}
                    </TextField>
                  ) : (
                    <TextField
                      fullWidth
                      size="small"
                      type={field.fieldType === "date" ? "date" : field.fieldType === "number" ? "number" : "text"}
                      multiline={field.fieldType === "textarea"}
                      minRows={field.fieldType === "textarea" ? 2 : undefined}
                      label={field.label}
                      required={field.required}
                      value={answers[field.key] ?? ""}
                      onChange={(e) => updateAnswer(field.key, e.target.value)}
                      InputLabelProps={field.fieldType === "date" ? { shrink: true } : undefined}
                    />
                  )}
                </Box>
              ))}
            </Stack>
          </Paper>

          <Button
            variant="contained"
            fullWidth
            disabled={saving}
            onClick={handleSubmit}
            startIcon={saving ? <CircularProgress size={16} color="inherit" /> : <CheckCircle />}
            sx={{ textTransform: "none", fontWeight: 700 }}
          >
            {saving ? "Submitting..." : data.existingEntry ? "Update Submission" : "Submit Report"}
          </Button>
        </Stack>
      </Box>
    </Box>
  );
}
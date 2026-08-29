"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import {
  Box,
  Container,
  Paper,
  Typography,
  TextField,
  Button,
  Stack,
  CircularProgress,
  Alert,
} from "@mui/material";
import { CheckCircleOutline, SentimentDissatisfied } from "@mui/icons-material";
import api from "../../../lib/api";

export default function PublicFormPage() {
  const { slug } = useParams();

  const [loadState, setLoadState] = useState("loading"); // loading | ready | notfound
  const [form, setForm] = useState(null);
  const [values, setValues] = useState({});
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");

  useEffect(() => {
    if (!slug) return;
    api
      .get(`/forms/public/${slug}`)
      .then((res) => {
        setForm(res.data);
        setLoadState("ready");
      })
      .catch(() => setLoadState("notfound"));
  }, [slug]);

  const handleChange = (fieldId, value) => {
    setValues((p) => ({ ...p, [fieldId]: value }));
    setErrors((p) => ({ ...p, [fieldId]: undefined }));
  };

  const validate = () => {
    const nextErrors = {};
    for (const field of form.fields) {
      const raw = values[field._id];
      if (field.required && (raw === undefined || String(raw).trim() === "")) {
        nextErrors[field._id] = "Required";
        continue;
      }
      if (field.fieldType === "number" && raw !== undefined && raw !== "" && isNaN(Number(raw))) {
        nextErrors[field._id] = "Must be a number";
      }
    }
    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const handleSubmit = async () => {
    setSubmitError("");
    if (!validate()) return;

    setSubmitting(true);
    try {
      const answers = form.fields.map((f) => ({ fieldId: f._id, value: values[f._id] ?? "" }));
      const res = await api.post(`/forms/public/${slug}/submit`, { answers });
      setSuccessMessage(res.data?.message || form.theme?.successMessage);
      setSubmitted(true);
    } catch (err) {
      setSubmitError(err?.response?.data?.message || "Could not submit the form. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const accent = form?.theme?.primaryColor || "#7e22ce";

  if (loadState === "loading") {
    return (
      <Box sx={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", bgcolor: "#faf9fb" }}>
        <CircularProgress sx={{ color: "#7e22ce" }} />
      </Box>
    );
  }

  if (loadState === "notfound") {
    return (
      <Box sx={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", bgcolor: "#faf9fb", px: 2 }}>
        <Stack spacing={1.5} alignItems="center" textAlign="center">
          <SentimentDissatisfied sx={{ fontSize: 44, color: "text.disabled" }} />
          <Typography variant="h6" fontWeight={700}>
            This form is not available
          </Typography>
          <Typography variant="body2" color="text.secondary">
            The link may be inactive, or the form was removed.
          </Typography>
        </Stack>
      </Box>
    );
  }

  return (
    <Box sx={{ minHeight: "100vh", bgcolor: "#faf9fb", py: { xs: 3, sm: 6 } }}>
      <Container maxWidth="sm">
        <Paper elevation={0} sx={{ border: "1px solid #e2e8f0", borderRadius: 3, overflow: "hidden" }}>
          <Box sx={{ px: { xs: 2.5, sm: 4 }, py: 3, bgcolor: accent, color: "white" }}>
            {form.theme?.headerText && (
              <Typography fontSize="0.72rem" letterSpacing={0.5} sx={{ opacity: 0.85, textTransform: "uppercase", mb: 0.5 }}>
                {form.theme.headerText}
              </Typography>
            )}
            <Typography variant="h5" fontWeight={800}>
              {form.title}
            </Typography>
            {form.description && (
              <Typography variant="body2" sx={{ opacity: 0.9, mt: 0.5 }}>
                {form.description}
              </Typography>
            )}
          </Box>

          <Box sx={{ px: { xs: 2.5, sm: 4 }, py: 3 }}>
            {submitted ? (
              <Stack spacing={1.5} alignItems="center" textAlign="center" sx={{ py: 3 }}>
                <CheckCircleOutline sx={{ fontSize: 48, color: accent }} />
                <Typography variant="h6" fontWeight={700}>
                  Submitted
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {successMessage}
                </Typography>
              </Stack>
            ) : (
              <Stack spacing={2}>
                {submitError && <Alert severity="error">{submitError}</Alert>}
                {form.fields.map((field) => (
                  <TextField
                    key={field._id}
                    label={field.label}
                    required={field.required}
                    type={field.fieldType === "number" ? "number" : "text"}
                    placeholder={field.placeholder}
                    fullWidth
                    value={values[field._id] ?? ""}
                    onChange={(e) => handleChange(field._id, e.target.value)}
                    error={!!errors[field._id]}
                    helperText={errors[field._id]}
                  />
                ))}
                <Button
                  variant="contained"
                  size="large"
                  onClick={handleSubmit}
                  disabled={submitting}
                  startIcon={submitting ? <CircularProgress size={16} color="inherit" /> : null}
                  sx={{
                    textTransform: "none",
                    fontWeight: 700,
                    bgcolor: accent,
                    "&:hover": { bgcolor: accent, filter: "brightness(0.9)" },
                  }}
                >
                  {submitting ? "Submitting..." : form.theme?.submitButtonLabel || "Submit"}
                </Button>
              </Stack>
            )}
          </Box>
        </Paper>
      </Container>
    </Box>
  );
}

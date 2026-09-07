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
  Rating,
  Checkbox,
  FormControlLabel,
  FormHelperText,
} from "@mui/material";

import {
  CheckCircleOutline,
  SentimentDissatisfied,
  StarBorder,
} from "@mui/icons-material";

import { useAuth } from "../../../context/AuthContext";
import Navbar from "../../../components/Navbar";
import api from "../../../lib/api";

export default function PublicFormPage() {
  const { slug } = useParams();

  const { user } = useAuth();

  const [loadState, setLoadState] = useState("loading");
  const [form, setForm] = useState(null);
  const [values, setValues] = useState({});
  const [remarks, setRemarks] = useState({});
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");

  // =========================================================
  // TEACHER CHECK
  // =========================================================

  const isTeacher = user?.role === "teacher";

  // =========================================================
  // LOAD FORM
  // =========================================================

  useEffect(() => {
    if (!slug) return;

    const loadForm = async () => {
      try {
        setLoadState("loading");

        const res = await api.get(`/forms/public/${slug}`);

        setForm(res.data);
        setLoadState("ready");
      } catch (error) {
        console.error("Could not load form:", error);
        setLoadState("notfound");
      }
    };

    loadForm();
  }, [slug]);

  // =========================================================
  // HANDLE CHANGE
  // =========================================================

  const handleChange = (fieldId, value) => {
    setValues((prev) => ({
      ...prev,
      [fieldId]: value,
    }));

    setErrors((prev) => ({
      ...prev,
      [fieldId]: undefined,
    }));
  };

  const handleRemarkChange = (fieldId, value) => {
    setRemarks((prev) => ({
      ...prev,
      [fieldId]: value,
    }));
  };

  // =========================================================
  // VALIDATION
  // =========================================================

  const validate = () => {
    if (!form) return false;

    const nextErrors = {};

    for (const field of form.fields || []) {
      const raw = values[field._id];

      if (field.fieldType === "checkbox") {
        if (field.required && raw !== true) {
          nextErrors[field._id] = "Required";
        }
        continue;
      }

      if (field.fieldType === "rating") {
        const isEmpty = raw === undefined || raw === null || raw === "";
        if (field.required && isEmpty) {
          nextErrors[field._id] = "Required";
        }
        continue;
      }

      // Required validation (text / number)
      if (
        field.required &&
        (raw === undefined ||
          raw === null ||
          String(raw).trim() === "")
      ) {
        nextErrors[field._id] = "Required";
        continue;
      }

      // Number validation
      if (
        field.fieldType === "number" &&
        raw !== undefined &&
        raw !== "" &&
        isNaN(Number(raw))
      ) {
        nextErrors[field._id] = "Must be a number";
      }
    }

    setErrors(nextErrors);

    return Object.keys(nextErrors).length === 0;
  };

  // =========================================================
  // SUBMIT
  // =========================================================

  const handleSubmit = async () => {
    setSubmitError("");

    if (!validate()) return;

    setSubmitting(true);

    try {
      const answers = (form.fields || []).map((field) => ({
        fieldId: field._id,
        value:
          field.fieldType === "checkbox"
            ? !!values[field._id]
            : values[field._id] ?? "",
        remark: field.allowRemark ? remarks[field._id] || "" : "",
      }));

      const res = await api.post(
        `/forms/public/${slug}/submit`,
        {
          answers,
        }
      );

      setSuccessMessage(
        res.data?.message ||
          form.theme?.successMessage ||
          "Thank you! Your response has been recorded."
      );

      setSubmitted(true);
    } catch (error) {
      console.error("Form submission error:", error);

      setSubmitError(
        error?.response?.data?.message ||
          "Could not submit the form. Please try again."
      );
    } finally {
      setSubmitting(false);
    }
  };

  // =========================================================
  // ACCENT
  // =========================================================

  const accent =
    form?.theme?.primaryColor || "#7e22ce";

  // =========================================================
  // LOADING
  // =========================================================

  if (loadState === "loading") {
    return (
      <Box
        sx={{
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          bgcolor: "#faf9fb",
        }}
      >
        <CircularProgress
          sx={{
            color: "#7e22ce",
          }}
        />
      </Box>
    );
  }

  // =========================================================
  // NOT FOUND
  // =========================================================

  if (loadState === "notfound") {
    return (
      <Box
        sx={{
          minHeight: "100vh",
          bgcolor: "#faf9fb",
        }}
      >
        {isTeacher && <Navbar />}

        <Box
          sx={{
            minHeight: isTeacher
              ? "calc(100vh - 64px)"
              : "100vh",

            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            px: 2,
          }}
        >
          <Stack
            spacing={1.5}
            alignItems="center"
            textAlign="center"
          >
            <SentimentDissatisfied
              sx={{
                fontSize: 44,
                color: "text.disabled",
              }}
            />

            <Typography
              variant="h6"
              fontWeight={700}
            >
              This form is not available
            </Typography>

            <Typography
              variant="body2"
              color="text.secondary"
            >
              The link may be inactive, or the form was removed.
            </Typography>
          </Stack>
        </Box>
      </Box>
    );
  }

  // =========================================================
  // FORM CONTENT
  // =========================================================

  const renderField = (field) => {
    const value = values[field._id];
    const error = errors[field._id];

    if (field.fieldType === "rating") {
      return (
        <Box key={field._id}>
          <Typography variant="body2" fontWeight={600} sx={{ mb: 0.5 }}>
            {field.label}
            {field.required && (
              <Box component="span" sx={{ color: "error.main" }}>
                {" "}
                *
              </Box>
            )}
          </Typography>
          <Rating
            value={value ? Number(value) : null}
            onChange={(_e, newValue) => handleChange(field._id, newValue)}
            emptyIcon={<StarBorder fontSize="inherit" />}
            sx={{ color: accent }}
          />
          {error && (
            <FormHelperText error sx={{ ml: 0 }}>
              {error}
            </FormHelperText>
          )}
          {field.allowRemark && (
            <TextField
              placeholder="Add a remark (optional)"
              size="small"
              fullWidth
              multiline
              minRows={2}
              value={remarks[field._id] || ""}
              onChange={(e) => handleRemarkChange(field._id, e.target.value)}
              sx={{ mt: 1 }}
            />
          )}
        </Box>
      );
    }

    if (field.fieldType === "checkbox") {
      return (
        <Box key={field._id}>
          <FormControlLabel
            control={
              <Checkbox
                checked={!!value}
                onChange={(e) => handleChange(field._id, e.target.checked)}
                sx={{ color: accent, "&.Mui-checked": { color: accent } }}
              />
            }
            label={
              <Typography variant="body2" fontWeight={600}>
                {field.label}
                {field.required && (
                  <Box component="span" sx={{ color: "error.main" }}>
                    {" "}
                    *
                  </Box>
                )}
              </Typography>
            }
          />
          {error && (
            <FormHelperText error sx={{ ml: 4, mt: -0.5 }}>
              {error}
            </FormHelperText>
          )}
          {field.allowRemark && (
            <TextField
              placeholder="Add a remark (optional)"
              size="small"
              fullWidth
              multiline
              minRows={2}
              value={remarks[field._id] || ""}
              onChange={(e) => handleRemarkChange(field._id, e.target.value)}
              sx={{ mt: 1 }}
            />
          )}
        </Box>
      );
    }

    // text / number
    return (
      <Box key={field._id}>
        <TextField
          label={field.label}
          required={field.required}
          type={field.fieldType === "number" ? "number" : "text"}
          placeholder={field.placeholder || ""}
          fullWidth
          value={value ?? ""}
          onChange={(e) => handleChange(field._id, e.target.value)}
          error={!!error}
          helperText={error || " "}
          InputLabelProps={{
            shrink: field.fieldType === "number" ? true : undefined,
          }}
          sx={{
            "& .MuiOutlinedInput-root": {
              borderRadius: 1.5,
              "&.Mui-focused fieldset": { borderColor: accent },
            },
            "& .MuiInputLabel-root.Mui-focused": { color: accent },
          }}
        />
        {field.allowRemark && (
          <TextField
            placeholder="Add a remark (optional)"
            size="small"
            fullWidth
            multiline
            minRows={2}
            value={remarks[field._id] || ""}
            onChange={(e) => handleRemarkChange(field._id, e.target.value)}
            sx={{ mt: 1 }}
          />
        )}
      </Box>
    );
  };

  const FormContent = (
    <Box
      sx={{
        minHeight: isTeacher
          ? "calc(100vh - 64px)"
          : "100vh",

        bgcolor: "#faf9fb",

        py: {
          xs: 3,
          sm: 5,
          md: 6,
        },
      }}
    >
      <Container
        maxWidth="sm"
        sx={{
          px: {
            xs: 1.5,
            sm: 2,
          },
        }}
      >
        <Paper
          elevation={0}
          sx={{
            border:
              "1px solid #e2e8f0",

            borderRadius: {
              xs: 2,
              sm: 3,
            },

            overflow: "hidden",

            backgroundColor: "#FFFFFF",
          }}
        >
          {/* FORM HEADER */}

          <Box
            sx={{
              px: { xs: 2.5, sm: 4 },
              py: { xs: 2.5, sm: 3 },
              bgcolor: accent,
              color: "#FFFFFF",
            }}
          >
            {form.theme?.headerText && (
              <Typography
                fontSize="0.72rem"
                letterSpacing={0.5}
                sx={{
                  opacity: 0.85,
                  textTransform: "uppercase",
                  mb: 0.6,
                  fontWeight: 600,
                }}
              >
                {form.theme.headerText}
              </Typography>
            )}

            <Typography
              variant="h5"
              fontWeight={800}
              sx={{
                fontSize: { xs: "1.35rem", sm: "1.6rem" },
                lineHeight: 1.25,
              }}
            >
              {form.title}
            </Typography>

            {form.description && (
              <Typography
                variant="body2"
                sx={{ opacity: 0.9, mt: 0.8, lineHeight: 1.55 }}
              >
                {form.description}
              </Typography>
            )}
          </Box>

          {/* FORM BODY */}

          <Box
            sx={{
              px: { xs: 2.5, sm: 4 },
              py: { xs: 2.5, sm: 3.5 },
            }}
          >
            {submitted ? (
              <Stack
                spacing={1.5}
                alignItems="center"
                textAlign="center"
                sx={{ py: { xs: 3, sm: 4 } }}
              >
                <CheckCircleOutline sx={{ fontSize: 52, color: accent }} />
                <Typography variant="h6" fontWeight={700}>
                  Submitted
                </Typography>
                <Typography
                  variant="body2"
                  color="text.secondary"
                  sx={{ maxWidth: 420, lineHeight: 1.6 }}
                >
                  {successMessage}
                </Typography>
              </Stack>
            ) : (
              <Stack spacing={2.2}>
                {submitError && (
                  <Alert severity="error" sx={{ borderRadius: 1.5 }}>
                    {submitError}
                  </Alert>
                )}

                {(form.fields || []).map((field) => renderField(field))}

                <Button
                  variant="contained"
                  size="large"
                  fullWidth
                  onClick={handleSubmit}
                  disabled={submitting}
                  startIcon={
                    submitting ? <CircularProgress size={17} color="inherit" /> : null
                  }
                  sx={{
                    mt: 0.5,
                    minHeight: 48,
                    textTransform: "none",
                    fontWeight: 700,
                    borderRadius: 1.5,
                    bgcolor: accent,
                    boxShadow: "none",
                    "&:hover": { bgcolor: accent, filter: "brightness(0.92)", boxShadow: "none" },
                    "&:disabled": { bgcolor: accent, opacity: 0.7, color: "#FFFFFF" },
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

  if (isTeacher) {
    return (
      <>
        <Navbar />
        {FormContent}
      </>
    );
  }

  return FormContent;
}
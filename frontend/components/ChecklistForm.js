"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Checkbox,
  Grid,
  LinearProgress,
  Paper,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import {
  CheckCircle,
  Description,
  Save,
  Visibility,
  DeleteOutline,
} from "@mui/icons-material";
import { useRouter } from "next/navigation";
import { toast } from "react-toastify";
import api from "../lib/api";
import { useAuth } from "../context/AuthContext";

/* =====================================================
   CHECKLIST DEFINITION
===================================================== */
const sections = [
  {
    title: "Morning readiness check",
    timing: "0830–0900 hrs",
    items: [
      "Cleanliness of classrooms & workshop floor",
      "Cleanliness of washrooms & toilets",
      "Housekeeping staff attendance & task allocation",
      "Waste disposal & dustbin status",
      "Drinking water points & seating hygiene",
      "Trainee & trainer attendance",
    ],
  },
  {
    title: "Mid-day infrastructure & order inspection",
    timing: "1100–1300 hrs",
    items: [
      "Corridor, staircase & common area cleanliness",
      "Tools, machinery & equipment upkeep",
      "Furniture condition & orderly arrangement",
      "Electrical fittings, wiring & fixtures check",
      "Plumbing & water supply functionality",
    ],
  },
  {
    title: "Afternoon maintenance round",
    timing: "1400–1600 hrs",
    items: [
      "Overall upkeep of premises & campus grounds",
      "Garden/landscaping & external area maintenance",
      "Building repairs/damage requiring attention",
      "Housekeeping consumables stock (soap, phenyl, etc.)",
      "Fire safety & security equipment check",
    ],
  },
];

const createChecks = () =>
  sections.flatMap((section) =>
    section.items.map((label) => ({ label, checked: false, remark: "" })),
  );

// IST-correct "today" — server/browser UTC clock ko IST (UTC+5:30) mein shift karke date nikalta hai.
// Plain new Date().toISOString() raat 12:00–5:30 AM IST ke beech pichle din ki date de deta tha.
const getToday = () => {
  const now = new Date();
  const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;
  const ist = new Date(now.getTime() + IST_OFFSET_MS);
  return ist.toISOString().slice(0, 10);
};

const createForm = (userName) => ({
  date: getToday(),
  dutyOfficerName: userName || "",
  centreBatch: "",
  positiveObservations: "",
  hygieneLapses: "",
  maintenanceFollowUp: "",
  urgentMatters: "",
  signature: userName || "",
  countersignedBy: "",
});

const REQUIRED_TEXT_FIELDS = [
  "dutyOfficerName",
  "positiveObservations",
  "hygieneLapses",
  "maintenanceFollowUp",
  "urgentMatters",
  "signature",
  "countersignedBy",
];

const draftKeyFor = (date) => `dutyChecklistDraft_${date}`;

/* =====================================================
   COMPONENT
===================================================== */
export default function ChecklistForm() {
  const router = useRouter();
  const { user } = useAuth();

  const [form, setForm] = useState(() => createForm(user?.name));
  const [checks, setChecks] = useState(createChecks);
  const [touched, setTouched] = useState(false);

  const [saving, setSaving] = useState(false);
  const [savingDraft, setSavingDraft] = useState(false);
  const [draftRestored, setDraftRestored] = useState(false);

  const [error, setError] = useState("");

  // undefined = checking, null = not submitted today, object = already submitted
  const [todayReport, setTodayReport] = useState(undefined);

  const hasHydratedDraft = useRef(false);
  const autosaveTimer = useRef(null);

  useEffect(() => {
    api
      .get("/reports/today")
      .then((res) => setTodayReport(res.data))
      .catch(() => setTodayReport(null));
  }, []);

  // Load a saved draft (if any) for today's date once we know no report is already submitted
  useEffect(() => {
    if (todayReport !== null || hasHydratedDraft.current) return;
    hasHydratedDraft.current = true;

    try {
      const raw = localStorage.getItem(draftKeyFor(getToday()));
      if (!raw) return;

      const draft = JSON.parse(raw);
      if (draft?.form) setForm((prev) => ({ ...prev, ...draft.form }));
      if (Array.isArray(draft?.checks) && draft.checks.length === checks.length) {
        setChecks(draft.checks);
      }
      setDraftRestored(true);
    } catch {
      // corrupted draft, ignore silently
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [todayReport]);

  // Debounced autosave to localStorage on every change, so an accidental
  // tab/window close doesn't lose progress.
  useEffect(() => {
    if (todayReport) return; // don't autosave once already submitted
    if (autosaveTimer.current) clearTimeout(autosaveTimer.current);

    autosaveTimer.current = setTimeout(() => {
      try {
        localStorage.setItem(
          draftKeyFor(form.date || getToday()),
          JSON.stringify({ form, checks, savedAt: new Date().toISOString() }),
        );
      } catch {
        // localStorage full/unavailable — fail silently, not critical
      }
    }, 800);

    return () => clearTimeout(autosaveTimer.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form, checks, todayReport]);

  const completed = useMemo(
    () => checks.filter((c) => c.checked).length,
    [checks],
  );
  const total = checks.length;
  const percentage = total > 0 ? Math.round((completed / total) * 100) : 0;

  const fieldErrors = useMemo(() => {
    const errs = {};
    if (!touched) return errs;
    REQUIRED_TEXT_FIELDS.forEach((key) => {
      if (!form[key]?.trim()) errs[key] = "This field is required";
    });
    return errs;
  }, [form, touched]);

  const allChecksTicked = completed === total;
  const isValid =
    REQUIRED_TEXT_FIELDS.every((key) => form[key]?.trim()) && allChecksTicked;

  const updateForm = (field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    setError("");
  };

  const updateCheck = (index, patch) => {
    setChecks((prev) =>
      prev.map((item, i) => (i === index ? { ...item, ...patch } : item)),
    );
    setError("");
  };

  const clearDraft = () => {
    try {
      localStorage.removeItem(draftKeyFor(form.date || getToday()));
    } catch {
      // ignore
    }
  };

  const saveAsDraft = () => {
    setSavingDraft(true);
    try {
      localStorage.setItem(
        draftKeyFor(form.date || getToday()),
        JSON.stringify({ form, checks, savedAt: new Date().toISOString() }),
      );
      toast.success("Draft saved — you can resume this later.");
    } catch {
      toast.error("Could not save draft on this device.");
    } finally {
      setSavingDraft(false);
    }
  };

  const discardDraft = () => {
    clearDraft();
    setForm(createForm(user?.name));
    setChecks(createChecks());
    setDraftRestored(false);
    toast.info("Draft discarded.");
  };

  const submit = async (e) => {
    e.preventDefault();
    setTouched(true);
    setError("");

    if (!isValid) {
      const validationMessage = !allChecksTicked
        ? "Please tick every checklist item before submitting."
        : "Please fill in all required fields.";

      setError(validationMessage);
      toast.error(validationMessage);
      return;
    }

    try {
      setSaving(true);

      // group checks back into sections for the API (Report model expects 3 arrays)
      const morningChecks = checks.slice(0, sections[0].items.length);
      const middayChecks = checks.slice(
        sections[0].items.length,
        sections[0].items.length + sections[1].items.length,
      );
      const afternoonChecks = checks.slice(
        sections[0].items.length + sections[1].items.length,
      );

      const { data } = await api.post("/reports", {
        date: form.date,
        dutyOfficerName: form.dutyOfficerName,
        centreBatch: form.centreBatch,
        morningChecks,
        middayChecks,
        afternoonChecks,
        positiveObservations: form.positiveObservations,
        hygieneLapses: form.hygieneLapses,
        maintenanceFollowUp: form.maintenanceFollowUp,
        urgentMatters: form.urgentMatters,
        signature: form.signature,
        countersignedBy: form.countersignedBy,
      });

      clearDraft();
      toast.success("Thank you for your contribution!");
      setTodayReport(data);
      setTimeout(() => router.push("/teacher/dashboard"), 900);
    } catch (err) {
      if (err?.response?.status === 409) {
        const conflictMessage =
          err?.response?.data?.message ||
          "A report for this date has already been submitted.";

        toast.error(conflictMessage);

        if (err?.response?.data?.report) {
          setTodayReport(err.response.data.report);
          clearDraft();
        }
      } else {
        toast.error(err?.response?.data?.message || "Could not save report.");
      }
    } finally {
      setSaving(false);
    }
  };

  // still checking today's status
  if (todayReport === undefined) {
    return (
      <Box sx={{ display: "flex", justifyContent: "center", py: 6 }}>
        <CircularProgress />
      </Box>
    );
  }

  // already submitted today — view only
  if (todayReport) {
    return (
      <Box sx={{ maxWidth: 500, mx: "auto", p: { xs: 1.5, sm: 3 } }}>
        <Paper
          elevation={0}
          sx={{
            p: 3,
            textAlign: "center",
            border: "1px solid #e2e8f0",
            borderRadius: 2.5,
          }}
        >
          <CheckCircle sx={{ fontSize: 40, color: "#7e22ce", mb: 1 }} />
          <Typography fontWeight={700} mb={0.5}>
            Thank you for your contribution!
          </Typography>
          <Typography variant="body2" color="text.secondary" mb={2}>
            You've already submitted today's checklist. You can only view it
            now.
          </Typography>
          <Button
            variant="outlined"
            startIcon={<Visibility />}
            onClick={() => router.push(`/teacher/report/${todayReport._id}`)}
          >
            View Submitted Report
          </Button>
        </Paper>
      </Box>
    );
  }

  let cursor = 0;

  return (
    <Box
      component="form"
      onSubmit={submit}
      sx={{ maxWidth: 900, mx: "auto", p: { xs: 1.5, sm: 3 } }}
    >
      <Stack spacing={2.5}>
        {/* HEADER */}
        <Paper
          elevation={0}
          sx={{
            border: "1px solid #e5e7eb",
            borderRadius: 2,
            overflow: "hidden",
          }}
        >
          <Box
            sx={{
              p: { xs: 2.5, sm: 3 },
              background: "linear-gradient(135deg, #7e22ce 0%, #4c1d95 100%)",
              color: "white",
            }}
          >
            <Stack direction="row" alignItems="center" spacing={1.5}>
              <Box
                sx={{
                  width: 42,
                  height: 42,
                  borderRadius: 2,
                  bgcolor: "rgba(255,255,255,0.15)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                }}
              >
                <Description />
              </Box>
              <Box>
                <Typography variant="h5" fontWeight={800}>
                  Duty Officer's Inspection Checklist
                </Typography>
                <Typography variant="body2" sx={{ opacity: 0.9, mt: 0.3 }}>
                  To be completed by the Duty Officer at the end of the day —
                  all fields are required
                </Typography>
              </Box>
            </Stack>
          </Box>
        </Paper>

        {draftRestored && (
          <Alert
            severity="info"
            action={
              <Button
                size="small"
                color="inherit"
                startIcon={<DeleteOutline />}
                onClick={discardDraft}
              >
                Discard draft
              </Button>
            }
          >
            A saved draft from earlier was restored. Continue where you left
            off, or discard it to start fresh.
          </Alert>
        )}

        {error && (
          <Alert severity="error" onClose={() => setError("")}>
            {error}
          </Alert>
        )}

        {/* BASIC INFO */}
        <Paper
          elevation={0}
          sx={{
            p: { xs: 2, sm: 2.5 },
            border: "1px solid #e2e8f0",
            borderRadius: 2.5,
          }}
        >
          <Grid container spacing={2}>
            <Grid item xs={12} sm={6}>
              <TextField
                label="Date"
                type="date"
                fullWidth
                required
                value={form.date}
                inputProps={{
                  min: getToday(),
                  max: getToday(),
                }}
                onChange={(e) => {
                  const value = e.target.value;

                  // Sirf aaj ki date allow
                  if (value === getToday()) {
                    updateForm("date", value);
                  }
                }}
                InputLabelProps={{ shrink: true }}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                label="Name of Duty Officer"
                fullWidth
                required
                value={form.dutyOfficerName}
                onChange={(e) => updateForm("dutyOfficerName", e.target.value)}
                error={!!fieldErrors.dutyOfficerName}
                helperText={fieldErrors.dutyOfficerName}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                label="Centre / Batch covered"
                placeholder="e.g. SDC Khurja"
                fullWidth
                value={form.centreBatch}
                onChange={(e) => updateForm("centreBatch", e.target.value)}
              />
            </Grid>
          </Grid>
        </Paper>

        {/* PROGRESS */}
        <Paper
          elevation={0}
          sx={{
            p: { xs: 1.5, sm: 2 },
            border: "1px solid #e2e8f0",
            borderRadius: 2.5,
          }}
        >
          <Stack
            direction="row"
            justifyContent="space-between"
            alignItems="center"
            mb={1}
          >
            <Box>
              <Typography fontWeight={700} fontSize="0.95rem">
                Inspection Progress
              </Typography>
              <Typography variant="caption" color="text.secondary">
                Every item must be ticked before you can submit
              </Typography>
            </Box>
            <Chip
              label={`${completed}/${total}`}
              color={allChecksTicked ? "success" : "warning"}
              icon={allChecksTicked ? <CheckCircle /> : undefined}
              sx={{ fontWeight: 700 }}
            />
          </Stack>
          <LinearProgress
            variant="determinate"
            value={percentage}
            sx={{
              height: 8,
              borderRadius: 10,
              bgcolor: "#f1f5f9",
              "& .MuiLinearProgress-bar": {
                bgcolor: "#7e22ce",
                borderRadius: 10,
              },
            }}
          />
          <Typography
            variant="caption"
            color="text.secondary"
            sx={{ display: "block", mt: 0.7, textAlign: "right" }}
          >
            {percentage}% completed
          </Typography>
        </Paper>

        {/* CHECKLIST SECTIONS */}
        {sections.map((section) => (
          <Paper
            key={section.title}
            elevation={0}
            sx={{
              border: "1px solid #e2e8f0",
              borderRadius: 2.5,
              overflow: "hidden",
            }}
          >
            <Box sx={{ px: { xs: 1.2, sm: 2 } }}>
              {section.items.map((label) => {
                const index = cursor++;
                const item = checks[index];
                const showWarn = touched && !item.checked;
                return (
                  <Box
                    key={label}
                    sx={{
                      py: 1.4,
                      borderBottom: "1px solid #f1f5f9",
                      "&:last-child": { borderBottom: "none" },
                    }}
                  >
                    <Stack
                      direction="row"
                      alignItems="flex-start"
                      spacing={0.5}
                    >
                      <Checkbox
                        checked={item.checked}
                        onChange={(e) =>
                          updateCheck(index, { checked: e.target.checked })
                        }
                        sx={{
                          p: 0.5,
                          mt: -0.2,
                          color: showWarn ? "#f87171" : "#c4b5fd",
                          "&.Mui-checked": { color: "#7e22ce" },
                        }}
                      />
                      <Typography
                        fontSize="0.9rem"
                        fontWeight={item.checked ? 600 : 500}
                        sx={{
                          pt: 0.4,
                          color: item.checked ? "#334155" : "#475569",
                        }}
                      >
                        {label}{" "}
                        <Typography
                          component="span"
                          color="error"
                          fontSize="0.8rem"
                        >
                          *
                        </Typography>
                      </Typography>
                    </Stack>
                    <TextField
                      fullWidth
                      size="small"
                      placeholder="Add remarks (optional)"
                      value={item.remark}
                      onChange={(e) =>
                        updateCheck(index, { remark: e.target.value })
                      }
                      sx={{
                        mt: 1,
                        ml: { xs: 4.5, sm: 5 },
                        width: {
                          xs: "calc(100% - 36px)",
                          sm: "calc(100% - 40px)",
                        },
                        "& .MuiOutlinedInput-root": { bgcolor: "#fafafa" },
                      }}
                    />
                  </Box>
                );
              })}
            </Box>
          </Paper>
        ))}

        {/* OBSERVATIONS */}
        <Paper
          elevation={0}
          sx={{
            p: { xs: 1.5, sm: 2.5 },
            border: "1px solid #e2e8f0",
            borderRadius: 2.5,
          }}
        >
          <Typography fontWeight={800} color="#6b21a8" mb={0.5}>
            4. Summary of Key Observations
          </Typography>
          <Typography
            variant="caption"
            color="text.secondary"
            display="block"
            mb={2}
          >
            All fields below are required.
          </Typography>
          <Stack spacing={1.8}>
            <TextField
              fullWidth
              multiline
              minRows={2}
              required
              label="Major positive observations"
              value={form.positiveObservations}
              onChange={(e) =>
                updateForm("positiveObservations", e.target.value)
              }
              error={!!fieldErrors.positiveObservations}
              helperText={fieldErrors.positiveObservations}
            />
            <TextField
              fullWidth
              multiline
              minRows={2}
              required
              label="Cleanliness / hygiene lapses noted"
              value={form.hygieneLapses}
              onChange={(e) => updateForm("hygieneLapses", e.target.value)}
              error={!!fieldErrors.hygieneLapses}
              helperText={fieldErrors.hygieneLapses}
            />
            <TextField
              fullWidth
              multiline
              minRows={2}
              required
              label="Maintenance items needing follow-up action"
              value={form.maintenanceFollowUp}
              onChange={(e) =>
                updateForm("maintenanceFollowUp", e.target.value)
              }
              error={!!fieldErrors.maintenanceFollowUp}
              helperText={fieldErrors.maintenanceFollowUp}
            />
          </Stack>
        </Paper>

        {/* URGENT MATTERS */}
        <Paper
          elevation={0}
          sx={{
            p: { xs: 1.5, sm: 2.5 },
            border: "1px solid #fecaca",
            borderRadius: 2.5,
          }}
        >
          <Typography fontWeight={800} color="#b91c1c" mb={0.5}>
            5. Urgent Matters
          </Typography>
          <Typography
            variant="caption"
            color="text.secondary"
            display="block"
            mb={1.5}
          >
            Required — write "None" if there is nothing urgent to report.
          </Typography>
          <TextField
            fullWidth
            multiline
            minRows={2}
            required
            placeholder='Mention urgent issue, or type "None"'
            value={form.urgentMatters}
            onChange={(e) => updateForm("urgentMatters", e.target.value)}
            error={!!fieldErrors.urgentMatters}
            helperText={fieldErrors.urgentMatters}
            sx={{ "& .MuiOutlinedInput-root": { bgcolor: "#fff8f7" } }}
          />
        </Paper>

        {/* SIGNATURE */}
        <Paper
          elevation={0}
          sx={{
            p: { xs: 1.5, sm: 2.5 },
            border: "1px solid #e2e8f0",
            borderRadius: 2.5,
          }}
        >
          <Typography fontWeight={800} color="#6b21a8" mb={2}>
            Verification
          </Typography>
          <Grid container spacing={1.8}>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                required
                label="Signature of Duty Officer"
                value={form.signature}
                onChange={(e) => updateForm("signature", e.target.value)}
                error={!!fieldErrors.signature}
                helperText={fieldErrors.signature}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                required
                label="Countersigned by"
                placeholder="Type name"
                value={form.countersignedBy}
                onChange={(e) => updateForm("countersignedBy", e.target.value)}
                error={!!fieldErrors.countersignedBy}
                helperText={fieldErrors.countersignedBy}
              />
            </Grid>
          </Grid>
        </Paper>

        {/* STICKY-STYLE SUBMIT BAR */}
        <Paper
          elevation={0}
          sx={{
            p: { xs: 1.5, sm: 2 },
            border: "1px solid #e5e7eb",
            borderRadius: 2.5,
            position: "sticky",
            bottom: 8,
            bgcolor: "#fff",
            boxShadow: "0 -4px 12px rgba(15,23,42,0.06)",
          }}
        >
          <Stack
            direction={{ xs: "column", sm: "row" }}
            justifyContent="flex-end"
            spacing={1.2}
          >
            <Button
              type="button"
              variant="outlined"
              size="large"
              disabled={savingDraft || saving}
              onClick={saveAsDraft}
              startIcon={
                savingDraft ? (
                  <CircularProgress size={18} color="inherit" />
                ) : (
                  <Save />
                )
              }
              sx={{
                minWidth: { xs: "100%", sm: 180 },
                borderColor: "#7e22ce",
                color: "#7e22ce",
                fontWeight: 700,
                "&:hover": { borderColor: "#6b21a8", bgcolor: "#faf5ff" },
              }}
            >
              {savingDraft ? "Saving..." : "Save as Draft"}
            </Button>
            <Button
              type="submit"
              variant="contained"
              size="large"
              disabled={saving}
              startIcon={
                saving ? (
                  <CircularProgress size={18} color="inherit" />
                ) : (
                  <Save />
                )
              }
              sx={{
                minWidth: { xs: "100%", sm: 200 },
                bgcolor: "#7e22ce",
                fontWeight: 700,
                "&:hover": { bgcolor: "#6b21a8" },
              }}
            >
              {saving ? "Submitting..." : "Submit Report"}
            </Button>
          </Stack>
        </Paper>
      </Stack>
    </Box>
  );
}
"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  Alert, Box, Button, Checkbox, CircularProgress, Grid, LinearProgress,
  Paper, Stack, TextField, Typography, Chip,
} from "@mui/material";
import { CheckCircle, DeleteOutline, Description, Visibility } from "@mui/icons-material";
import { useRouter } from "next/navigation";
import { toast } from "react-toastify";
import api from "../lib/api";
import { useAuth } from "../context/AuthContext";

const getToday = () => {
  const now = new Date();
  return new Date(now.getTime() + 5.5 * 60 * 60 * 1000).toISOString().slice(0, 10);
};

// NEW: default labels for fixed fields — must match backend DEFAULT_FIXED_FIELDS.
const FIXED_FIELD_DEFAULTS = {
  positiveObservations: "Major positive observations",
  hygieneLapses: "Cleanliness / hygiene lapses",
  maintenanceFollowUp: "Maintenance follow-up",
  urgentMatters: "Urgent matters",
  signature: "Signature of Duty Officer",
  countersignedBy: "Countersigned by",
};

const normalizeSections = (sections = []) => sections.map((s, si) => ({
  key: s?.key || `section_${si + 1}`,
  title: s?.title || `Section ${si + 1}`,
  timing: s?.timing || "",
  items: Array.isArray(s?.items) ? s.items.map((item, ii) => ({
    key: item?.key || `${s?.key || `section_${si + 1}`}_item_${ii + 1}`,
    label: item?.label || "",
    checked: !!item?.checked,
    remark: item?.remark || "",
    status: item?.status === "resolved" ? "resolved" : "open",
    adminRemark: item?.adminRemark || "",
    followed: !!item?.followed,
  })) : [],
}));

const createForm = (name) => ({
  date: getToday(),
  dutyOfficerName: name || "",
  shiftTiming: "",
  centreBatch: "",
  positiveObservations: "",
  hygieneLapses: "",
  maintenanceFollowUp: "",
  urgentMatters: "",
  signature: name || "",
  countersignedBy: "",
});

const draftKey = (date) => `dutyChecklistDraft_${date}`;

export default function ChecklistForm() {
  const router = useRouter();
  const { user } = useAuth();
  const [template, setTemplate] = useState(null);
  const [sections, setSections] = useState([]);
  const [form, setForm] = useState(() => createForm(user?.name));
  const [todayReport, setTodayReport] = useState(undefined);
  const [touched, setTouched] = useState(false);
  const [saving, setSaving] = useState(false);
  const [draftRestored, setDraftRestored] = useState(false);
  const [error, setError] = useState("");
  const hydrated = useRef(false);
  const timer = useRef(null);

  useEffect(() => {
    if (user?.name) setForm((p) => ({ ...p, dutyOfficerName: p.dutyOfficerName || user.name, signature: p.signature || user.name }));
  }, [user?.name]);

  useEffect(() => {
    Promise.all([
      api.get("/reports/template"),
      api.get("/reports/today"),
    ]).then(([templateRes, todayRes]) => {
      const t = templateRes?.data || {};
      setTemplate(t);
      setSections(normalizeSections(t.sections || []));
      setTodayReport(todayRes?.data || null);
    }).catch((err) => {
      setError(err?.response?.data?.message || "Could not load the daily report form.");
      setTodayReport(null);
    });
  }, []);

  useEffect(() => {
    if (todayReport !== null || !template || hydrated.current) return;
    hydrated.current = true;
    try {
      const raw = localStorage.getItem(draftKey(getToday()));
      if (!raw) return;
      const d = JSON.parse(raw);
      if (d?.form) setForm((p) => ({ ...p, ...d.form }));
      if (Array.isArray(d?.sections)) setSections(normalizeSections(d.sections));
      setDraftRestored(true);
    } catch {}
  }, [todayReport, template]);

  useEffect(() => {
    if (todayReport || !sections.length) return;
    clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      try { localStorage.setItem(draftKey(form.date || getToday()), JSON.stringify({ form, sections, savedAt: new Date().toISOString() })); } catch {}
    }, 700);
    return () => clearTimeout(timer.current);
  }, [form, sections, todayReport]);

  // NEW: resolve label + enabled state for a fixed field, falling back to defaults.
  const fixedFields = template?.fixedFields || {};
  const fieldLabel = (key) => fixedFields[key]?.label || FIXED_FIELD_DEFAULTS[key];
  const fieldEnabled = (key) => fixedFields[key]?.enabled !== false;

  // CHANGED: required list is now dynamic — disabled fixed fields are not required.
  const required = useMemo(() => {
    const base = ["dutyOfficerName"];
    Object.keys(FIXED_FIELD_DEFAULTS).forEach((key) => {
      if (fieldEnabled(key)) base.push(key);
    });
    return base;
  }, [template]);

  const allItems = useMemo(() => sections.flatMap((s) => s.items || []), [sections]);
  const completed = allItems.filter((i) => i.checked).length;
  const total = allItems.length;
  const percent = total ? Math.round((completed / total) * 100) : 0;
  const errors = useMemo(() => touched
    ? Object.fromEntries(required.filter((k) => !String(form[k] ?? "").trim()).map((k) => [k, "This field is required"]))
    : {}, [form, touched, required]);

  const updateForm = (key, value) => { setForm((p) => ({ ...p, [key]: value })); setError(""); };
  const updateItem = (sectionIndex, itemIndex, patch) => {
    setSections((prev) => prev.map((section, si) => si !== sectionIndex ? section : {
      ...section,
      items: section.items.map((item, ii) => ii !== itemIndex ? item : { ...item, ...patch }),
    }));
    setError("");
  };

  const clearDraft = () => { try { localStorage.removeItem(draftKey(form.date || getToday())); } catch {} };
  const discardDraft = () => {
    clearDraft();
    setForm(createForm(user?.name));
    setSections(normalizeSections(template?.sections || []));
    setTouched(false); setDraftRestored(false); setError("");
    toast.info("Draft discarded.");
  };

  const submit = async (e) => {
    e.preventDefault();
    setTouched(true); setError("");

    const missing = required.filter((k) => !String(form[k] ?? "").trim());
    if (missing.length || completed !== total) {
      const msg = completed !== total ? "Please tick every checklist item before submitting." : "Please fill in all required fields.";
      setError(msg); toast.error(msg); return;
    }

    try {
      setSaving(true);
      const { data } = await api.post("/reports", {
        ...form,
        dutyOfficerName: form.dutyOfficerName.trim(),
        sections,
      });
      const report = data?.report || data?.data?.report || data?.data || data;
      clearDraft(); setTodayReport(report);
      toast.success("Daily report submitted successfully.");
      setTimeout(() => router.push(`/teacher/report/${report._id}`), 700);
    } catch (err) {
      if (err?.response?.status === 409) {
        toast.error(err.response.data?.message || "A report for this date has already been submitted.");
        if (err.response.data?.report) { setTodayReport(err.response.data.report); clearDraft(); }
      } else toast.error(err?.response?.data?.message || "Could not save report.");
    } finally { setSaving(false); }
  };

  if (todayReport === undefined || !template) return <Box sx={{ display: "flex", justifyContent: "center", py: 7 }}><CircularProgress /></Box>;

  if (todayReport) return (
    <Box sx={{ maxWidth: 560, mx: "auto", p: { xs: 1.5, sm: 3 } }}>
      <Paper elevation={0} sx={{ p: 3, textAlign: "center", border: "1px solid #e2e8f0", borderRadius: 3 }}>
        <CheckCircle sx={{ fontSize: 46, color: "#7e22ce", mb: 1 }} />
        <Typography fontWeight={800} mb={0.6}>Today's report is already submitted</Typography>
        <Typography variant="body2" color="text.secondary" mb={2}>You can view the complete report and admin remarks.</Typography>
        <Button fullWidth variant="contained" startIcon={<Visibility />} onClick={() => router.push(`/teacher/report/${todayReport._id}`)}>View Submitted Report</Button>
      </Paper>
    </Box>
  );

  return (
    <Box component="form" onSubmit={submit} sx={{ maxWidth: 920, mx: "auto", p: { xs: 1.2, sm: 3 }, pb: 11 }}>
      <Stack spacing={2}>
        <Paper elevation={0} sx={{ border: "1px solid #e5e7eb", borderRadius: 2.5, overflow: "hidden" }}>
          <Box sx={{ p: { xs: 2, sm: 2.7 }, background: "linear-gradient(135deg,#7e22ce,#4c1d95)", color: "white" }}>
            <Stack direction="row" spacing={1.4} alignItems="center"><Description /><Box><Typography fontWeight={800} fontSize={{ xs: "1.1rem", sm: "1.4rem" }}>Duty Officer's Inspection Checklist</Typography><Typography variant="body2" sx={{ opacity: .9 }}>Complete all checklist items before submitting.</Typography></Box></Stack>
          </Box>
        </Paper>

        {draftRestored && <Alert severity="info" action={<Button size="small" color="inherit" startIcon={<DeleteOutline />} onClick={discardDraft}>Discard</Button>}>Saved draft restored.</Alert>}
        {error && <Alert severity="error">{error}</Alert>}

        <Paper elevation={0} sx={{ p: { xs: 1.5, sm: 2.3 }, border: "1px solid #e2e8f0", borderRadius: 2.5 }}>
          <Typography fontWeight={800} color="#6b21a8" mb={1.5}>Basic Information</Typography>
          <Grid container spacing={1.5}>
            <Grid item xs={12} sm={6}><TextField fullWidth size="small" label="Date" type="date" required value={form.date} inputProps={{ min: getToday(), max: getToday() }} onChange={(e) => e.target.value === getToday() && updateForm("date", e.target.value)} InputLabelProps={{ shrink: true }} /></Grid>
            <Grid item xs={12} sm={6}><TextField fullWidth size="small" label="Name of Duty Officer" required value={form.dutyOfficerName} onChange={(e) => updateForm("dutyOfficerName", e.target.value)} error={!!errors.dutyOfficerName} helperText={errors.dutyOfficerName} /></Grid>
            <Grid item xs={12} sm={6}><TextField fullWidth size="small" label="Shift / Timing" placeholder="e.g. 08:30 AM – 04:30 PM" value={form.shiftTiming} onChange={(e) => updateForm("shiftTiming", e.target.value)} /></Grid>
            <Grid item xs={12} sm={6}><TextField fullWidth size="small" label="Centre / Batch" value={form.centreBatch} onChange={(e) => updateForm("centreBatch", e.target.value)} /></Grid>
          </Grid>
        </Paper>

        <Paper elevation={0} sx={{ p: { xs: 1.5, sm: 2.3 }, border: "1px solid #e2e8f0", borderRadius: 2.5 }}>
          <Stack spacing={2}>
            <Box><Typography fontWeight={800} color="#6b21a8">Inspection Checklist</Typography><Stack direction="row" spacing={1} alignItems="center" mt={0.8}><Chip size="small" label={`${completed}/${total} completed`} /><Typography variant="caption" color="text.secondary">{percent}%</Typography></Stack><LinearProgress variant="determinate" value={percent} sx={{ mt: 0.8, height: 6, borderRadius: 3 }} /></Box>

            {sections.map((section, si) => (
              <Paper key={section.key} variant="outlined" sx={{ overflow: "hidden", borderRadius: 2 }}>
                <Box sx={{ px: 1.5, py: 1.1, bgcolor: "#f5f3ff", borderBottom: "1px solid #ddd6fe" }}>
                  <Typography fontWeight={800} fontSize="0.88rem" color="#5b21b6">{section.title}</Typography>
                  {section.timing && <Typography variant="caption" color="text.secondary">{section.timing}</Typography>}
                </Box>
                <Stack divider={<Box sx={{ borderBottom: "1px solid #f1f5f9" }} />}>
                  {(section.items || []).map((item, ii) => (
                    <Box key={item.key || ii} sx={{ p: 1.25 }}>
                      <Stack direction="row" spacing={1} alignItems="flex-start">
                        <Checkbox checked={!!item.checked} onChange={(e) => updateItem(si, ii, { checked: e.target.checked })} sx={{ p: 0.2, mt: 0.15 }} />
                        <Box sx={{ flex: 1 }}>
                          <Typography fontSize="0.82rem" fontWeight={600}>{item.label}</Typography>
                          <TextField fullWidth size="small" multiline minRows={1} sx={{ mt: 0.8 }} label="Remark (optional)" value={item.remark || ""} onChange={(e) => updateItem(si, ii, { remark: e.target.value })} />
                        </Box>
                      </Stack>
                    </Box>
                  ))}
                </Stack>
              </Paper>
            ))}
          </Stack>
        </Paper>

        {/* CHANGED: labels now come from template.fixedFields (fallback to defaults), disabled fields are hidden */}
        <Paper elevation={0} sx={{ p: { xs: 1.5, sm: 2.3 }, border: "1px solid #e2e8f0", borderRadius: 2.5 }}>
          <Typography fontWeight={800} color="#6b21a8" mb={1.5}>Summary & Follow-up</Typography>
          <Stack spacing={1.4}>
            {fieldEnabled("positiveObservations") && (
              <TextField fullWidth multiline minRows={2} label={fieldLabel("positiveObservations")} required value={form.positiveObservations} onChange={(e) => updateForm("positiveObservations", e.target.value)} error={!!errors.positiveObservations} helperText={errors.positiveObservations} />
            )}
            {fieldEnabled("hygieneLapses") && (
              <TextField fullWidth multiline minRows={2} label={fieldLabel("hygieneLapses")} required value={form.hygieneLapses} onChange={(e) => updateForm("hygieneLapses", e.target.value)} error={!!errors.hygieneLapses} helperText={errors.hygieneLapses} />
            )}
            {fieldEnabled("maintenanceFollowUp") && (
              <TextField fullWidth multiline minRows={2} label={fieldLabel("maintenanceFollowUp")} required value={form.maintenanceFollowUp} onChange={(e) => updateForm("maintenanceFollowUp", e.target.value)} error={!!errors.maintenanceFollowUp} helperText={errors.maintenanceFollowUp} />
            )}
            {fieldEnabled("urgentMatters") && (
              <TextField fullWidth multiline minRows={2} label={fieldLabel("urgentMatters")} required value={form.urgentMatters} onChange={(e) => updateForm("urgentMatters", e.target.value)} error={!!errors.urgentMatters} helperText={errors.urgentMatters || "Write None if there are no urgent matters."} />
            )}
          </Stack>
        </Paper>

        {/* CHANGED: same dynamic label/enabled treatment for Verification fields */}
        {(fieldEnabled("signature") || fieldEnabled("countersignedBy")) && (
          <Paper elevation={0} sx={{ p: { xs: 1.5, sm: 2.3 }, border: "1px solid #e2e8f0", borderRadius: 2.5 }}>
            <Typography fontWeight={800} color="#6b21a8" mb={1.5}>Verification</Typography>
            <Grid container spacing={1.5}>
              {fieldEnabled("signature") && (
                <Grid item xs={12} sm={6}><TextField fullWidth size="small" label={fieldLabel("signature")} required value={form.signature} onChange={(e) => updateForm("signature", e.target.value)} error={!!errors.signature} helperText={errors.signature} /></Grid>
              )}
              {fieldEnabled("countersignedBy") && (
                <Grid item xs={12} sm={6}><TextField fullWidth size="small" label={fieldLabel("countersignedBy")} required value={form.countersignedBy} onChange={(e) => updateForm("countersignedBy", e.target.value)} error={!!errors.countersignedBy} helperText={errors.countersignedBy} /></Grid>
              )}
            </Grid>
          </Paper>
        )}

        <Paper elevation={3} sx={{ position: "fixed", left: 0, right: 0, bottom: 0, zIndex: 1200, borderRadius: 0, borderTop: "1px solid #e2e8f0", bgcolor: "rgba(255,255,255,.96)", backdropFilter: "blur(10px)" }}>
          <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ maxWidth: 920, mx: "auto", p: 1.1, px: { xs: 1.2, sm: 3 } }}>
            <Box><Typography fontSize="0.76rem" fontWeight={700}>{completed}/{total} completed</Typography><Typography variant="caption" color="text.secondary">All checklist items are required.</Typography></Box>
            <Button type="submit" variant="contained" disabled={saving || !total} startIcon={saving ? <CircularProgress size={15} color="inherit" /> : <CheckCircle />} sx={{ textTransform: "none", fontWeight: 700 }}>Submit Daily Report</Button>
          </Stack>
        </Paper>
      </Stack>
    </Box>
  );
}
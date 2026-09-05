"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  Alert,
  Box,
  Button,
  Checkbox,
  Chip,
  CircularProgress,
  Divider,
  Grid,
  Paper,
  Stack,
  Typography,
} from "@mui/material";
import { ArrowBack, CheckCircle, Description } from "@mui/icons-material";
import api from "../../../../lib/api";

const BASE_SECTIONS = [
  { title: "Morning readiness check", key: "morningChecks" },
  { title: "Mid-day infrastructure & order inspection", key: "middayChecks" },
  { title: "Afternoon maintenance round", key: "afternoonChecks" },
];

function getSections(report) {
  if (Array.isArray(report?.sections) && report.sections.length) {
    return report.sections.map((section, index) => ({
      ...section,
      key: section?.key || `section_${index + 1}`,
      title: section?.title || `Section ${index + 1}`,
      timing: section?.timing || "",
      items: Array.isArray(section?.items) ? section.items : [],
    }));
  }

  const meta = report?.sectionMeta || {};
  return [
    ...BASE_SECTIONS.map((section) => ({
      ...section,
      title: meta?.[section.key]?.title || section.title,
      timing: meta?.[section.key]?.timing || "",
      items: Array.isArray(report?.[section.key]) ? report[section.key] : [],
    })),
    ...(Array.isArray(report?.customSections) ? report.customSections : []).map((section, index) => ({
      ...section,
      key: section?.key || `custom_${index}`,
      title: section?.title || `Custom Section ${index + 1}`,
      timing: section?.timing || "",
      items: Array.isArray(section?.items) ? section.items : [],
    })),
  ];
}

function displayValue(value) {
  if (value === null || value === undefined || value === "") return "—";
  if (typeof value === "boolean") return value ? "Yes" : "No";
  return String(value);
}

function formatCustomField(field) {
  if (field?.type === "checkbox") return field.value ? "Yes" : "No";
  return displayValue(field?.value);
}

export default function ReportViewPage() {
  const { id } = useParams();
  const router = useRouter();

  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!id) return;

    api
      .get(`/reports/${id}`)
      .then((res) => {
        const data = res?.data?.report || res?.data?.data?.report || res?.data?.data || res?.data;
        setReport(data);
      })
      .catch((err) => setError(err?.response?.data?.message || "Could not load report."))
      .finally(() => setLoading(false));
  }, [id]);

  const sections = useMemo(() => getSections(report), [report]);
  const customFields = Array.isArray(report?.customFields) ? report.customFields : [];

  if (loading) {
    return (
      <Box sx={{ display: "flex", justifyContent: "center", py: 8 }}>
        <CircularProgress />
      </Box>
    );
  }

  if (error || !report) {
    return (
      <Box sx={{ maxWidth: 600, mx: "auto", p: 3 }}>
        <Alert severity="error">{error || "Report not found."}</Alert>
      </Box>
    );
  }

  return (
    <Box sx={{ maxWidth: 980, mx: "auto", p: { xs: 1.5, sm: 3 } }}>
      <Stack spacing={2.5}>
        <Paper elevation={0} sx={{ border: "1px solid #e5e7eb", borderRadius: 3, overflow: "hidden" }}>
          <Box
            sx={{
              p: { xs: 2.5, sm: 3.5 },
              background: "linear-gradient(135deg, #7e22ce 0%, #4c1d95 100%)",
              color: "white",
            }}
          >
            <Stack direction="row" alignItems="center" spacing={1.5}>
              <Box
                sx={{
                  width: 46,
                  height: 46,
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
              <Box sx={{ minWidth: 0 }}>
                <Typography variant="h5" fontWeight={800} sx={{ fontSize: { xs: "1.15rem", sm: "1.5rem" } }}>
                  Duty Officer's Inspection Checklist
                </Typography>
                <Typography variant="body2" sx={{ opacity: 0.9, mt: 0.4 }}>
                  Submitted report — view only
                </Typography>
              </Box>
            </Stack>
          </Box>
        </Paper>

        <Alert icon={<CheckCircle />} severity="success">
          Thank you for your contribution! Here is your submitted report.
        </Alert>

        <Paper elevation={0} sx={{ p: { xs: 2, sm: 2.5 }, border: "1px solid #e2e8f0", borderRadius: 2.5 }}>
          <Typography fontWeight={800} color="#6b21a8" mb={2}>
            Report Information
          </Typography>
          <Grid container spacing={2}>
            <Grid item xs={12} sm={6}>
              <Typography variant="caption" color="text.secondary">Date</Typography>
              <Typography fontWeight={600}>{displayValue(report.date)}</Typography>
            </Grid>
            <Grid item xs={12} sm={6}>
              <Typography variant="caption" color="text.secondary">Name of Duty Officer</Typography>
              <Typography fontWeight={600}>{displayValue(report.dutyOfficerName)}</Typography>
            </Grid>
            <Grid item xs={12} sm={6}>
              <Typography variant="caption" color="text.secondary">Shift / Timing</Typography>
              <Typography fontWeight={600}>{displayValue(report.shiftTiming)}</Typography>
            </Grid>
            <Grid item xs={12} sm={6}>
              <Typography variant="caption" color="text.secondary">Centre / Batch covered</Typography>
              <Typography fontWeight={600}>{displayValue(report.centreBatch)}</Typography>
            </Grid>
          </Grid>
        </Paper>

        {sections.map((section, sectionIndex) => (
          <Paper
            key={section.key || sectionIndex}
            elevation={0}
            sx={{ border: "1px solid #e2e8f0", borderRadius: 2.5, overflow: "hidden" }}
          >
            <Box sx={{ px: { xs: 1.5, sm: 2.5 }, py: 1.5, bgcolor: "#faf5ff", borderBottom: "1px solid #f1f5f9" }}>
              <Stack direction={{ xs: "column", sm: "row" }} justifyContent="space-between" alignItems={{ xs: "flex-start", sm: "center" }} gap={0.5}>
                <Typography fontWeight={800} fontSize="0.98rem">
                  {sectionIndex + 1}. {section.title}
                </Typography>
                {section.timing && <Chip size="small" label={section.timing} sx={{ bgcolor: "white" }} />}
              </Stack>
            </Box>

            <Box sx={{ px: { xs: 1.2, sm: 2 } }}>
              {section.items.length === 0 ? (
                <Typography color="text.secondary" sx={{ py: 2, px: 1 }}>
                  No checklist items added.
                </Typography>
              ) : (
                section.items.map((item, i) => (
                  <Box key={`${section.key}-${i}`} sx={{ py: 1.35, borderBottom: "1px solid #f1f5f9", "&:last-child": { borderBottom: "none" } }}>
                    <Stack direction="row" alignItems="flex-start" spacing={0.5}>
                      <Checkbox checked={!!item.checked} disabled sx={{ p: 0.5, mt: -0.2, "&.Mui-checked": { color: "#7e22ce" } }} />
                      <Typography fontSize="0.9rem" fontWeight={500} sx={{ pt: 0.4, flex: 1 }}>
                        {item.label || "Untitled checklist item"}
                      </Typography>
                      {item.status && (
                        <Chip size="small" label={item.status === "resolved" ? "Resolved" : "Open"} />
                      )}
                    </Stack>

                    <Stack spacing={0.6} sx={{ ml: { xs: 4.5, sm: 5 } }}>
                      {item.remark && (
                        <Typography variant="body2" color="text.secondary">Teacher remark: {item.remark}</Typography>
                      )}
                      {item.adminRemark && (
                        <Typography variant="body2" color="text.secondary">Admin remark: {item.adminRemark}</Typography>
                      )}
                      {item.followed && <Typography variant="body2" color="text.secondary">Follow-up: Yes</Typography>}
                    </Stack>
                  </Box>
                ))
              )}
            </Box>
          </Paper>
        ))}

        {sections.some((section) => (section.items || []).some((item) => item.adminRemark)) && (
          <Paper elevation={0} sx={{ p: { xs: 1.5, sm: 2.5 }, border: "1px solid #ddd6fe", bgcolor: "#faf5ff", borderRadius: 2.5 }}>
            <Typography fontWeight={800} color="#6b21a8" mb={1}>Admin Remarks & Follow-up</Typography>
            <Stack spacing={1}>
              {sections.flatMap((section) => (section.items || []).map((item, index) => item.adminRemark ? (
                <Box key={`${section.key}-admin-${index}`} sx={{ p: 1.1, bgcolor: "white", borderRadius: 1.5, border: "1px solid #ede9fe" }}>
                  <Typography fontSize="0.76rem" fontWeight={800}>{section.title}</Typography>
                  <Typography fontSize="0.82rem">{item.label}</Typography>
                  <Typography variant="body2" color="text.secondary" sx={{ mt: 0.3 }}>{item.adminRemark}</Typography>
                </Box>
              ) : null))}
            </Stack>
          </Paper>
        )}

        {customFields.length > 0 && (
          <Paper elevation={0} sx={{ p: { xs: 1.5, sm: 2.5 }, border: "1px solid #e2e8f0", borderRadius: 2.5 }}>
            <Typography fontWeight={800} color="#6b21a8" mb={1.5}>Additional Fields</Typography>
            <Grid container spacing={2}>
              {customFields.map((field, index) => (
                <Grid item xs={12} sm={6} key={field.key || index}>
                  <Typography variant="caption" color="text.secondary">{field.label || "Additional field"}</Typography>
                  <Typography fontWeight={600}>{formatCustomField(field)}</Typography>
                </Grid>
              ))}
            </Grid>
          </Paper>
        )}

        <Paper elevation={0} sx={{ p: { xs: 1.5, sm: 2.5 }, border: "1px solid #e2e8f0", borderRadius: 2.5 }}>
          <Typography fontWeight={800} color="#6b21a8" mb={1.5}>Summary of Key Observations</Typography>
          <Stack spacing={1.5}>
            <Box>
              <Typography variant="caption" color="text.secondary">Major positive observations</Typography>
              <Typography>{displayValue(report.positiveObservations)}</Typography>
            </Box>
            <Divider />
            <Box>
              <Typography variant="caption" color="text.secondary">Cleanliness / hygiene lapses noted</Typography>
              <Typography>{displayValue(report.hygieneLapses)}</Typography>
            </Box>
            <Divider />
            <Box>
              <Typography variant="caption" color="text.secondary">Maintenance items needing follow-up action</Typography>
              <Typography>{displayValue(report.maintenanceFollowUp)}</Typography>
            </Box>
          </Stack>
        </Paper>

        <Paper elevation={0} sx={{ p: { xs: 1.5, sm: 2.5 }, border: "1px solid #fecaca", borderRadius: 2.5 }}>
          <Typography fontWeight={800} color="#b91c1c" mb={0.5}>Urgent Matters</Typography>
          <Typography>{displayValue(report.urgentMatters)}</Typography>
        </Paper>

        <Paper elevation={0} sx={{ p: { xs: 1.5, sm: 2.5 }, border: "1px solid #e2e8f0", borderRadius: 2.5 }}>
          <Grid container spacing={1.8}>
            <Grid item xs={12} sm={6}>
              <Typography variant="caption" color="text.secondary">Signature of Duty Officer</Typography>
              <Typography fontWeight={600}>{displayValue(report.signature)}</Typography>
            </Grid>
            <Grid item xs={12} sm={6}>
              <Typography variant="caption" color="text.secondary">Countersigned by</Typography>
              <Typography fontWeight={600}>{displayValue(report.countersignedBy)}</Typography>
            </Grid>
          </Grid>
        </Paper>

        <Button startIcon={<ArrowBack />} onClick={() => router.push("/teacher/dashboard")} sx={{ alignSelf: "flex-start" }}>
          Back to Dashboard
        </Button>
      </Stack>
    </Box>
  );
}

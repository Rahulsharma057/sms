"use client";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  Alert, Box, Button, Checkbox, CircularProgress, Divider, Grid,
  Paper, Stack, Typography,
} from "@mui/material";
import { ArrowBack, CheckCircle, Description } from "@mui/icons-material";
import api from "../../../../lib/api";
const sections = [
  { title: "Morning readiness check", key: "morningChecks" },
  { title: "Mid-day infrastructure & order inspection", key: "middayChecks" },
  { title: "Afternoon maintenance round", key: "afternoonChecks" },
];

export default function ReportViewPage() {
  const { id } = useParams();
  const router = useRouter();

  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    api.get(`/reports/${id}`)
      .then((res) => setReport(res.data))
      .catch((err) => setError(err?.response?.data?.message || "Could not load report."))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) {
    return (
      <Box sx={{ display: "flex", justifyContent: "center", py: 6 }}>
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
    <Box sx={{ maxWidth: 900, mx: "auto", p: { xs: 1.5, sm: 3 } }}>
      <Stack spacing={2.5}>
        <Paper elevation={0} sx={{ border: "1px solid #e5e7eb", borderRadius: 2, overflow: "hidden" }}>
          <Box sx={{ p: { xs: 2.5, sm: 3 }, background: "linear-gradient(135deg, #7e22ce 0%, #4c1d95 100%)", color: "white" }}>
            <Stack direction="row" alignItems="center" spacing={1.5}>
              <Box sx={{ width: 42, height: 42, borderRadius: 2, bgcolor: "rgba(255,255,255,0.15)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                <Description />
              </Box>
              <Box>
                <Typography variant="h5" fontWeight={800}>Duty Officer's Inspection Checklist</Typography>
                <Typography variant="body2" sx={{ opacity: 0.9, mt: 0.3 }}>
                  Submitted report — view only
                </Typography>
              </Box>
            </Stack>
          </Box>
        </Paper>

        <Alert icon={<CheckCircle />} severity="success">
          Thank you for your contribution! Here is your submitted report.
        </Alert>

        {/* BASIC INFO */}
        <Paper elevation={0} sx={{ p: { xs: 2, sm: 2.5 }, border: "1px solid #e2e8f0", borderRadius: 2.5 }}>
          <Grid container spacing={2}>
            <Grid item xs={12} sm={6}>
              <Typography variant="caption" color="text.secondary">Date</Typography>
              <Typography fontWeight={600}>{report.date}</Typography>
            </Grid>
            <Grid item xs={12} sm={6}>
              <Typography variant="caption" color="text.secondary">Name of Duty Officer</Typography>
              <Typography fontWeight={600}>{report.dutyOfficerName}</Typography>
            </Grid>
         {/*    <Grid item xs={12} sm={6}>
              <Typography variant="caption" color="text.secondary">Shift / Timing</Typography>
              <Typography fontWeight={600}>{report.shiftTiming}</Typography>
            </Grid> */}
            <Grid item xs={12} sm={6}>
              <Typography variant="caption" color="text.secondary">Centre / Batch covered</Typography>
              <Typography fontWeight={600}>{report.centreBatch}</Typography>
            </Grid>
          </Grid>
        </Paper>

        {/* CHECKLIST SECTIONS */}
        {sections.map((section, sectionIndex) => (
          <Paper key={section.key} elevation={0} sx={{ border: "1px solid #e2e8f0", borderRadius: 2.5, overflow: "hidden" }}>
            <Box sx={{ px: { xs: 1.5, sm: 2.5 }, py: 1.5, bgcolor: "#faf5ff", borderBottom: "1px solid #f1f5f9" }}>
              <Stack direction="row" alignItems="center" gap={1.5}>
               {/*  <Box sx={{ width: 30, height: 30, borderRadius: "50%", bgcolor: "#7e22ce", color: "white", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: 800, flexShrink: 0 }}>
                  {sectionIndex + 1}
                </Box> */}
              {/*   <Typography fontWeight={800} fontSize="0.95rem">{section.title}</Typography> */}
              </Stack>
            </Box>

            <Box sx={{ px: { xs: 1.2, sm: 2 } }}>
              {(report[section.key] || []).map((item, i) => (
                <Box key={i} sx={{ py: 1.2, borderBottom: "1px solid #f1f5f9", "&:last-child": { borderBottom: "none" } }}>
                  <Stack direction="row" alignItems="flex-start" spacing={0.5}>
                    <Checkbox checked={!!item.checked} disabled sx={{ p: 0.5, mt: -0.2, "&.Mui-checked": { color: "#7e22ce" } }} />
                    <Typography fontSize="0.9rem" fontWeight={500} sx={{ pt: 0.4 }}>{item.label}</Typography>
                  </Stack>
                  {item.remark && (
                    <Typography variant="body2" color="text.secondary" sx={{ ml: { xs: 4.5, sm: 5 } }}>
                      Remark: {item.remark}
                    </Typography>
                  )}
                </Box>
              ))}
            </Box>
          </Paper>
        ))}

        {/* OBSERVATIONS */}
        <Paper elevation={0} sx={{ p: { xs: 1.5, sm: 2.5 }, border: "1px solid #e2e8f0", borderRadius: 2.5 }}>
          <Typography fontWeight={800} color="#6b21a8" mb={1.5}>Summary of Key Observations</Typography>
          <Stack spacing={1.5}>
            <Box>
              <Typography variant="caption" color="text.secondary">Major positive observations</Typography>
              <Typography>{report.positiveObservations}</Typography>
            </Box>
            <Divider />
            <Box>
              <Typography variant="caption" color="text.secondary">Cleanliness / hygiene lapses noted</Typography>
              <Typography>{report.hygieneLapses}</Typography>
            </Box>
            <Divider />
            <Box>
              <Typography variant="caption" color="text.secondary">Maintenance items needing follow-up action</Typography>
              <Typography>{report.maintenanceFollowUp}</Typography>
            </Box>
          </Stack>
        </Paper>

        {/* URGENT MATTERS */}
        <Paper elevation={0} sx={{ p: { xs: 1.5, sm: 2.5 }, border: "1px solid #fecaca", borderRadius: 2.5 }}>
          <Typography fontWeight={800} color="#b91c1c" mb={0.5}>Urgent Matters</Typography>
          <Typography>{report.urgentMatters}</Typography>
        </Paper>

        {/* SIGNATURE */}
        <Paper elevation={0} sx={{ p: { xs: 1.5, sm: 2.5 }, border: "1px solid #e2e8f0", borderRadius: 2.5 }}>
          <Grid container spacing={1.8}>
            <Grid item xs={12} sm={6}>
              <Typography variant="caption" color="text.secondary">Signature of Duty Officer</Typography>
              <Typography fontWeight={600}>{report.signature}</Typography>
            </Grid>
            <Grid item xs={12} sm={6}>
              <Typography variant="caption" color="text.secondary">Countersigned by</Typography>
              <Typography fontWeight={600}>{report.countersignedBy}</Typography>
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
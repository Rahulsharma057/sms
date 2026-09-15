"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  Alert, Avatar, Box, Button, Chip, CircularProgress, Container, Dialog, DialogContent,
  IconButton, Paper, Stack, TextField, Typography,
} from "@mui/material";
import { ArrowBack, CheckCircle, Download, Edit, Lock, LockOpen, ReportProblemOutlined } from "@mui/icons-material";
import ProtectedRoute from "../../../../components/ProtectedRoute";
import Navbar from "../../../../components/Navbar";
import api, { downloadInspectionReportPdf } from "../../../../lib/api";
import IssueEditDialog from "../../../../components/IssueEditDialog";

const dimensionsLabel = (issue) => {
  if (!issue.length && !issue.height) return null;
  const parts = [];
  if (issue.length) parts.push(`L: ${issue.length}${issue.unit}`);
  if (issue.height) parts.push(`H: ${issue.height}${issue.unit}`);
  return parts.join(" × ");
};

function IssueCard({ issue, locked, onResolve, resolving, onEdit, onViewImage }) {
  const [remark, setRemark] = useState(issue.adminRemark || "");

  return (
    <Paper elevation={0} sx={{ p: 1.8, border: "1px solid #e2e8f0", borderRadius: 2.5 }}>
      <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5}>
        {issue.photos?.length > 0 && (
          <Stack direction="row" spacing={0.5} flexWrap="wrap" useFlexGap sx={{ flexShrink: 0 }}>
            {issue.photos.map((p) => (
              <Avatar
                key={p.publicId}
                src={p.url}
                variant="rounded"
                sx={{ width: 88, height: 88, cursor: "pointer" }}
                onClick={() => onViewImage(p.url)}
              />
            ))}
          </Stack>
        )}
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Stack direction="row" justifyContent="space-between" alignItems="flex-start" gap={1}>
            <Typography fontWeight={800}>{issue.problemName}</Typography>
            <Stack direction="row" spacing={0.5} alignItems="center">
              {!locked && (
                <IconButton size="small" onClick={onEdit} sx={{ color: "#1e3a5f" }}>
                  <Edit fontSize="small" />
                </IconButton>
              )}
              <Chip size="small" label={issue.status === "resolved" ? "Resolved" : "Open"} color={issue.status === "resolved" ? "success" : "warning"} />
            </Stack>
          </Stack>

          <Stack direction="row" spacing={0.6} flexWrap="wrap" useFlexGap sx={{ mt: 0.6 }}>
            {issue.location && <Chip size="small" label={`Location: ${issue.location}`} />}
            {issue.direction && <Chip size="small" label={`Direction: ${issue.direction}`} />}
            {issue.brokenSince && <Chip size="small" label={`Since: ${issue.brokenSince}`} color="warning" variant="outlined" />}
            {issue.quantity != null && <Chip size="small" label={`Qty: ${issue.quantity}`} />}
            {dimensionsLabel(issue) && <Chip size="small" label={dimensionsLabel(issue)} />}
          </Stack>

          {issue.description && (
            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.8 }}>
              {issue.description}
            </Typography>
          )}

          {issue.voiceNote?.url && (
            <Box sx={{ mt: 1 }}>
              <audio controls src={issue.voiceNote.url} style={{ height: 32, width: "100%", maxWidth: 320 }} />
            </Box>
          )}

          <Stack direction={{ xs: "column", sm: "row" }} spacing={1} sx={{ mt: 1.2 }} alignItems={{ sm: "center" }}>
            <TextField
              size="small"
              fullWidth
              placeholder="Admin remark (optional)"
              value={remark}
              onChange={(e) => setRemark(e.target.value)}
            />
            <Button
              size="small"
              variant={issue.status === "resolved" ? "outlined" : "contained"}
              onClick={() => onResolve(issue._id, issue.status === "resolved" ? "open" : "resolved", remark)}
              disabled={resolving === issue._id}
              startIcon={resolving === issue._id ? <CircularProgress size={14} color="inherit" /> : <CheckCircle fontSize="small" />}
              sx={{ textTransform: "none", flexShrink: 0 }}
            >
              {issue.status === "resolved" ? "Mark Open" : "Mark Resolved"}
            </Button>
          </Stack>
        </Box>
      </Stack>
    </Paper>
  );
}

function AdminInspectionReportDetailInner() {
  const { id } = useParams();
  const router = useRouter();

  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [resolving, setResolving] = useState(null);
  const [lockToggling, setLockToggling] = useState(false);
  const [editingIssue, setEditingIssue] = useState(null);
  const [viewImage, setViewImage] = useState(null);
  const [downloadingPdf, setDownloadingPdf] = useState(false);

  const load = () => {
    setLoading(true);
    api
      .get(`/inspection-reports/${id}`)
      .then((res) => setReport(res.data))
      .catch((err) => setError(err?.response?.data?.message || "Could not load this report."))
      .finally(() => setLoading(false));
  };

  useEffect(() => { if (id) load(); }, [id]);

  const handleResolve = async (issueId, status, adminRemark) => {
    setResolving(issueId);
    try {
      const res = await api.patch(`/inspection-reports/${id}/issues/${issueId}/status`, { status, adminRemark });
      setReport(res.data);
    } catch (err) {
      setError(err?.response?.data?.message || "Could not update this issue.");
    } finally {
      setResolving(null);
    }
  };

  const toggleLock = async () => {
    const nextLocked = !report.locked;
    const confirmed = window.confirm(
      nextLocked
        ? "Lock this report? No one (including you) will be able to edit its issues after this."
        : "Unlock this report so it can be edited again?",
    );
    if (!confirmed) return;

    setLockToggling(true);
    try {
      const res = await api.patch(`/inspection-reports/${id}/lock`, { locked: nextLocked });
      setReport(res.data);
    } catch (err) {
      setError(err?.response?.data?.message || "Could not update the lock status.");
    } finally {
      setLockToggling(false);
    }
  };

  const handleDownloadPdf = async () => {
    setDownloadingPdf(true);
    setError("");
    try {
      await downloadInspectionReportPdf(report._id, report.reportedBy?.name || "report");
    } catch (err) {
      setError(err.message || "Could not download PDF.");
    } finally {
      setDownloadingPdf(false);
    }
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

  return (
    <Box sx={{ bgcolor: "#faf9fb", minHeight: "100vh" }}>
      <Navbar />
      <Container maxWidth="md" sx={{ py: 3 }}>
        <Stack direction="row" spacing={1.2} alignItems="center" sx={{ mb: 2.5 }} flexWrap="wrap" useFlexGap>
          <IconButton onClick={() => router.push("/admin/inspection-reports")}>
            <ArrowBack />
          </IconButton>
          <Box sx={{ width: 40, height: 40, borderRadius: 2, bgcolor: "#1c28ce", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <ReportProblemOutlined sx={{ color: "white", fontSize: 22 }} />
          </Box>
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography variant="h5" fontWeight={800} noWrap>{report?.reportedBy?.name}'s Inspection</Typography>
            <Typography variant="body2" color="text.secondary">
              {report?.submittedAt && new Date(report.submittedAt).toLocaleString("en-IN")}
            </Typography>
          </Box>
          {report && (
            <Stack direction="row" spacing={1}>
              <Button
                variant="outlined"
                onClick={handleDownloadPdf}
                disabled={downloadingPdf}
                startIcon={downloadingPdf ? <CircularProgress size={16} /> : <Download />}
                sx={{ textTransform: "none", fontWeight: 700 }}
              >
                {downloadingPdf ? "Preparing..." : "Download PDF"}
              </Button>

              <Button
                variant={report.locked ? "outlined" : "contained"}
                color={report.locked ? "inherit" : "error"}
                onClick={toggleLock}
                disabled={lockToggling}
                startIcon={
                  lockToggling ? <CircularProgress size={16} color="inherit" /> : report.locked ? <LockOpen /> : <Lock />
                }
                sx={{ textTransform: "none", fontWeight: 700 }}
              >
                {lockToggling ? "Updating..." : report.locked ? "Unlock Report" : "Lock Report"}
              </Button>
            </Stack>
          )}
        </Stack>

        {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError("")}>{error}</Alert>}

        {report?.locked && (
          <Alert severity="info" icon={<Lock fontSize="small" />} sx={{ mb: 2 }}>
            This report is locked — issues can no longer be edited by you or the teacher.
          </Alert>
        )}

        <Stack spacing={1.5}>
          {(report?.issues || []).map((issue) => (
            <IssueCard
              key={issue._id}
              issue={issue}
              locked={Boolean(report.locked)}
              onResolve={handleResolve}
              resolving={resolving}
              onEdit={() => setEditingIssue(issue)}
              onViewImage={setViewImage}
            />
          ))}
        </Stack>
      </Container>

      <IssueEditDialog
        open={Boolean(editingIssue)}
        onClose={() => setEditingIssue(null)}
        reportId={report?._id}
        issue={editingIssue}
        onSaved={(updatedReport) => setReport(updatedReport)}
      />

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

export default function AdminInspectionReportDetailPage() {
  return (
    <ProtectedRoute role="superadmin">
      <AdminInspectionReportDetailInner />
    </ProtectedRoute>
  );
}
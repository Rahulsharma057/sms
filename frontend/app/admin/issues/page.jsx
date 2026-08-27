"use client";
import { useEffect, useState } from "react";
import {
  Box, Container, Typography, Paper, Grid, Card, CardContent,
  Table, TableHead, TableRow, TableCell, TableBody, TableContainer,
  Chip, Stack, CircularProgress, IconButton, Tooltip, Divider,
  TextField, MenuItem, Button, Dialog, DialogTitle, DialogContent, DialogActions,
  Switch, FormControlLabel, Alert, Tabs, Tab,
} from "@mui/material";
import {
  ReportProblem, Star, StarBorder, Close, CheckCircle,
  ErrorOutline, FilterAltOff, Person, CalendarMonth, Groups,
} from "@mui/icons-material";
import ProtectedRoute from "../../../components/ProtectedRoute";
import Navbar from "../../../components/Navbar";
import api from "../../../lib/api";

const SECTION_LABELS = {
  morningChecks: "Morning readiness check",
  middayChecks: "Mid-day infrastructure & order inspection",
  afternoonChecks: "Afternoon maintenance round",
};

function IssuesInner() {
  const [tab, setTab] = useState(0); // 0 = Common Problems, 1 = All Issues

  const [summary, setSummary] = useState([]);
  const [issues, setIssues] = useState([]);
  const [loadingSummary, setLoadingSummary] = useState(true);
  const [loadingList, setLoadingList] = useState(true);

  const [labelFilter, setLabelFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [followedOnly, setFollowedOnly] = useState(false);

  const [selected, setSelected] = useState(null);
  const [adminRemarkDraft, setAdminRemarkDraft] = useState("");
  const [statusDraft, setStatusDraft] = useState("open");
  const [followedDraft, setFollowedDraft] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState("");

  const loadSummary = () => {
    setLoadingSummary(true);
    api.get("/reports/issues/summary")
      .then((res) => setSummary(res.data))
      .finally(() => setLoadingSummary(false));
  };

  const loadIssues = (filters = {}) => {
    setLoadingList(true);
    const params = {};
    const label = filters.label !== undefined ? filters.label : labelFilter;
    const status = filters.status !== undefined ? filters.status : statusFilter;
    const followed = filters.followed !== undefined ? filters.followed : followedOnly;

    if (label) params.label = label;
    if (status) params.status = status;
    if (followed) params.followed = "true";

    api.get("/reports/issues", { params })
      .then((res) => setIssues(res.data))
      .finally(() => setLoadingList(false));
  };

  useEffect(() => {
    loadSummary();
    loadIssues({});
  }, []);

  const applyProblemFilter = (label) => {
    const next = labelFilter === label ? "" : label;
    setLabelFilter(next);
    loadIssues({ label: next });
    setTab(1); // problem pe click karte hi seedha list dikhao
  };

  const applyStatusFilter = (val) => {
    setStatusFilter(val);
    loadIssues({ status: val });
  };

  const applyFollowedOnly = (val) => {
    setFollowedOnly(val);
    loadIssues({ followed: val });
  };

  const resetFilters = () => {
    setLabelFilter("");
    setStatusFilter("");
    setFollowedOnly(false);
    loadIssues({ label: "", status: "", followed: false });
  };

  const openIssue = (issue) => {
    setSelected(issue);
    setAdminRemarkDraft(issue.adminRemark || "");
    setStatusDraft(issue.status || "open");
    setFollowedDraft(!!issue.followed);
    setSaveMsg("");
  };

  const toggleFollowInline = async (issue, e) => {
    e.stopPropagation();
    try {
      await api.patch(`/reports/${issue.reportId}/check-status`, {
        section: issue.section,
        index: issue.index,
        followed: !issue.followed,
      });
      loadIssues({});
      loadSummary();
    } catch {
      // ignore — user can retry from dialog
    }
  };

  const saveIssue = async () => {
    if (!selected) return;
    try {
      setSaving(true);
      await api.patch(`/reports/${selected.reportId}/check-status`, {
        section: selected.section,
        index: selected.index,
        status: statusDraft,
        adminRemark: adminRemarkDraft,
        followed: followedDraft,
      });
      setSaveMsg("Saved.");
      loadIssues({});
      loadSummary();
      setTimeout(() => setSelected(null), 700);
    } catch (err) {
      setSaveMsg(err?.response?.data?.message || "Could not save.");
    } finally {
      setSaving(false);
    }
  };

  const topProblem = summary[0];
  const totalOpen = summary.reduce((s, g) => s + g.openCount, 0);

  return (
    <Box sx={{ bgcolor: "#faf9fb", minHeight: "100vh" }}>
      <Navbar />
      <Container maxWidth="lg" sx={{ py: { xs: 2, sm: 3 } }}>
        {/* HEADER */}
        <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 2 }}>
          <Box sx={{ width: { xs: 32, sm: 40 }, height: { xs: 32, sm: 40 }, borderRadius: 2, bgcolor: "#b91c1c", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            <ReportProblem sx={{ color: "white", fontSize: { xs: 18, sm: 22 } }} />
          </Box>
          <Box sx={{ minWidth: 0 }}>
            <Typography variant="h6" fontWeight={800} fontSize={{ xs: "1.05rem", sm: "1.5rem" }}>Issue Tracker</Typography>
            <Typography variant="body2" color="text.secondary" fontSize={{ xs: "0.72rem", sm: "0.875rem" }} noWrap>
              Most reported problems across all checklists
            </Typography>
          </Box>
        </Stack>

        {/* SUMMARY CARDS — 3-in-a-row, compact on mobile */}
        <Grid container spacing={{ xs: 1, sm: 2 }} sx={{ mb: 2 }}>
          <Grid item xs={4}>
            <Card elevation={0} sx={{ border: "1px solid #e2e8f0", borderRadius: 2, height: "100%" }}>
              <CardContent sx={{ p: { xs: 1, sm: 2 }, "&:last-child": { pb: { xs: 1, sm: 2 } } }}>
                <Typography color="text.secondary" fontSize={{ xs: "0.6rem", sm: "0.8rem" }} noWrap>Problems</Typography>
                <Typography fontWeight={800} fontSize={{ xs: "1.05rem", sm: "1.5rem" }}>{summary.length}</Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={4}>
            <Card elevation={0} sx={{ border: "1px solid #e2e8f0", borderRadius: 2, height: "100%" }}>
              <CardContent sx={{ p: { xs: 1, sm: 2 }, "&:last-child": { pb: { xs: 1, sm: 2 } } }}>
                <Typography color="text.secondary" fontSize={{ xs: "0.6rem", sm: "0.8rem" }} noWrap>Open</Typography>
                <Typography fontWeight={800} fontSize={{ xs: "1.05rem", sm: "1.5rem" }} color="#dc2626">{totalOpen}</Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={4}>
            <Card elevation={0} sx={{ border: "1px solid #e2e8f0", borderRadius: 2, height: "100%" }}>
              <CardContent sx={{ p: { xs: 1, sm: 2 }, "&:last-child": { pb: { xs: 1, sm: 2 } } }}>
                <Typography color="text.secondary" fontSize={{ xs: "0.6rem", sm: "0.8rem" }} noWrap>Top Problem</Typography>
                <Typography fontWeight={800} fontSize={{ xs: "0.68rem", sm: "0.9rem" }} noWrap>
                  {topProblem ? topProblem.label : "-"}
                </Typography>
              </CardContent>
            </Card>
          </Grid>
        </Grid>

        {/* TABS */}
        <Paper elevation={0} sx={{ border: "1px solid #e2e8f0", borderRadius: 2.5, overflow: "hidden" }}>
          <Tabs
            value={tab}
            onChange={(e, v) => setTab(v)}
            variant="fullWidth"
            sx={{
              borderBottom: "1px solid #e2e8f0",
              minHeight: 42,
              "& .MuiTab-root": { minHeight: 42, fontSize: { xs: "0.75rem", sm: "0.875rem" }, fontWeight: 600, textTransform: "none" },
              "& .Mui-selected": { color: "#7e22ce !important" },
              "& .MuiTabs-indicator": { bgcolor: "#7e22ce" },
            }}
          >
            <Tab label="Common Problems" />
            <Tab label={`All Issues${issues.length ? ` (${issues.length})` : ""}`} />
          </Tabs>

          {/* ===================== TAB 0: COMMON PROBLEMS ===================== */}
          {tab === 0 && (
            <Box sx={{ p: { xs: 1.2, sm: 2.5 } }}>
              {loadingSummary ? (
                <Box sx={{ display: "flex", justifyContent: "center", py: 4 }}>
                  <CircularProgress size={22} sx={{ color: "#7e22ce" }} />
                </Box>
              ) : summary.length === 0 ? (
                <Typography color="text.secondary" fontSize="0.85rem" sx={{ py: 2, textAlign: "center" }}>
                  No issues reported yet.
                </Typography>
              ) : (
                <Stack spacing={1}>
                  {summary.map((g) => {
                    const active = labelFilter === g.label;
                    return (
                      <Box
                        key={g.label}
                        onClick={() => applyProblemFilter(g.label)}
                        sx={{
                          cursor: "pointer",
                          border: active ? "1.5px solid #7e22ce" : "1px solid #e2e8f0",
                          bgcolor: active ? "#faf5ff" : "white",
                          borderRadius: 2,
                          px: 1.4, py: 1,
                          transition: "all 0.15s",
                          "&:hover": { borderColor: "#7e22ce" },
                        }}
                      >
                        <Stack direction="row" justifyContent="space-between" alignItems="flex-start" spacing={1}>
                          <Typography fontSize={{ xs: "0.8rem", sm: "0.9rem" }} fontWeight={600} sx={{ flex: 1, minWidth: 0 }}>
                            {g.label}
                          </Typography>
                          <Chip
                            icon={<Groups sx={{ fontSize: "13px !important" }} />}
                            label={`${g.teacherCount} ${g.teacherCount === 1 ? "person" : "people"}`}
                            size="small"
                            sx={{ bgcolor: "#b91c1c", color: "white", fontWeight: 700, height: 22, fontSize: "0.65rem", flexShrink: 0 }}
                          />
                        </Stack>
                        <Stack direction="row" spacing={1.2} mt={0.6} flexWrap="wrap">
                          <Typography fontSize={{ xs: "0.62rem", sm: "0.7rem" }} color="text.secondary">
                            {g.totalCount} total occurrence{g.totalCount !== 1 ? "s" : ""}
                          </Typography>
                          <Typography fontSize={{ xs: "0.62rem", sm: "0.7rem" }} color="#dc2626">{g.openCount} open</Typography>
                          <Typography fontSize={{ xs: "0.62rem", sm: "0.7rem" }} color="#15803d">{g.resolvedCount} resolved</Typography>
                          {g.followedCount > 0 && (
                            <Typography fontSize={{ xs: "0.62rem", sm: "0.7rem" }} color="#a16207">★ {g.followedCount} followed</Typography>
                          )}
                        </Stack>
                      </Box>
                    );
                  })}
                </Stack>
              )}
            </Box>
          )}

          {/* ===================== TAB 1: ALL ISSUES ===================== */}
          {tab === 1 && (
            <Box sx={{ p: { xs: 1.2, sm: 2.5 } }}>
              {/* FILTERS */}
              <Stack spacing={1} sx={{ mb: 1.5 }}>
                {labelFilter && (
                  <Chip
                    label={`Problem: ${labelFilter}`}
                    onDelete={() => applyProblemFilter(labelFilter)}
                    size="small"
                    sx={{ bgcolor: "#f3e8ff", color: "#6b21a8", fontWeight: 600, alignSelf: "flex-start" }}
                  />
                )}
                <Stack direction="row" spacing={1} sx={{ flexWrap: "wrap", gap: 1 }}>
                  <TextField
                    select size="small" label="Status" value={statusFilter}
                    onChange={(e) => applyStatusFilter(e.target.value)}
                    sx={{ flex: { xs: "1 1 47%", sm: "0 1 140px" } }}
                  >
                    <MenuItem value="">All</MenuItem>
                    <MenuItem value="open">Open</MenuItem>
                    <MenuItem value="resolved">Resolved</MenuItem>
                  </TextField>
                  <FormControlLabel
                    control={<Switch size="small" checked={followedOnly} onChange={(e) => applyFollowedOnly(e.target.checked)} />}
                    label={<Typography fontSize="0.78rem">Followed by me</Typography>}
                    sx={{ flex: { xs: "1 1 47%", sm: "0 0 auto" }, ml: 0 }}
                  />
                  <Box sx={{ flexGrow: 1, display: { xs: "none", sm: "block" } }} />
                  <Button size="small" startIcon={<FilterAltOff fontSize="small" />} onClick={resetFilters} color="inherit" sx={{ fontSize: "0.72rem" }}>
                    Reset
                  </Button>
                </Stack>
              </Stack>

              <Divider sx={{ mb: 1.5 }} />

              {loadingList ? (
                <Box sx={{ display: "flex", justifyContent: "center", py: 4 }}>
                  <CircularProgress size={22} sx={{ color: "#7e22ce" }} />
                </Box>
              ) : issues.length === 0 ? (
                <Typography color="text.secondary" fontSize="0.85rem" sx={{ py: 2, textAlign: "center" }}>
                  No issues match these filters.
                </Typography>
              ) : (
                <TableContainer sx={{ overflowX: "auto" }}>
                  <Table size="small">
                    <TableHead>
                      <TableRow sx={{ "& th": { bgcolor: "#fef2f2", fontWeight: 700, color: "#991b1b", fontSize: { xs: "0.68rem", sm: "0.8rem" }, py: 1, px: { xs: 0.8, sm: 2 } } }}>
                        <TableCell>Date</TableCell>
                        <TableCell>Teacher</TableCell>
                        <TableCell sx={{ display: { xs: "none", sm: "table-cell" } }}>Problem</TableCell>
                        <TableCell sx={{ display: { xs: "none", md: "table-cell" } }}>Remark</TableCell>
                        <TableCell>Status</TableCell>
                        <TableCell align="right">Follow</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {issues.map((issue) => (
                        <TableRow
                          key={`${issue.reportId}-${issue.section}-${issue.index}`}
                          hover
                          sx={{ cursor: "pointer", "&:hover": { bgcolor: "#fef2f2" }, "& td": { px: { xs: 0.8, sm: 2 }, py: { xs: 0.7, sm: 1.2 } } }}
                          onClick={() => openIssue(issue)}
                        >
                          <TableCell sx={{ whiteSpace: "nowrap", fontSize: { xs: "0.7rem", sm: "0.875rem" } }}>{issue.date}</TableCell>
                          <TableCell sx={{ fontSize: { xs: "0.7rem", sm: "0.875rem" }, maxWidth: { xs: 80, sm: "none" }, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                            {issue.teacher?.name || "-"}
                          </TableCell>
                          <TableCell sx={{ display: { xs: "none", sm: "table-cell" }, maxWidth: 220 }}>
                            <Typography fontSize="0.85rem" noWrap>{issue.label}</Typography>
                            <Typography variant="caption" color="text.secondary">{SECTION_LABELS[issue.section]}</Typography>
                          </TableCell>
                          <TableCell sx={{ display: { xs: "none", md: "table-cell" }, maxWidth: 200 }}>
                            <Typography fontSize="0.82rem" color="text.secondary" noWrap>
                              {issue.remark || (issue.checked === false ? "Left unchecked" : "-")}
                            </Typography>
                          </TableCell>
                          <TableCell>
                            {issue.status === "resolved" ? (
                              <Chip size="small" icon={<CheckCircle sx={{ fontSize: "12px !important" }} />} label="Done" sx={{ bgcolor: "#f0fdf4", color: "#15803d", height: 20, fontSize: "0.65rem" }} />
                            ) : (
                              <Chip size="small" icon={<ErrorOutline sx={{ fontSize: "12px !important" }} />} label="Open" color="error" sx={{ height: 20, fontSize: "0.65rem" }} />
                            )}
                          </TableCell>
                          <TableCell align="right" onClick={(e) => e.stopPropagation()}>
                            <Tooltip title={issue.followed ? "Unfollow" : "Follow"}>
                              <IconButton size="small" onClick={(e) => toggleFollowInline(issue, e)} sx={{ color: "#ca8a04", p: 0.5 }}>
                                {issue.followed ? <Star fontSize="small" /> : <StarBorder fontSize="small" />}
                              </IconButton>
                            </Tooltip>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              )}
            </Box>
          )}
        </Paper>
      </Container>

      {/* ISSUE DETAIL DIALOG */}
      <Dialog open={!!selected} onClose={() => setSelected(null)} maxWidth="sm" fullWidth PaperProps={{ sx: { borderRadius: 2.5 } }}>
        {selected && (
          <>
            <DialogTitle sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", bgcolor: "#fef2f2", py: 1.5 }}>
              <Typography fontWeight={700} fontSize={{ xs: "0.95rem", sm: "1.05rem" }} sx={{ pr: 1 }}>{selected.label}</Typography>
              <IconButton onClick={() => setSelected(null)} size="small"><Close fontSize="small" /></IconButton>
            </DialogTitle>
            <DialogContent dividers sx={{ p: { xs: 1.5, sm: 2.5 } }}>
              <Stack spacing={1.8}>
                <Stack direction="row" spacing={2} flexWrap="wrap">
                  <Stack direction="row" alignItems="center" spacing={0.6}>
                    <CalendarMonth sx={{ fontSize: 16, color: "text.secondary" }} />
                    <Typography variant="body2">{selected.date}</Typography>
                  </Stack>
                  <Stack direction="row" alignItems="center" spacing={0.6}>
                    <Person sx={{ fontSize: 16, color: "text.secondary" }} />
                    <Typography variant="body2">{selected.teacher?.name || "-"}</Typography>
                  </Stack>
                </Stack>

                <Box>
                  <Typography variant="caption" color="text.secondary">SECTION</Typography>
                  <Typography variant="body2">{SECTION_LABELS[selected.section]}</Typography>
                </Box>

                <Box>
                  <Typography variant="caption" color="text.secondary">TEACHER'S REMARK</Typography>
                  <Typography variant="body2">
                    {selected.remark || (selected.checked === false ? "Item was left unchecked — no remark given." : "-")}
                  </Typography>
                </Box>

                <Divider />

                <TextField
                  select size="small" label="Status" value={statusDraft}
                  onChange={(e) => setStatusDraft(e.target.value)}
                >
                  <MenuItem value="open">Open</MenuItem>
                  <MenuItem value="resolved">Resolved</MenuItem>
                </TextField>

                <TextField
                  label="Your remark / action taken"
                  multiline minRows={3} fullWidth
                  placeholder="e.g. Spoke to housekeeping staff, issue fixed on 26 Aug"
                  value={adminRemarkDraft}
                  onChange={(e) => setAdminRemarkDraft(e.target.value)}
                />

                <FormControlLabel
                  control={<Switch checked={followedDraft} onChange={(e) => setFollowedDraft(e.target.checked)} />}
                  label={<Typography fontSize="0.85rem">Follow this issue (show it in my followed list)</Typography>}
                />

                {saveMsg && <Alert severity={saveMsg === "Saved." ? "success" : "error"}>{saveMsg}</Alert>}
              </Stack>
            </DialogContent>
            <DialogActions sx={{ px: 2.5, py: 1.5 }}>
              <Button onClick={() => setSelected(null)}>Cancel</Button>
              <Button
                variant="contained"
                disabled={saving}
                onClick={saveIssue}
                sx={{ bgcolor: "#7e22ce", "&:hover": { bgcolor: "#6b21a8" } }}
              >
                {saving ? "Saving..." : "Save"}
              </Button>
            </DialogActions>
          </>
        )}
      </Dialog>
    </Box>
  );
}

export default function IssuesPage() {
  return (
    <ProtectedRoute role="superadmin">
      <IssuesInner />
    </ProtectedRoute>
  );
}
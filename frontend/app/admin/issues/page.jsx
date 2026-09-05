
"use client";

import { useEffect, useState } from "react";
import {
  Box,
  Container,
  Typography,
  Paper,
  Grid,
  Card,
  CardContent,
  Table,
  TableHead,
  TableRow,
  TableCell,
  TableBody,
  TableContainer,
  Chip,
  Stack,
  CircularProgress,
  IconButton,
  Tooltip,
  Divider,
  TextField,
  MenuItem,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Switch,
  FormControlLabel,
  Alert,
  Tabs,
  Tab,
} from "@mui/material";

import {
  ReportProblem,
  Star,
  StarBorder,
  Close,
  CheckCircle,
  ErrorOutline,
  FilterAltOff,
  Person,
  CalendarMonth,
  Groups,
} from "@mui/icons-material";

import ProtectedRoute from "../../../components/ProtectedRoute";
import Navbar from "../../../components/Navbar";
import api from "../../../lib/api";

const SECTION_LABELS = {
  morningChecks: "Morning readiness check",
  middayChecks: "Mid-day infrastructure & order inspection",
  afternoonChecks: "Afternoon maintenance round",
};

/*
|--------------------------------------------------------------------------
| SAFE ARRAY HELPER
|--------------------------------------------------------------------------
| API kabhi array directly bhej sakti hai:
|   [...]
|
| Ya:
|   { data: [...] }
|
| Ya:
|   { issues: [...] }
|
| Ya:
|   { summary: [...] }
|
| Ye helper in sab situations me safe array return karega.
|--------------------------------------------------------------------------
*/
const getSafeArray = (value, keys = []) => {
  if (Array.isArray(value)) {
    return value;
  }

  if (value && typeof value === "object") {
    for (const key of keys) {
      if (Array.isArray(value[key])) {
        return value[key];
      }
    }

    if (value.data && Array.isArray(value.data)) {
      return value.data;
    }
  }

  return [];
};

/*
|--------------------------------------------------------------------------
| SAFE NUMBER
|--------------------------------------------------------------------------
*/
const safeNumber = (value) => {
  const number = Number(value);

  return Number.isFinite(number) ? number : 0;
};

function IssuesInner() {
  const [tab, setTab] = useState(0);

  /*
  |--------------------------------------------------------------------------
  | ALWAYS ARRAYS
  |--------------------------------------------------------------------------
  */
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

  /*
  |--------------------------------------------------------------------------
  | LOAD SUMMARY
  |--------------------------------------------------------------------------
  */
  const loadSummary = async () => {
    setLoadingSummary(true);

    try {
      const res = await api.get("/reports/issues/summary");

      const responseData = res?.data;

      const safeSummary = getSafeArray(responseData, [
        "summary",
        "data",
        "results",
        "items",
      ]);

      setSummary(safeSummary);
    } catch (error) {
      console.error("Failed to load issue summary:", error);

      setSummary([]);
    } finally {
      setLoadingSummary(false);
    }
  };

  /*
  |--------------------------------------------------------------------------
  | LOAD ISSUES
  |--------------------------------------------------------------------------
  */
const loadIssues = async (filters = {}) => {
  setLoadingList(true);

  try {
    const label =
      filters.label !== undefined
        ? filters.label
        : labelFilter;

    const status =
      filters.status !== undefined
        ? filters.status
        : statusFilter;

    const followed =
      filters.followed !== undefined
        ? filters.followed
        : followedOnly;

    const params = {};

    // Backend support ke liye params bhi bhej rahe hain
    if (label) {
      params.label = label;
    }

    if (status) {
      params.status = status;
    }

    if (followed) {
      params.followed = "true";
    }

    const res = await api.get("/reports/issues", {
      params,
    });

    const responseData = res?.data;

    const allIssues = getSafeArray(responseData, [
      "issues",
      "data",
      "results",
      "items",
    ]);

    /*
    |--------------------------------------------------------------------------
    | FRONTEND FILTER
    |--------------------------------------------------------------------------
    | Backend agar filters ignore bhi kare, frontend correctly filter karega.
    |--------------------------------------------------------------------------
    */

    const normalizedLabel = String(label || "")
      .trim()
      .toLowerCase();

    const filteredIssues = allIssues.filter((issue) => {
      if (!issue || typeof issue !== "object") {
        return false;
      }

      // -------------------------------------------------------------
      // PROBLEM / LABEL FILTER
      // -------------------------------------------------------------
      if (normalizedLabel) {
        const issueLabel = String(
          issue.label || ""
        )
          .trim()
          .toLowerCase();

        if (issueLabel !== normalizedLabel) {
          return false;
        }
      }

      // -------------------------------------------------------------
      // STATUS FILTER
      // -------------------------------------------------------------
      if (status) {
        const issueStatus =
          issue.status === "resolved"
            ? "resolved"
            : "open";

        if (issueStatus !== status) {
          return false;
        }
      }

      // -------------------------------------------------------------
      // FOLLOWED FILTER
      // -------------------------------------------------------------
      if (followed) {
        if (issue.followed !== true) {
          return false;
        }
      }

      return true;
    });

    setIssues(filteredIssues);
  } catch (error) {
    console.error(
      "Failed to load issues:",
      error
    );

    setIssues([]);
  } finally {
    setLoadingList(false);
  }
};

  /*
  |--------------------------------------------------------------------------
  | INITIAL LOAD
  |--------------------------------------------------------------------------
  */
  useEffect(() => {
    loadSummary();
    loadIssues({});
  }, []);

  /*
  |--------------------------------------------------------------------------
  | PROBLEM FILTER
  |--------------------------------------------------------------------------
  */
const applyProblemFilter = (label) => {
  const next =
    labelFilter === label
      ? ""
      : label;

  setLabelFilter(next);

  loadIssues({
    label: next,
    status: statusFilter,
    followed: followedOnly,
  });

  setTab(1);
};
  /*
  |--------------------------------------------------------------------------
  | STATUS FILTER
  |--------------------------------------------------------------------------
  */
const applyStatusFilter = (val) => {
  setStatusFilter(val);

  loadIssues({
    label: labelFilter,
    status: val,
    followed: followedOnly,
  });

  setTab(1);
};

  /*
  |--------------------------------------------------------------------------
  | FOLLOWED FILTER
  |--------------------------------------------------------------------------
  */
const applyFollowedOnly = (val) => {
  setFollowedOnly(val);

  loadIssues({
    label: labelFilter,
    status: statusFilter,
    followed: val,
  });

  setTab(1);
};
  /*
  |--------------------------------------------------------------------------
  | RESET FILTERS
  |--------------------------------------------------------------------------
  */
const resetFilters = () => {
  setLabelFilter("");
  setStatusFilter("");
  setFollowedOnly(false);

  loadIssues({
    label: "",
    status: "",
    followed: false,
  });

  setTab(1);
};

  /*
  |--------------------------------------------------------------------------
  | OPEN ISSUE
  |--------------------------------------------------------------------------
  */
  const openIssue = (issue) => {
    if (!issue || typeof issue !== "object") {
      return;
    }

    setSelected(issue);

    setAdminRemarkDraft(
      typeof issue.adminRemark === "string"
        ? issue.adminRemark
        : ""
    );

    setStatusDraft(
      issue.status === "resolved"
        ? "resolved"
        : "open"
    );

    setFollowedDraft(Boolean(issue.followed));

    setSaveMsg("");
  };

  /*
  |--------------------------------------------------------------------------
  | TOGGLE FOLLOW INLINE
  |--------------------------------------------------------------------------
  */
const toggleFollowInline = async (issue, e) => {
  e?.stopPropagation();

  if (!issue?.reportId) {
    return;
  }

  try {
    await api.patch(
      `/reports/${issue.reportId}/check-status`,
      {
        section:
          issue.section ||
          issue.sectionKey,

        index:
          issue.index ??
          issue.itemIndex,

        followed: !Boolean(issue.followed),
      }
    );

    await loadIssues({
      label: labelFilter,
      status: statusFilter,
      followed: followedOnly,
    });

    await loadSummary();
  } catch (error) {
    console.error(
      "Failed to update follow status:",
      error
    );
  }
};

  /*
  |--------------------------------------------------------------------------
  | SAVE ISSUE
  |--------------------------------------------------------------------------
  */
  const saveIssue = async () => {
    if (!selected?.reportId) {
      return;
    }

    try {
      setSaving(true);
      setSaveMsg("");

      await api.patch(
        `/reports/${selected.reportId}/check-status`,
        {
          section: selected.section,
          index: selected.index,
          status: statusDraft,
          adminRemark: adminRemarkDraft,
          followed: followedDraft,
        }
      );

      setSaveMsg("Saved.");

      await loadIssues({});
      await loadSummary();

      setTimeout(() => {
        setSelected(null);
      }, 700);
    } catch (err) {
      console.error("Failed to save issue:", err);

      setSaveMsg(
        err?.response?.data?.message ||
          "Could not save."
      );
    } finally {
      setSaving(false);
    }
  };

  /*
  |--------------------------------------------------------------------------
  | EXTRA SAFE VARIABLES
  |--------------------------------------------------------------------------
  */
  const summaryList = Array.isArray(summary)
    ? summary
    : [];

  const issuesList = Array.isArray(issues)
    ? issues
    : [];

  /*
  |--------------------------------------------------------------------------
  | TOP PROBLEM
  |--------------------------------------------------------------------------
  */
  const topProblem =
    summaryList.length > 0
      ? summaryList[0]
      : null;

  /*
  |--------------------------------------------------------------------------
  | TOTAL OPEN
  |--------------------------------------------------------------------------
  */
  const totalOpen = summaryList.reduce(
    (total, group) => {
      return (
        total +
        safeNumber(group?.openCount)
      );
    },
    0
  );

  return (
    <Box
      sx={{
        bgcolor: "#faf9fb",
        minHeight: "100vh",
      }}
    >
      <Navbar />

      <Container
        maxWidth="lg"
        sx={{
          py: {
            xs: 2,
            sm: 3,
          },
        }}
      >
        {/* =========================================================
            HEADER
        ========================================================= */}

        <Stack
          direction="row"
          alignItems="center"
          spacing={1}
          sx={{
            mb: 2,
          }}
        >
          <Box
            sx={{
              width: {
                xs: 32,
                sm: 40,
              },
              height: {
                xs: 32,
                sm: 40,
              },
              borderRadius: 2,
              bgcolor: "#b91c1c",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
            }}
          >
            <ReportProblem
              sx={{
                color: "white",
                fontSize: {
                  xs: 18,
                  sm: 22,
                },
              }}
            />
          </Box>

          <Box
            sx={{
              minWidth: 0,
            }}
          >
            <Typography
              variant="h6"
              fontWeight={800}
              fontSize={{
                xs: "1.05rem",
                sm: "1.5rem",
              }}
            >
              Issue Tracker
            </Typography>

            <Typography
              variant="body2"
              color="text.secondary"
              fontSize={{
                xs: "0.72rem",
                sm: "0.875rem",
              }}
              noWrap
            >
              Most reported problems across all checklists
            </Typography>
          </Box>
        </Stack>

        {/* =========================================================
            SUMMARY CARDS
        ========================================================= */}

        <Grid
          container
          spacing={{
            xs: 1,
            sm: 2,
          }}
          sx={{
            mb: 2,
          }}
        >
          {/* Problems */}

          <Grid item xs={4}>
            <Card
              elevation={0}
              sx={{
                border: "1px solid #e2e8f0",
                borderRadius: 2,
                height: "100%",
              }}
            >
              <CardContent
                sx={{
                  p: {
                    xs: 1,
                    sm: 2,
                  },
                  "&:last-child": {
                    pb: {
                      xs: 1,
                      sm: 2,
                    },
                  },
                }}
              >
                <Typography
                  color="text.secondary"
                  fontSize={{
                    xs: "0.6rem",
                    sm: "0.8rem",
                  }}
                  noWrap
                >
                  Problems
                </Typography>

                <Typography
                  fontWeight={800}
                  fontSize={{
                    xs: "1.05rem",
                    sm: "1.5rem",
                  }}
                >
                  {summaryList.length}
                </Typography>
              </CardContent>
            </Card>
          </Grid>

          {/* Open */}

          <Grid item xs={4}>
            <Card
              elevation={0}
              sx={{
                border: "1px solid #e2e8f0",
                borderRadius: 2,
                height: "100%",
              }}
            >
              <CardContent
                sx={{
                  p: {
                    xs: 1,
                    sm: 2,
                  },
                  "&:last-child": {
                    pb: {
                      xs: 1,
                      sm: 2,
                    },
                  },
                }}
              >
                <Typography
                  color="text.secondary"
                  fontSize={{
                    xs: "0.6rem",
                    sm: "0.8rem",
                  }}
                  noWrap
                >
                  Open
                </Typography>

                <Typography
                  fontWeight={800}
                  fontSize={{
                    xs: "1.05rem",
                    sm: "1.5rem",
                  }}
                  color="#dc2626"
                >
                  {totalOpen}
                </Typography>
              </CardContent>
            </Card>
          </Grid>

          {/* Top Problem */}

          <Grid item xs={4}>
            <Card
              elevation={0}
              sx={{
                border: "1px solid #e2e8f0",
                borderRadius: 2,
                height: "100%",
              }}
            >
              <CardContent
                sx={{
                  p: {
                    xs: 1,
                    sm: 2,
                  },
                  "&:last-child": {
                    pb: {
                      xs: 1,
                      sm: 2,
                    },
                  },
                }}
              >
                <Typography
                  color="text.secondary"
                  fontSize={{
                    xs: "0.6rem",
                    sm: "0.8rem",
                  }}
                  noWrap
                >
                  Top Problem
                </Typography>

                <Typography
                  fontWeight={800}
                  fontSize={{
                    xs: "0.68rem",
                    sm: "0.9rem",
                  }}
                  noWrap
                >
                  {topProblem?.label || "-"}
                </Typography>
              </CardContent>
            </Card>
          </Grid>
        </Grid>

        {/* =========================================================
            TABS
        ========================================================= */}

        <Paper
          elevation={0}
          sx={{
            border: "1px solid #e2e8f0",
            borderRadius: 2.5,
            overflow: "hidden",
          }}
        >
          <Tabs
            value={tab}
            onChange={(e, v) => setTab(v)}
            variant="fullWidth"
            sx={{
              borderBottom: "1px solid #e2e8f0",
              minHeight: 42,

              "& .MuiTab-root": {
                minHeight: 42,
                fontSize: {
                  xs: "0.75rem",
                  sm: "0.875rem",
                },
                fontWeight: 600,
                textTransform: "none",
              },

              "& .Mui-selected": {
                color: "#361fb8 !important",
              },

              "& .MuiTabs-indicator": {
                bgcolor: "#321a9a",
              },
            }}
          >
            <Tab label="Common Problems" />

            <Tab
              label={
                `All Issues${
                  issuesList.length
                    ? ` (${issuesList.length})`
                    : ""
                }`
              }
            />
          </Tabs>

          {/* =======================================================
              TAB 0
          ======================================================= */}

          {tab === 0 && (
            <Box
              sx={{
                p: {
                  xs: 1.2,
                  sm: 2.5,
                },
              }}
            >
              {loadingSummary ? (
                <Box
                  sx={{
                    display: "flex",
                    justifyContent: "center",
                    py: 4,
                  }}
                >
                  <CircularProgress
                    size={22}
                    sx={{
                      color: "#7e22ce",
                    }}
                  />
                </Box>
              ) : summaryList.length === 0 ? (
                <Typography
                  color="text.secondary"
                  fontSize="0.85rem"
                  sx={{
                    py: 2,
                    textAlign: "center",
                  }}
                >
                  No issues reported yet.
                </Typography>
              ) : (
                <Stack spacing={1}>
                  {summaryList.map((g, index) => {
                    /*
                    | Safe group object
                    */
                    const group =
                      g &&
                      typeof g === "object"
                        ? g
                        : {};

                    const label =
                      group.label || "Unknown problem";

                    const active =
                      labelFilter === label;

                    const teacherCount =
                      safeNumber(
                        group.teacherCount
                      );

                    const totalCount =
                      safeNumber(
                        group.totalCount
                      );

                    const openCount =
                      safeNumber(
                        group.openCount
                      );

                    const resolvedCount =
                      safeNumber(
                        group.resolvedCount
                      );

                    const followedCount =
                      safeNumber(
                        group.followedCount
                      );

                    return (
                      <Box
                        key={`${label}-${index}`}
                        onClick={() =>
                          applyProblemFilter(label)
                        }
                        sx={{
                          cursor: "pointer",
                          border: active
                            ? "1.5px solid #7e22ce"
                            : "1px solid #e2e8f0",
                          bgcolor: active
                            ? "#faf5ff"
                            : "white",
                          borderRadius: 2,
                          px: 1.4,
                          py: 1,
                          transition: "all 0.15s",
                          "&:hover": {
                            borderColor: "#7e22ce",
                          },
                        }}
                      >
                        <Stack
                          direction="row"
                          justifyContent="space-between"
                          alignItems="flex-start"
                          spacing={1}
                        >
                          <Typography
                            fontSize={{
                              xs: "0.8rem",
                              sm: "0.9rem",
                            }}
                            fontWeight={600}
                            sx={{
                              flex: 1,
                              minWidth: 0,
                            }}
                          >
                            {label}
                          </Typography>

                          <Chip
                            icon={
                              <Groups
                                sx={{
                                  fontSize:
                                    "13px !important",
                                }}
                              />
                            }
                            label={`${teacherCount} ${
                              teacherCount === 1
                                ? "person"
                                : "people"
                            }`}
                            size="small"
                            sx={{
                              bgcolor: "#b91c1c",
                              color: "white",
                              fontWeight: 700,
                              height: 22,
                              fontSize: "0.65rem",
                              flexShrink: 0,
                            }}
                          />
                        </Stack>

                        <Stack
                          direction="row"
                          spacing={1.2}
                          mt={0.6}
                          flexWrap="wrap"
                        >
                          <Typography
                            fontSize={{
                              xs: "0.62rem",
                              sm: "0.7rem",
                            }}
                            color="text.secondary"
                          >
                            {totalCount} total occurrence
                            {totalCount !== 1
                              ? "s"
                              : ""}
                          </Typography>

                          <Typography
                            fontSize={{
                              xs: "0.62rem",
                              sm: "0.7rem",
                            }}
                            color="#dc2626"
                          >
                            {openCount} open
                          </Typography>

                          <Typography
                            fontSize={{
                              xs: "0.62rem",
                              sm: "0.7rem",
                            }}
                            color="#15803d"
                          >
                            {resolvedCount} resolved
                          </Typography>

                          {followedCount > 0 && (
                            <Typography
                              fontSize={{
                                xs: "0.62rem",
                                sm: "0.7rem",
                              }}
                              color="#a16207"
                            >
                              ★ {followedCount} followed
                            </Typography>
                          )}
                        </Stack>
                      </Box>
                    );
                  })}
                </Stack>
              )}
            </Box>
          )}

          {/* =======================================================
              TAB 1
          ======================================================= */}

          {tab === 1 && (
            <Box
              sx={{
                p: {
                  xs: 1.2,
                  sm: 2.5,
                },
              }}
            >
              {/* FILTERS */}

              <Stack
                spacing={1}
                sx={{
                  mb: 1.5,
                }}
              >
                {labelFilter && (
                  <Chip
                    label={`Problem: ${labelFilter}`}
                    onDelete={() =>
                      applyProblemFilter(
                        labelFilter
                      )
                    }
                    size="small"
                    sx={{
                      bgcolor: "#f3e8ff",
                      color: "#6b21a8",
                      fontWeight: 600,
                      alignSelf: "flex-start",
                    }}
                  />
                )}

                <Stack
                  direction="row"
                  spacing={1}
                  sx={{
                    flexWrap: "wrap",
                    gap: 1,
                  }}
                >
                  <TextField
                    select
                    size="small"
                    label="Status"
                    value={statusFilter}
                    onChange={(e) =>
                      applyStatusFilter(
                        e.target.value
                      )
                    }
                    sx={{
                      flex: {
                        xs: "1 1 47%",
                        sm: "0 1 140px",
                      },
                    }}
                  >
                    <MenuItem value="">
                      All
                    </MenuItem>

                    <MenuItem value="open">
                      Open
                    </MenuItem>

                    <MenuItem value="resolved">
                      Resolved
                    </MenuItem>
                  </TextField>

                  <FormControlLabel
                    control={
                      <Switch
                        size="small"
                        checked={followedOnly}
                        onChange={(e) =>
                          applyFollowedOnly(
                            e.target.checked
                          )
                        }
                      />
                    }
                    label={
                      <Typography fontSize="0.78rem">
                        Followed by me
                      </Typography>
                    }
                    sx={{
                      flex: {
                        xs: "1 1 47%",
                        sm: "0 0 auto",
                      },
                      ml: 0,
                    }}
                  />

                  <Box
                    sx={{
                      flexGrow: 1,
                      display: {
                        xs: "none",
                        sm: "block",
                      },
                    }}
                  />

                  <Button
                    size="small"
                    startIcon={
                      <FilterAltOff fontSize="small" />
                    }
                    onClick={resetFilters}
                    color="inherit"
                    sx={{
                      fontSize: "0.72rem",
                    }}
                  >
                    Reset
                  </Button>
                </Stack>
              </Stack>

              <Divider
                sx={{
                  mb: 1.5,
                }}
              />

              {/* =====================================================
                  ISSUE LIST
              ===================================================== */}

              {loadingList ? (
                <Box
                  sx={{
                    display: "flex",
                    justifyContent: "center",
                    py: 4,
                  }}
                >
                  <CircularProgress
                    size={22}
                    sx={{
                      color: "#7e22ce",
                    }}
                  />
                </Box>
              ) : issuesList.length === 0 ? (
                <Typography
                  color="text.secondary"
                  fontSize="0.85rem"
                  sx={{
                    py: 2,
                    textAlign: "center",
                  }}
                >
                  No issues match these filters.
                </Typography>
              ) : (
                <TableContainer
                  sx={{
                    overflowX: "auto",
                  }}
                >
                  <Table size="small">
                    <TableHead>
                      <TableRow
                        sx={{
                          "& th": {
                            bgcolor: "#fef2f2",
                            fontWeight: 700,
                            color: "#991b1b",
                            fontSize: {
                              xs: "0.68rem",
                              sm: "0.8rem",
                            },
                            py: 1,
                            px: {
                              xs: 0.8,
                              sm: 2,
                            },
                          },
                        }}
                      >
                        <TableCell>
                          Date
                        </TableCell>

                        <TableCell>
                          Teacher
                        </TableCell>

                        <TableCell
                          sx={{
                            display: {
                              xs: "none",
                              sm: "table-cell",
                            },
                          }}
                        >
                          Problem
                        </TableCell>

                        <TableCell
                          sx={{
                            display: {
                              xs: "none",
                              md: "table-cell",
                            },
                          }}
                        >
                          Remark
                        </TableCell>

                        <TableCell>
                          Status
                        </TableCell>

                        <TableCell align="right">
                          Follow
                        </TableCell>
                      </TableRow>
                    </TableHead>

                    <TableBody>
                      {issuesList.map(
                        (issue, index) => {
                          /*
                          | Safe issue object
                          */
                          const item =
                            issue &&
                            typeof issue ===
                              "object"
                              ? issue
                              : {};

                          const rowKey =
                            item.reportId ||
                            item._id ||
                            `issue-${index}`;

                          const teacherName =
                            item.teacher?.name ||
                            item.teacher?.fullName ||
                            "-";

                          const problemLabel =
                            item.label ||
                            "Unknown problem";

                          const sectionLabel =
                            SECTION_LABELS[
                              item.section
                            ] ||
                            item.section ||
                            "-";

                          const remark =
                            item.remark ||
                            (item.checked === false
                              ? "Left unchecked"
                              : "-");

                          const isResolved =
                            item.status ===
                            "resolved";

                          return (
                            <TableRow
                              key={`${rowKey}-${item.section || "section"}-${item.index ?? index}`}
                              hover
                              sx={{
                                cursor: "pointer",
                                "&:hover": {
                                  bgcolor: "#fef2f2",
                                },
                                "& td": {
                                  px: {
                                    xs: 0.8,
                                    sm: 2,
                                  },
                                  py: {
                                    xs: 0.7,
                                    sm: 1.2,
                                  },
                                },
                              }}
                              onClick={() =>
                                openIssue(item)
                              }
                            >
                              <TableCell
                                sx={{
                                  whiteSpace:
                                    "nowrap",
                                  fontSize: {
                                    xs: "0.7rem",
                                    sm: "0.875rem",
                                  },
                                }}
                              >
                                {item.date || "-"}
                              </TableCell>

                              <TableCell
                                sx={{
                                  fontSize: {
                                    xs: "0.7rem",
                                    sm: "0.875rem",
                                  },
                                  maxWidth: {
                                    xs: 80,
                                    sm: "none",
                                  },
                                  overflow:
                                    "hidden",
                                  textOverflow:
                                    "ellipsis",
                                  whiteSpace:
                                    "nowrap",
                                }}
                              >
                                {teacherName}
                              </TableCell>

                              <TableCell
                                sx={{
                                  display: {
                                    xs: "none",
                                    sm: "table-cell",
                                  },
                                  maxWidth: 220,
                                }}
                              >
                                <Typography
                                  fontSize="0.85rem"
                                  noWrap
                                >
                                  {problemLabel}
                                </Typography>

                                <Typography
                                  variant="caption"
                                  color="text.secondary"
                                >
                                  {sectionLabel}
                                </Typography>
                              </TableCell>

                              <TableCell
                                sx={{
                                  display: {
                                    xs: "none",
                                    md: "table-cell",
                                  },
                                  maxWidth: 200,
                                }}
                              >
                                <Typography
                                  fontSize="0.82rem"
                                  color="text.secondary"
                                  noWrap
                                >
                                  {remark}
                                </Typography>
                              </TableCell>

                              <TableCell>
                                {isResolved ? (
                                  <Chip
                                    size="small"
                                    icon={
                                      <CheckCircle
                                        sx={{
                                          fontSize:
                                            "12px !important",
                                        }}
                                      />
                                    }
                                    label="Done"
                                    sx={{
                                      bgcolor:
                                        "#f0fdf4",
                                      color:
                                        "#15803d",
                                      height: 20,
                                      fontSize:
                                        "0.65rem",
                                    }}
                                  />
                                ) : (
                                  <Chip
                                    size="small"
                                    icon={
                                      <ErrorOutline
                                        sx={{
                                          fontSize:
                                            "12px !important",
                                        }}
                                      />
                                    }
                                    label="Open"
                                    color="error"
                                    sx={{
                                      height: 20,
                                      fontSize:
                                        "0.65rem",
                                    }}
                                  />
                                )}
                              </TableCell>

                              <TableCell
                                align="right"
                                onClick={(e) =>
                                  e.stopPropagation()
                                }
                              >
                                <Tooltip
                                  title={
                                    item.followed
                                      ? "Unfollow"
                                      : "Follow"
                                  }
                                >
                                  <IconButton
                                    size="small"
                                    onClick={(e) =>
                                      toggleFollowInline(
                                        item,
                                        e
                                      )
                                    }
                                    sx={{
                                      color:
                                        "#ca8a04",
                                      p: 0.5,
                                    }}
                                  >
                                    {item.followed ? (
                                      <Star fontSize="small" />
                                    ) : (
                                      <StarBorder fontSize="small" />
                                    )}
                                  </IconButton>
                                </Tooltip>
                              </TableCell>
                            </TableRow>
                          );
                        }
                      )}
                    </TableBody>
                  </Table>
                </TableContainer>
              )}
            </Box>
          )}
        </Paper>
      </Container>

      {/* =========================================================
          ISSUE DETAIL DIALOG
      ========================================================= */}

      <Dialog
        open={Boolean(selected)}
        onClose={() => setSelected(null)}
        maxWidth="sm"
        fullWidth
        PaperProps={{
          sx: {
            borderRadius: 2.5,
          },
        }}
      >
        {selected && (
          <>
            <DialogTitle
              sx={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                bgcolor: "#fef2f2",
                py: 1.5,
              }}
            >
              <Typography
                fontWeight={700}
                fontSize={{
                  xs: "0.95rem",
                  sm: "1.05rem",
                }}
                sx={{
                  pr: 1,
                }}
              >
                {selected.label ||
                  "Issue Details"}
              </Typography>

              <IconButton
                onClick={() =>
                  setSelected(null)
                }
                size="small"
              >
                <Close fontSize="small" />
              </IconButton>
            </DialogTitle>

            <DialogContent
              dividers
              sx={{
                p: {
                  xs: 1.5,
                  sm: 2.5,
                },
              }}
            >
              <Stack spacing={1.8}>
                {/* DATE + TEACHER */}

                <Stack
                  direction="row"
                  spacing={2}
                  flexWrap="wrap"
                >
                  <Stack
                    direction="row"
                    alignItems="center"
                    spacing={0.6}
                  >
                    <CalendarMonth
                      sx={{
                        fontSize: 16,
                        color:
                          "text.secondary",
                      }}
                    />

                    <Typography variant="body2">
                      {selected.date || "-"}
                    </Typography>
                  </Stack>

                  <Stack
                    direction="row"
                    alignItems="center"
                    spacing={0.6}
                  >
                    <Person
                      sx={{
                        fontSize: 16,
                        color:
                          "text.secondary",
                      }}
                    />

                    <Typography variant="body2">
                      {selected.teacher?.name ||
                        selected.teacher
                          ?.fullName ||
                        "-"}
                    </Typography>
                  </Stack>
                </Stack>

                {/* SECTION */}

                <Box>
                  <Typography
                    variant="caption"
                    color="text.secondary"
                  >
                    SECTION
                  </Typography>

                  <Typography variant="body2">
                    {SECTION_LABELS[
                      selected.section
                    ] ||
                      selected.section ||
                      "-"}
                  </Typography>
                </Box>

                {/* TEACHER REMARK */}

                <Box>
                  <Typography
                    variant="caption"
                    color="text.secondary"
                  >
                    TEACHER'S REMARK
                  </Typography>

                  <Typography variant="body2">
                    {selected.remark ||
                      (selected.checked === false
                        ? "Item was left unchecked — no remark given."
                        : "-")}
                  </Typography>
                </Box>

                <Divider />

                {/* STATUS */}

                <TextField
                  select
                  size="small"
                  label="Status"
                  value={statusDraft}
                  onChange={(e) =>
                    setStatusDraft(
                      e.target.value
                    )
                  }
                >
                  <MenuItem value="open">
                    Open
                  </MenuItem>

                  <MenuItem value="resolved">
                    Resolved
                  </MenuItem>
                </TextField>

                {/* ADMIN REMARK */}

                <TextField
                  label="Your remark / action taken"
                  multiline
                  minRows={3}
                  fullWidth
                  placeholder="e.g. Spoke to housekeeping staff, issue fixed on 26 Aug"
                  value={adminRemarkDraft}
                  onChange={(e) =>
                    setAdminRemarkDraft(
                      e.target.value
                    )
                  }
                />

                {/* FOLLOW */}

                <FormControlLabel
                  control={
                    <Switch
                      checked={followedDraft}
                      onChange={(e) =>
                        setFollowedDraft(
                          e.target.checked
                        )
                      }
                    />
                  }
                  label={
                    <Typography fontSize="0.85rem">
                      Follow this issue (show it
                      in my followed list)
                    </Typography>
                  }
                />

                {/* SAVE MESSAGE */}

                {saveMsg && (
                  <Alert
                    severity={
                      saveMsg === "Saved."
                        ? "success"
                        : "error"
                    }
                  >
                    {saveMsg}
                  </Alert>
                )}
              </Stack>
            </DialogContent>

            <DialogActions
              sx={{
                px: 2.5,
                py: 1.5,
              }}
            >
              <Button
                onClick={() =>
                  setSelected(null)
                }
              >
                Cancel
              </Button>

              <Button
                variant="contained"
                disabled={saving}
                onClick={saveIssue}
                sx={{
                  bgcolor: "#7e22ce",
                  "&:hover": {
                    bgcolor: "#6b21a8",
                  },
                }}
              >
                {saving
                  ? "Saving..."
                  : "Save"}
              </Button>
            </DialogActions>
          </>
        )}
      </Dialog>
    </Box>
  );
}

/*
|--------------------------------------------------------------------------
| PAGE
|--------------------------------------------------------------------------
*/

export default function IssuesPage() {
  return (
    <ProtectedRoute role="superadmin">
      <IssuesInner />
    </ProtectedRoute>
  );
}

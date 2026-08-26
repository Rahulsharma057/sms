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
  TextField,
  MenuItem,
  Chip,
  Dialog,
  DialogContent,
  DialogActions,
  IconButton,
  Button,
  Stack,
  CircularProgress,
  Tooltip,
  Divider,
  Alert,
  Checkbox,
  LinearProgress,
  ToggleButtonGroup,
  ToggleButton,
} from "@mui/material";

import {
  Close,
  FilterAltOff,
  Visibility,
  PictureAsPdf,
  Share,
  Assignment,
  Warning,
  CalendarMonth,
  Description,
  ViewList,
  ViewModule,
  Person,
  CheckCircle,
} from "@mui/icons-material";

import ProtectedRoute from "../../../components/ProtectedRoute";
import Navbar from "../../../components/Navbar";
import api from "../../../lib/api";

const getToday = () => new Date().toISOString().slice(0, 10);

const CHECKLIST_SECTIONS = [
  {
    key: "morningChecks",
    title: "1. Morning readiness check",
    timing: "0830–0900 hrs",
  },
  {
    key: "middayChecks",
    title: "2. Mid-day infrastructure & order inspection",
    timing: "1100–1300 hrs",
  },
  {
    key: "afternoonChecks",
    title: "3. Afternoon maintenance round",
    timing: "1400–1600 hrs",
  },
];

const getTotalChecks = (report) =>
  CHECKLIST_SECTIONS.reduce(
    (sum, s) => sum + (report?.[s.key]?.length || 0),
    0
  );

const getCompletedChecks = (report) =>
  CHECKLIST_SECTIONS.reduce(
    (sum, s) =>
      sum + (report?.[s.key]?.filter((c) => c.checked).length || 0),
    0
);

/* =====================================================
   PDF GENERATION
===================================================== */

const PAGE_WIDTH = 210;
const PAGE_HEIGHT = 297;
const MARGIN_X = 14;
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN_X * 2;
const BOTTOM_LIMIT = 278;

const buildReportPdf = async (report) => {
  const { default: jsPDF } = await import("jspdf");

  const doc = new jsPDF({
    unit: "mm",
    format: "a4",
  });

  let y = 0;
  let page = 1;

  /* -------------------------------------------------
     HEADER / FOOTER
  ------------------------------------------------- */

  const drawHeader = () => {
    doc.setFillColor(30, 58, 95);
    doc.rect(0, 0, PAGE_WIDTH, 22, "F");

    doc.setTextColor(255, 255, 255);
    doc.setFont(undefined, "bold");
    doc.setFontSize(14);

    doc.text(
      "Duty Officer's Inspection Report",
      MARGIN_X,
      14
    );

    doc.setFont(undefined, "normal");
    doc.setFontSize(9);

    doc.text(
      report.date || "-",
      PAGE_WIDTH - MARGIN_X,
      14,
      { align: "right" }
    );

    doc.setTextColor(0, 0, 0);

    y = 30;
  };

  const drawFooter = () => {
    doc.setFont(undefined, "normal");
    doc.setFontSize(8);
    doc.setTextColor(148, 163, 184);

    doc.text(
      `Page ${page}`,
      PAGE_WIDTH / 2,
      PAGE_HEIGHT - 8,
      { align: "center" }
    );

    doc.setTextColor(0, 0, 0);
  };

  const newPage = () => {
    drawFooter();

    doc.addPage();

    page += 1;

    drawHeader();
  };

  const ensureSpace = (needed) => {
    if (y + needed > BOTTOM_LIMIT) {
      newPage();
    }
  };

  /* -------------------------------------------------
     SECTION TITLE
  ------------------------------------------------- */

  const sectionTitle = (title) => {
    ensureSpace(11);

    doc.setFillColor(243, 232, 255);

    doc.rect(
      MARGIN_X,
      y - 4.5,
      CONTENT_WIDTH,
      7.5,
      "F"
    );

    doc.setFont(undefined, "bold");
    doc.setFontSize(10.5);
    doc.setTextColor(76, 29, 149);

    doc.text(title, MARGIN_X + 2, y);

    doc.setTextColor(0, 0, 0);

    y += 8.5;
  };

  /* -------------------------------------------------
     INFO GRID
  ------------------------------------------------- */

  const infoGrid = (pairs) => {
    const colWidth = CONTENT_WIDTH / 2;

    pairs.forEach((row, i) => {
      const isNewRow = i % 2 === 0;

      if (isNewRow) {
        ensureSpace(14);
      }

      const x =
        MARGIN_X +
        (i % 2) * colWidth;

      const [label, value] = row;

      doc.setFont(undefined, "bold");
      doc.setFontSize(7.5);
      doc.setTextColor(100, 116, 139);

      doc.text(
        label.toUpperCase(),
        x,
        y
      );

      doc.setFont(undefined, "normal");
      doc.setFontSize(10);
      doc.setTextColor(15, 23, 42);

      const text = doc.splitTextToSize(
        value || "-",
        colWidth - 6
      );

      doc.text(
        text,
        x,
        y + 5
      );

      if (!isNewRow || i === pairs.length - 1) {
        y +=
          Math.max(
            text.length * 4.5,
            4.5
          ) + 8;
      }
    });
  };

  /* -------------------------------------------------
     TEXT BLOCK
  ------------------------------------------------- */

  const textBlock = (label, value) => {
    const text = doc.splitTextToSize(
      value?.trim() || "None",
      CONTENT_WIDTH - 4
    );

    const needed =
      6 +
      text.length * 4.6 +
      4;

    ensureSpace(needed);

    doc.setFont(undefined, "bold");
    doc.setFontSize(9);
    doc.setTextColor(51, 65, 85);

    doc.text(
      label,
      MARGIN_X,
      y
    );

    y += 5;

    doc.setFont(undefined, "normal");
    doc.setFontSize(9.5);
    doc.setTextColor(15, 23, 42);

    doc.text(
      text,
      MARGIN_X + 2,
      y
    );

    y +=
      text.length * 4.6 +
      5;
  };

  /* -------------------------------------------------
     CHECKLIST ITEM
  ------------------------------------------------- */

  const checklistItem = (item) => {
    const labelLines = doc.splitTextToSize(
      item.label || "",
      CONTENT_WIDTH - 12
    );

    const remarkLines = item.remark
      ? doc.splitTextToSize(
          `Remark: ${item.remark}`,
          CONTENT_WIDTH - 16
        )
      : [];

    const needed =
      labelLines.length * 4.6 +
      remarkLines.length * 4.2 +
      4;

    ensureSpace(needed);

    doc.setDrawColor(148, 163, 184);
    doc.setLineWidth(0.3);

    doc.rect(
      MARGIN_X,
      y - 3.2,
      3.6,
      3.6
    );

    if (item.checked) {
      doc.setFont(undefined, "bold");
      doc.setFontSize(8.5);
      doc.setTextColor(22, 101, 52);

      doc.text(
        "✓",
        MARGIN_X + 0.6,
        y - 0.3
      );

      doc.setTextColor(0, 0, 0);
    }

    doc.setFont(undefined, "normal");
    doc.setFontSize(9.5);
    doc.setTextColor(15, 23, 42);

    doc.text(
      labelLines,
      MARGIN_X + 7,
      y
    );

    y +=
      labelLines.length * 4.6;

    if (remarkLines.length) {
      doc.setFont(undefined, "italic");
      doc.setFontSize(8.5);
      doc.setTextColor(100, 116, 139);

      doc.text(
        remarkLines,
        MARGIN_X + 9,
        y
      );

      doc.setTextColor(0, 0, 0);

      y +=
        remarkLines.length * 4.2;
    }

    y += 1.5;
  };

  /* -------------------------------------------------
     BUILD PDF
  ------------------------------------------------- */

  drawHeader();

  const teacherLabel = report.teacher?.name
    ? `${report.teacher.name}${
        report.teacher.email
          ? ` (${report.teacher.email})`
          : ""
      }`
    : "-";

  infoGrid([
    ["Date", report.date],
    ["Teacher", teacherLabel],
    ["Duty Officer", report.dutyOfficerName],
    ["Organization / Centre", report.centreBatch],
  ]);

  const total = getTotalChecks(report);

  const completed =
    getCompletedChecks(report);

  const percentage =
    total > 0
      ? Math.round(
          (completed / total) * 100
        )
      : 0;

  ensureSpace(14);

  doc.setFont(undefined, "bold");
  doc.setFontSize(9.5);
  doc.setTextColor(15, 23, 42);

  doc.text(
    `${completed} of ${total} checks completed (${percentage}%)`,
    MARGIN_X,
    y
  );

  y += 4;

  doc.setDrawColor(226, 232, 240);
  doc.setFillColor(241, 245, 249);

  doc.roundedRect(
    MARGIN_X,
    y,
    CONTENT_WIDTH,
    3,
    1.5,
    1.5,
    "F"
  );

  doc.setFillColor(30, 58, 95);

  doc.roundedRect(
    MARGIN_X,
    y,
    (CONTENT_WIDTH * percentage) / 100,
    3,
    1.5,
    1.5,
    "F"
  );

  y += 9;

  /* CHECKLIST */
CHECKLIST_SECTIONS.forEach((section) => {
  const items = report[section.key] || [];
  if (items.length === 0) return;

  items.forEach((item) => checklistItem(item));

  y += 2;
});

  /* OBSERVATIONS */

  sectionTitle(
    "Summary of Key Observations"
  );

  textBlock(
    "Major positive observations",
    report.positiveObservations
  );

  textBlock(
    "Cleanliness / hygiene lapses noted",
    report.hygieneLapses
  );

  textBlock(
    "Maintenance items needing follow-up action",
    report.maintenanceFollowUp
  );

  /* URGENT MATTERS */

  const urgentText =
    report.urgentMatters?.trim() ||
    "None";

  const urgentLines =
    doc.splitTextToSize(
      urgentText,
      CONTENT_WIDTH - 6
    );

  const urgentBoxHeight =
    urgentLines.length * 4.6 +
    14;

  ensureSpace(
    urgentBoxHeight + 4
  );

  doc.setDrawColor(253, 230, 138);
  doc.setFillColor(255, 251, 235);

  doc.roundedRect(
    MARGIN_X,
    y,
    CONTENT_WIDTH,
    urgentBoxHeight,
    1.5,
    1.5,
    "FD"
  );

  doc.setFont(undefined, "bold");
  doc.setFontSize(9.5);
  doc.setTextColor(146, 64, 14);

  doc.text(
    "Urgent Matters",
    MARGIN_X + 3,
    y + 6
  );

  doc.setFont(undefined, "normal");
  doc.setFontSize(9.5);
  doc.setTextColor(15, 23, 42);

  doc.text(
    urgentLines,
    MARGIN_X + 3,
    y + 11.5
  );

  y +=
    urgentBoxHeight +
    8;

  /* VERIFICATION */

  sectionTitle("Verification");

  infoGrid([
    [
      "Signature of Duty Officer",
      report.signature,
    ],
    [
      "Countersigned by",
      report.countersignedBy,
    ],
  ]);

  drawFooter();

  return doc;
};

const downloadReportPdf = async (report) => {
  const doc =
    await buildReportPdf(report);

  doc.save(
    `report-${report.date}-${(
      report.teacher?.name ||
      "teacher"
    ).replace(/\s+/g, "_")}.pdf`
  );
};

/* =====================================================
   SHARE
===================================================== */

const buildShareText = (report) =>
  `Duty Officer's Inspection Report
Date: ${report.date}
Teacher: ${report.teacher?.name || "-"}
Centre/Batch: ${report.centreBatch || "-"}
Urgent: ${
    report.urgentMatters?.trim() &&
    report.urgentMatters
      .trim()
      .toLowerCase() !== "none"
      ? report.urgentMatters
      : "None"
  }`;

const shareReport = async (
  report,
  onFallback
) => {
  const text =
    buildShareText(report);

  if (navigator.share) {
    try {
      await navigator.share({
        title: `Report — ${report.date}`,
        text,
      });

      return;
    } catch {
      // fallback
    }
  }

  try {
    await navigator.clipboard.writeText(
      text
    );

    onFallback?.(
      "Report details copied to clipboard."
    );
  } catch {
    onFallback?.(
      "Could not share or copy the report."
    );
  }
};

/* =====================================================
   COMPONENT
===================================================== */

function AllReportsInner() {
  const [reports, setReports] =
    useState([]);

  const [teachers, setTeachers] =
    useState([]);

  const [loading, setLoading] =
    useState(true);

  const [selectedReport, setSelectedReport] =
    useState(null);

  const [copyToast, setCopyToast] =
    useState("");

  const [viewMode, setViewMode] =
    useState("table");

  const [dateFilter, setDateFilter] =
    useState(getToday());

  const [teacherFilter, setTeacherFilter] =
    useState("");

  const [urgentFilter, setUrgentFilter] =
    useState("");

  /* -------------------------------------------------
     LOAD REPORTS
  ------------------------------------------------- */

  const loadReports = (
    filters = {}
  ) => {
    setLoading(true);

    const params = {};

    if (filters.date !== "") {
      params.from = filters.date;
      params.to = filters.date;
    }

    if (filters.teacher) {
      params.teacher =
        filters.teacher;
    }

    if (filters.urgent !== "") {
      params.urgent =
        filters.urgent;
    }

    api
      .get("/reports", { params })
      .then((res) =>
        setReports(res.data)
      )
      .finally(() =>
        setLoading(false)
      );
  };

  useEffect(() => {
    api
      .get("/users/teachers")
      .then((res) =>
        setTeachers(res.data)
      );

    loadReports({
      date: dateFilter,
      teacher: teacherFilter,
      urgent: urgentFilter,
    });
  }, []);

  /* -------------------------------------------------
     FILTERS
  ------------------------------------------------- */

  const applyFilters = (
    next = {}
  ) => {
    const merged = {
      date:
        next.date !== undefined
          ? next.date
          : dateFilter,

      teacher:
        next.teacher !== undefined
          ? next.teacher
          : teacherFilter,

      urgent:
        next.urgent !== undefined
          ? next.urgent
          : urgentFilter,
    };

    if (next.date !== undefined) {
      setDateFilter(next.date);
    }

    if (
      next.teacher !== undefined
    ) {
      setTeacherFilter(
        next.teacher
      );
    }

    if (
      next.urgent !== undefined
    ) {
      setUrgentFilter(
        next.urgent
      );
    }

    loadReports(merged);
  };

  const resetFilters = () => {
    setDateFilter(getToday());
    setTeacherFilter("");
    setUrgentFilter("");

    loadReports({
      date: getToday(),
      teacher: "",
      urgent: "",
    });
  };

  const showAllDates = () =>
    applyFilters({
      date: "",
    });

  const isUrgentReport = (r) => {
    const t =
      (r.urgentMatters || "")
        .trim()
        .toLowerCase();

    return (
      t &&
      t !== "none"
    );
  };

  const urgentCount =
    reports.filter(
      isUrgentReport
    ).length;

  useEffect(() => {
    if (!copyToast) return;

    const t = setTimeout(
      () => setCopyToast(""),
      2500
    );

    return () =>
      clearTimeout(t);
  }, [copyToast]);

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
        sx={{ py: 3 }}
      >
        {/* HEADER */}

        <Stack
          direction="row"
          alignItems="center"
          spacing={1.2}
          sx={{ mb: 2.5 }}
        >
          <Box
            sx={{
              width: 40,
              height: 40,
              borderRadius: 2,
              bgcolor: "#7e22ce",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Assignment
              sx={{
                color: "white",
                fontSize: 22,
              }}
            />
          </Box>

          <Box>
            <Typography
              variant="h5"
              fontWeight={800}
            >
              All Reports
            </Typography>

            <Typography
              variant="body2"
              color="text.secondary"
            >
              Inspection checklist
              submissions across all
              teachers
            </Typography>
          </Box>
        </Stack>

        {/* SUMMARY CARDS */}

        <Grid
          container
          spacing={{
            xs: 1,
            sm: 2,
          }}
          sx={{
            mb: {
              xs: 2,
              sm: 3,
            },
          }}
        >
          <Grid item xs={4}>
            <Card
              elevation={0}
              sx={{
                border:
                  "1px solid #e2e8f0",
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
                  display: "flex",
                  alignItems: "center",
                  gap: {
                    xs: 0.8,
                    sm: 1.5,
                  },
                }}
              >
                <Box
                  sx={{
                    width: {
                      xs: 30,
                      sm: 42,
                    },
                    height: {
                      xs: 30,
                      sm: 42,
                    },
                    borderRadius: "50%",
                    bgcolor: "#f3e8ff",
                    display: "flex",
                    alignItems: "center",
                    justifyContent:
                      "center",
                    flexShrink: 0,
                  }}
                >
                  <Assignment
                    sx={{
                      color: "#7e22ce",
                      fontSize: {
                        xs: 16,
                        sm: 22,
                      },
                    }}
                  />
                </Box>

                <Box sx={{ minWidth: 0 }}>
                  <Typography
                    color="text.secondary"
                    fontSize={{
                      xs: "0.62rem",
                      sm: "0.8rem",
                    }}
                    noWrap
                  >
                    Reports
                  </Typography>

                  <Typography
                    fontWeight={800}
                    fontSize={{
                      xs: "1.1rem",
                      sm: "1.5rem",
                    }}
                  >
                    {reports.length}
                  </Typography>
                </Box>
              </CardContent>
            </Card>
          </Grid>

          <Grid item xs={4}>
            <Card
              elevation={0}
              sx={{
                border:
                  "1px solid #e2e8f0",
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
                  display: "flex",
                  alignItems: "center",
                  gap: {
                    xs: 0.8,
                    sm: 1.5,
                  },
                }}
              >
                <Box
                  sx={{
                    width: {
                      xs: 30,
                      sm: 42,
                    },
                    height: {
                      xs: 30,
                      sm: 42,
                    },
                    borderRadius: "50%",
                    bgcolor: "#fee2e2",
                    display: "flex",
                    alignItems: "center",
                    justifyContent:
                      "center",
                    flexShrink: 0,
                  }}
                >
                  <Warning
                    sx={{
                      color: "#dc2626",
                      fontSize: {
                        xs: 16,
                        sm: 22,
                      },
                    }}
                  />
                </Box>

                <Box sx={{ minWidth: 0 }}>
                  <Typography
                    color="text.secondary"
                    fontSize={{
                      xs: "0.62rem",
                      sm: "0.8rem",
                    }}
                    noWrap
                  >
                    Urgent
                  </Typography>

                  <Typography
                    fontWeight={800}
                    fontSize={{
                      xs: "1.1rem",
                      sm: "1.5rem",
                    }}
                  >
                    {urgentCount}
                  </Typography>
                </Box>
              </CardContent>
            </Card>
          </Grid>

          <Grid item xs={4}>
            <Card
              elevation={0}
              sx={{
                border:
                  "1px solid #e2e8f0",
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
                  display: "flex",
                  alignItems: "center",
                  gap: {
                    xs: 0.8,
                    sm: 1.5,
                  },
                }}
              >
                <Box
                  sx={{
                    width: {
                      xs: 30,
                      sm: 42,
                    },
                    height: {
                      xs: 30,
                      sm: 42,
                    },
                    borderRadius: "50%",
                    bgcolor: "#ede9fe",
                    display: "flex",
                    alignItems: "center",
                    justifyContent:
                      "center",
                    flexShrink: 0,
                  }}
                >
                  <CalendarMonth
                    sx={{
                      color: "#6d28d9",
                      fontSize: {
                        xs: 16,
                        sm: 22,
                      },
                    }}
                  />
                </Box>

                <Box sx={{ minWidth: 0 }}>
                  <Typography
                    color="text.secondary"
                    fontSize={{
                      xs: "0.62rem",
                      sm: "0.8rem",
                    }}
                    noWrap
                  >
                    Date
                  </Typography>

                  <Typography
                    fontWeight={800}
                    fontSize={{
                      xs: "0.85rem",
                      sm: "1.25rem",
                    }}
                    noWrap
                  >
                    {dateFilter || "All"}
                  </Typography>
                </Box>
              </CardContent>
            </Card>
          </Grid>
        </Grid>

        {/* FILTERS */}

        <Paper
          elevation={0}
          sx={{
            p: {
              xs: 1.5,
              sm: 2.5,
            },
            border:
              "1px solid #e2e8f0",
            borderRadius: 2.5,
          }}
        >
          <Stack
            spacing={1}
            sx={{ mb: 2 }}
          >
            <Stack
              direction="row"
              spacing={0}
              sx={{
                flexWrap: "wrap",
                gap: 1,
              }}
            >
              <TextField
                select
                size="small"
                label="Teacher"
                value={teacherFilter}
                onChange={(e) =>
                  applyFilters({
                    teacher:
                      e.target.value,
                  })
                }
                sx={{
                  flex: {
                    xs: "1 1 100%",
                    sm: "0 1 200px",
                  },
                }}
              >
                <MenuItem value="">
                  All teachers
                </MenuItem>

                {teachers.map((t) => (
                  <MenuItem
                    key={t._id}
                    value={t._id}
                  >
                    {t.name}
                  </MenuItem>
                ))}
              </TextField>

              <TextField
                select
                size="small"
                label="Urgent"
                value={urgentFilter}
                onChange={(e) =>
                  applyFilters({
                    urgent:
                      e.target.value,
                  })
                }
                sx={{
                  flex: {
                    xs: "1 1 100%",
                    sm: "0 1 160px",
                  },
                }}
              >
                <MenuItem value="">
                  All
                </MenuItem>

                <MenuItem value="true">
                  Urgent only
                </MenuItem>

                <MenuItem value="false">
                  Not urgent
                </MenuItem>
              </TextField>

              {/* ONLY TODAY OR PAST DATES */}

              <TextField
                label="Date"
                type="date"
                size="small"
                value={dateFilter}
                onChange={(e) =>
                  applyFilters({
                    date:
                      e.target.value,
                  })
                }
                inputProps={{
                  max: getToday(),
                }}
                InputLabelProps={{
                  shrink: true,
                }}
                sx={{
                  flex: {
                    xs: "1 1 100%",
                    sm: "0 1 170px",
                  },
                }}
              />
            </Stack>

            <Stack
              direction="row"
              alignItems="center"
              justifyContent="space-between"
              flexWrap="wrap"
              gap={1}
            >
              <Stack
                direction="row"
                spacing={0.5}
              >
                <Button
                  size="small"
                  onClick={showAllDates}
                  disabled={
                    dateFilter === ""
                  }
                  sx={{
                    color: "#7e22ce",
                    fontSize: {
                      xs: "0.72rem",
                      sm: "0.8125rem",
                    },
                    px: 1,
                  }}
                >
                  Show all dates
                </Button>

                <Button
                  size="small"
                  startIcon={
                    <FilterAltOff fontSize="small" />
                  }
                  onClick={resetFilters}
                  color="inherit"
                  sx={{
                    fontSize: {
                      xs: "0.72rem",
                      sm: "0.8125rem",
                    },
                    px: 1,
                  }}
                >
                  Reset filters
                </Button>
              </Stack>

              <ToggleButtonGroup
                value={viewMode}
                exclusive
                size="small"
                onChange={(e, val) =>
                  val &&
                  setViewMode(val)
                }
                sx={{
                  "& .MuiToggleButton-root":
                    {
                      px: 1,
                      py: 0.4,
                    },

                  "& .MuiToggleButton-root.Mui-selected":
                    {
                      bgcolor:
                        "#7e22ce",
                      color: "white",

                      "&:hover": {
                        bgcolor:
                          "#6b21a8",
                      },
                    },
                }}
              >
                <ToggleButton value="table">
                  <Tooltip title="Table view">
                    <ViewList fontSize="small" />
                  </Tooltip>
                </ToggleButton>

                <ToggleButton value="card">
                  <Tooltip title="Card view">
                    <ViewModule fontSize="small" />
                  </Tooltip>
                </ToggleButton>
              </ToggleButtonGroup>
            </Stack>
          </Stack>

          <Divider sx={{ mb: 1.5 }} />

          {/* CONTENT */}

          {loading ? (
            <Box
              sx={{
                display: "flex",
                justifyContent: "center",
                py: 5,
              }}
            >
              <CircularProgress
                size={24}
                sx={{
                  color: "#7e22ce",
                }}
              />
            </Box>
          ) : reports.length === 0 ? (
            <Box
              sx={{
                py: 4,
                textAlign: "center",
              }}
            >
              <Typography color="text.secondary">
                No reports found for
                the selected filters.
              </Typography>
            </Box>
          ) : viewMode === "table" ? (
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
                        bgcolor:
                          "#faf5ff",
                        fontWeight: 700,
                        color:
                          "#4c1d95",
                      },
                    }}
                  >
                    <TableCell>
                      Date
                    </TableCell>

                    <TableCell>
                      Teacher
                    </TableCell>

                    <TableCell>
                      Centre/Batch
                    </TableCell>

                    <TableCell>
                      Urgent
                    </TableCell>

                    <TableCell align="right">
                      Actions
                    </TableCell>
                  </TableRow>
                </TableHead>

                <TableBody>
                  {reports.map((r) => {
                    const urgent =
                      isUrgentReport(r);

                    return (
                      <TableRow
                        key={r._id}
                        hover
                        sx={{
                          cursor:
                            "pointer",

                          "&:hover": {
                            bgcolor:
                              "#faf5ff",
                          },
                        }}
                        onClick={() =>
                          setSelectedReport(
                            r
                          )
                        }
                      >
                        <TableCell>
                          {r.date}
                        </TableCell>

                        <TableCell>
                          {r.teacher?.name ||
                            "-"}
                        </TableCell>

                        <TableCell>
                          {r.centreBatch ||
                            "-"}
                        </TableCell>

                        <TableCell>
                          {urgent ? (
                            <Chip
                              size="small"
                              color="error"
                              label="Yes"
                            />
                          ) : (
                            <Chip
                              size="small"
                              label="No"
                            />
                          )}
                        </TableCell>

                        <TableCell
                          align="right"
                          onClick={(e) =>
                            e.stopPropagation()
                          }
                        >
                          <Tooltip title="View">
                            <IconButton
                              size="small"
                              onClick={() =>
                                setSelectedReport(
                                  r
                                )
                              }
                              sx={{
                                color:
                                  "#7e22ce",
                              }}
                            >
                              <Visibility fontSize="small" />
                            </IconButton>
                          </Tooltip>

                          <Tooltip title="Download PDF">
                            <IconButton
                              size="small"
                              onClick={() =>
                                downloadReportPdf(
                                  r
                                )
                              }
                              sx={{
                                color:
                                  "#6b21a8",
                              }}
                            >
                              <PictureAsPdf fontSize="small" />
                            </IconButton>
                          </Tooltip>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </TableContainer>
          ) : (
            <Grid
              container
              spacing={2}
            >
              {reports.map((r) => {
                const urgent =
                  isUrgentReport(r);

                return (
                  <Grid
                    item
                    xs={12}
                    sm={6}
                    md={4}
                    key={r._id}
                  >
                    <Card
                      elevation={0}
                      sx={{
                        border: urgent
                          ? "1px solid #fecaca"
                          : "1px solid #e2e8f0",
                        borderRadius: 2.5,
                        height: "100%",
                        display: "flex",
                        flexDirection:
                          "column",
                        cursor:
                          "pointer",

                        transition:
                          "box-shadow 0.15s",

                        "&:hover": {
                          boxShadow:
                            "0 4px 14px rgba(15,23,42,0.08)",
                        },
                      }}
                      onClick={() =>
                        setSelectedReport(
                          r
                        )
                      }
                    >
                      <CardContent
                        sx={{
                          flexGrow: 1,
                          display: "flex",
                          flexDirection:
                            "column",
                          gap: 1,
                        }}
                      >
                        <Stack
                          direction="row"
                          justifyContent="space-between"
                          alignItems="flex-start"
                        >
                          <Stack
                            direction="row"
                            alignItems="center"
                            spacing={0.8}
                          >
                            <CalendarMonth
                              sx={{
                                fontSize: 17,
                                color:
                                  "#7e22ce",
                              }}
                            />

                            <Typography
                              fontWeight={700}
                              fontSize="0.9rem"
                            >
                              {r.date}
                            </Typography>
                          </Stack>

                          {urgent ? (
                            <Chip
                              size="small"
                              icon={
                                <Warning
                                  sx={{
                                    fontSize:
                                      "14px !important",
                                  }}
                                />
                              }
                              color="error"
                              label="Urgent"
                              sx={{
                                height: 22,
                                fontSize:
                                  "0.68rem",
                              }}
                            />
                          ) : (
                            <Chip
                              size="small"
                              icon={
                                <CheckCircle
                                  sx={{
                                    fontSize:
                                      "14px !important",
                                  }}
                                />
                              }
                              label="Normal"
                              sx={{
                                height: 22,
                                fontSize:
                                  "0.68rem",
                                bgcolor:
                                  "#f0fdf4",
                                color:
                                  "#15803d",
                              }}
                            />
                          )}
                        </Stack>

                        <Divider />

                        <Stack
                          direction="row"
                          alignItems="center"
                          spacing={0.8}
                        >
                          <Person
                            sx={{
                              fontSize: 16,
                              color:
                                "text.secondary",
                            }}
                          />

                          <Typography
                            variant="body2"
                            noWrap
                          >
                            {r.teacher?.name ||
                              "-"}
                          </Typography>
                        </Stack>

                        <Typography
                          variant="body2"
                          color="text.secondary"
                          noWrap
                        >
                          {r.centreBatch ||
                            "-"}
                        </Typography>
                      </CardContent>

                      <Divider />

                      <Stack
                        direction="row"
                        justifyContent="flex-end"
                        spacing={0.5}
                        sx={{ p: 0.8 }}
                        onClick={(e) =>
                          e.stopPropagation()
                        }
                      >
                        <Tooltip title="View">
                          <IconButton
                            size="small"
                            onClick={() =>
                              setSelectedReport(
                                r
                              )
                            }
                            sx={{
                              color:
                                "#7e22ce",
                            }}
                          >
                            <Visibility fontSize="small" />
                          </IconButton>
                        </Tooltip>

                        <Tooltip title="Download PDF">
                          <IconButton
                            size="small"
                            onClick={() =>
                              downloadReportPdf(
                                r
                              )
                            }
                            sx={{
                              color:
                                "#6b21a8",
                            }}
                          >
                            <PictureAsPdf fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      </Stack>
                    </Card>
                  </Grid>
                );
              })}
            </Grid>
          )}
        </Paper>
      </Container>

      {/* =================================================
          VIEW REPORT DIALOG
      ================================================= */}

      <Dialog
        open={!!selectedReport}
        onClose={() =>
          setSelectedReport(null)
        }
        maxWidth="sm"
        fullWidth
        PaperProps={{
          sx: {
            borderRadius: 2.5,
            overflow: "hidden",
          },
        }}
      >
        {selectedReport && (
          <>
            <Box
              sx={{
                px: 3,
                py: 2.5,
                bgcolor: "#1e3a5f",
                color: "white",
                position: "relative",
              }}
            >
              <IconButton
                onClick={() =>
                  setSelectedReport(
                    null
                  )
                }
                sx={{
                  position:
                    "absolute",
                  top: 10,
                  right: 10,
                  color: "white",
                }}
              >
                <Close />
              </IconButton>

              <Stack
                direction="row"
                alignItems="center"
                spacing={1.5}
              >
                <Box
                  sx={{
                    width: 38,
                    height: 38,
                    borderRadius: 2,
                    bgcolor:
                      "rgba(255,255,255,0.15)",
                    display: "flex",
                    alignItems:
                      "center",
                    justifyContent:
                      "center",
                    flexShrink: 0,
                  }}
                >
                  <Description
                    sx={{
                      fontSize: 20,
                    }}
                  />
                </Box>

                <Box>
                  <Typography
                    variant="h6"
                    fontWeight={700}
                  >
                    Duty Officer's
                    Inspection
                    Checklist
                  </Typography>

                  <Typography
                    variant="body2"
                    sx={{
                      opacity: 0.85,
                    }}
                  >
                    Submitted by{" "}
                    {selectedReport
                      .teacher
                      ?.name || "-"}{" "}
                    — view only
                  </Typography>
                </Box>
              </Stack>
            </Box>

            <DialogContent
              dividers
              sx={{
                p: {
                  xs: 1.5,
                  sm: 2.5,
                },
                bgcolor: "#fafafa",
              }}
            >
              <Stack spacing={2}>
                {/* URGENT STATUS */}

                {isUrgentReport(
                  selectedReport
                ) && (
                  <Chip
                    icon={<Warning />}
                    color="error"
                    label="Has urgent matters"
                    sx={{
                      alignSelf:
                        "flex-start",
                      fontWeight: 700,
                    }}
                  />
                )}

                {/* BASIC INFO */}

                <Paper
                  elevation={0}
                  sx={{
                    p: 2,
                    border:
                      "1px solid #e2e8f0",
                    borderRadius: 2,
                  }}
                >
                  <Grid
                    container
                    spacing={1.5}
                  >
                    <Grid item xs={6}>
                      <Typography
                        variant="caption"
                        color="text.secondary"
                      >
                        DATE
                      </Typography>

                      <Typography
                        fontWeight={600}
                      >
                        {selectedReport.date}
                      </Typography>
                    </Grid>

                    <Grid item xs={6}>
                      <Typography
                        variant="caption"
                        color="text.secondary"
                      >
                        NAME OF DUTY OFFICER
                      </Typography>

                      <Typography
                        fontWeight={600}
                      >
                        {selectedReport.dutyOfficerName ||
                          "-"}
                      </Typography>
                    </Grid>

                    <Grid item xs={6}>
                      <Typography
                        variant="caption"
                        color="text.secondary"
                      >
                        ORGANIZATION NAME
                      </Typography>

                      <Typography
                        fontWeight={600}
                      >
                        {selectedReport.centreBatch ||
                          "-"}
                      </Typography>
                    </Grid>
                  </Grid>
                </Paper>

                {/* PROGRESS */}

                <Paper
                  elevation={0}
                  sx={{
                    p: 1.5,
                    border:
                      "1px solid #e2e8f0",
                    borderRadius: 2,
                  }}
                >
                  <Stack
                    direction="row"
                    justifyContent="space-between"
                    mb={0.5}
                  >
                    <Typography
                      variant="body2"
                      fontWeight={600}
                    >
                      {getCompletedChecks(
                        selectedReport
                      )}{" "}
                      of{" "}
                      {getTotalChecks(
                        selectedReport
                      )}{" "}
                      checks completed
                    </Typography>

                    <Typography
                      variant="body2"
                      color="text.secondary"
                    >
                      {getTotalChecks(
                        selectedReport
                      ) > 0
                        ? Math.round(
                            (getCompletedChecks(
                              selectedReport
                            ) /
                              getTotalChecks(
                                selectedReport
                              )) *
                              100
                          )
                        : 0}
                      %
                    </Typography>
                  </Stack>

                  <LinearProgress
                    variant="determinate"
                    value={
                      getTotalChecks(
                        selectedReport
                      ) > 0
                        ? (getCompletedChecks(
                            selectedReport
                          ) /
                            getTotalChecks(
                              selectedReport
                            )) *
                          100
                        : 0
                    }
                    sx={{
                      height: 7,
                      borderRadius: 10,
                      bgcolor:
                        "#f1f5f9",

                      "& .MuiLinearProgress-bar":
                        {
                          bgcolor:
                            "#1e3a5f",
                          borderRadius: 10,
                        },
                    }}
                  />
                </Paper>

                {/* CHECKLIST */}
{CHECKLIST_SECTIONS.map((section) => (
  <Paper
    key={section.key}
    elevation={0}
    sx={{
      border: "1px solid #e2e8f0",
      borderRadius: 2,
      overflow: "hidden",
    }}
  >
    <Box sx={{ px: 1.5 }}>
      {(selectedReport[section.key] || []).map((item, i) => (
        <Box
          key={i}
          sx={{
            py: 1,
            borderBottom: "1px solid #f1f5f9",
            "&:last-child": {
              borderBottom: "none",
            },
          }}
        >
          <Stack
            direction="row"
            alignItems="flex-start"
            spacing={0.5}
          >
            <Checkbox
              checked={!!item.checked}
              disabled
              size="small"
              sx={{
                p: 0.5,
                mt: -0.2,
                "&.Mui-disabled": {
                  color: item.checked
                    ? "#1e3a5f"
                    : "#cbd5e1",
                },
              }}
            />

            <Typography
              fontSize="0.87rem"
              sx={{ pt: 0.4 }}
            >
              {item.label}
            </Typography>
          </Stack>

          {item.remark && (
            <Typography
              variant="body2"
              color="text.secondary"
              sx={{
                ml: 5,
                fontStyle: "italic",
              }}
            >
              Remark: {item.remark}
            </Typography>
          )}
        </Box>
      ))}
    </Box>
  </Paper>
))}
                {/* SUMMARY OF OBSERVATIONS */}

                <Paper
                  elevation={0}
                  sx={{
                    p: 2,
                    border:
                      "1px solid #e2e8f0",
                    borderRadius: 2,
                  }}
                >
                  <Typography
                    fontWeight={700}
                    color="#1e3a5f"
                    mb={1.2}
                  >
                    4. Summary of Key
                    Observations
                  </Typography>

                  <Stack spacing={1.5}>
                    <Box>
                      <Typography
                        variant="caption"
                        color="text.secondary"
                      >
                        MAJOR POSITIVE
                        OBSERVATIONS
                      </Typography>

                      <Typography
                        variant="body2"
                      >
                        {selectedReport.positiveObservations ||
                          "None"}
                      </Typography>
                    </Box>

                    <Box>
                      <Typography
                        variant="caption"
                        color="text.secondary"
                      >
                        CLEANLINESS /
                        HYGIENE LAPSES
                        NOTED
                      </Typography>

                      <Typography
                        variant="body2"
                      >
                        {selectedReport.hygieneLapses ||
                          "None"}
                      </Typography>
                    </Box>

                    <Box>
                      <Typography
                        variant="caption"
                        color="text.secondary"
                      >
                        MAINTENANCE ITEMS
                        NEEDING
                        FOLLOW-UP ACTION
                      </Typography>

                      <Typography
                        variant="body2"
                      >
                        {selectedReport.maintenanceFollowUp ||
                          "None"}
                      </Typography>
                    </Box>
                  </Stack>
                </Paper>

                {/* URGENT MATTERS */}

                <Paper
                  elevation={0}
                  sx={{
                    p: 2,
                    border:
                      "1px solid #fde68a",
                    bgcolor: "#fffbeb",
                    borderRadius: 2,
                  }}
                >
                  <Typography
                    fontWeight={700}
                    color="#92400e"
                    mb={0.8}
                  >
                    5. Urgent Matters
                  </Typography>

                  <Typography variant="body2">
                    {selectedReport.urgentMatters ||
                      "None"}
                  </Typography>
                </Paper>

                {/* VERIFICATION */}

                <Paper
                  elevation={0}
                  sx={{
                    p: 2,
                    border:
                      "1px solid #e2e8f0",
                    borderRadius: 2,
                  }}
                >
                  <Grid
                    container
                    spacing={1.5}
                  >
                    <Grid item xs={6}>
                      <Typography
                        variant="caption"
                        color="text.secondary"
                      >
                        SIGNATURE OF DUTY
                        OFFICER
                      </Typography>

                      <Typography
                        fontWeight={600}
                      >
                        {selectedReport.signature ||
                          "-"}
                      </Typography>
                    </Grid>

                    <Grid item xs={6}>
                      <Typography
                        variant="caption"
                        color="text.secondary"
                      >
                        COUNTERSIGNED BY
                      </Typography>

                      <Typography
                        fontWeight={600}
                      >
                        {selectedReport.countersignedBy ||
                          "-"}
                      </Typography>
                    </Grid>
                  </Grid>
                </Paper>

                {copyToast && (
                  <Alert
                    severity="info"
                    onClose={() =>
                      setCopyToast("")
                    }
                  >
                    {copyToast}
                  </Alert>
                )}
              </Stack>
            </DialogContent>

            <DialogActions
              sx={{
                px: 2.5,
                py: 1.5,
                bgcolor: "white",
              }}
            >
              <Button
                startIcon={<Share />}
                onClick={() =>
                  shareReport(
                    selectedReport,
                    setCopyToast
                  )
                }
              >
                Share
              </Button>

              <Button
                variant="contained"
                startIcon={
                  <PictureAsPdf />
                }
                onClick={() =>
                  downloadReportPdf(
                    selectedReport
                  )
                }
                sx={{
                  bgcolor: "#1e3a5f",
                  "&:hover": {
                    bgcolor:
                      "#16293f",
                  },
                }}
              >
                Download PDF
              </Button>
            </DialogActions>
          </>
        )}
      </Dialog>
    </Box>
  );
}

export default function AllReportsPage() {
  return (
    <ProtectedRoute role="superadmin">
      <AllReportsInner />
    </ProtectedRoute>
  );
}
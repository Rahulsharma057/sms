"use client";

import { useEffect, useState } from "react";
import {
  ThemeProvider,
  createTheme,
} from "@mui/material/styles";
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
  Pagination,
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
  DeleteOutline,
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

const reportTheme = createTheme({
  palette: {
    primary: {
      main: "#1E3A5F",
      dark: "#162F4D",
      light: "#EFF6FF",
      contrastText: "#FFFFFF",
    },
    secondary: {
      main: "#2563A6",
    },
    error: {
      main: "#DC2626",
      dark: "#B91C1C",
      light: "#FEF2F2",
    },
    success: {
      main: "#15803D",
      dark: "#166534",
      light: "#F0FDF4",
    },
    background: {
      default: "#F8FAFC",
      paper: "#FFFFFF",
    },
    text: {
      primary: "#0F172A",
      secondary: "#64748B",
    },
    divider: "#E2E8F0",
  },
  typography: {
    fontFamily: [
      "Inter",
      "Roboto",
      "Arial",
      "sans-serif",
    ].join(","),
  },
  shape: {
    borderRadius: 8,
  },
});

function AllReportsInner() {
  const [reports, setReports] = useState([]);
  const [teachers, setTeachers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedReport, setSelectedReport] = useState(null);
  const [copyToast, setCopyToast] = useState("");
  const [viewMode, setViewMode] = useState("table");

  const [fromDate, setFromDate] = useState(getToday());
  const [toDate, setToDate] = useState(getToday());
  const [teacherFilter, setTeacherFilter] = useState("");
  const [urgentFilter, setUrgentFilter] = useState("");

  const [page, setPage] = useState(1);
  const [limit] = useState(20);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);

  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);

  /* =====================================================
     LOAD REPORTS
     FUNCTIONALITY UNCHANGED
  ===================================================== */

  const loadReports = (filters = {}) => {
    setLoading(true);

    const params = {
      page: filters.page || 1,
      limit,
    };

    if (filters.from) {
      params.from = filters.from;
    }

    if (filters.to) {
      params.to = filters.to;
    }

    if (filters.teacher) {
      params.teacher = filters.teacher;
    }

    if (filters.urgent !== "") {
      params.urgent = filters.urgent;
    }

    api
      .get("/reports", { params })
      .then((res) => {
        setReports(res.data?.reports || []);

        setTotalPages(
          res.data?.pagination?.totalPages || 1
        );

        setTotal(
          res.data?.pagination?.total || 0
        );

        setPage(
          res.data?.pagination?.page || 1
        );
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    api
      .get("/users/teachers")
      .then((res) => setTeachers(res.data));

    loadReports({
      from: fromDate,
      to: toDate,
      teacher: teacherFilter,
      urgent: urgentFilter,
      page: 1,
    });
  }, []);

  /* =====================================================
     FILTERS
     FUNCTIONALITY UNCHANGED
  ===================================================== */

  const applyFilters = (next = {}) => {
    const merged = {
      from:
        next.from !== undefined
          ? next.from
          : fromDate,

      to:
        next.to !== undefined
          ? next.to
          : toDate,

      teacher:
        next.teacher !== undefined
          ? next.teacher
          : teacherFilter,

      urgent:
        next.urgent !== undefined
          ? next.urgent
          : urgentFilter,

      page: 1,
    };

    if (next.from !== undefined) {
      setFromDate(next.from);
    }

    if (next.to !== undefined) {
      setToDate(next.to);
    }

    if (next.teacher !== undefined) {
      setTeacherFilter(next.teacher);
    }

    if (next.urgent !== undefined) {
      setUrgentFilter(next.urgent);
    }

    loadReports(merged);
  };

  const resetFilters = () => {
    setFromDate(getToday());
    setToDate(getToday());
    setTeacherFilter("");
    setUrgentFilter("");

    loadReports({
      from: getToday(),
      to: getToday(),
      teacher: "",
      urgent: "",
      page: 1,
    });
  };

  const showAllDates = () =>
    applyFilters({
      from: "",
      to: "",
    });

  const handlePageChange = (_e, value) => {
    loadReports({
      from: fromDate,
      to: toDate,
      teacher: teacherFilter,
      urgent: urgentFilter,
      page: value,
    });
  };

  const isUrgentReport = (r) => {
    const t = (r.urgentMatters || "")
      .trim()
      .toLowerCase();

    return t && t !== "none";
  };

  const urgentCount = reports.filter(
    isUrgentReport
  ).length;

  useEffect(() => {
    if (!copyToast) return;

    const t = setTimeout(
      () => setCopyToast(""),
      2500
    );

    return () => clearTimeout(t);
  }, [copyToast]);

  /* =====================================================
     DELETE
     FUNCTIONALITY UNCHANGED
  ===================================================== */

  const handleDeleteConfirmed = async () => {
    if (!deleteTarget) return;

    setDeleting(true);

    try {
      await api.delete(
        `/reports/${deleteTarget._id}`
      );

      setDeleteTarget(null);

      setCopyToast(
        "Report deleted successfully."
      );

      const isLastItemOnPage =
        reports.length === 1 && page > 1;

      loadReports({
        from: fromDate,
        to: toDate,
        teacher: teacherFilter,
        urgent: urgentFilter,
        page: isLastItemOnPage
          ? page - 1
          : page,
      });
    } catch (err) {
      setCopyToast(
        err?.response?.data?.message ||
          "Could not delete report."
      );
    } finally {
      setDeleting(false);
    }
  };

  /* =====================================================
     SMALL UI HELPERS
  ===================================================== */

  const fieldSx = {
    minWidth: 0,
    "& .MuiInputBase-root": {
      height: 38,
      bgcolor: "background.paper",
      fontSize: "0.82rem",
    },
    "& .MuiInputLabel-root": {
      fontSize: "0.8rem",
    },
  };

  const sectionPaperSx = {
    border: "1px solid",
    borderColor: "divider",
    borderRadius: 1.5,
    bgcolor: "background.paper",
    boxShadow: "none",
  };

  const actionButtonSx = {
    width: 32,
    height: 32,
    borderRadius: 1,
  };

  return (
    <ThemeProvider theme={reportTheme}>
      <Box
        sx={{
          minHeight: "100%",
          bgcolor: "background.default",
          color: "text.primary",
          overflowX: "hidden",
        }}
      >
        <Navbar />

        <Container
          maxWidth="lg"
          sx={{
            py: {
              xs: 1.5,
              sm: 2,
              md: 2.5,
            },
          }}
        >
          {/* =================================================
              PAGE HEADER
          ================================================= */}

          <Stack
            direction="row"
            alignItems="center"
            spacing={1.25}
            sx={{ mb: 2 }}
          >
            <Box
              sx={{
                width: {
                  xs: 36,
                  sm: 40,
                },
                height: {
                  xs: 36,
                  sm: 40,
                },
                borderRadius: 1.5,
                bgcolor: "rgb(61, 37, 165)",
                color: "white",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                position: "relative",
                flexShrink: 0,
                overflow: "hidden",
              }}
            >
              <Assignment
                sx={{
                  fontSize: {
                    xs: 19,
                    sm: 21,
                  },
                }}
              />

              <Box
                sx={{
                  position: "absolute",
                  right: 0,
                  bottom: 0,
                  width: 8,
                  height: 8,
                  bgcolor: "error.main",
                }}
              />
            </Box>

            <Box sx={{ minWidth: 0 }}>
              <Typography
                sx={{
                  fontSize: {
                    xs: "1.25rem",
                    sm: "1.5rem",
                  },
                  lineHeight: 1.15,
                  fontWeight: 750,
                  letterSpacing: "-0.02em",
                }}
              >
                All Reports
              </Typography>

              <Typography
                sx={{
                  mt: 0.25,
                  fontSize: {
                    xs: "0.72rem",
                    sm: "0.78rem",
                  },
                  color: "text.secondary",
                }}
              >
                Inspection checklist submissions
                across all teachers
              </Typography>
            </Box>
          </Stack>

          {/* =================================================
              SUMMARY
          ================================================= */}

          <Grid
            container
            spacing={1.25}
            sx={{ mb: 1.5 }}
          >
            {/* REPORTS */}

            <Grid item xs={4}>
              <Card
                elevation={0}
                sx={{
                  ...sectionPaperSx,
                  height: {
                    xs: 70,
                    sm: 76,
                  },
                }}
              >
                <CardContent
                  sx={{
                    p: {
                      xs: 1,
                      sm: 1.4,
                    },
                    "&:last-child": {
                      pb: {
                        xs: 1,
                        sm: 1.4,
                      },
                    },
                    height: "100%",
                    display: "flex",
                    alignItems: "center",
                    gap: {
                      xs: 0.8,
                      sm: 1.2,
                    },
                  }}
                >
                  <Box
                    sx={{
                      width: {
                        xs: 30,
                        sm: 36,
                      },
                      height: {
                        xs: 30,
                        sm: 36,
                      },
                      borderRadius: 1,
                      bgcolor: "primary.light",
                      color: "primary.main",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      flexShrink: 0,
                    }}
                  >
                    <Assignment
                      sx={{
                        fontSize: {
                          xs: 16,
                          sm: 19,
                        },
                      }}
                    />
                  </Box>

                  <Box sx={{ minWidth: 0 }}>
                    <Typography
                      sx={{
                        color: "text.secondary",
                        fontSize: {
                          xs: "0.65rem",
                          sm: "0.75rem",
                        },
                        lineHeight: 1.2,
                      }}
                    >
                      Reports
                    </Typography>

                    <Typography
                      sx={{
                        fontSize: {
                          xs: "1.05rem",
                          sm: "1.3rem",
                        },
                        fontWeight: 750,
                        lineHeight: 1.2,
                      }}
                    >
                      {total}
                    </Typography>
                  </Box>
                </CardContent>
              </Card>
            </Grid>

            {/* URGENT */}

            <Grid item xs={4}>
              <Card
                elevation={0}
                sx={{
                  ...sectionPaperSx,
                  height: {
                    xs: 70,
                    sm: 76,
                  },
                }}
              >
                <CardContent
                  sx={{
                    p: {
                      xs: 1,
                      sm: 1.4,
                    },
                    "&:last-child": {
                      pb: {
                        xs: 1,
                        sm: 1.4,
                      },
                    },
                    height: "100%",
                    display: "flex",
                    alignItems: "center",
                    gap: {
                      xs: 0.8,
                      sm: 1.2,
                    },
                  }}
                >
                  <Box
                    sx={{
                      width: {
                        xs: 30,
                        sm: 36,
                      },
                      height: {
                        xs: 30,
                        sm: 36,
                      },
                      borderRadius: 1,
                      bgcolor: "error.light",
                      color: "error.main",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      flexShrink: 0,
                    }}
                  >
                    <Warning
                      sx={{
                        fontSize: {
                          xs: 16,
                          sm: 19,
                        },
                      }}
                    />
                  </Box>

                  <Box sx={{ minWidth: 0 }}>
                    <Typography
                      sx={{
                        color: "text.secondary",
                        fontSize: {
                          xs: "0.65rem",
                          sm: "0.75rem",
                        },
                      }}
                    >
                      Urgent
                    </Typography>

                    <Typography
                      sx={{
                        fontSize: {
                          xs: "1.05rem",
                          sm: "1.3rem",
                        },
                        fontWeight: 750,
                        lineHeight: 1.2,
                        color:
                          urgentCount > 0
                            ? "error.main"
                            : "text.primary",
                      }}
                    >
                      {urgentCount}
                    </Typography>
                  </Box>
                </CardContent>
              </Card>
            </Grid>

            {/* RANGE */}

            <Grid item xs={4}>
              <Card
                elevation={0}
                sx={{
                  ...sectionPaperSx,
                  height: {
                    xs: 70,
                    sm: 76,
                  },
                }}
              >
                <CardContent
                  sx={{
                    p: {
                      xs: 1,
                      sm: 1.4,
                    },
                    "&:last-child": {
                      pb: {
                        xs: 1,
                        sm: 1.4,
                      },
                    },
                    height: "100%",
                    display: "flex",
                    alignItems: "center",
                    gap: {
                      xs: 0.8,
                      sm: 1.2,
                    },
                  }}
                >
                  <Box
                    sx={{
                      width: {
                        xs: 30,
                        sm: 36,
                      },
                      height: {
                        xs: 30,
                        sm: 36,
                      },
                      borderRadius: 1,
                      bgcolor: "#F1F5F9",
                      color: "primary.main",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      flexShrink: 0,
                    }}
                  >
                    <CalendarMonth
                      sx={{
                        fontSize: {
                          xs: 16,
                          sm: 19,
                        },
                      }}
                    />
                  </Box>

                  <Box sx={{ minWidth: 0 }}>
                    <Typography
                      sx={{
                        color: "text.secondary",
                        fontSize: {
                          xs: "0.65rem",
                          sm: "0.75rem",
                        },
                      }}
                    >
                      Date Range
                    </Typography>

                    <Typography
                      noWrap
                      sx={{
                        fontSize: {
                          xs: "0.67rem",
                          sm: "0.82rem",
                        },
                        fontWeight: 700,
                        lineHeight: 1.3,
                      }}
                    >
                      {fromDate || toDate
                        ? `${fromDate || "…"} → ${
                            toDate || "…"
                          }`
                        : "All dates"}
                    </Typography>
                  </Box>
                </CardContent>
              </Card>
            </Grid>
          </Grid>

          {/* =================================================
              FILTER TOOLBAR
          ================================================= */}

          <Paper
            elevation={0}
            sx={{
              ...sectionPaperSx,
              p: {
                xs: 1.25,
                sm: 1.5,
              },
              mb: 1.5,
              position: "relative",
              overflow: "hidden",

              "&::before": {
                content: '""',
                position: "absolute",
                left: 0,
                top: 0,
                bottom: 0,
                width: 3,
                bgcolor: "primary.main",
              },
            }}
          >
            <Stack spacing={1.25}>
              <Box
                sx={{
                  display: "grid",
                  gridTemplateColumns: {
                    xs: "1fr",
                    sm: "1.5fr 1fr 1fr 1fr",
                    md: "1.45fr 0.9fr 1fr 1fr",
                  },
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
                      teacher: e.target.value,
                    })
                  }
                  sx={fieldSx}
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
                      urgent: e.target.value,
                    })
                  }
                  sx={fieldSx}
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

                <TextField
                  label="From"
                  type="date"
                  size="small"
                  value={fromDate}
                  onChange={(e) =>
                    applyFilters({
                      from: e.target.value,
                    })
                  }
                  inputProps={{
                    max: toDate || getToday(),
                  }}
                  InputLabelProps={{
                    shrink: true,
                  }}
                  sx={fieldSx}
                />

                <TextField
                  label="To"
                  type="date"
                  size="small"
                  value={toDate}
                  onChange={(e) =>
                    applyFilters({
                      to: e.target.value,
                    })
                  }
                  inputProps={{
                    min:
                      fromDate || undefined,
                    max: getToday(),
                  }}
                  InputLabelProps={{
                    shrink: true,
                  }}
                  sx={fieldSx}
                />
              </Box>

              <Stack
                direction={{
                  xs: "column",
                  sm: "row",
                }}
                justifyContent="space-between"
                alignItems={{
                  xs: "stretch",
                  sm: "center",
                }}
                gap={1}
              >
                <Stack
                  direction="row"
                  spacing={0.5}
                  flexWrap="wrap"
                >
                  <Button
                    size="small"
                    onClick={showAllDates}
                    disabled={
                      fromDate === "" &&
                      toDate === ""
                    }
                    sx={{
                      height: 34,
                      px: 1.2,
                      color: "primary.main",
                      fontSize: "0.76rem",
                      textTransform: "none",
                      fontWeight: 600,
                    }}
                  >
                    Show all dates
                  </Button>

                  <Button
                    size="small"
                    startIcon={
                      <FilterAltOff
                        sx={{ fontSize: 16 }}
                      />
                    }
                    onClick={resetFilters}
                    color="inherit"
                    sx={{
                      height: 34,
                      px: 1.2,
                      fontSize: "0.76rem",
                      textTransform: "none",
                      color: "text.secondary",
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
                    val && setViewMode(val)
                  }
                  sx={{
                    alignSelf: {
                      xs: "flex-end",
                      sm: "auto",
                    },

                    "& .MuiToggleButton-root": {
                      minWidth: 38,
                      height: 34,
                      px: 1,
                      borderColor:
                        "divider",
                      color:
                        "text.secondary",
                    },

                    "& .MuiToggleButton-root.Mui-selected":
                      {
                        bgcolor:
                          "primary.main",
                        color: "white",
                        borderColor:
                          "primary.main",

                        "&:hover": {
                          bgcolor:
                            "primary.dark",
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
          </Paper>

          {/* =================================================
              REPORT LIST
          ================================================= */}

          <Paper
            elevation={0}
            sx={{
              ...sectionPaperSx,
              overflow: "hidden",
            }}
          >
            {loading ? (
              <Box
                sx={{
                  minHeight: 150,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Stack
                  alignItems="center"
                  spacing={1}
                >
                  <CircularProgress
                    size={24}
                    thickness={4}
                    sx={{
                      color: "primary.main",
                    }}
                  />

                  <Typography
                    variant="caption"
                    color="text.secondary"
                  >
                    Loading reports...
                  </Typography>
                </Stack>
              </Box>
            ) : reports.length === 0 ? (
              <Box
                sx={{
                  py: 4,
                  px: 2,
                  textAlign: "center",
                }}
              >
                <Box
                  sx={{
                    width: 42,
                    height: 42,
                    mx: "auto",
                    mb: 1,
                    borderRadius: "50%",
                    bgcolor:
                      "primary.light",
                    color:
                      "primary.main",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <Description fontSize="small" />
                </Box>

                <Typography
                  fontWeight={700}
                  fontSize="0.95rem"
                >
                  No reports found
                </Typography>

                <Typography
                  variant="caption"
                  color="text.secondary"
                >
                  No reports match the
                  selected filters.
                </Typography>
              </Box>
            ) : viewMode === "table" ? (
              <>
                {/* DESKTOP TABLE */}

                <TableContainer
                  sx={{
                    width: "100%",
                    overflowX: "auto",
                  }}
                >
                  <Table
                    size="small"
                    sx={{
                      minWidth: 650,

                      "& .MuiTableCell-root": {
                        borderColor:
                          "divider",
                        py: 0.9,
                        fontSize:
                          "0.78rem",
                      },
                    }}
                  >
                    <TableHead>
  <TableRow
    sx={{
      bgcolor: "rgba(30, 52, 162, 0.98)",

      "& th": {
        bgcolor: "rgba(23, 43, 143, 0.98) !important",
        color: "#FFFFFF !important",
        fontWeight: 700,
        fontSize: "0.68rem",
        textTransform: "uppercase",
        letterSpacing: "0.04em",
        py: 1.1,
        borderBottom: "none",
        whiteSpace: "nowrap",
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
      Centre Name
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
                            onClick={() =>
                              setSelectedReport(
                                r
                              )
                            }
                            sx={{
                              cursor:
                                "pointer",

                              "&:hover": {
                                bgcolor:
                                  "#F8FBFF",
                              },
                            }}
                          >
                            <TableCell>
                              <Typography
                                fontSize="0.78rem"
                                fontWeight={650}
                              >
                                {r.date}
                              </Typography>
                            </TableCell>

                            <TableCell>
                              <Typography
                                fontSize="0.78rem"
                                fontWeight={600}
                              >
                                {r.teacher?.name ||
                                  "-"}
                              </Typography>
                            </TableCell>

                            <TableCell>
                              <Typography
                                fontSize="0.78rem"
                                color="text.secondary"
                                noWrap
                                sx={{
                                  maxWidth: 260,
                                }}
                              >
                                {r.centreBatch ||
                                  "-"}
                              </Typography>
                            </TableCell>

                            <TableCell>
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
                                  label="Urgent"
                                  color="error"
                                  sx={{
                                    height: 24,
                                    fontSize:
                                      "0.68rem",
                                    fontWeight: 700,
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
                                    height: 24,
                                    fontSize:
                                      "0.68rem",
                                    fontWeight: 650,
                                    bgcolor:
                                      "success.light",
                                    color:
                                      "success.dark",
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
                              <Tooltip title="View">
                                <IconButton
                                  size="small"
                                  onClick={() =>
                                    setSelectedReport(
                                      r
                                    )
                                  }
                                  sx={{
                                    ...actionButtonSx,
                                    color:
                                      "primary.main",
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
                                    ...actionButtonSx,
                                    color:
                                      "secondary.main",
                                  }}
                                >
                                  <PictureAsPdf fontSize="small" />
                                </IconButton>
                              </Tooltip>

                              <Tooltip title="Delete">
                                <IconButton
                                  size="small"
                                  onClick={() =>
                                    setDeleteTarget(
                                      r
                                    )
                                  }
                                  sx={{
                                    ...actionButtonSx,
                                    color:
                                      "error.main",
                                  }}
                                >
                                  <DeleteOutline fontSize="small" />
                                </IconButton>
                              </Tooltip>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </TableContainer>
              </>
            ) : (
              /* =================================================
                 CARD VIEW
              ================================================= */

              <Box sx={{ p: 1.25 }}>
                <Grid
                  container
                  spacing={1.25}
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
                          onClick={() =>
                            setSelectedReport(
                              r
                            )
                          }
                          sx={{
                            height: "100%",
                            border: "1px solid",
                            borderColor:
                              urgent
                                ? "#FECACA"
                                : "divider",
                            borderRadius: 1.5,
                            cursor:
                              "pointer",
                            transition:
                              "border-color .15s, box-shadow .15s",

                            "&:hover": {
                              borderColor:
                                urgent
                                  ? "#FCA5A5"
                                  : "#BFDBFE",
                              boxShadow:
                                "0 2px 8px rgba(15,23,42,.06)",
                            },
                          }}
                        >
                          <CardContent
                            sx={{
                              p: 1.4,
                              "&:last-child": {
                                pb: 1.4,
                              },
                            }}
                          >
                            <Stack
                              direction="row"
                              justifyContent="space-between"
                              alignItems="center"
                              gap={1}
                            >
                              <Stack
                                direction="row"
                                alignItems="center"
                                spacing={0.7}
                              >
                                <CalendarMonth
                                  sx={{
                                    fontSize: 16,
                                    color:
                                      "primary.main",
                                  }}
                                />

                                <Typography
                                  fontSize="0.78rem"
                                  fontWeight={700}
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
                                          "13px !important",
                                      }}
                                    />
                                  }
                                  color="error"
                                  label="Urgent"
                                  sx={{
                                    height: 22,
                                    fontSize:
                                      "0.64rem",
                                    fontWeight: 700,
                                  }}
                                />
                              ) : (
                                <Chip
                                  size="small"
                                  label="Normal"
                                  sx={{
                                    height: 22,
                                    fontSize:
                                      "0.64rem",
                                    bgcolor:
                                      "success.light",
                                    color:
                                      "success.dark",
                                    fontWeight: 650,
                                  }}
                                />
                              )}
                            </Stack>

                            <Divider
                              sx={{ my: 1 }}
                            />

                            <Typography
                              fontSize="0.8rem"
                              fontWeight={650}
                              noWrap
                            >
                              {r.teacher?.name ||
                                "-"}
                            </Typography>

                            <Typography
                              fontSize="0.73rem"
                              color="text.secondary"
                              noWrap
                              sx={{ mt: 0.3 }}
                            >
                              {r.centreBatch ||
                                "-"}
                            </Typography>

                            <Stack
                              direction="row"
                              justifyContent="flex-end"
                              spacing={0.3}
                              sx={{
                                mt: 0.8,
                              }}
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
                                    ...actionButtonSx,
                                    color:
                                      "primary.main",
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
                                    ...actionButtonSx,
                                    color:
                                      "secondary.main",
                                  }}
                                >
                                  <PictureAsPdf fontSize="small" />
                                </IconButton>
                              </Tooltip>

                              <Tooltip title="Delete">
                                <IconButton
                                  size="small"
                                  onClick={() =>
                                    setDeleteTarget(
                                      r
                                    )
                                  }
                                  sx={{
                                    ...actionButtonSx,
                                    color:
                                      "error.main",
                                  }}
                                >
                                  <DeleteOutline fontSize="small" />
                                </IconButton>
                              </Tooltip>
                            </Stack>
                          </CardContent>
                        </Card>
                      </Grid>
                    );
                  })}
                </Grid>
              </Box>
            )}

            {/* =================================================
                PAGINATION
            ================================================= */}
{!loading && reports.length > 0 && (
  <Stack
    direction="row"
    justifyContent="space-between"
    alignItems="center"
    sx={{
      px: { xs: 1, sm: 1.5 },
      py: { xs: 0.7, sm: 0.55 },
      width: "100%",
      boxSizing: "border-box",

      // Mobile white, desktop blue
      bgcolor: {
        xs: "#FFFFFF",
        sm: "rgba(23, 43, 143, 0.98)",
      },

      borderTop: {
        xs: "1px solid #E5E7EB",
        sm: "1px solid rgba(255,255,255,0.15)",
      },
    }}
  >
    {/* LEFT */}
    <Typography
      variant="caption"
      sx={{
        fontSize: { xs: "0.62rem", sm: "0.68rem" },
        color: {
          xs: "#333333",
          sm: "#FFFFFF",
        },
        fontWeight: 600,
        whiteSpace: "nowrap",
        flexShrink: 0,
      }}
    >
      Showing page{" "}
      <Box component="span" sx={{ fontWeight: 800 }}>
        {page}
      </Box>{" "}
      of{" "}
      <Box component="span" sx={{ fontWeight: 800 }}>
        {totalPages}
      </Box>{" "}
      ({total} total)
    </Typography>

    {/* RIGHT */}
    <Pagination
      count={totalPages}
      page={page}
      onChange={handlePageChange}
      size="small"
      siblingCount={1}
      boundaryCount={0}
      shape="rounded"
      sx={{
        flexShrink: 0,

        "& .MuiPagination-ul": {
          flexWrap: "nowrap",
          gap: 0,
        },

        "& .MuiPaginationItem-root": {
          minWidth: { xs: 24, sm: 26 },
          width: { xs: 24, sm: 26 },
          height: { xs: 24, sm: 26 },
          padding: 0,
          margin: "0 1px",
          fontSize: { xs: "0.62rem", sm: "0.68rem" },
          fontWeight: 700,
          borderRadius: 1.2,

          color: {
            xs: "rgba(23, 43, 143, 0.98)",
            sm: "#FFFFFF",
          },
        },

        "& .MuiPaginationItem-root:hover": {
          bgcolor: {
            xs: "rgba(23, 43, 143, 0.08)",
            sm: "rgba(255,255,255,0.15)",
          },
        },

        // Active
        "& .MuiPaginationItem-root.Mui-selected": {
          bgcolor: {
            xs: "rgba(23, 43, 143, 0.98)",
            sm: "#FFFFFF",
          },

          color: {
            xs: "#FFFFFF",
            sm: "rgba(23, 43, 143, 0.98)",
          },

          fontWeight: 800,
        },

        "& .MuiPaginationItem-previousNext": {
          color: {
            xs: "rgba(23, 43, 143, 0.98)",
            sm: "#FFFFFF",
          },
        },
      }}
    />
  </Stack>
)}
          </Paper>
        </Container>

        {/* =====================================================
            VIEW REPORT DIALOG
        ===================================================== */}

        <Dialog
          open={!!selectedReport}
          onClose={() =>
            setSelectedReport(null)
          }
          maxWidth="sm"
          fullWidth
          fullScreen={false}
          PaperProps={{
            sx: {
              borderRadius: {
                xs: 1.5,
                sm: 2,
              },
              maxHeight: "92vh",
              overflow: "hidden",
              m: {
                xs: 1,
                sm: 2,
              },
            },
          }}
        >
          {selectedReport && (
            <>
              {/* DIALOG HEADER */}

              <Box
                sx={{
                  px: {
                    xs: 1.75,
                    sm: 2.25,
                  },
                  py: {
                    xs: 1.5,
                    sm: 1.8,
                  },
                  bgcolor:
                    "primary.main",
                  color: "white",
                  position: "relative",

                  "&::after": {
                    content: '""',
                    position:
                      "absolute",
                    left: 0,
                    bottom: 0,
                    width: 64,
                    height: 3,
                    bgcolor:
                      "error.main",
                  },
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
                    top: 7,
                    right: 7,
                    width: 32,
                    height: 32,
                    color: "white",
                    bgcolor:
                      "rgba(255,255,255,.08)",

                    "&:hover": {
                      bgcolor:
                        "rgba(255,255,255,.16)",
                    },
                  }}
                >
                  <Close fontSize="small" />
                </IconButton>

                <Stack
                  direction="row"
                  alignItems="center"
                  spacing={1.1}
                  sx={{
                    pr: 4,
                  }}
                >
                  <Box
                    sx={{
                      width: 34,
                      height: 34,
                      borderRadius: 1,
                      bgcolor:
                        "rgba(255,255,255,.12)",
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
                        fontSize: 18,
                      }}
                    />
                  </Box>

                  <Box>
                    <Typography
                      sx={{
                        fontSize: {
                          xs: "0.95rem",
                          sm: "1.05rem",
                        },
                        lineHeight: 1.2,
                        fontWeight: 700,
                      }}
                    >
                      Duty Officer's
                      Inspection
                      Checklist
                    </Typography>

                    <Typography
                      sx={{
                        mt: 0.25,
                        fontSize:
                          "0.7rem",
                        opacity: 0.82,
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
                    xs: 1.25,
                    sm: 1.75,
                  },
                  bgcolor:
                    "background.default",
                  borderColor:
                    "divider",
                }}
              >
                <Stack spacing={1.25}>
                  {/* URGENT STATUS */}

                  {isUrgentReport(
                    selectedReport
                  ) && (
                    <Box
                      sx={{
                        display: "flex",
                        alignItems:
                          "center",
                        gap: 0.8,
                        px: 1,
                        py: 0.65,
                        borderRadius: 1,
                        bgcolor:
                          "error.light",
                        border:
                          "1px solid #FECACA",
                        color:
                          "error.dark",
                      }}
                    >
                      <Warning
                        sx={{
                          fontSize: 17,
                        }}
                      />

                      <Typography
                        fontSize="0.74rem"
                        fontWeight={700}
                      >
                        Has urgent
                        matters
                      </Typography>
                    </Box>
                  )}

                  {/* BASIC INFORMATION */}

                  <Paper
                    elevation={0}
                    sx={{
                      ...sectionPaperSx,
                      p: {
                        xs: 1.25,
                        sm: 1.5,
                      },
                    }}
                  >
                    <SectionHeading>
                      01&nbsp;&nbsp; Basic
                      Information
                    </SectionHeading>

                    <Grid
                      container
                      spacing={{
                        xs: 1,
                        sm: 1.25,
                      }}
                      sx={{ mt: 0.1 }}
                    >
                      {[
                        [
                          "DATE",
                          selectedReport.date,
                        ],
                        [
                          "DUTY OFFICER",
                          selectedReport.dutyOfficerName,
                        ],
                        [
                          "ORGANIZATION NAME",
                          selectedReport.centreBatch,
                        ],
                      ].map(
                        ([label, value]) => (
                          <Grid
                            item
                            xs={12}
                            sm={6}
                            key={label}
                          >
                            <InfoValue
                              label={label}
                              value={
                                value ||
                                "-"
                              }
                            />
                          </Grid>
                        )
                      )}
                    </Grid>
                  </Paper>

                  {/* PROGRESS */}

                  <Paper
                    elevation={0}
                    sx={{
                      ...sectionPaperSx,
                      p: {
                        xs: 1.25,
                        sm: 1.5,
                      },
                    }}
                  >
                    <Stack
                      direction="row"
                      alignItems="center"
                      justifyContent="space-between"
                      sx={{
                        mb: 0.75,
                      }}
                    >
                      <Box>
                        <Typography
                          fontSize="0.74rem"
                          fontWeight={700}
                        >
                          Completion Progress
                        </Typography>

                        <Typography
                          fontSize="0.67rem"
                          color="text.secondary"
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
                      </Box>

                      <Typography
                        fontSize="1rem"
                        fontWeight={750}
                        color="primary.main"
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
                        height: 6,
                        borderRadius: 5,
                        bgcolor: "#E2E8F0",

                        "& .MuiLinearProgress-bar":
                          {
                            bgcolor:
                              "primary.main",
                            borderRadius: 5,
                          },
                      }}
                    />
                  </Paper>

                  {/* CHECKLIST */}

                  <SectionHeading>
                    02&nbsp;&nbsp; Inspection
                    Checklist
                  </SectionHeading>

                  {CHECKLIST_SECTIONS.map(
                    (section, sectionIndex) => {
                      const items =
                        selectedReport[
                          section.key
                        ] || [];

                      return (
                        <Paper
                          key={
                            section.key
                          }
                          elevation={0}
                          sx={{
                            ...sectionPaperSx,
                            overflow:
                              "hidden",
                          }}
                        >
                          {/* SECTION HEADER */}

                          <Box
                            sx={{
                              px: {
                                xs: 1.25,
                                sm: 1.5,
                              },
                              py: 0.8,
                              bgcolor:
                                "primary.light",
                              borderBottom:
                                "1px solid",
                              borderColor:
                                "#DBEAFE",
                            }}
                          >
                            <Stack
                              direction="row"
                              justifyContent="space-between"
                              alignItems="center"
                              gap={1}
                            >
                              <Typography
                                fontSize="0.75rem"
                                fontWeight={750}
                                color="primary.main"
                              >
                                {String(
                                  sectionIndex +
                                    1
                                ).padStart(
                                  2,
                                  "0"
                                )}{" "}
                                &nbsp;
                                {
                                  section.title
                                    .replace(
                                      /^\d+\.\s*/,
                                      ""
                                    )
                                }
                              </Typography>

                              <Typography
                                fontSize="0.63rem"
                                color="text.secondary"
                                whiteSpace="nowrap"
                              >
                                {
                                  section.timing
                                }
                              </Typography>
                            </Stack>
                          </Box>

                          {/* ITEMS */}

                          {items.length ===
                          0 ? (
                            <Typography
                              sx={{
                                p: 1.2,
                                fontSize:
                                  "0.7rem",
                                color:
                                  "text.secondary",
                              }}
                            >
                              No checklist
                              items
                              available.
                            </Typography>
                          ) : (
                            <Box
                              sx={{
                                px: {
                                  xs: 1,
                                  sm: 1.25,
                                },
                              }}
                            >
                              {items.map(
                                (
                                  item,
                                  i
                                ) => (
                                  <Box
                                    key={i}
                                    sx={{
                                      py: 0.8,
                                      borderBottom:
                                        i ===
                                        items.length -
                                          1
                                          ? "none"
                                          : "1px solid #F1F5F9",
                                    }}
                                  >
                                    <Stack
                                      direction="row"
                                      alignItems="flex-start"
                                      spacing={
                                        0.7
                                      }
                                    >
                                      <Checkbox
                                        checked={
                                          !!item.checked
                                        }
                                        disabled
                                        size="small"
                                        sx={{
                                          p: 0,
                                          mt: 0.05,

                                          "&.Mui-disabled":
                                            {
                                              color:
                                                item.checked
                                                  ? "primary.main"
                                                  : "#CBD5E1",
                                            },
                                        }}
                                      />

                                      <Typography
                                        fontSize="0.76rem"
                                        sx={{
                                          pt: 0.15,
                                          lineHeight: 1.45,
                                          color:
                                            "text.primary",
                                        }}
                                      >
                                        {
                                          item.label
                                        }
                                      </Typography>
                                    </Stack>

                                    {item.remark && (
                                      <Typography
                                        sx={{
                                          ml: 3.25,
                                          mt: 0.25,
                                          fontSize:
                                            "0.65rem",
                                          lineHeight: 1.4,
                                          color:
                                            "text.secondary",
                                          fontStyle:
                                            "italic",
                                        }}
                                      >
                                        Remark:{" "}
                                        {
                                          item.remark
                                        }
                                      </Typography>
                                    )}
                                  </Box>
                                )
                              )}
                            </Box>
                          )}
                        </Paper>
                      );
                    }
                  )}

                  {/* OBSERVATIONS */}

                  <Paper
                    elevation={0}
                    sx={{
                      ...sectionPaperSx,
                      p: {
                        xs: 1.25,
                        sm: 1.5,
                      },
                    }}
                  >
                    <SectionHeading>
                      03&nbsp;&nbsp; Summary of
                      Key Observations
                    </SectionHeading>

                    <Stack spacing={1}>
                      <ObservationRow
                        label="Major positive observations"
                        value={
                          selectedReport.positiveObservations
                        }
                      />

                      <ObservationRow
                        label="Cleanliness / hygiene lapses noted"
                        value={
                          selectedReport.hygieneLapses
                        }
                      />

                      <ObservationRow
                        label="Maintenance items needing follow-up action"
                        value={
                          selectedReport.maintenanceFollowUp
                        }
                      />
                    </Stack>
                  </Paper>

                  {/* URGENT MATTERS */}

                  <Box
                    sx={{
                      border:
                        "1px solid",
                      borderColor:
                        isUrgentReport(
                          selectedReport
                        )
                          ? "#FECACA"
                          : "divider",
                      bgcolor:
                        isUrgentReport(
                          selectedReport
                        )
                          ? "error.light"
                          : "background.paper",
                      borderRadius: 1.5,
                      p: {
                        xs: 1.25,
                        sm: 1.5,
                      },
                    }}
                  >
                    <Stack
                      direction="row"
                      spacing={0.8}
                      alignItems="flex-start"
                    >
                      <Warning
                        sx={{
                          fontSize: 17,
                          color:
                            isUrgentReport(
                              selectedReport
                            )
                              ? "error.main"
                              : "text.secondary",
                          mt: 0.1,
                        }}
                      />

                      <Box>
                        <Typography
                          fontSize="0.75rem"
                          fontWeight={750}
                          color={
                            isUrgentReport(
                              selectedReport
                            )
                              ? "error.dark"
                              : "text.primary"
                          }
                        >
                          04&nbsp;&nbsp;
                          Urgent Matters
                        </Typography>

                        <Typography
                          sx={{
                            mt: 0.35,
                            fontSize:
                              "0.72rem",
                            lineHeight: 1.5,
                            color:
                              isUrgentReport(
                                selectedReport
                              )
                                ? "#7F1D1D"
                                : "text.secondary",
                          }}
                        >
                          {selectedReport.urgentMatters?.trim() ||
                            "None reported"}
                        </Typography>
                      </Box>
                    </Stack>
                  </Box>

                  {/* VERIFICATION */}

                  <Paper
                    elevation={0}
                    sx={{
                      ...sectionPaperSx,
                      p: {
                        xs: 1.25,
                        sm: 1.5,
                      },
                    }}
                  >
                    <SectionHeading>
                      05&nbsp;&nbsp; Verification
                    </SectionHeading>

                    <Grid
                      container
                      spacing={1.25}
                    >
                      <Grid
                        item
                        xs={12}
                        sm={6}
                      >
                        <InfoValue
                          label="SIGNATURE OF DUTY OFFICER"
                          value={
                            selectedReport.signature ||
                            "-"
                          }
                        />
                      </Grid>

                      <Grid
                        item
                        xs={12}
                        sm={6}
                      >
                        <InfoValue
                          label="COUNTERSIGNED BY"
                          value={
                            selectedReport.countersignedBy ||
                            "-"
                          }
                        />
                      </Grid>
                    </Grid>
                  </Paper>

                  {copyToast && (
                    <Alert
                      severity="info"
                      onClose={() =>
                        setCopyToast(
                          ""
                        )
                      }
                      sx={{
                        py: 0,
                        fontSize:
                          "0.75rem",
                      }}
                    >
                      {copyToast}
                    </Alert>
                  )}
                </Stack>
              </DialogContent>

              {/* FOOTER */}

              <DialogActions
                sx={{
                  px: {
                    xs: 1.25,
                    sm: 1.75,
                  },
                  py: 1,
                  bgcolor:
                    "background.paper",
                  borderTop:
                    "1px solid",
                  borderColor:
                    "divider",
                  gap: 0.75,
                }}
              >
                <Button
                  startIcon={
                    <Share fontSize="small" />
                  }
                  onClick={() =>
                    shareReport(
                      selectedReport,
                      setCopyToast
                    )
                  }
                  variant="outlined"
                  sx={{
                    height: 36,
                    px: 1.5,
                    fontSize:
                      "0.76rem",
                    textTransform:
                      "none",
                    borderColor:
                      "divider",
                    color:
                      "text.primary",
                  }}
                >
                  Share
                </Button>

                <Button
                  variant="contained"
                  startIcon={
                    <PictureAsPdf fontSize="small" />
                  }
                  onClick={() =>
                    downloadReportPdf(
                      selectedReport
                    )
                  }
                  sx={{
                    height: 36,
                    px: 1.6,
                    fontSize:
                      "0.76rem",
                    textTransform:
                      "none",
                    bgcolor:
                      "primary.main",
                    boxShadow: "none",

                    "&:hover": {
                      bgcolor:
                        "primary.dark",
                      boxShadow: "none",
                    },
                  }}
                >
                  Download PDF
                </Button>
              </DialogActions>
            </>
          )}
        </Dialog>

        {/* =====================================================
            DELETE CONFIRMATION
        ===================================================== */}

        <Dialog
          open={!!deleteTarget}
          onClose={() =>
            !deleting &&
            setDeleteTarget(null)
          }
          maxWidth="xs"
          fullWidth
          PaperProps={{
            sx: {
              borderRadius: 2,
              mx: 1.5,
            },
          }}
        >
          <DialogContent
            sx={{
              px: 2.5,
              pt: 2.5,
              pb: 1.5,
            }}
          >
            <Stack
              spacing={1}
              alignItems="center"
              textAlign="center"
            >
              <Box
                sx={{
                  width: 42,
                  height: 42,
                  borderRadius:
                    "50%",
                  bgcolor:
                    "error.light",
                  color:
                    "error.main",
                  display: "flex",
                  alignItems:
                    "center",
                  justifyContent:
                    "center",
                }}
              >
                <DeleteOutline />
              </Box>

              <Typography
                fontWeight={750}
                fontSize="0.95rem"
              >
                Delete this report?
              </Typography>

              <Typography
                fontSize="0.72rem"
                color="text.secondary"
                sx={{
                  maxWidth: 300,
                }}
              >
                {deleteTarget?.date} —{" "}
                {deleteTarget?.teacher
                  ?.name ||
                  "Unknown teacher"}
                . This action cannot
                be undone.
              </Typography>
            </Stack>
          </DialogContent>

          <DialogActions
            sx={{
              px: 2.5,
              pb: 2,
              justifyContent:
                "center",
              gap: 0.75,
            }}
          >
            <Button
              onClick={() =>
                setDeleteTarget(null)
              }
              disabled={deleting}
              sx={{
                height: 36,
                px: 1.75,
                fontSize:
                  "0.76rem",
                textTransform:
                  "none",
                color:
                  "text.secondary",
              }}
            >
              Cancel
            </Button>

            <Button
              variant="contained"
              color="error"
              onClick={
                handleDeleteConfirmed
              }
              disabled={deleting}
              startIcon={
                deleting ? (
                  <CircularProgress
                    size={15}
                    color="inherit"
                  />
                ) : (
                  <DeleteOutline fontSize="small" />
                )
              }
              sx={{
                height: 36,
                px: 1.75,
                fontSize:
                  "0.76rem",
                textTransform:
                  "none",
                fontWeight: 700,
                boxShadow: "none",
              }}
            >
              {deleting
                ? "Deleting..."
                : "Delete"}
            </Button>
          </DialogActions>
        </Dialog>
      </Box>
    </ThemeProvider>
  );
}

/* =====================================================
   REUSABLE UI-ONLY COMPONENTS
===================================================== */

function SectionHeading({ children }) {
  return (
    <Typography
      sx={{
        fontSize: "0.76rem",
        fontWeight: 750,
        color: "primary.main",
        lineHeight: 1.3,
        mb: 1,
      }}
    >
      {children}
    </Typography>
  );
}

function InfoValue({ label, value }) {
  return (
    <Box sx={{ minWidth: 0 }}>
      <Typography
        sx={{
          fontSize: "0.61rem",
          lineHeight: 1.2,
          color: "text.secondary",
          fontWeight: 650,
          letterSpacing: "0.035em",
        }}
      >
        {label}
      </Typography>

      <Typography
        sx={{
          mt: 0.25,
          fontSize: "0.76rem",
          lineHeight: 1.4,
          color: "text.primary",
          fontWeight: 600,
          wordBreak: "break-word",
        }}
      >
        {value}
      </Typography>
    </Box>
  );
}

function ObservationRow({ label, value }) {
  return (
    <Box
      sx={{
        py: 0.65,
        borderBottom: "1px solid #F1F5F9",

        "&:last-child": {
          borderBottom: "none",
          pb: 0,
        },

        "&:first-child": {
          pt: 0,
        },
      }}
    >
      <Typography
        sx={{
          fontSize: "0.62rem",
          fontWeight: 700,
          color: "text.secondary",
          textTransform: "uppercase",
          letterSpacing: "0.025em",
        }}
      >
        {label}
      </Typography>

      <Typography
        sx={{
          mt: 0.25,
          fontSize: "0.72rem",
          lineHeight: 1.5,
          color: "text.primary",
          whiteSpace: "pre-wrap",
        }}
      >
        {value?.trim() || "None"}
      </Typography>
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


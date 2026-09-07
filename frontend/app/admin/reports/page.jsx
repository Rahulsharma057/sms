"use client";

import { useEffect, useState } from "react";
import { ThemeProvider, createTheme } from "@mui/material/styles";
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
  EditOutlined,
  Add,
  RemoveCircleOutline,
  Save,
} from "@mui/icons-material";

import ProtectedRoute from "../../../components/ProtectedRoute";
import Navbar from "../../../components/Navbar";
import api from "../../../lib/api";
import ReportFormatDialog from "../../../components/ReportFormatDialog";

const getToday = () => new Date().toISOString().slice(0, 10);

// NEW: default labels for fixed fields — must match backend DEFAULT_FIXED_FIELDS.
const FIXED_FIELD_DEFAULTS = {
  positiveObservations: "Major positive observations",
  hygieneLapses: "Cleanliness / hygiene lapses noted",
  maintenanceFollowUp: "Maintenance items needing follow-up action",
  urgentMatters: "Urgent Matters",
  signature: "Signature of Duty Officer",
  countersignedBy: "Countersigned by",
};

const CHECKLIST_SECTIONS = [
  {
    key: "morningChecks",
    title: "Morning readiness check",
    timing: "0830–0900 hrs",
  },
  {
    key: "middayChecks",
    title: "Mid-day infrastructure & order inspection",
    timing: "1100–1300 hrs",
  },
  {
    key: "afternoonChecks",
    title: "Afternoon maintenance round",
    timing: "1400–1600 hrs",
  },
];

const getReportSections = (report) => {
  if (Array.isArray(report?.sections) && report.sections.length) {
    return report.sections.map((section, index) => ({
      key: section?.key || `section_${index + 1}`,
      title: section?.title || `Section ${index + 1}`,
      timing: section?.timing || "",
      items: Array.isArray(section?.items) ? section.items : [],
      existing: CHECKLIST_SECTIONS.some((x) => x.key === section?.key),
    }));
  }

  const meta = report?.sectionMeta || {};
  const base = CHECKLIST_SECTIONS.map((section) => ({
    ...section,
    title: meta?.[section.key]?.title || section.title,
    timing: meta?.[section.key]?.timing || section.timing,
    items: Array.isArray(report?.[section.key]) ? report[section.key] : [],
    existing: true,
  }));
  const custom = Array.isArray(report?.customSections)
    ? report.customSections.map((section, index) => ({
        key: section?.key || `custom_section_${index + 1}`,
        title: section?.title || `Additional Section ${index + 1}`,
        timing: section?.timing || "",
        items: Array.isArray(section?.items) ? section.items : [],
        existing: false,
      }))
    : [];
  return [...base, ...custom];
};

const getTotalChecks = (report) =>
  getReportSections(report).reduce((sum, s) => sum + (s.items?.length || 0), 0);

const getCompletedChecks = (report) =>
  getReportSections(report).reduce(
    (sum, s) => sum + (s.items?.filter((c) => c.checked).length || 0),
    0,
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

    doc.text("Duty Officer's Inspection Report", MARGIN_X, 14);

    doc.setFont(undefined, "normal");
    doc.setFontSize(9);

    doc.text(report.date || "-", PAGE_WIDTH - MARGIN_X, 14, { align: "right" });

    doc.setTextColor(0, 0, 0);

    y = 30;
  };
  const drawFooter = () => {
    doc.setFont(undefined, "normal");
    doc.setFontSize(8);
    doc.setTextColor(148, 163, 184);

    doc.text(`Page ${page}`, PAGE_WIDTH / 2, PAGE_HEIGHT - 8, {
      align: "center",
    });

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

    doc.rect(MARGIN_X, y - 4.5, CONTENT_WIDTH, 7.5, "F");

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

      const x = MARGIN_X + (i % 2) * colWidth;

      const [label, value] = row;

      doc.setFont(undefined, "bold");
      doc.setFontSize(7.5);
      doc.setTextColor(100, 116, 139);

      doc.text(label.toUpperCase(), x, y);

      doc.setFont(undefined, "normal");
      doc.setFontSize(10);
      doc.setTextColor(15, 23, 42);

      const text = doc.splitTextToSize(value || "-", colWidth - 6);

      doc.text(text, x, y + 5);

      if (!isNewRow || i === pairs.length - 1) {
        y += Math.max(text.length * 4.5, 4.5) + 8;
      }
    });
  };

  /* -------------------------------------------------
     TEXT BLOCK
  ------------------------------------------------- */

  const textBlock = (label, value) => {
    const text = doc.splitTextToSize(
      value?.trim() || "None",
      CONTENT_WIDTH - 4,
    );

    const needed = 6 + text.length * 4.6 + 4;

    ensureSpace(needed);

    doc.setFont(undefined, "bold");
    doc.setFontSize(9);
    doc.setTextColor(51, 65, 85);

    doc.text(label, MARGIN_X, y);

    y += 5;

    doc.setFont(undefined, "normal");
    doc.setFontSize(9.5);
    doc.setTextColor(15, 23, 42);

    doc.text(text, MARGIN_X + 2, y);

    y += text.length * 4.6 + 5;
  };

  /* -------------------------------------------------
     CHECKLIST ITEM
  ------------------------------------------------- */

  const checklistItem = (item) => {
    const labelLines = doc.splitTextToSize(
      item.label || "",
      CONTENT_WIDTH - 12,
    );

    const remarkLines = item.remark
      ? doc.splitTextToSize(`Remark: ${item.remark}`, CONTENT_WIDTH - 16)
      : [];

    const needed = labelLines.length * 4.6 + remarkLines.length * 4.2 + 4;

    ensureSpace(needed);

    doc.setDrawColor(148, 163, 184);
    doc.setLineWidth(0.3);

    doc.rect(MARGIN_X, y - 3.2, 3.6, 3.6);

    if (item.checked) {
      doc.setFont(undefined, "bold");
      doc.setFontSize(8.5);
      doc.setTextColor(22, 101, 52);

      doc.text("✓", MARGIN_X + 0.6, y - 0.3);

      doc.setTextColor(0, 0, 0);
    }

    doc.setFont(undefined, "normal");
    doc.setFontSize(9.5);
    doc.setTextColor(15, 23, 42);

    doc.text(labelLines, MARGIN_X + 7, y);

    y += labelLines.length * 4.6;

    if (remarkLines.length) {
      doc.setFont(undefined, "italic");
      doc.setFontSize(8.5);
      doc.setTextColor(100, 116, 139);

      doc.text(remarkLines, MARGIN_X + 9, y);

      doc.setTextColor(0, 0, 0);

      y += remarkLines.length * 4.2;
    }

    y += 1.5;
  };

  /* -------------------------------------------------
     BUILD PDF
  ------------------------------------------------- */

  drawHeader();

  const teacherLabel = report.teacher?.name
    ? `${report.teacher.name}${
        report.teacher.email ? ` (${report.teacher.email})` : ""
      }`
    : "-";

  infoGrid([
    ["Date", report.date],
    ["Teacher", teacherLabel],
    ["Duty Officer", report.dutyOfficerName],
    ["Organization / Centre", report.centreBatch],
    ["Shift Timing", report.shiftTiming],
  ]);

  const total = getTotalChecks(report);

  const completed = getCompletedChecks(report);

  const percentage = total > 0 ? Math.round((completed / total) * 100) : 0;

  ensureSpace(14);

  doc.setFont(undefined, "bold");
  doc.setFontSize(9.5);
  doc.setTextColor(15, 23, 42);

  doc.text(
    `${completed} of ${total} checks completed (${percentage}%)`,
    MARGIN_X,
    y,
  );

  y += 4;

  doc.setDrawColor(226, 232, 240);
  doc.setFillColor(241, 245, 249);

  doc.roundedRect(MARGIN_X, y, CONTENT_WIDTH, 3, 1.5, 1.5, "F");

  doc.setFillColor(30, 58, 95);

  doc.roundedRect(
    MARGIN_X,
    y,
    (CONTENT_WIDTH * percentage) / 100,
    3,
    1.5,
    1.5,
    "F",
  );

  y += 9;

  /* CHECKLIST */
  getReportSections(report).forEach((section) => {
    const items = section.items || [];
    if (items.length === 0) return;
    sectionTitle(
      `${section.title}${section.timing ? ` (${section.timing})` : ""}`,
    );
    items.forEach((item) => checklistItem(item));
    y += 2;
  });

  /* OBSERVATIONS */

  sectionTitle("Summary of Key Observations");

  textBlock("Major positive observations", report.positiveObservations);

  textBlock("Cleanliness / hygiene lapses noted", report.hygieneLapses);

  textBlock(
    "Maintenance items needing follow-up action",
    report.maintenanceFollowUp,
  );

  /* URGENT MATTERS */

  const urgentText = report.urgentMatters?.trim() || "None";

  const urgentLines = doc.splitTextToSize(urgentText, CONTENT_WIDTH - 6);

  const urgentBoxHeight = urgentLines.length * 4.6 + 14;

  ensureSpace(urgentBoxHeight + 4);

  doc.setDrawColor(253, 230, 138);
  doc.setFillColor(255, 251, 235);

  doc.roundedRect(MARGIN_X, y, CONTENT_WIDTH, urgentBoxHeight, 1.5, 1.5, "FD");

  doc.setFont(undefined, "bold");
  doc.setFontSize(9.5);
  doc.setTextColor(146, 64, 14);

  doc.text("Urgent Matters", MARGIN_X + 3, y + 6);

  doc.setFont(undefined, "normal");
  doc.setFontSize(9.5);
  doc.setTextColor(15, 23, 42);

  doc.text(urgentLines, MARGIN_X + 3, y + 11.5);

  y += urgentBoxHeight + 8;

  /* VERIFICATION */

  sectionTitle("Verification");

  infoGrid([
    ["Signature of Duty Officer", report.signature],
    ["Countersigned by", report.countersignedBy],
  ]);

  /* ADDITIONAL CUSTOM FIELDS */
  if (Array.isArray(report.customFields) && report.customFields.length > 0) {
    sectionTitle("Additional Fields");

    report.customFields.forEach((field) => {
      textBlock(
        field?.label || field?.key || "Additional Field",
        formatCustomFieldValue(field),
      );
    });
  }

  drawFooter();

  return doc;
};

const downloadReportPdf = async (report) => {
  const doc = await buildReportPdf(report);

  doc.save(
    `report-${report.date}-${(report.teacher?.name || "teacher").replace(
      /\s+/g,
      "_",
    )}.pdf`,
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
    report.urgentMatters.trim().toLowerCase() !== "none"
      ? report.urgentMatters
      : "None"
  }`;

const shareReport = async (report, onFallback) => {
  const text = buildShareText(report);

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
    await navigator.clipboard.writeText(text);

    onFallback?.("Report details copied to clipboard.");
  } catch {
    onFallback?.("Could not share or copy the report.");
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
    fontFamily: ["Inter", "Roboto", "Arial", "sans-serif"].join(","),
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
  const [template, setTemplate] = useState(null);
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

  const [editReport, setEditReport] = useState(null);
  const [savingReport, setSavingReport] = useState(false);
  const [formatDialogOpen, setFormatDialogOpen] = useState(false);

  // NEW: resolve label + enabled state for a fixed field, falling back to defaults.
  const fixedFields = template?.fixedFields || {};
  const fieldLabel = (key) => fixedFields[key]?.label || FIXED_FIELD_DEFAULTS[key];
  const fieldEnabled = (key) => fixedFields[key]?.enabled !== false;

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

        setTotalPages(res.data?.pagination?.totalPages || 1);

        setTotal(res.data?.pagination?.total || 0);

        setPage(res.data?.pagination?.page || 1);
      })
      .finally(() => setLoading(false));
  };

  // CHANGED: now stores the template so labels can be applied dynamically
  const loadTemplate = () => {
    api
      .get("/reports/template")
      .then((res) => setTemplate(res.data))
      .catch((err) => console.error("loadTemplate error:", err));
  };

  useEffect(() => {
    api.get("/users/teachers").then((res) => setTeachers(res.data));
    loadTemplate(); // NEW

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
      from: next.from !== undefined ? next.from : fromDate,

      to: next.to !== undefined ? next.to : toDate,

      teacher: next.teacher !== undefined ? next.teacher : teacherFilter,

      urgent: next.urgent !== undefined ? next.urgent : urgentFilter,

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
    const t = (r.urgentMatters || "").trim().toLowerCase();

    return t && t !== "none";
  };

  const urgentCount = reports.filter(isUrgentReport).length;

  useEffect(() => {
    if (!copyToast) return;

    const t = setTimeout(() => setCopyToast(""), 2500);

    return () => clearTimeout(t);
  }, [copyToast]);
  /* =====================================================
   EDIT REPORT
===================================================== */

  const normalizeEditReport = (report) => ({
    ...report,
    date: report?.date || "",
    dutyOfficerName: report?.dutyOfficerName || "",
    shiftTiming: report?.shiftTiming || "",
    centreBatch: report?.centreBatch || "",
    teacher:
      typeof report?.teacher === "object"
        ? report.teacher?._id || ""
        : report?.teacher || "",
    sections: getReportSections(report).map((section, index) => ({
      key: section.key || `section_${index + 1}`,
      title: section.title || `Section ${index + 1}`,
      timing: section.timing || "",
      items: (section.items || []).map((item, itemIndex) => ({
        key: item?.key || `${section.key}_item_${itemIndex + 1}`,
        label: item?.label || "",
        checked: !!item?.checked,
        remark: item?.remark || "",
        status: item?.status === "resolved" ? "resolved" : "open",
        adminRemark: item?.adminRemark || "",
        followed: !!item?.followed,
      })),
      existing: !!section.existing,
    })),
    positiveObservations: report?.positiveObservations || "",
    hygieneLapses: report?.hygieneLapses || "",
    maintenanceFollowUp: report?.maintenanceFollowUp || "",
    urgentMatters: report?.urgentMatters || "",
    signature: report?.signature || "",
    countersignedBy: report?.countersignedBy || "",
    customFields: Array.isArray(report?.customFields)
      ? report.customFields.map((field, index) => ({
          key: field?.key || `custom_field_${index + 1}`,

          label: field?.label || "",

          type: field?.type || "text",

          value: field?.value ?? (field?.type === "checkbox" ? false : ""),

          options: Array.isArray(field?.options) ? [...field.options] : [],
          required: !!field?.required,
        }))
      : [],
  });

  const openEditReport = (report) => {
    setSelectedReport(null);
    setEditReport(normalizeEditReport(report));
  };

  const updateEditField = (field, value) => {
    setEditReport((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  /* =====================================================
   CHECKLIST + SECTION EDITING
===================================================== */

  const updateChecklistItem = (sectionKey, index, patch) => {
    setEditReport((prev) => ({
      ...prev,
      sections: (prev?.sections || []).map((section) =>
        section.key !== sectionKey
          ? section
          : {
              ...section,
              items: (section.items || []).map((item, i) =>
                i === index ? { ...item, ...patch } : item,
              ),
            },
      ),
    }));
  };

  const addChecklistItem = (sectionKey) => {
    const item = {
      key: `item_${Date.now()}`,
      label: "",
      checked: false,
      remark: "",
      status: "open",
      adminRemark: "",
      followed: false,
    };
    setEditReport((prev) => ({
      ...prev,
      sections: (prev?.sections || []).map((section) =>
        section.key === sectionKey
          ? { ...section, items: [...(section.items || []), item] }
          : section,
      ),
    }));
  };

  const removeChecklistItem = (sectionKey, index) => {
    setEditReport((prev) => ({
      ...prev,
      sections: (prev?.sections || []).map((section) =>
        section.key === sectionKey
          ? {
              ...section,
              items: (section.items || []).filter((_, i) => i !== index),
            }
          : section,
      ),
    }));
  };

  const updateSectionMeta = (sectionKey, patch) => {
    setEditReport((prev) => ({
      ...prev,
      sections: (prev?.sections || []).map((section) =>
        section.key === sectionKey ? { ...section, ...patch } : section,
      ),
    }));
  };

  const updateCustomSection = (sectionKey, patch) =>
    updateSectionMeta(sectionKey, patch);

  const addCustomSection = () => {
    setEditReport((prev) => ({
      ...prev,
      sections: [
        ...(prev?.sections || []),
        {
          key: `custom_section_${Date.now()}`,
          title: "New Section",
          timing: "",
          items: [],
          existing: false,
        },
      ],
    }));
  };

  const removeCustomSection = (sectionKey) => {
    setEditReport((prev) => ({
      ...prev,
      sections: (prev?.sections || []).filter(
        (section) => section.key !== sectionKey,
      ),
    }));
  };

  /* =====================================================
   CUSTOM FIELD EDITING
===================================================== */

  const addCustomField = () => {
    setEditReport((prev) => ({
      ...prev,

      customFields: [
        ...(prev?.customFields || []),

        {
          key: `custom_field_${Date.now()}`,
          label: "",
          type: "text",
          value: "",
          options: [],
          required: false,
        },
      ],
    }));
  };

  const updateCustomField = (index, patch) => {
    setEditReport((prev) => ({
      ...prev,

      customFields: (prev?.customFields || []).map((field, i) =>
        i === index
          ? {
              ...field,
              ...patch,
            }
          : field,
      ),
    }));
  };

  const removeCustomField = (index) => {
    setEditReport((prev) => ({
      ...prev,

      customFields: (prev?.customFields || []).filter((_, i) => i !== index),
    }));
  };

  /* =====================================================
   SAVE EDITED REPORT
===================================================== */

  const handleUpdateReport = async () => {
    if (!editReport?._id) return;

    if (
      !editReport.date ||
      !editReport.teacher ||
      !editReport.dutyOfficerName?.trim()
    ) {
      setCopyToast("Date, teacher and duty officer are required.");
      return;
    }

    const invalidCustomField = (editReport.customFields || []).find(
      (field) => !field?.label?.trim() || !field?.key?.trim(),
    );

    if (invalidCustomField) {
      setCopyToast("Every additional field needs a label and key.");
      return;
    }

    const invalidSelectField = (editReport.customFields || []).find(
      (field) =>
        field?.type === "select" &&
        (!Array.isArray(field.options) || field.options.length === 0),
    );

    if (invalidSelectField) {
      setCopyToast("Select fields must have at least one option.");
      return;
    }

    try {
      setSavingReport(true);

      const payload = {
        date: editReport.date,

        teacher:
          typeof editReport.teacher === "object"
            ? editReport.teacher?._id
            : editReport.teacher,

        dutyOfficerName: editReport.dutyOfficerName,

        shiftTiming: editReport.shiftTiming,

        centreBatch: editReport.centreBatch,

        sections: editReport.sections || [],

        positiveObservations: editReport.positiveObservations,

        hygieneLapses: editReport.hygieneLapses,

        maintenanceFollowUp: editReport.maintenanceFollowUp,

        urgentMatters: editReport.urgentMatters,

        signature: editReport.signature,

        countersignedBy: editReport.countersignedBy,

        customFields: editReport.customFields,
      };

      const res = await api.patch(`/reports/${editReport._id}`, payload);

      const updatedReport =
        res?.data?.report ||
        res?.data?.data?.report ||
        res?.data?.data ||
        res?.data;
      if (!updatedReport?._id)
        throw new Error("Updated report was not returned by server.");

      setEditReport(null);

      setSelectedReport(updatedReport);

      setCopyToast("Daily report updated successfully.");

      await loadReports({
        from: fromDate,
        to: toDate,
        teacher: teacherFilter,
        urgent: urgentFilter,
        page,
      });
    } catch (error) {
      console.error("handleUpdateReport error:", error);

      setCopyToast(
        error?.response?.data?.message || "Failed to update daily report.",
      );
    } finally {
      setSavingReport(false);
    }
  };
  /* =====================================================
     DELETE
     FUNCTIONALITY UNCHANGED
  ===================================================== */

  const handleDeleteConfirmed = async () => {
    if (!deleteTarget) return;

    setDeleting(true);

    try {
      await api.delete(`/reports/${deleteTarget._id}`);

      setDeleteTarget(null);

      setCopyToast("Report deleted successfully.");

      const isLastItemOnPage = reports.length === 1 && page > 1;

      loadReports({
        from: fromDate,
        to: toDate,
        teacher: teacherFilter,
        urgent: urgentFilter,
        page: isLastItemOnPage ? page - 1 : page,
      });
    } catch (err) {
      setCopyToast(err?.response?.data?.message || "Could not delete report.");
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
                Inspection checklist submissions across all teachers
              </Typography>
            </Box>
          </Stack>

          {/* =================================================
              SUMMARY
          ================================================= */}

          <Grid container spacing={1.25} sx={{ mb: 1.5 }}>
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
                        color: urgentCount > 0 ? "error.main" : "text.primary",
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
                        ? `${fromDate || "…"} → ${toDate || "…"}`
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
                  <MenuItem value="">All teachers</MenuItem>

                  {teachers.map((t) => (
                    <MenuItem key={t._id} value={t._id}>
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
                  <MenuItem value="">All</MenuItem>

                  <MenuItem value="true">Urgent only</MenuItem>

                  <MenuItem value="false">Not urgent</MenuItem>
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
                    min: fromDate || undefined,
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
                <Stack direction="row" spacing={0.5} flexWrap="wrap">
                  <Button
                    size="small"
                    onClick={showAllDates}
                    disabled={fromDate === "" && toDate === ""}
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
                    startIcon={<FilterAltOff sx={{ fontSize: 16 }} />}
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

                <Button
                  size="small"
                  variant="contained"
                  startIcon={<EditOutlined fontSize="small" />}
                  onClick={() => setFormatDialogOpen(true)}
                  sx={{
                    height: 34,
                    px: 1.5,
                    textTransform: "none",
                    fontSize: "0.76rem",
                    fontWeight: 700,
                    boxShadow: "none",
                  }}
                >
                  Edit Daily Report Format
                </Button>

                <ToggleButtonGroup
                  value={viewMode}
                  exclusive
                  size="small"
                  onChange={(e, val) => val && setViewMode(val)}
                  sx={{
                    alignSelf: {
                      xs: "flex-end",
                      sm: "auto",
                    },

                    "& .MuiToggleButton-root": {
                      minWidth: 38,
                      height: 34,
                      px: 1,
                      borderColor: "divider",
                      color: "text.secondary",
                    },

                    "& .MuiToggleButton-root.Mui-selected": {
                      bgcolor: "primary.main",
                      color: "white",
                      borderColor: "primary.main",

                      "&:hover": {
                        bgcolor: "primary.dark",
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
                <Stack alignItems="center" spacing={1}>
                  <CircularProgress
                    size={24}
                    thickness={4}
                    sx={{
                      color: "primary.main",
                    }}
                  />

                  <Typography variant="caption" color="text.secondary">
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
                    bgcolor: "primary.light",
                    color: "primary.main",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <Description fontSize="small" />
                </Box>

                <Typography fontWeight={700} fontSize="0.95rem">
                  No reports found
                </Typography>

                <Typography variant="caption" color="text.secondary">
                  No reports match the selected filters.
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
                        borderColor: "divider",
                        py: 0.9,
                        fontSize: "0.78rem",
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
                        <TableCell>Date</TableCell>

                        <TableCell>Teacher</TableCell>

                        <TableCell>Centre Name</TableCell>

                        <TableCell>Urgent</TableCell>

                        <TableCell align="right">Actions</TableCell>
                      </TableRow>
                    </TableHead>

                    <TableBody>
                      {reports.map((r) => {
                        const urgent = isUrgentReport(r);

                        return (
                          <TableRow
                            key={r._id}
                            hover
                            onClick={() => setSelectedReport(r)}
                            sx={{
                              cursor: "pointer",

                              "&:hover": {
                                bgcolor: "#F8FBFF",
                              },
                            }}
                          >
                            <TableCell>
                              <Typography fontSize="0.78rem" fontWeight={650}>
                                {r.date}
                              </Typography>
                            </TableCell>

                            <TableCell>
                              <Typography fontSize="0.78rem" fontWeight={600}>
                                {r.teacher?.name || "-"}
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
                                {r.centreBatch || "-"}
                              </Typography>
                            </TableCell>

                            <TableCell>
                              {urgent ? (
                                <Chip
                                  size="small"
                                  icon={
                                    <Warning
                                      sx={{
                                        fontSize: "14px !important",
                                      }}
                                    />
                                  }
                                  label="Urgent"
                                  color="error"
                                  sx={{
                                    height: 24,
                                    fontSize: "0.68rem",
                                    fontWeight: 700,
                                  }}
                                />
                              ) : (
                                <Chip
                                  size="small"
                                  icon={
                                    <CheckCircle
                                      sx={{
                                        fontSize: "14px !important",
                                      }}
                                    />
                                  }
                                  label="Normal"
                                  sx={{
                                    height: 24,
                                    fontSize: "0.68rem",
                                    fontWeight: 650,
                                    bgcolor: "success.light",
                                    color: "success.dark",
                                  }}
                                />
                              )}
                            </TableCell>

                            <TableCell
                              align="right"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <Tooltip title="View">
                                <IconButton
                                  size="small"
                                  onClick={() => setSelectedReport(r)}
                                  sx={{
                                    ...actionButtonSx,
                                    color: "primary.main",
                                  }}
                                >
                                  <Visibility fontSize="small" />
                                </IconButton>
                              </Tooltip>
                              <Tooltip title="Edit">
                                <IconButton
                                  size="small"
                                  onClick={() => openEditReport(r)}
                                  sx={{
                                    ...actionButtonSx,
                                    color: "primary.main",
                                  }}
                                >
                                  <EditOutlined fontSize="small" />
                                </IconButton>
                              </Tooltip>
                              <Tooltip title="Download PDF">
                                <IconButton
                                  size="small"
                                  onClick={() => downloadReportPdf(r)}
                                  sx={{
                                    ...actionButtonSx,
                                    color: "secondary.main",
                                  }}
                                >
                                  <PictureAsPdf fontSize="small" />
                                </IconButton>
                              </Tooltip>

                              <Tooltip title="Delete">
                                <IconButton
                                  size="small"
                                  onClick={() => setDeleteTarget(r)}
                                  sx={{
                                    ...actionButtonSx,
                                    color: "error.main",
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
                <Grid container spacing={1.25}>
                  {reports.map((r) => {
                    const urgent = isUrgentReport(r);

                    return (
                      <Grid item xs={12} sm={6} md={4} key={r._id}>
                        <Card
                          elevation={0}
                          onClick={() => setSelectedReport(r)}
                          sx={{
                            height: "100%",
                            border: "1px solid",
                            borderColor: urgent ? "#FECACA" : "divider",
                            borderRadius: 1.5,
                            cursor: "pointer",
                            transition: "border-color .15s, box-shadow .15s",

                            "&:hover": {
                              borderColor: urgent ? "#FCA5A5" : "#BFDBFE",
                              boxShadow: "0 2px 8px rgba(15,23,42,.06)",
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
                                    color: "primary.main",
                                  }}
                                />

                                <Typography fontSize="0.78rem" fontWeight={700}>
                                  {r.date}
                                </Typography>
                              </Stack>

                              {urgent ? (
                                <Chip
                                  size="small"
                                  icon={
                                    <Warning
                                      sx={{
                                        fontSize: "13px !important",
                                      }}
                                    />
                                  }
                                  color="error"
                                  label="Urgent"
                                  sx={{
                                    height: 22,
                                    fontSize: "0.64rem",
                                    fontWeight: 700,
                                  }}
                                />
                              ) : (
                                <Chip
                                  size="small"
                                  label="Normal"
                                  sx={{
                                    height: 22,
                                    fontSize: "0.64rem",
                                    bgcolor: "success.light",
                                    color: "success.dark",
                                    fontWeight: 650,
                                  }}
                                />
                              )}
                            </Stack>

                            <Divider sx={{ my: 1 }} />

                            <Typography
                              fontSize="0.8rem"
                              fontWeight={650}
                              noWrap
                            >
                              {r.teacher?.name || "-"}
                            </Typography>

                            <Typography
                              fontSize="0.73rem"
                              color="text.secondary"
                              noWrap
                              sx={{ mt: 0.3 }}
                            >
                              {r.centreBatch || "-"}
                            </Typography>

                            <Stack
                              direction="row"
                              justifyContent="flex-end"
                              spacing={0.3}
                              sx={{
                                mt: 0.8,
                              }}
                              onClick={(e) => e.stopPropagation()}
                            >
                              <Tooltip title="View">
                                <IconButton
                                  size="small"
                                  onClick={() => setSelectedReport(r)}
                                  sx={{
                                    ...actionButtonSx,
                                    color: "primary.main",
                                  }}
                                >
                                  <Visibility fontSize="small" />
                                </IconButton>
                              </Tooltip>
                              <Tooltip title="Edit">
                                <IconButton
                                  size="small"
                                  onClick={() => openEditReport(r)}
                                  sx={{
                                    ...actionButtonSx,
                                    color: "primary.main",
                                  }}
                                >
                                  <EditOutlined fontSize="small" />
                                </IconButton>
                              </Tooltip>{" "}
                              <Tooltip title="Download PDF">
                                <IconButton
                                  size="small"
                                  onClick={() => downloadReportPdf(r)}
                                  sx={{
                                    ...actionButtonSx,
                                    color: "secondary.main",
                                  }}
                                >
                                  <PictureAsPdf fontSize="small" />
                                </IconButton>
                              </Tooltip>
                              <Tooltip title="Delete">
                                <IconButton
                                  size="small"
                                  onClick={() => setDeleteTarget(r)}
                                  sx={{
                                    ...actionButtonSx,
                                    color: "error.main",
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
          onClose={() => setSelectedReport(null)}
          maxWidth="sm"
          fullWidth
          fullScreen={false}
          PaperProps={{
            sx: {
              borderRadius: { xs: 2, sm: 3 },
              maxHeight: "92vh",
              overflow: "hidden",
              m: { xs: 1, sm: 2 },
              border: "1.5px solid #CBD5E1",
            },
          }}
        >
          {selectedReport && (
            <>
              {/* DIALOG HEADER */}
              <Box
                sx={{
                  px: { xs: 2, sm: 2.5 },
                  py: { xs: 1.5, sm: 2 },
                  bgcolor: "#1E3A8A",
                  color: "white",
                  position: "relative",
                  "&::after": {
                    content: '""',
                    position: "absolute",
                    left: 0,
                    bottom: 0,
                    width: 64,
                    height: 3,
                    bgcolor: "#B91C1C",
                  },
                }}
              >
                <IconButton
                  onClick={() => setSelectedReport(null)}
                  sx={{
                    position: "absolute",
                    top: 8,
                    right: 8,
                    width: 32,
                    height: 32,
                    color: "white",
                    bgcolor: "rgba(255,255,255,.10)",
                    "&:hover": { bgcolor: "rgba(255,255,255,.20)" },
                  }}
                >
                  <Close fontSize="small" />
                </IconButton>

                <Stack
                  direction="row"
                  alignItems="center"
                  spacing={1.2}
                  sx={{ pr: 4 }}
                >
                  <Box
                    sx={{
                      width: 36,
                      height: 36,
                      borderRadius: 1.5,
                      bgcolor: "rgba(255,255,255,.12)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      flexShrink: 0,
                    }}
                  >
                    <Description sx={{ fontSize: 18 }} />
                  </Box>

                  <Box>
                    <Typography
                      sx={{
                        fontSize: { xs: "0.9rem", sm: "1.05rem" },
                        lineHeight: 1.2,
                        fontWeight: 800,
                      }}
                    >
                      Duty Officer's Inspection Checklist
                    </Typography>

                    <Typography
                      sx={{
                        mt: 0.25,
                        fontSize: "0.7rem",
                        opacity: 0.85,
                        fontWeight: 500,
                      }}
                    >
                      Submitted by {selectedReport.teacher?.name || "-"} — view
                      only
                    </Typography>
                  </Box>
                </Stack>
              </Box>

              <DialogContent
                dividers
                sx={{
                  p: { xs: 1.25, sm: 1.75 },
                  bgcolor: "#F8FAFC",
                  borderColor: "#E2E8F0",
                  "&::-webkit-scrollbar": { width: 6 },
                  "&::-webkit-scrollbar-thumb": {
                    bgcolor: "#CBD5E1",
                    borderRadius: 3,
                  },
                }}
              >
                <Stack spacing={1.25}>
                  {/* URGENT STATUS */}
                  {isUrgentReport(selectedReport) && (
                    <Box
                      sx={{
                        display: "flex",
                        alignItems: "center",
                        gap: 0.8,
                        px: 1.25,
                        py: 0.75,
                        borderRadius: 1.5,
                        bgcolor: "#FEE2E2",
                        border: "1.5px solid #FECACA",
                        color: "#7F1D1D",
                      }}
                    >
                      <Warning sx={{ fontSize: 17, color: "#B91C1C" }} />
                      <Typography fontSize="0.74rem" fontWeight={800}>
                        Has urgent matters
                      </Typography>
                    </Box>
                  )}

                  {/* BASIC INFORMATION */}
                  <Paper
                    elevation={0}
                    sx={{
                      ...sectionPaperSx,
                      p: { xs: 1.25, sm: 1.5 },
                      border: "1.5px solid #E2E8F0",
                      borderRadius: 2,
                      bgcolor: "white",
                    }}
                  >
                    <SectionHeading>
                      01&nbsp;&nbsp;Basic Information
                    </SectionHeading>

                    <Grid
                      container
                      spacing={{ xs: 1, sm: 1.25 }}
                      sx={{ mt: 0.1 }}
                    >
                      {[
                        ["DATE", selectedReport.date],
                        ["DUTY OFFICER", selectedReport.dutyOfficerName],
                        ["ORGANIZATION / CENTRE", selectedReport.centreBatch],
                        ["SHIFT TIMING", selectedReport.shiftTiming],
                      ].map(([label, value]) => (
                        <Grid item xs={12} sm={6} key={label}>
                          <InfoValue label={label} value={value || "-"} />
                        </Grid>
                      ))}
                    </Grid>
                  </Paper>

                  {/* PROGRESS */}
                  <Paper
                    elevation={0}
                    sx={{
                      ...sectionPaperSx,
                      p: { xs: 1.25, sm: 1.5 },
                      border: "1.5px solid #E2E8F0",
                      borderRadius: 2,
                      bgcolor: "white",
                    }}
                  >
                    <Stack
                      direction="row"
                      alignItems="center"
                      justifyContent="space-between"
                      sx={{ mb: 0.75 }}
                    >
                      <Box>
                        <Typography fontSize="0.74rem" fontWeight={800}>
                          Completion Progress
                        </Typography>
                        <Typography
                          fontSize="0.67rem"
                          sx={{ color: "#64748B" }}
                        >
                          {getCompletedChecks(selectedReport)} of{" "}
                          {getTotalChecks(selectedReport)} checks completed
                        </Typography>
                      </Box>
                      <Typography
                        fontSize="1rem"
                        fontWeight={800}
                        sx={{ color: "#1E3A8A" }}
                      >
                        {getTotalChecks(selectedReport) > 0
                          ? Math.round(
                              (getCompletedChecks(selectedReport) /
                                getTotalChecks(selectedReport)) *
                                100,
                            )
                          : 0}
                        %
                      </Typography>
                    </Stack>

                    <LinearProgress
                      variant="determinate"
                      value={
                        getTotalChecks(selectedReport) > 0
                          ? (getCompletedChecks(selectedReport) /
                              getTotalChecks(selectedReport)) *
                            100
                          : 0
                      }
                      sx={{
                        height: 6,
                        borderRadius: 5,
                        bgcolor: "#E2E8F0",
                        "& .MuiLinearProgress-bar": {
                          bgcolor: "#1E3A8A",
                          borderRadius: 5,
                        },
                      }}
                    />
                  </Paper>

                  {/* CHECKLIST */}
                  <SectionHeading>
                    02&nbsp;&nbsp;Inspection Checklist
                  </SectionHeading>

                  {getReportSections(selectedReport).map(
                    (section, sectionIndex) => {
                      const items = section.items || [];

                      return (
                        <Paper
                          key={section.key}
                          elevation={0}
                          sx={{
                            ...sectionPaperSx,
                            overflow: "hidden",
                            border: "1.5px solid #E2E8F0",
                            borderRadius: 2,
                            bgcolor: "white",
                          }}
                        >
                          {/* SECTION HEADER */}
                          <Box
                            sx={{
                              px: { xs: 1.25, sm: 1.5 },
                              py: 0.85,
                              bgcolor: "#DBEAFE",
                              borderBottom: "1.5px solid #BFDBFE",
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
                                fontWeight={800}
                                sx={{ color: "#1E3A8A" }}
                              >
                                {String(sectionIndex + 1).padStart(2, "0")}
                                &nbsp;{section.title.replace(/^\d+\.\s*/, "")}
                              </Typography>
                            </Stack>
                          </Box>

                          {/* ITEMS */}
                          {items.length === 0 ? (
                            <Typography
                              sx={{
                                p: 1.2,
                                fontSize: "0.7rem",
                                color: "#64748B",
                              }}
                            >
                              No checklist items available.
                            </Typography>
                          ) : (
                            <Box sx={{ px: { xs: 1, sm: 1.25 } }}>
                              {items.map((item, i) => (
                                <Box
                                  key={i}
                                  sx={{
                                    py: 0.8,
                                    borderBottom:
                                      i === items.length - 1
                                        ? "none"
                                        : "1px solid #F1F5F9",
                                  }}
                                >
                                  <Stack
                                    direction="row"
                                    alignItems="flex-start"
                                    spacing={0.7}
                                  >
                                    <Checkbox
                                      checked={!!item.checked}
                                      disabled
                                      size="small"
                                      sx={{
                                        p: 0,
                                        mt: 0.05,
                                        "&.Mui-disabled": {
                                          color: item.checked
                                            ? "#1E3A8A"
                                            : "#CBD5E1",
                                        },
                                      }}
                                    />

                                    <Typography
                                      fontSize="0.76rem"
                                      sx={{
                                        pt: 0.15,
                                        lineHeight: 1.45,
                                        color: "#0F172A",
                                      }}
                                    >
                                      {item.label}
                                    </Typography>
                                  </Stack>

                                  {item.remark && (
                                    <Typography
                                      sx={{
                                        ml: 3.25,
                                        mt: 0.25,
                                        fontSize: "0.65rem",
                                        lineHeight: 1.4,
                                        color: "#64748B",
                                        fontStyle: "italic",
                                      }}
                                    >
                                      Remark: {item.remark}
                                    </Typography>
                                  )}

                                  {(item.status ||
                                    item.followed ||
                                    item.adminRemark) && (
                                    <Stack
                                      direction={{ xs: "column", sm: "row" }}
                                      spacing={0.6}
                                      sx={{ ml: 3.25, mt: 0.45 }}
                                    >
                                      {item.status && (
                                        <Chip
                                          size="small"
                                          label={`Status: ${item.status}`}
                                          sx={{
                                            height: 21,
                                            fontSize: "0.61rem",
                                            textTransform: "capitalize",
                                          }}
                                        />
                                      )}
                                      {item.followed && (
                                        <Chip
                                          size="small"
                                          label="Followed"
                                          color="success"
                                          sx={{
                                            height: 21,
                                            fontSize: "0.61rem",
                                          }}
                                        />
                                      )}
                                    </Stack>
                                  )}

                                  {item.adminRemark && (
                                    <Typography
                                      sx={{
                                        ml: 3.25,
                                        mt: 0.35,
                                        fontSize: "0.65rem",
                                        lineHeight: 1.4,
                                        color: "#475569",
                                      }}
                                    >
                                      Admin remark: {item.adminRemark}
                                    </Typography>
                                  )}
                                </Box>
                              ))}
                            </Box>
                          )}
                        </Paper>
                      );
                    },
                  )}

                  {/* OBSERVATIONS */}
                  <Paper
                    elevation={0}
                    sx={{
                      ...sectionPaperSx,
                      p: { xs: 1.25, sm: 1.5 },
                      border: "1.5px solid #E2E8F0",
                      borderRadius: 2,
                      bgcolor: "white",
                    }}
                  >
                    <SectionHeading>
                      03&nbsp;&nbsp;Summary of Key Observations
                    </SectionHeading>

                    <Stack spacing={1}>
                      {fieldEnabled("positiveObservations") && (
                        <ObservationRow
                          label={fieldLabel("positiveObservations")}
                          value={selectedReport.positiveObservations}
                        />
                      )}
                      {fieldEnabled("hygieneLapses") && (
                        <ObservationRow
                          label={fieldLabel("hygieneLapses")}
                          value={selectedReport.hygieneLapses}
                        />
                      )}
                      {fieldEnabled("maintenanceFollowUp") && (
                        <ObservationRow
                          label={fieldLabel("maintenanceFollowUp")}
                          value={selectedReport.maintenanceFollowUp}
                        />
                      )}
                    </Stack>
                  </Paper>

                  {/* URGENT MATTERS */}
                  {fieldEnabled("urgentMatters") && (
                  <Box
                    sx={{
                      border: "1.5px solid",
                      borderColor: isUrgentReport(selectedReport)
                        ? "#FECACA"
                        : "#E2E8F0",
                      bgcolor: isUrgentReport(selectedReport)
                        ? "#FEE2E2"
                        : "white",
                      borderRadius: 2,
                      p: { xs: 1.25, sm: 1.5 },
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
                          color: isUrgentReport(selectedReport)
                            ? "#B91C1C"
                            : "#94A3B8",
                          mt: 0.1,
                          flexShrink: 0,
                        }}
                      />

                      <Box>
                        <Typography
                          fontSize="0.75rem"
                          fontWeight={800}
                          sx={{
                            color: isUrgentReport(selectedReport)
                              ? "#7F1D1D"
                              : "#0F172A",
                          }}
                        >
                          04&nbsp;&nbsp;{fieldLabel("urgentMatters")}
                        </Typography>

                        <Typography
                          sx={{
                            mt: 0.35,
                            fontSize: "0.72rem",
                            lineHeight: 1.5,
                            color: isUrgentReport(selectedReport)
                              ? "#7F1D1D"
                              : "#64748B",
                          }}
                        >
                          {selectedReport.urgentMatters?.trim() ||
                            "None reported"}
                        </Typography>
                      </Box>
                    </Stack>
                  </Box>
                  )}

                  {/* ADDITIONAL FIELDS */}
                  {Array.isArray(selectedReport.customFields) &&
                    selectedReport.customFields.length > 0 && (
                      <Paper
                        elevation={0}
                        sx={{
                          ...sectionPaperSx,
                          p: { xs: 1.25, sm: 1.5 },
                          border: "1.5px solid #E2E8F0",
                          borderRadius: 2,
                          bgcolor: "white",
                        }}
                      >
                        <SectionHeading>
                          06&nbsp;&nbsp;Additional Fields
                        </SectionHeading>
                        <Grid container spacing={1.25}>
                          {selectedReport.customFields.map((field, index) => (
                            <Grid
                              item
                              xs={12}
                              sm={6}
                              key={field._id || field.key || index}
                            >
                              <InfoValue
                                label={
                                  field.label || field.key || "Additional Field"
                                }
                                value={formatCustomFieldValue(field)}
                              />
                            </Grid>
                          ))}
                        </Grid>
                      </Paper>
                    )}

                  {/* VERIFICATION */}
                  <Paper
                    elevation={0}
                    sx={{
                      ...sectionPaperSx,
                      p: { xs: 1.25, sm: 1.5 },
                      border: "1.5px solid #E2E8F0",
                      borderRadius: 2,
                      bgcolor: "white",
                    }}
                  >
                    <SectionHeading>05&nbsp;&nbsp;Verification</SectionHeading>

                    <Grid container spacing={1.25}>
                      {fieldEnabled("signature") && (
                        <Grid item xs={12} sm={6}>
                          <InfoValue
                            label={fieldLabel("signature").toUpperCase()}
                            value={selectedReport.signature || "-"}
                          />
                        </Grid>
                      )}
                      {fieldEnabled("countersignedBy") && (
                        <Grid item xs={12} sm={6}>
                          <InfoValue
                            label={fieldLabel("countersignedBy").toUpperCase()}
                            value={selectedReport.countersignedBy || "-"}
                          />
                        </Grid>
                      )}
                    </Grid>
                  </Paper>

                  {copyToast && (
                    <Alert
                      severity="info"
                      onClose={() => setCopyToast("")}
                      sx={{
                        py: 0,
                        fontSize: "0.75rem",
                        borderRadius: 1.5,
                        border: "1.5px solid #BFDBFE",
                        bgcolor: "#DBEAFE",
                        color: "#1E3A8A",
                        "& .MuiAlert-icon": { color: "#1E3A8A" },
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
                  px: { xs: 1.5, sm: 2 },
                  py: 1.25,
                  bgcolor: "white",
                  borderTop: "1.5px solid #E2E8F0",
                  gap: 0.75,
                }}
              >
                <Button
                  startIcon={<EditOutlined fontSize="small" />}
                  onClick={() => openEditReport(selectedReport)}
                  variant="outlined"
                  sx={{
                    height: 36,
                    px: 1.5,
                    fontSize: "0.76rem",
                    textTransform: "none",
                    fontWeight: 700,
                    borderColor: "#BFDBFE",
                    color: "primary.main",
                    borderRadius: 1.5,
                  }}
                >
                  Edit
                </Button>

                <Button
                  startIcon={<Share fontSize="small" />}
                  onClick={() => shareReport(selectedReport, setCopyToast)}
                  variant="outlined"
                  sx={{
                    height: 36,
                    px: 1.5,
                    fontSize: "0.76rem",
                    textTransform: "none",
                    fontWeight: 700,
                    borderColor: "#E2E8F0",
                    color: "#0F172A",
                    borderRadius: 1.5,
                    "&:hover": { bgcolor: "#F8FAFC", borderColor: "#CBD5E1" },
                  }}
                >
                  Share
                </Button>

                <Button
                  variant="contained"
                  startIcon={<PictureAsPdf fontSize="small" />}
                  onClick={() => downloadReportPdf(selectedReport)}
                  sx={{
                    height: 36,
                    px: 1.6,
                    fontSize: "0.76rem",
                    textTransform: "none",
                    fontWeight: 700,
                    bgcolor: "#1E3A8A",
                    borderRadius: 1.5,
                    boxShadow: "none",
                    "&:hover": { bgcolor: "#172554", boxShadow: "none" },
                  }}
                >
                  Download PDF
                </Button>
              </DialogActions>
            </>
          )}
        </Dialog>
        {/* =====================================================
    EDIT REPORT DIALOG
===================================================== */}

        <Dialog
          open={!!editReport}
          onClose={() => {
            if (!savingReport) {
              setEditReport(null);
            }
          }}
          maxWidth="lg"
          fullWidth
          PaperProps={{
            sx: {
              borderRadius: {
                xs: 2,
                sm: 3,
              },
              maxHeight: "94vh",
              overflow: "hidden",
              m: {
                xs: 1,
                sm: 2,
              },
              border: "1.5px solid #CBD5E1",
            },
          }}
        >
          {editReport && (
            <>
              {/* HEADER */}

              <Box
                sx={{
                  px: {
                    xs: 1.75,
                    sm: 2.5,
                  },
                  py: {
                    xs: 1.5,
                    sm: 1.8,
                  },
                  bgcolor: "#1E3A8A",
                  color: "white",
                  position: "relative",
                }}
              >
                <IconButton
                  disabled={savingReport}
                  onClick={() => setEditReport(null)}
                  sx={{
                    position: "absolute",
                    right: 8,
                    top: 8,
                    width: 32,
                    height: 32,
                    color: "white",
                    bgcolor: "rgba(255,255,255,.10)",
                    "&:hover": {
                      bgcolor: "rgba(255,255,255,.20)",
                    },
                  }}
                >
                  <Close fontSize="small" />
                </IconButton>

                <Stack
                  direction="row"
                  spacing={1}
                  alignItems="center"
                  sx={{ pr: 4 }}
                >
                  <Box
                    sx={{
                      width: 36,
                      height: 36,
                      borderRadius: 1.5,
                      bgcolor: "rgba(255,255,255,.12)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <EditOutlined sx={{ fontSize: 18 }} />
                  </Box>

                  <Box>
                    <Typography
                      fontSize={{
                        xs: "0.95rem",
                        sm: "1.05rem",
                      }}
                      fontWeight={800}
                    >
                      Edit Daily Report
                    </Typography>

                    <Typography
                      fontSize="0.68rem"
                      sx={{
                        opacity: 0.82,
                        mt: 0.2,
                      }}
                    >
                      Admin / Superadmin editing
                    </Typography>
                  </Box>
                </Stack>
              </Box>

              <DialogContent
                dividers
                sx={{
                  p: {
                    xs: 1.25,
                    sm: 2,
                  },
                  bgcolor: "#F8FAFC",

                  "&::-webkit-scrollbar": {
                    width: 6,
                  },

                  "&::-webkit-scrollbar-thumb": {
                    bgcolor: "#CBD5E1",
                    borderRadius: 3,
                  },
                }}
              >
                <Stack spacing={1.5}>
                  {/* =================================================
              BASIC INFORMATION
          ================================================= */}

                  <Paper
                    elevation={0}
                    sx={{
                      ...sectionPaperSx,
                      p: {
                        xs: 1.25,
                        sm: 1.5,
                      },
                      borderRadius: 2,
                    }}
                  >
                    <SectionHeading>
                      01&nbsp;&nbsp;Basic Information
                    </SectionHeading>

                    <Grid container spacing={1.25}>
                      {/* DATE */}

                      <Grid item xs={12} sm={6} md={3}>
                        <TextField
                          fullWidth
                          size="small"
                          type="date"
                          label="Date"
                          value={editReport.date}
                          onChange={(e) =>
                            updateEditField("date", e.target.value)
                          }
                          InputLabelProps={{
                            shrink: true,
                          }}
                        />
                      </Grid>

                      {/* TEACHER */}

                      <Grid item xs={12} sm={6} md={3}>
                        <TextField
                          select
                          fullWidth
                          size="small"
                          label="Teacher"
                          value={editReport.teacher || ""}
                          onChange={(e) =>
                            updateEditField("teacher", e.target.value)
                          }
                        >
                          <MenuItem value="">Select teacher</MenuItem>

                          {teachers.map((teacher) => (
                            <MenuItem key={teacher._id} value={teacher._id}>
                              {teacher.name}
                            </MenuItem>
                          ))}
                        </TextField>
                      </Grid>

                      {/* DUTY OFFICER */}

                      <Grid item xs={12} sm={6} md={3}>
                        <TextField
                          fullWidth
                          size="small"
                          label="Duty Officer"
                          value={editReport.dutyOfficerName}
                          onChange={(e) =>
                            updateEditField("dutyOfficerName", e.target.value)
                          }
                        />
                      </Grid>

                      {/* CENTRE */}

                      <Grid item xs={12} sm={6} md={3}>
                        <TextField
                          fullWidth
                          size="small"
                          label="Centre / Batch"
                          value={editReport.centreBatch}
                          onChange={(e) =>
                            updateEditField("centreBatch", e.target.value)
                          }
                        />
                      </Grid>

                      {/* SHIFT */}

                      <Grid item xs={12} sm={6}>
                        <TextField
                          fullWidth
                          size="small"
                          label="Shift Timing"
                          placeholder="e.g. 0830–1600 hrs"
                          value={editReport.shiftTiming}
                          onChange={(e) =>
                            updateEditField("shiftTiming", e.target.value)
                          }
                        />
                      </Grid>
                    </Grid>
                  </Paper>

                  {/* =================================================
              CHECKLISTS
          ================================================= */}

                  <SectionHeading>
                    02&nbsp;&nbsp;Inspection Checklist
                  </SectionHeading>

                  {getReportSections(editReport).map(
                    (section, sectionIndex) => {
                      const items = section.items || [];

                      return (
                        <Paper
                          key={section.key}
                          elevation={0}
                          sx={{
                            ...sectionPaperSx,
                            overflow: "hidden",
                            borderRadius: 2,
                          }}
                        >
                          {/* SECTION HEADER */}

                          <Box
                            sx={{
                              px: {
                                xs: 1.25,
                                sm: 1.5,
                              },
                              py: 1,
                              bgcolor: "#DBEAFE",
                              borderBottom: "1px solid #BFDBFE",
                            }}
                          >
                            <Stack
                              direction={{
                                xs: "column",
                                sm: "row",
                              }}
                              justifyContent="space-between"
                              alignItems={{
                                xs: "flex-start",
                                sm: "center",
                              }}
                              spacing={0.7}
                            >
                              <Box sx={{ flex: 1, width: "100%" }}>
                                <Stack
                                  direction={{ xs: "column", sm: "row" }}
                                  spacing={0.75}
                                >
                                  <TextField
                                    size="small"
                                    label="Section title"
                                    value={section.title || ""}
                                    onChange={(e) =>
                                      updateSectionMeta(section.key, {
                                        title: e.target.value,
                                      })
                                    }
                                    disabled
                                    sx={{ flex: 1 }}
                                  />
                                  <TextField
                                    size="small"
                                    label="Timing"
                                    value={section.timing || ""}
                                    onChange={(e) =>
                                      updateSectionMeta(section.key, {
                                        timing: e.target.value,
                                      })
                                    }
                                    disabled
                                    sx={{ flex: 1 }}
                                  />
                                </Stack>
                              </Box>

                              {!section.existing && (
                                <Tooltip title="Remove section">
                                  <IconButton
                                    size="small"
                                    disabled
                                    onClick={() =>
                                      removeCustomSection(section.key)
                                    }
                                    sx={{ color: "error.main" }}
                                  >
                                    <DeleteOutline fontSize="small" />
                                  </IconButton>
                                </Tooltip>
                              )}

                              <Button
                                size="small"
                                startIcon={
                                  <Add
                                    sx={{
                                      fontSize: "16px !important",
                                    }}
                                  />
                                }
                                disabled
                                onClick={() => addChecklistItem(section.key)}
                                sx={{
                                  height: 30,
                                  px: 1,
                                  fontSize: "0.68rem",
                                  textTransform: "none",
                                  fontWeight: 700,
                                }}
                              >
                                Add Item
                              </Button>
                            </Stack>
                          </Box>

                          {/* ITEMS */}

                          <Box
                            sx={{
                              p: {
                                xs: 1,
                                sm: 1.25,
                              },
                            }}
                          >
                            {items.length === 0 ? (
                              <Box
                                sx={{
                                  py: 2,
                                  textAlign: "center",
                                  border: "1px dashed #CBD5E1",
                                  borderRadius: 1.5,
                                }}
                              >
                                <Typography
                                  fontSize="0.7rem"
                                  color="text.secondary"
                                >
                                  No checklist items. Add a new item.
                                </Typography>
                              </Box>
                            ) : (
                              <Stack spacing={1}>
                                {items.map((item, index) => (
                                  <Box
                                    key={`${section.key}-${index}`}
                                    sx={{
                                      p: 1,
                                      border: "1px solid #E2E8F0",
                                      borderRadius: 1.5,
                                      bgcolor: "#FFFFFF",
                                    }}
                                  >
                                    <Grid
                                      container
                                      spacing={1}
                                      alignItems="flex-start"
                                    >
                                      {/* CHECKED */}

                                      <Grid item xs="auto">
                                        <Tooltip title="Completed">
                                          <Checkbox
                                            size="small"
                                            checked={!!item.checked}
                                            onChange={(e) =>
                                              updateChecklistItem(
                                                section.key,
                                                index,
                                                {
                                                  checked: e.target.checked,
                                                },
                                              )
                                            }
                                            sx={{
                                              mt: 0.15,
                                            }}
                                          />
                                        </Tooltip>
                                      </Grid>

                                      {/* LABEL */}

                                      <Grid item xs={12} md={4}>
                                        <TextField
                                          fullWidth
                                          size="small"
                                          label="Checklist item"
                                          value={item.label}
                                          disabled
                                          onChange={(e) =>
                                            updateChecklistItem(
                                              section.key,
                                              index,
                                              { label: e.target.value },
                                            )
                                          }
                                        />
                                      </Grid>

                                      {/* REMARK */}

                                      <Grid item xs={12} md={3}>
                                        <TextField
                                          fullWidth
                                          size="small"
                                          label="Teacher remark"
                                          value={item.remark}
                                          onChange={(e) =>
                                            updateChecklistItem(
                                              section.key,
                                              index,
                                              {
                                                remark: e.target.value,
                                              },
                                            )
                                          }
                                        />
                                      </Grid>

                                      {/* STATUS */}

                                      <Grid item xs={12} sm={6} md={2}>
                                        <TextField
                                          select
                                          fullWidth
                                          size="small"
                                          label="Status"
                                          value={item.status || "open"}
                                          onChange={(e) =>
                                            updateChecklistItem(
                                              section.key,
                                              index,
                                              {
                                                status: e.target.value,
                                              },
                                            )
                                          }
                                        >
                                          <MenuItem value="open">Open</MenuItem>

                                          <MenuItem value="resolved">
                                            Resolved
                                          </MenuItem>
                                        </TextField>
                                      </Grid>

                                      {/* FOLLOWED */}

                                      <Grid item xs={12} sm={6} md={2}>
                                        <Stack
                                          direction="row"
                                          alignItems="center"
                                          sx={{
                                            minHeight: 40,
                                          }}
                                        >
                                          <Checkbox
                                            size="small"
                                            checked={!!item.followed}
                                            onChange={(e) =>
                                              updateChecklistItem(
                                                section.key,
                                                index,
                                                {
                                                  followed: e.target.checked,
                                                },
                                              )
                                            }
                                          />

                                          <Typography
                                            fontSize="0.7rem"
                                            fontWeight={600}
                                          >
                                            Followed
                                          </Typography>
                                        </Stack>
                                      </Grid>

                                      {/* DELETE */}

                                      <Grid item xs="auto">
                                        <Tooltip title="Remove item">
                                          <IconButton
                                            size="small"
                                            disabled
                                            onClick={() =>
                                              removeChecklistItem(
                                                section.key,
                                                index,
                                              )
                                            }
                                            sx={{
                                              color: "error.main",
                                              mt: 0.3,
                                            }}
                                          >
                                            <RemoveCircleOutline fontSize="small" />
                                          </IconButton>
                                        </Tooltip>
                                      </Grid>

                                      {/* ADMIN REMARK */}

                                      <Grid item xs={12}>
                                        <TextField
                                          fullWidth
                                          size="small"
                                          multiline
                                          minRows={2}
                                          label="Admin remark"
                                          value={item.adminRemark || ""}
                                          onChange={(e) =>
                                            updateChecklistItem(
                                              section.key,
                                              index,
                                              {
                                                adminRemark: e.target.value,
                                              },
                                            )
                                          }
                                        />
                                      </Grid>
                                    </Grid>
                                  </Box>
                                ))}
                              </Stack>
                            )}
                          </Box>
                        </Paper>
                      );
                    },
                  )}

                  <Button
                    variant="outlined"
                    size="small"
                    startIcon={<Add fontSize="small" />}
                    disabled
                    onClick={addCustomSection}
                    sx={{
                      alignSelf: "flex-start",
                      textTransform: "none",
                      fontSize: "0.72rem",
                      fontWeight: 700,
                    }}
                  >
                    Add New Section
                  </Button>

                  {/* =================================================
              OBSERVATIONS
          ================================================= */}

                  <Paper
                    elevation={0}
                    sx={{
                      ...sectionPaperSx,
                      p: {
                        xs: 1.25,
                        sm: 1.5,
                      },
                      borderRadius: 2,
                    }}
                  >
                    <SectionHeading>
                      03&nbsp;&nbsp;Summary of Key Observations
                    </SectionHeading>

                    <Stack spacing={1.25}>
                      <TextField
                        fullWidth
                        multiline
                        minRows={2}
                        size="small"
                        label={fieldLabel("positiveObservations")}
                        value={editReport.positiveObservations}
                        onChange={(e) =>
                          updateEditField(
                            "positiveObservations",
                            e.target.value,
                          )
                        }
                      />

                      <TextField
                        fullWidth
                        multiline
                        minRows={2}
                        size="small"
                        label={fieldLabel("hygieneLapses")}
                        value={editReport.hygieneLapses}
                        onChange={(e) =>
                          updateEditField("hygieneLapses", e.target.value)
                        }
                      />

                      <TextField
                        fullWidth
                        multiline
                        minRows={2}
                        size="small"
                        label={fieldLabel("maintenanceFollowUp")}
                        value={editReport.maintenanceFollowUp}
                        onChange={(e) =>
                          updateEditField("maintenanceFollowUp", e.target.value)
                        }
                      />
                    </Stack>
                  </Paper>

                  {/* =================================================
              URGENT MATTERS
          ================================================= */}

                  <Paper
                    elevation={0}
                    sx={{
                      p: {
                        xs: 1.25,
                        sm: 1.5,
                      },
                      borderRadius: 2,
                      border: "1px solid #FECACA",
                      bgcolor: "#FFF7F7",
                    }}
                  >
                    <SectionHeading>
                      04&nbsp;&nbsp;{fieldLabel("urgentMatters")}
                    </SectionHeading>

                    <TextField
                      fullWidth
                      multiline
                      minRows={3}
                      size="small"
                      label={fieldLabel("urgentMatters")}
                      value={editReport.urgentMatters}
                      onChange={(e) =>
                        updateEditField("urgentMatters", e.target.value)
                      }
                      helperText="Leave empty or write None if there are no urgent matters."
                    />
                  </Paper>

                  {/* =================================================
              VERIFICATION
          ================================================= */}

                  <Paper
                    elevation={0}
                    sx={{
                      ...sectionPaperSx,
                      p: {
                        xs: 1.25,
                        sm: 1.5,
                      },
                      borderRadius: 2,
                    }}
                  >
                    <SectionHeading>05&nbsp;&nbsp;Verification</SectionHeading>

                    <Grid container spacing={1.25}>
                      <Grid item xs={12} sm={6}>
                        <TextField
                          fullWidth
                          size="small"
                          label={fieldLabel("signature")}
                          value={editReport.signature}
                          onChange={(e) =>
                            updateEditField("signature", e.target.value)
                          }
                        />
                      </Grid>

                      <Grid item xs={12} sm={6}>
                        <TextField
                          fullWidth
                          size="small"
                          label={fieldLabel("countersignedBy")}
                          value={editReport.countersignedBy}
                          onChange={(e) =>
                            updateEditField("countersignedBy", e.target.value)
                          }
                        />
                      </Grid>
                    </Grid>
                  </Paper>

                  {/* =================================================
              CUSTOM FIELDS
          ================================================= */}

                  <Paper
                    elevation={0}
                    sx={{
                      ...sectionPaperSx,
                      p: {
                        xs: 1.25,
                        sm: 1.5,
                      },
                      borderRadius: 2,
                    }}
                  >
                    <Stack
                      direction={{
                        xs: "column",
                        sm: "row",
                      }}
                      justifyContent="space-between"
                      alignItems={{
                        xs: "flex-start",
                        sm: "center",
                      }}
                      spacing={1}
                      sx={{ mb: 1.25 }}
                    >
                      <Box>
                        <SectionHeading>
                          06&nbsp;&nbsp;Additional Fields
                        </SectionHeading>

                        <Typography
                          fontSize="0.67rem"
                          color="text.secondary"
                          sx={{
                            mt: -0.5,
                          }}
                        >
                          Add extra information to this report.
                        </Typography>
                      </Box>

                      <Button
                        variant="outlined"
                        size="small"
                        startIcon={<Add fontSize="small" />}
                        disabled
                        onClick={addCustomField}
                        sx={{
                          height: 32,
                          textTransform: "none",
                          fontSize: "0.7rem",
                          fontWeight: 700,
                        }}
                      >
                        Add Field
                      </Button>
                    </Stack>

                    {(editReport.customFields || []).length === 0 ? (
                      <Box
                        sx={{
                          py: 2,
                          textAlign: "center",
                          border: "1px dashed #CBD5E1",
                          borderRadius: 1.5,
                        }}
                      >
                        <Typography fontSize="0.7rem" color="text.secondary">
                          No additional fields added.
                        </Typography>
                      </Box>
                    ) : (
                      <Stack spacing={1}>
                        {editReport.customFields.map((field, index) => (
                          <CustomFieldEditor
                            key={`${field.key}-${index}`}
                            field={field}
                            index={index}
                            onChange={updateCustomField}
                            onRemove={removeCustomField}
                            readOnly
                          />
                        ))}
                      </Stack>
                    )}
                  </Paper>
                </Stack>
              </DialogContent>

              {/* FOOTER */}

              <DialogActions
                sx={{
                  px: {
                    xs: 1.25,
                    sm: 2,
                  },
                  py: 1.25,
                  bgcolor: "white",
                  borderTop: "1px solid #E2E8F0",
                  gap: 0.75,
                }}
              >
                <Button
                  disabled={savingReport}
                  onClick={() => setEditReport(null)}
                  sx={{
                    height: 36,
                    px: 1.75,
                    textTransform: "none",
                    fontSize: "0.76rem",
                    color: "text.secondary",
                  }}
                >
                  Cancel
                </Button>

                <Button
                  variant="contained"
                  disabled={savingReport}
                  onClick={handleUpdateReport}
                  startIcon={
                    savingReport ? (
                      <CircularProgress size={15} color="inherit" />
                    ) : (
                      <Save fontSize="small" />
                    )
                  }
                  sx={{
                    height: 36,
                    px: 1.75,
                    textTransform: "none",
                    fontSize: "0.76rem",
                    fontWeight: 700,
                    bgcolor: "#1E3A8A",
                    boxShadow: "none",
                    "&:hover": {
                      bgcolor: "#172554",
                      boxShadow: "none",
                    },
                  }}
                >
                  {savingReport ? "Saving..." : "Save Changes"}
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
          onClose={() => !deleting && setDeleteTarget(null)}
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
            <Stack spacing={1} alignItems="center" textAlign="center">
              <Box
                sx={{
                  width: 42,
                  height: 42,
                  borderRadius: "50%",
                  bgcolor: "error.light",
                  color: "error.main",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <DeleteOutline />
              </Box>

              <Typography fontWeight={750} fontSize="0.95rem">
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
                {deleteTarget?.teacher?.name || "Unknown teacher"}. This action
                cannot be undone.
              </Typography>
            </Stack>
          </DialogContent>

          <DialogActions
            sx={{
              px: 2.5,
              pb: 2,
              justifyContent: "center",
              gap: 0.75,
            }}
          >
            <Button
              onClick={() => setDeleteTarget(null)}
              disabled={deleting}
              sx={{
                height: 36,
                px: 1.75,
                fontSize: "0.76rem",
                textTransform: "none",
                color: "text.secondary",
              }}
            >
              Cancel
            </Button>

            <Button
              variant="contained"
              color="error"
              onClick={handleDeleteConfirmed}
              disabled={deleting}
              startIcon={
                deleting ? (
                  <CircularProgress size={15} color="inherit" />
                ) : (
                  <DeleteOutline fontSize="small" />
                )
              }
              sx={{
                height: 36,
                px: 1.75,
                fontSize: "0.76rem",
                textTransform: "none",
                fontWeight: 700,
                boxShadow: "none",
              }}
            >
              {deleting ? "Deleting..." : "Delete"}
            </Button>
          </DialogActions>
        </Dialog>
      </Box>
  <ReportFormatDialog
  open={formatDialogOpen}
  onClose={() => setFormatDialogOpen(false)}
  onSaved={() => {
    setFormatDialogOpen(false);
    loadTemplate();
  }}
/>
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
function formatCustomFieldValue(field) {
  if (field?.type === "checkbox") return field?.value ? "Yes" : "No";
  if (Array.isArray(field?.value)) return field.value.join(", ") || "None";
  return field?.value === null ||
    field?.value === undefined ||
    field?.value === ""
    ? "None"
    : String(field.value);
}

function CustomFieldEditor({
  field,
  index,
  onChange,
  onRemove,
  readOnly = false,
}) {
  const handleTypeChange = (type) => {
    let value = "";
    if (type === "checkbox") value = false;

    onChange(index, {
      type,
      value,
      options: type === "select" ? field.options || [] : [],
    });
  };

  return (
    <Box
      sx={{
        p: 1,
        border: "1px solid #E2E8F0",
        borderRadius: 1.5,
        bgcolor: "#FFFFFF",
      }}
    >
      <Grid container spacing={1} alignItems="flex-start">
        <Grid item xs={12} sm={6} md={3}>
          <TextField
            fullWidth
            size="small"
            label="Field label"
            placeholder="e.g. Inspection score"
            value={field.label || ""}
            disabled={readOnly}
            onChange={(e) => onChange(index, { label: e.target.value })}
          />
        </Grid>

        <Grid item xs={12} sm={6} md={2}>
          <TextField
            fullWidth
            size="small"
            label="Field key"
            value={field.key || ""}
            disabled={readOnly}
            onChange={(e) =>
              onChange(index, {
                key: e.target.value.replace(/\s+/g, "_").toLowerCase(),
              })
            }
          />
        </Grid>

        <Grid item xs={12} sm={6} md={2}>
          <TextField
            select
            fullWidth
            size="small"
            label="Type"
            value={field.type || "text"}
            disabled={readOnly}
            onChange={(e) => handleTypeChange(e.target.value)}
          >
            <MenuItem value="text">Text</MenuItem>
            <MenuItem value="textarea">Textarea</MenuItem>
            <MenuItem value="number">Number</MenuItem>
            <MenuItem value="date">Date</MenuItem>
            <MenuItem value="checkbox">Checkbox</MenuItem>
            <MenuItem value="select">Select</MenuItem>
          </TextField>
        </Grid>

        <Grid item xs={12} sm={6} md={4}>
          {field.type === "checkbox" ? (
            <Stack direction="row" alignItems="center" sx={{ minHeight: 40 }}>
              <Checkbox
                size="small"
                checked={!!field.value}
                onChange={(e) => onChange(index, { value: e.target.checked })}
              />
              <Typography fontSize="0.72rem" fontWeight={600}>
                Checked
              </Typography>
            </Stack>
          ) : field.type === "select" ? (
            <TextField
              select
              fullWidth
              size="small"
              label="Value"
              value={field.value ?? ""}
              onChange={(e) => onChange(index, { value: e.target.value })}
            >
              <MenuItem value="">Select value</MenuItem>
              {(field.options || []).map((option, optionIndex) => (
                <MenuItem key={`${option}-${optionIndex}`} value={option}>
                  {option}
                </MenuItem>
              ))}
            </TextField>
          ) : (
            <TextField
              fullWidth
              size="small"
              type={
                field.type === "number"
                  ? "number"
                  : field.type === "date"
                    ? "date"
                    : "text"
              }
              multiline={field.type === "textarea"}
              minRows={field.type === "textarea" ? 2 : undefined}
              label="Value"
              value={field.value ?? ""}
              onChange={(e) =>
                onChange(index, {
                  value:
                    field.type === "number"
                      ? e.target.value === ""
                        ? ""
                        : Number(e.target.value)
                      : e.target.value,
                })
              }
              InputLabelProps={
                field.type === "date" ? { shrink: true } : undefined
              }
            />
          )}
        </Grid>

        <Grid item xs="auto">
          <Tooltip title="Remove field">
            <IconButton
              size="small"
              disabled={readOnly}
              onClick={() => onRemove(index)}
              sx={{ color: "error.main", mt: 0.3 }}
            >
              <RemoveCircleOutline fontSize="small" />
            </IconButton>
          </Tooltip>
        </Grid>

        {field.type === "select" && (
          <Grid item xs={12} md={9}>
            <TextField
              fullWidth
              size="small"
              label="Select options"
              placeholder="Good, Average, Poor"
              value={(field.options || []).join(", ")}
              disabled={readOnly}
              onChange={(e) => {
                const options = e.target.value
                  .split(",")
                  .map((option) => option.trim())
                  .filter(Boolean);

                onChange(index, {
                  options,
                  value: options.includes(field.value) ? field.value : "",
                });
              }}
              helperText="Separate options with commas."
            />
          </Grid>
        )}

        <Grid item xs={12}>
          <Stack direction="row" alignItems="center" spacing={0.5}>
            <Checkbox
              size="small"
              checked={!!field.required}
              disabled={readOnly}
              onChange={(e) => onChange(index, { required: e.target.checked })}
            />
            <Typography fontSize="0.7rem" fontWeight={600}>
              Required field
            </Typography>
          </Stack>
        </Grid>
      </Grid>
    </Box>
  );
}

export default function AllReportsPage() {
  return (
    <ProtectedRoute roles={["admin", "superadmin"]}>
      <AllReportsInner />
    </ProtectedRoute>
  );
}
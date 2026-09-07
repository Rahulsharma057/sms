const DynamicReport = require("../models/DynamicReport");
const DynamicReportEntry = require("../models/DynamicReportEntry");
const User = require("../models/User");
const { createNotification } = require("../services/notificationService"); // adjust path to your actual notification service file
const PDFDocument = require("pdfkit"); // npm install pdfkit

const VALID_FIELD_TYPES = [
  "text",
  "textarea",
  "number",
  "date",
  "select",
  "multiselect",
  "checkbox",
  "checkbox_remark",
  "rating",
];

const OPTIONS_FIELD_TYPES = ["select", "multiselect"];

const getTodayIST = () => {
  const now = new Date();
  return new Date(now.getTime() + 5.5 * 60 * 60 * 1000).toISOString().slice(0, 10);
};

const isAdmin = (req) =>
  ["admin", "superadmin"].includes(String(req.user?.role || "").toLowerCase());

const requireAdmin = (req, res) => {
  if (!isAdmin(req)) {
    res.status(403).json({ message: "Admin access required" });
    return false;
  }
  return true;
};

const slugKey = (value, fallback) =>
  String(value || fallback)
    .trim()
    .replace(/[^a-zA-Z0-9_-]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .toLowerCase() || fallback;

const cleanFields = (fields) => {
  if (!Array.isArray(fields)) return [];
  const keys = new Set();

  return fields
    .filter((f) => f && f.label && f.label.trim())
    .map((f, index) => {
      const key = slugKey(f.key, `field_${index + 1}`);
      if (keys.has(key)) {
        const error = new Error(`Duplicate field key: ${key}`);
        error.statusCode = 400;
        throw error;
      }
      keys.add(key);

      const fieldType = VALID_FIELD_TYPES.includes(f.fieldType) ? f.fieldType : "text";

      // Options can arrive either as an array (preferred, from the chip UI)
      // or as a comma string (legacy / defensive fallback) — normalize both.
      let options = [];
      if (Array.isArray(f.options)) {
        options = f.options.map((x) => String(x).trim()).filter(Boolean);
      } else if (typeof f.options === "string") {
        options = f.options.split(",").map((x) => x.trim()).filter(Boolean);
      }
      // De-duplicate while preserving order.
      options = [...new Set(options)];

      if (OPTIONS_FIELD_TYPES.includes(fieldType) && options.length === 0) {
        const error = new Error(`"${f.label}" must have at least one option.`);
        error.statusCode = 400;
        throw error;
      }

      const maxRating =
        fieldType === "rating"
          ? Number(f.maxRating) > 0
            ? Math.min(Math.round(Number(f.maxRating)), 10)
            : 5
          : undefined;

      return {
        key,
        label: f.label.trim(),
        fieldType,
        required: !!f.required,
        options: OPTIONS_FIELD_TYPES.includes(fieldType) ? options : [],
        ...(fieldType === "rating" ? { maxRating } : {}),
      };
    });
};

const sanitizeTargeting = ({ targetType, targetUsers }) => {
  const type = targetType === "specific" ? "specific" : "all";
  const users = type === "specific" && Array.isArray(targetUsers) ? targetUsers : [];
  return { targetType: type, targetUsers: users };
};

const sanitizeSchedule = ({ frequency, weekDays, customDates }) => {
  const freq = ["daily", "weekly", "custom"].includes(frequency) ? frequency : "daily";
  const days =
    freq === "weekly" && Array.isArray(weekDays)
      ? weekDays.map(Number).filter((d) => d >= 0 && d <= 6)
      : [];
  const dates =
    freq === "custom" && Array.isArray(customDates)
      ? customDates.filter((d) => /^\d{4}-\d{2}-\d{2}$/.test(d))
      : [];
  return { frequency: freq, weekDays: days, customDates: dates };
};

// Is this report due "today" (or on a given date) at all — used to decide
// whether to show it as "due" in the visible list. Daily reports are always
// due; weekly only on their configured weekdays; custom only on listed dates.
const isDueOn = (report, dateStr) => {
  if (report.frequency === "daily") return true;
  if (report.frequency === "weekly") {
    const day = new Date(`${dateStr}T00:00:00`).getDay();
    return (report.weekDays || []).includes(day);
  }
  if (report.frequency === "custom") {
    return (report.customDates || []).includes(dateStr);
  }
  return false;
};

const resolveAudienceIds = async (report) => {
  if (report.targetType === "all") {
    const users = await User.find({}).select("_id");
    return users.map((u) => String(u._id));
  }
  return (report.targetUsers || []).map((id) => String(id));
};

const notifyAudience = async (report, { title, message }) => {
  const ids = await resolveAudienceIds(report);
  await Promise.all(
    ids.map((recipient) =>
      createNotification({
        recipient,
        type: "NEW_DYNAMIC_REPORT",
        title,
        message,
        dynamicReport: report._id,
      }),
    ),
  );
};

const notifyAdminsOfSubmission = async ({ report, submittedByName }) => {
  const admins = await User.find({ role: { $in: ["admin", "superadmin"] } }).select("_id");
  await Promise.all(
    admins.map((admin) =>
      createNotification({
        recipient: admin._id,
        type: "DYNAMIC_REPORT_SUBMITTED",
        title: `${report.title} submitted`,
        message: `${submittedByName || "A user"} submitted "${report.title}".`,
        dynamicReport: report._id,
      }),
    ),
  );
};

/* =====================================================
   ADMIN: CREATE / UPDATE / DELETE / LIST DEFINITIONS
===================================================== */

const createDynamicReport = async (req, res) => {
  if (!requireAdmin(req, res)) return;
  try {
    const { title, description, fields, targetType, targetUsers, isActive } = req.body;

    if (!title || !title.trim()) {
      return res.status(400).json({ message: "Title is required." });
    }

    const safeFields = cleanFields(fields);
    if (safeFields.length === 0) {
      return res.status(400).json({ message: "Add at least one field." });
    }

    const { targetType: safeType, targetUsers: safeUsers } = sanitizeTargeting({
      targetType,
      targetUsers,
    });
    if (safeType === "specific" && safeUsers.length === 0) {
      return res.status(400).json({ message: "Select at least one user, or choose 'All users'." });
    }

    const schedule = sanitizeSchedule(req.body);

    const report = await DynamicReport.create({
      title: title.trim(),
      description: description || "",
      fields: safeFields,
      ...schedule,
      targetType: safeType,
      targetUsers: safeUsers,
      isActive: isActive === undefined ? true : !!isActive,
      createdBy: req.user._id,
    });

    // Notify the assigned audience right away.
    if (report.isActive) {
      await notifyAudience(report, {
        title: "New report assigned",
        message: `You've been assigned a new report: "${report.title}".`,
      });
    }

    const populated = await report.populate("targetUsers", "name email");
    res.status(201).json(populated);
  } catch (error) {
    console.error("createDynamicReport error:", error);
    res
      .status(error.statusCode || 500)
      .json({ message: error.message || "Failed to create report." });
  }
};

const updateDynamicReport = async (req, res) => {
  if (!requireAdmin(req, res)) return;
  try {
    const report = await DynamicReport.findById(req.params.id);
    if (!report) return res.status(404).json({ message: "Report not found." });

    const { title, description, fields, targetType, targetUsers, isActive } = req.body;

    if (title !== undefined) {
      if (!title.trim()) return res.status(400).json({ message: "Title cannot be empty." });
      report.title = title.trim();
    }
    if (description !== undefined) report.description = description;

    if (fields !== undefined) {
      const safeFields = cleanFields(fields);
      if (safeFields.length === 0) {
        return res.status(400).json({ message: "Add at least one field." });
      }
      report.fields = safeFields;
    }

    const previousAudience = new Set(await resolveAudienceIds(report));

    if (targetType !== undefined || targetUsers !== undefined) {
      const { targetType: safeType, targetUsers: safeUsers } = sanitizeTargeting({
        targetType: targetType !== undefined ? targetType : report.targetType,
        targetUsers: targetUsers !== undefined ? targetUsers : report.targetUsers,
      });
      if (safeType === "specific" && safeUsers.length === 0) {
        return res.status(400).json({ message: "Select at least one user, or choose 'All users'." });
      }
      report.targetType = safeType;
      report.targetUsers = safeUsers;
    }

    if (
      req.body.frequency !== undefined ||
      req.body.weekDays !== undefined ||
      req.body.customDates !== undefined
    ) {
      const schedule = sanitizeSchedule({
        frequency: req.body.frequency !== undefined ? req.body.frequency : report.frequency,
        weekDays: req.body.weekDays !== undefined ? req.body.weekDays : report.weekDays,
        customDates: req.body.customDates !== undefined ? req.body.customDates : report.customDates,
      });
      report.frequency = schedule.frequency;
      report.weekDays = schedule.weekDays;
      report.customDates = schedule.customDates;
    }

    if (isActive !== undefined) report.isActive = !!isActive;

    await report.save();

    // Notify anyone newly added to the audience.
    const newAudience = await resolveAudienceIds(report);
    const newlyAdded = newAudience.filter((id) => !previousAudience.has(id));
    if (report.isActive && newlyAdded.length > 0) {
      await Promise.all(
        newlyAdded.map((recipient) =>
          createNotification({
            recipient,
            type: "NEW_DYNAMIC_REPORT",
            title: "New report assigned",
            message: `You've been assigned a report: "${report.title}".`,
            dynamicReport: report._id,
          }),
        ),
      );
    }

    const populated = await report.populate("targetUsers", "name email");
    res.json(populated);
  } catch (error) {
    console.error("updateDynamicReport error:", error);
    res
      .status(error.statusCode || 500)
      .json({ message: error.message || "Failed to update report." });
  }
};

const deleteDynamicReport = async (req, res) => {
  if (!requireAdmin(req, res)) return;
  const report = await DynamicReport.findById(req.params.id);
  if (!report) return res.status(404).json({ message: "Report not found." });

  await DynamicReportEntry.deleteMany({ report: report._id });
  await report.deleteOne();
  res.json({ message: "Report deleted successfully.", id: req.params.id });
};

const getAllDynamicReports = async (req, res) => {
  if (!requireAdmin(req, res)) return;

  const filter = {};
  if (req.query.search) {
    const regex = new RegExp(req.query.search.trim(), "i");
    filter.$or = [{ title: regex }, { description: regex }];
  }

  const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
  const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 10, 1), 100);
  const skip = (page - 1) * limit;

  const [reports, total] = await Promise.all([
    DynamicReport.find(filter)
      .populate("createdBy", "name email")
      .populate("targetUsers", "name email")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit),
    DynamicReport.countDocuments(filter),
  ]);

  const counts = await DynamicReportEntry.aggregate([
    { $match: { report: { $in: reports.map((r) => r._id) } } },
    { $group: { _id: "$report", count: { $sum: 1 } } },
  ]);
  const countMap = Object.fromEntries(counts.map((c) => [String(c._id), c.count]));

  res.json({
    reports: reports.map((r) => ({ ...r.toObject(), entryCount: countMap[String(r._id)] || 0 })),
    pagination: { page, limit, total, totalPages: Math.max(Math.ceil(total / limit), 1) },
  });
};

const getDynamicReportById = async (req, res) => {
  if (!requireAdmin(req, res)) return;
  const report = await DynamicReport.findById(req.params.id)
    .populate("createdBy", "name email")
    .populate("targetUsers", "name email");
  if (!report) return res.status(404).json({ message: "Report not found." });
  res.json(report);
};

/* =====================================================
   USER: VISIBLE LIST, SUBMIT, MY ENTRIES
===================================================== */

// GET /api/dynamic-reports/visible — for Navbar + fill pages
const getVisibleDynamicReports = async (req, res) => {
  const today = getTodayIST();

  const reports = await DynamicReport.find({
    isActive: true,
    $or: [{ targetType: "all" }, { targetType: "specific", targetUsers: req.user._id }],
  }).select("title description frequency weekDays customDates fields createdAt");

  const reportIds = reports.map((r) => r._id);
  const entriesToday = await DynamicReportEntry.find({
    report: { $in: reportIds },
    submittedBy: req.user._id,
    date: today,
  }).select("report");
  const submittedTodaySet = new Set(entriesToday.map((e) => String(e.report)));

  const result = reports.map((r) => ({
    _id: r._id,
    title: r.title,
    description: r.description,
    frequency: r.frequency,
    dueToday: isDueOn(r, today),
    submittedToday: submittedTodaySet.has(String(r._id)),
  }));

  res.json(result);
};

const getDynamicReportForFilling = async (req, res) => {
  const report = await DynamicReport.findOne({
    _id: req.params.id,
    isActive: true,
    $or: [{ targetType: "all" }, { targetType: "specific", targetUsers: req.user._id }],
  });
  if (!report) return res.status(404).json({ message: "Report not available." });

  const today = getTodayIST();
  const existing = await DynamicReportEntry.findOne({
    report: report._id,
    submittedBy: req.user._id,
    date: today,
  });

  res.json({
    report: {
      _id: report._id,
      title: report.title,
      description: report.description,
      fields: report.fields,
      frequency: report.frequency,
    },
    date: today,
    dueToday: isDueOn(report, today),
    existingEntry: existing || null,
  });
};

const submitDynamicReportEntry = async (req, res) => {
  try {
    const report = await DynamicReport.findOne({
      _id: req.params.id,
      isActive: true,
      $or: [{ targetType: "all" }, { targetType: "specific", targetUsers: req.user._id }],
    });
    if (!report) return res.status(404).json({ message: "Report not available." });

    const { answers } = req.body;
    if (!Array.isArray(answers)) {
      return res.status(400).json({ message: "Invalid submission." });
    }

    const answerMap = new Map(answers.map((a) => [String(a.fieldKey), a.value]));
    const cleanAnswers = [];

    for (const field of report.fields) {
      const raw = answerMap.get(field.key);

      // Checkbox + Remark: value is stored as { checked, remark }
      if (field.fieldType === "checkbox_remark") {
        const obj = raw && typeof raw === "object" ? raw : {};
        const checked = Boolean(obj.checked);
        const remark = String(obj.remark || "").trim();
        if (field.required && !checked) {
          return res.status(400).json({ message: `"${field.label}" must be checked.` });
        }
        cleanAnswers.push({ fieldKey: field.key, label: field.label, value: { checked, remark } });
        continue;
      }

      // Rating: numeric value between 0 and field.maxRating
      if (field.fieldType === "rating") {
        const max = field.maxRating || 5;
        const isEmpty = raw === undefined || raw === null || raw === "";
        if (field.required && isEmpty) {
          return res.status(400).json({ message: `"${field.label}" is required.` });
        }
        const num = isEmpty ? null : Number(raw);
        if (!isEmpty && (isNaN(num) || num < 0 || num > max)) {
          return res.status(400).json({ message: `"${field.label}" must be between 0 and ${max}.` });
        }
        cleanAnswers.push({ fieldKey: field.key, label: field.label, value: num });
        continue;
      }

      // Multi-select: value is an array of chosen options, each must be a valid option.
      if (field.fieldType === "multiselect") {
        const arr = Array.isArray(raw) ? raw.filter((v) => (field.options || []).includes(v)) : [];
        if (field.required && arr.length === 0) {
          return res.status(400).json({ message: `"${field.label}" is required.` });
        }
        cleanAnswers.push({ fieldKey: field.key, label: field.label, value: arr });
        continue;
      }

      // Select: value must be one of the configured options.
      if (field.fieldType === "select") {
        const isEmpty = raw === undefined || raw === null || raw === "";
        if (field.required && isEmpty) {
          return res.status(400).json({ message: `"${field.label}" is required.` });
        }
        if (!isEmpty && !(field.options || []).includes(raw)) {
          return res.status(400).json({ message: `"${field.label}" has an invalid option.` });
        }
        cleanAnswers.push({ fieldKey: field.key, label: field.label, value: isEmpty ? "" : raw });
        continue;
      }

      if (field.required && (raw === undefined || raw === null || String(raw).trim() === "")) {
        return res.status(400).json({ message: `"${field.label}" is required.` });
      }
      if (field.fieldType === "number" && raw !== undefined && raw !== "" && isNaN(Number(raw))) {
        return res.status(400).json({ message: `"${field.label}" must be a number.` });
      }

      cleanAnswers.push({
        fieldKey: field.key,
        label: field.label,
        value: field.fieldType === "number" && raw !== "" && raw !== undefined ? Number(raw) : raw ?? "",
      });
    }

    const today = getTodayIST();

    const entry = await DynamicReportEntry.findOneAndUpdate(
      { report: report._id, submittedBy: req.user._id, date: today },
      { $set: { answers: cleanAnswers } },
      { new: true, upsert: true, setDefaultsOnInsert: true },
    );

    await notifyAdminsOfSubmission({ report, submittedByName: req.user?.name });

    res.status(201).json({ message: "Report submitted successfully.", entry });
  } catch (error) {
    console.error("submitDynamicReportEntry error:", error);
    res.status(500).json({ message: "Could not submit report." });
  }
};

const getMyDynamicReportEntries = async (req, res) => {
  const entries = await DynamicReportEntry.find({ submittedBy: req.user._id })
    .populate("report", "title frequency fields")
    .sort({ date: -1 });
  res.json({ entries });
};

/* =====================================================
   ADMIN: RESPONSES
===================================================== */

// Builds the Mongo filter shared by both the entries listing and the PDF
// export, given the raw query params:
//   ?date=YYYY-MM-DD                — exact day
//   ?dateFrom=YYYY-MM-DD&dateTo=...  — inclusive range (either end optional)
const buildDateFilter = (query) => {
  if (query.date && /^\d{4}-\d{2}-\d{2}$/.test(query.date)) {
    return { date: query.date };
  }
  const range = {};
  if (query.dateFrom && /^\d{4}-\d{2}-\d{2}$/.test(query.dateFrom)) range.$gte = query.dateFrom;
  if (query.dateTo && /^\d{4}-\d{2}-\d{2}$/.test(query.dateTo)) range.$lte = query.dateTo;
  return Object.keys(range).length > 0 ? { date: range } : {};
};

// Resolves ?search= (submitter name/email) into a { submittedBy: { $in: [...] } }
// clause. Mutates and returns the passed-in filter object for convenience.
const applySearchFilter = async (filter, search) => {
  if (search && String(search).trim()) {
    const regex = new RegExp(String(search).trim(), "i");
    const matchingUsers = await User.find({ $or: [{ name: regex }, { email: regex }] }).select("_id");
    filter.submittedBy = { $in: matchingUsers.map((u) => u._id) };
  }
  return filter;
};

const formatEntryCell = (field, value) => {
  if (value === undefined || value === null || value === "") return "-";
  if (field.fieldType === "checkbox") return value ? "Yes" : "No";
  if (field.fieldType === "checkbox_remark") {
    const obj = typeof value === "object" ? value : {};
    return `${obj.checked ? "Yes" : "No"}${obj.remark ? ` - ${obj.remark}` : ""}`;
  }
  if (field.fieldType === "rating") return `${value} / ${field.maxRating || 5}`;
  if (field.fieldType === "multiselect") return Array.isArray(value) ? value.join(", ") : String(value);
  return String(value);
};

// GET /api/dynamic-reports/:id/entries
// Supports:
//   ?page=1&limit=20                 — pagination
//   ?date=YYYY-MM-DD                 — jump straight to entries from one exact day
//   ?dateFrom=YYYY-MM-DD&dateTo=...  — entries submitted within a date range
//   ?search=some name or email       — filter by the submitter's name/email
const getDynamicReportEntries = async (req, res) => {
  if (!requireAdmin(req, res)) return;

  const report = await DynamicReport.findById(req.params.id).select("title fields");
  if (!report) return res.status(404).json({ message: "Report not found." });

  const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
  const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 20, 1), 200);
  const skip = (page - 1) * limit;

  const filter = { report: report._id, ...buildDateFilter(req.query) };
  await applySearchFilter(filter, req.query.search);

  const [entries, total] = await Promise.all([
    DynamicReportEntry.find(filter)
      .populate("submittedBy", "name email")
      .sort({ date: -1, createdAt: -1 })
      .skip(skip)
      .limit(limit),
    DynamicReportEntry.countDocuments(filter),
  ]);

  res.json({
    report: { _id: report._id, title: report.title, fields: report.fields },
    entries,
    pagination: { page, limit, total, totalPages: Math.max(Math.ceil(total / limit), 1) },
  });
};

// GET /api/dynamic-reports/:id/entries/pdf
// Streams a PDF of the (optionally filtered) entries back as a download.
// Accepts the same ?search / ?date / ?dateFrom / ?dateTo filters as the
// listing endpoint above, plus an optional ?columns=key1,key2 to match
// whichever columns the admin currently has visible in the table.
const MAX_PDF_ROWS = 2000;

const exportDynamicReportEntriesPdf = async (req, res) => {
  if (!requireAdmin(req, res)) return;

  const report = await DynamicReport.findById(req.params.id).select("title fields");
  if (!report) return res.status(404).json({ message: "Report not found." });

  const filter = { report: report._id, ...buildDateFilter(req.query) };
  await applySearchFilter(filter, req.query.search);

  const entries = await DynamicReportEntry.find(filter)
    .populate("submittedBy", "name email")
    .sort({ date: -1, createdAt: -1 })
    .limit(MAX_PDF_ROWS);

  const requestedKeys = req.query.columns
    ? String(req.query.columns).split(",").map((s) => s.trim()).filter(Boolean)
    : null;
  const fields = requestedKeys
    ? report.fields.filter((f) => requestedKeys.includes(f.key))
    : report.fields;

  const filename = `${report.title.replace(/[^a-z0-9]+/gi, "_") || "report"}_entries.pdf`;
  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);

  const doc = new PDFDocument({ size: "A4", layout: "landscape", margin: 30 });
  doc.pipe(res);

  // ---- Header ----
  doc.font("Helvetica-Bold").fontSize(16).fillColor("#1f2937").text(report.title);

  const filterBits = [];
  if (req.query.date) filterBits.push(`Date: ${req.query.date}`);
  if (req.query.dateFrom || req.query.dateTo) {
    filterBits.push(`Range: ${req.query.dateFrom || "…"} to ${req.query.dateTo || "…"}`);
  }
  if (req.query.search) filterBits.push(`Search: "${req.query.search}"`);

  doc
    .font("Helvetica")
    .fontSize(9)
    .fillColor("#6b7280")
    .text(
      `Generated ${new Date().toLocaleString()} — ${entries.length} entr${entries.length === 1 ? "y" : "ies"}` +
        (filterBits.length ? ` — ${filterBits.join(" — ")}` : ""),
    );
  doc.moveDown(1);

  // ---- Table ----
  const pageWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;
  const dateColWidth = 65;
  const submitterColWidth = 130;
  const remaining = Math.max(pageWidth - dateColWidth - submitterColWidth, 100);
  const fieldColWidth = fields.length > 0 ? remaining / fields.length : remaining;

  const columnWidths = [dateColWidth, submitterColWidth, ...fields.map(() => fieldColWidth)];
  const headerLabels = ["Date", "Submitted By", ...fields.map((f) => f.label)];
  const rowHeight = 20;
  let y = doc.y;

  const drawRow = (cells, { bold = false, striped = false } = {}) => {
    let x = doc.page.margins.left;
    if (bold) {
      doc.rect(doc.page.margins.left, y, pageWidth, rowHeight).fill("#391ea4");
    } else if (striped) {
      doc.rect(doc.page.margins.left, y, pageWidth, rowHeight).fill("#f7f5fc");
    }
    doc.font(bold ? "Helvetica-Bold" : "Helvetica").fontSize(8).fillColor(bold ? "#ffffff" : "#111827");
    cells.forEach((cell, i) => {
      doc.text(String(cell ?? ""), x + 4, y + 5, { width: columnWidths[i] - 8, ellipsis: true });
      x += columnWidths[i];
    });
    y += rowHeight;
  };

  drawRow(headerLabels, { bold: true });

  entries.forEach((entry, idx) => {
    if (y + rowHeight > doc.page.height - doc.page.margins.bottom) {
      doc.addPage();
      y = doc.page.margins.top;
      drawRow(headerLabels, { bold: true });
    }
    const amap = {};
    (entry.answers || []).forEach((a) => (amap[a.fieldKey] = a));
    const row = [
      entry.date,
      entry.submittedBy?.name || entry.submittedBy?.email || "-",
      ...fields.map((f) => formatEntryCell(f, amap[f.key]?.value)),
    ];
    drawRow(row, { striped: idx % 2 === 1 });
  });

  doc.end();
};

// NEW: admin deletes a single submitted entry (row) from a dynamic report.
const deleteDynamicReportEntry = async (req, res) => {
  if (!requireAdmin(req, res)) return;

  const entry = await DynamicReportEntry.findOne({
    _id: req.params.entryId,
    report: req.params.id,
  });
  if (!entry) return res.status(404).json({ message: "Entry not found." });

  await entry.deleteOne();
  res.json({ message: "Entry deleted successfully.", id: req.params.entryId });
};

module.exports = {
  createDynamicReport,
  updateDynamicReport,
  deleteDynamicReport,
  getAllDynamicReports,
  getDynamicReportById,
  getVisibleDynamicReports,
  getDynamicReportForFilling,
  submitDynamicReportEntry,
  getMyDynamicReportEntries,
  getDynamicReportEntries,
  exportDynamicReportEntriesPdf,
  deleteDynamicReportEntry,
};
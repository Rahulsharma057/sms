const Report = require("../models/Report");
const ReportTemplate = require("../models/ReportTemplate");

const VALID_CUSTOM_FIELD_TYPES = [
  "text",
  "textarea",
  "number",
  "date",
  "select",
  "checkbox",
];
const BASE_SECTION_KEYS = ["morningChecks", "middayChecks", "afternoonChecks"];

// Defaults are used only for NEW reports. Existing reports always keep their saved snapshot.
const DEFAULT_REPORT_SECTIONS = [
  {
    key: "morningChecks",
    title: "Morning readiness check",
    timing: "0830–0900 hrs",
    items: [
      "Cleanliness of classrooms & workshop floor",
      "Cleanliness of washrooms & toilets",
      "Housekeeping staff attendance & task allocation",
      "Waste disposal & dustbin status",
      "Drinking water points & seating hygiene",
      "Trainee & trainer attendance",
    ],
  },
  {
    key: "middayChecks",
    title: "Mid-day infrastructure & order inspection",
    timing: "1100–1300 hrs",
    items: [
      "Corridor, staircase & common area cleanliness",
      "Tools, machinery & equipment upkeep",
      "Furniture condition & orderly arrangement",
      "Electrical fittings, wiring & fixtures check",
      "Plumbing & water supply functionality",
    ],
  },
  {
    key: "afternoonChecks",
    title: "Afternoon maintenance round",
    timing: "1400–1600 hrs",
    items: [
      "Overall upkeep of premises & campus grounds",
      "Garden/landscaping & external area maintenance",
      "Building repairs/damage requiring attention",
      "Housekeeping consumables stock (soap, phenyl, etc.)",
      "Fire safety & security equipment check",
    ],
  },
].map((section) => ({
  ...section,
  items: section.items.map((label, index) => ({
    key: `${section.key}_item_${index + 1}`,
    label,
    checked: false,
    remark: "",
    status: "open",
    adminRemark: "",
    followed: false,
  })),
}));

const getTodayIST = () => {
  const now = new Date();
  return new Date(now.getTime() + 5.5 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 10);
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

const slug = (value, fallback) =>
  String(value || fallback)
    .trim()
    .replace(/[^a-zA-Z0-9_-]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .toLowerCase() || fallback;

const cleanCheckItems = (items, oldItems = []) => {
  if (!Array.isArray(items)) {
    return [];
  }

  return items.map((item, index) => {
    const source = typeof item === "string" ? { label: item } : item || {};

    const old = oldItems?.[index] || {};

    const status = source?.status === "resolved" ? "resolved" : "open";

    const resolvedBy =
      status === "resolved" ? source?.resolvedBy || old?.resolvedBy : undefined;

    const resolvedAt =
      status === "resolved" ? source?.resolvedAt || old?.resolvedAt : undefined;

    return {
      key: slug(source?.key, old?.key || `item_${index + 1}`),

      label: String(source?.label || "").trim(),

      checked: Boolean(source?.checked),

      remark: String(source?.remark || ""),

      status,

      adminRemark: String(source?.adminRemark || ""),

      followed: Boolean(source?.followed),

      ...(resolvedBy ? { resolvedBy } : {}),

      ...(resolvedAt ? { resolvedAt } : {}),
    };
  });
};

const cleanSections = (sections, existing = []) => {
  if (!Array.isArray(sections)) return [];

  const keys = new Set();
  return sections.map((section, sectionIndex) => {
    const key = slug(section?.key, `section_${sectionIndex + 1}`);
    const title = String(
      section?.title || `Section ${sectionIndex + 1}`,
    ).trim();

    if (keys.has(key)) {
      const error = new Error(`Duplicate section key: ${key}`);
      error.statusCode = 400;
      throw error;
    }
    keys.add(key);

    const old = existing.find((x) => x.key === key) || {};
    const items = cleanCheckItems(section?.items, old.items || []);

    if (items.some((item) => !item.label)) {
      const error = new Error(
        `Every checklist item in "${title}" needs a label.`,
      );
      error.statusCode = 400;
      throw error;
    }

    return {
      key,
      title,
      timing: String(section?.timing || "").trim(),
      items,
    };
  });
};

const cleanCustomFields = (fields) => {
  if (!Array.isArray(fields)) return [];
  const keys = new Set();

  return fields.map((field, index) => {
    const key = slug(field?.key, `custom_field_${index + 1}`);
    const label = String(field?.label || "").trim();
    const type = VALID_CUSTOM_FIELD_TYPES.includes(field?.type)
      ? field.type
      : "text";
    const options = Array.isArray(field?.options)
      ? field.options.map((x) => String(x).trim()).filter(Boolean)
      : [];

    if (!label) {
      const error = new Error("Every additional field needs a label.");
      error.statusCode = 400;
      throw error;
    }
    if (keys.has(key)) {
      const error = new Error(`Duplicate custom field key: ${key}`);
      error.statusCode = 400;
      throw error;
    }
    if (type === "select" && options.length === 0) {
      const error = new Error(
        `Select field "${label}" must have at least one option.`,
      );
      error.statusCode = 400;
      throw error;
    }
    keys.add(key);

    return {
      key,
      label,
      type,
      value: field?.value ?? (type === "checkbox" ? false : ""),
      options: type === "select" ? options : [],
      required: !!field?.required,
    };
  });
};

const legacyToSections = (report) => {
  const meta = report?.sectionMeta || {};
  const defaults = Object.fromEntries(
    DEFAULT_REPORT_SECTIONS.map((s) => [s.key, s]),
  );

  const base = BASE_SECTION_KEYS.map((key) => ({
    key,
    title: meta?.[key]?.title || defaults[key]?.title || key,
    timing: meta?.[key]?.timing || defaults[key]?.timing || "",
    items: cleanCheckItems(report?.[key] || []),
  }));

  const custom = Array.isArray(report?.customSections)
    ? report.customSections.map((s, index) => ({
        key: slug(s?.key, `custom_section_${index + 1}`),
        title: String(s?.title || `Additional Section ${index + 1}`),
        timing: String(s?.timing || ""),
        items: cleanCheckItems(s?.items || []),
      }))
    : [];

  return [...base, ...custom];
};
const getSavedSections = (report) => {
  if (Array.isArray(report?.sections) && report.sections.length > 0) {
    return report.sections.map((section, sectionIndex) => ({
      key: section?.key || `section_${sectionIndex + 1}`,

      title: section?.title || `Section ${sectionIndex + 1}`,

      timing: section?.timing || "",

      items: cleanCheckItems(
        Array.isArray(section?.items) ? section.items : [],
      ),
    }));
  }

  return legacyToSections(report);
};
const syncLegacyFields = (report, sections) => {
  const base = Object.fromEntries(sections.map((s) => [s.key, s]));
  report.morningChecks = cleanCheckItems(base.morningChecks?.items || []);
  report.middayChecks = cleanCheckItems(base.middayChecks?.items || []);
  report.afternoonChecks = cleanCheckItems(base.afternoonChecks?.items || []);

  report.sectionMeta = {
    morningChecks: {
      title: base.morningChecks?.title || "",
      timing: base.morningChecks?.timing || "",
    },
    middayChecks: {
      title: base.middayChecks?.title || "",
      timing: base.middayChecks?.timing || "",
    },
    afternoonChecks: {
      title: base.afternoonChecks?.title || "",
      timing: base.afternoonChecks?.timing || "",
    },
  };

  report.customSections = sections
    .filter((s) => !BASE_SECTION_KEYS.includes(s.key))
    .map((s) => ({ ...s }));
};

const prepareReport = (report) => {
  const obj = report?.toObject ? report.toObject() : { ...report };
  if (!Array.isArray(obj.sections) || obj.sections.length === 0) {
    obj.sections = legacyToSections(obj);
  }
  return obj;
};

const createReport = async (req, res) => {
  try {
    const {
      date,
      dutyOfficerName,
      centreBatch,
      shiftTiming,
      sections,
      morningChecks,
      middayChecks,
      afternoonChecks,
      positiveObservations,
      hygieneLapses,
      maintenanceFollowUp,
      urgentMatters,
      signature,
      countersignedBy,
      customFields,
    } = req.body;

    if (!date || !dutyOfficerName) {
      return res
        .status(400)
        .json({ message: "Date and Duty Officer name are required" });
    }

    const existing = await Report.findOne({ teacher: req.user._id, date });
    if (existing) {
      return res.status(409).json({
        message: "You have already submitted a report for this date.",
        report: prepareReport(existing),
      });
    }

    let finalSections;
    let finalCustomFields = customFields || [];
    if (Array.isArray(sections) && sections.length) {
      finalSections = cleanSections(sections);
    } else {
      const template = await ReportTemplate.findOne({
        name: "Daily Report",
      }).lean();
      finalSections = template?.sections?.length
        ? template.sections.map((section) => ({
            key: section.key,
            title: section.title,
            timing: section.timing || "",
            items: section.items.map((item) => ({
              key: item.key,
              label: item.label,
              checked: false,
              remark: "",
              status: "open",
              adminRemark: "",
              followed: false,
            })),
          }))
        : legacyToSections({
            morningChecks,
            middayChecks,
            afternoonChecks,
            sectionMeta: {},
            customSections: [],
          });
      if (!Array.isArray(finalCustomFields) || !finalCustomFields.length)
        finalCustomFields = template?.customFields || [];
    }

    const report = new Report({
      teacher: req.user._id,
      date,
      dutyOfficerName: String(dutyOfficerName).trim(),
      centreBatch: String(centreBatch || "").trim(),
      shiftTiming: String(shiftTiming || "").trim(),
      sections: finalSections,
      positiveObservations: String(positiveObservations || ""),
      hygieneLapses: String(hygieneLapses || ""),
      maintenanceFollowUp: String(maintenanceFollowUp || ""),
      urgentMatters: String(urgentMatters || ""),
      signature: String(signature || ""),
      countersignedBy: String(countersignedBy || ""),
      customFields: cleanCustomFields(finalCustomFields || []),
    });

    syncLegacyFields(report, finalSections);
    await report.save();

    res.status(201).json(prepareReport(report));
  } catch (error) {
    if (error?.code === 11000)
      return res.status(409).json({
        message: "A report for this date has already been submitted.",
      });
    res
      .status(error.statusCode || 500)
      .json({ message: error.message || "Failed to create report" });
  }
};

const cleanTemplate = (payload) => {
  const sections = cleanSections(payload?.sections || []);
  const customFields = cleanCustomFields(
    (payload?.customFields || []).map((field) => ({
      ...field,
      value: undefined,
    })),
  ).map(({ key, label, type, options, required }) => ({
    key,
    label,
    type,
    options,
    required,
  }));
  if (!sections.length) {
    const error = new Error("At least one report section is required.");
    error.statusCode = 400;
    throw error;
  }
  return { sections, customFields };
};

const getReportTemplate = async (req, res) => {
  try {
    const template = await ReportTemplate.findOne({
      name: "Daily Report",
    }).lean();
    return res.json(
      template
        ? {
            sections: template.sections || [],
            customFields: template.customFields || [],
            updatedAt: template.updatedAt,
          }
        : { sections: DEFAULT_REPORT_SECTIONS, customFields: [] },
    );
  } catch (error) {
    return res.status(500).json({ message: "Failed to load report format" });
  }
};

const updateReportTemplate = async (req, res) => {
  if (!requireAdmin(req, res)) return;
  try {
    const cleaned = cleanTemplate(req.body || {});
    const template = await ReportTemplate.findOneAndUpdate(
      { name: "Daily Report" },
      {
        $set: {
          name: "Daily Report",
          sections: cleaned.sections.map((section) => ({
            key: section.key,
            title: section.title,
            timing: section.timing,
            items: section.items.map((item) => ({
              key: item.key,
              label: item.label,
            })),
          })),
          customFields: cleaned.customFields,
        },
      },
      { new: true, upsert: true, setDefaultsOnInsert: true },
    ).lean();
    return res.json({
      message:
        "Daily report format updated successfully. Existing submitted reports were not changed.",
      template,
    });
  } catch (error) {
    console.error("updateReportTemplate error:", error);
    return res
      .status(error.statusCode || 500)
      .json({ message: error.message || "Failed to update report format" });
  }
};

const getTodayReport = async (req, res) => {
  const report = await Report.findOne({
    teacher: req.user._id,
    date: getTodayIST(),
  });
  res.json(report ? prepareReport(report) : null);
};

const getMyReports = async (req, res) => {
  const filter = { teacher: req.user._id };
  if (req.query.from || req.query.to) {
    filter.date = {};
    if (req.query.from) filter.date.$gte = req.query.from;
    if (req.query.to) filter.date.$lte = req.query.to;
  }

  const reports = await Report.find(filter).sort({ date: -1, createdAt: -1 });
  res.json({ reports: reports.map(prepareReport) });
};

const getAllReports = async (req, res) => {
  if (!requireAdmin(req, res)) return;

  const filter = {};
  if (req.query.teacher) filter.teacher = req.query.teacher;
  if (req.query.from || req.query.to) {
    filter.date = {};
    if (req.query.from) filter.date.$gte = req.query.from;
    if (req.query.to) filter.date.$lte = req.query.to;
  }

  const NOT_URGENT_REGEX = /^\s*(none)?\s*$/i;
  if (req.query.urgent === "true")
    filter.urgentMatters = { $exists: true, $not: NOT_URGENT_REGEX };
  if (req.query.urgent === "false") {
    filter.$or = [
      { urgentMatters: { $exists: false } },
      { urgentMatters: { $regex: NOT_URGENT_REGEX } },
    ];
  }

  const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
  const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 20, 1), 100);
  const skip = (page - 1) * limit;

  const [reports, total] = await Promise.all([
    Report.find(filter)
      .populate("teacher", "name email centre")
      .sort({ date: -1, createdAt: -1 })
      .skip(skip)
      .limit(limit),
    Report.countDocuments(filter),
  ]);

  res.json({
    reports: reports.map(prepareReport),
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.max(Math.ceil(total / limit), 1),
    },
  });
};

const getReportById = async (req, res) => {
  const report = await Report.findById(req.params.id).populate(
    "teacher",
    "name email centre",
  );
  if (!report) return res.status(404).json({ message: "Report not found" });

  if (!isAdmin(req) && String(report.teacher._id) !== String(req.user._id)) {
    return res
      .status(403)
      .json({ message: "Not authorized to view this report" });
  }
  res.json(prepareReport(report));
};

const updateReport = async (req, res) => {
  if (!requireAdmin(req, res)) return;

  try {
    const report = await Report.findById(req.params.id);
    if (!report) return res.status(404).json({ message: "Report not found" });

    const {
      date,
      teacher,
      dutyOfficerName,
      shiftTiming,
      centreBatch,
      sections,
      morningChecks,
      middayChecks,
      afternoonChecks,
      sectionMeta,
      customSections,
      customFields,
      positiveObservations,
      hygieneLapses,
      maintenanceFollowUp,
      urgentMatters,
      signature,
      countersignedBy,
    } = req.body;

    if (!date || !dutyOfficerName || !teacher) {
      return res
        .status(400)
        .json({ message: "Date, teacher and duty officer are required" });
    }

    const duplicate = await Report.findOne({
      _id: { $ne: report._id },
      teacher,
      date,
    }).select("_id");
    if (duplicate)
      return res
        .status(409)
        .json({ message: "This teacher already has a report for this date." });

    let finalSections;
    if (Array.isArray(sections)) {
      finalSections = cleanSections(sections, getSavedSections(report));
    } else {
      // Backward-compatible payload from old frontend.
      const old = {
        ...report.toObject(),
        sectionMeta,
        customSections,
        morningChecks,
        middayChecks,
        afternoonChecks,
      };
      finalSections = legacyToSections(old);
    }

    report.teacher = teacher;
    report.date = String(date);
    report.dutyOfficerName = String(dutyOfficerName).trim();
    report.shiftTiming = String(shiftTiming || "").trim();
    report.centreBatch = String(centreBatch || "").trim();
    report.sections = finalSections;
    report.customFields =
      customFields !== undefined
        ? cleanCustomFields(customFields)
        : report.customFields || [];
    report.positiveObservations = String(positiveObservations || "");
    report.hygieneLapses = String(hygieneLapses || "");
    report.maintenanceFollowUp = String(maintenanceFollowUp || "");
    report.urgentMatters = String(urgentMatters || "");
    report.signature = String(signature || "");
    report.countersignedBy = String(countersignedBy || "");

    // Keep old fields synchronized so historical consumers do not break.
    syncLegacyFields(report, finalSections);
    await report.save();

    const populated = await Report.findById(report._id).populate(
      "teacher",
      "name email centre",
    );
    res.json({
      message: "Report updated successfully",
      report: prepareReport(populated),
    });
  } catch (error) {
    console.error("updateReport error:", error);
    res
      .status(error.statusCode || 500)
      .json({ message: error.message || "Failed to update report" });
  }
};
const updateCheckStatus = async (req, res) => {
  if (!requireAdmin(req, res)) return;

  try {
    const report = await Report.findById(req.params.id);

    if (!report) {
      return res.status(404).json({
        message: "Report not found",
      });
    }

    /*
    |--------------------------------------------------------------------------
    | Support BOTH old and new frontend payloads
    |--------------------------------------------------------------------------
    |
    | New frontend:
    | {
    |   section: "morningChecks",
    |   index: 0
    | }
    |
    | Old backend:
    | {
    |   sectionKey: "morningChecks",
    |   itemIndex: 0
    | }
    |
    */

    const sectionKey = req.body?.sectionKey ?? req.body?.section ?? "";

    const itemIndexRaw = req.body?.itemIndex ?? req.body?.index;

    const itemIndex = Number(itemIndexRaw);

    const { status, adminRemark, followed } = req.body || {};

    if (!sectionKey) {
      return res.status(400).json({
        message: "Section is required",
      });
    }

    if (!Number.isInteger(itemIndex) || itemIndex < 0) {
      return res.status(400).json({
        message: "Valid checklist item index is required",
      });
    }

    const sections = getSavedSections(report);

    const section = sections.find((s) => String(s?.key) === String(sectionKey));

    if (!section) {
      return res.status(404).json({
        message: "Checklist section not found",
      });
    }

    if (!Array.isArray(section.items) || !section.items[itemIndex]) {
      return res.status(404).json({
        message: "Checklist item not found",
      });
    }

    const item = section.items[itemIndex];

    /*
    |--------------------------------------------------------------------------
    | STATUS
    |--------------------------------------------------------------------------
    */

    if (status !== undefined) {
      const nextStatus = status === "resolved" ? "resolved" : "open";

      item.status = nextStatus;

      if (nextStatus === "resolved") {
        item.resolvedBy = req.user?._id;
        item.resolvedAt = new Date();
      } else {
        item.resolvedBy = undefined;
        item.resolvedAt = undefined;
      }
    }

    /*
    |--------------------------------------------------------------------------
    | ADMIN REMARK
    |--------------------------------------------------------------------------
    */

    if (adminRemark !== undefined) {
      item.adminRemark = String(adminRemark ?? "");
    }

    /*
    |--------------------------------------------------------------------------
    | FOLLOW
    |--------------------------------------------------------------------------
    */

    if (followed !== undefined) {
      item.followed = Boolean(followed);
    }

    /*
    |--------------------------------------------------------------------------
    | SAVE
    |--------------------------------------------------------------------------
    */

    report.sections = sections;

    syncLegacyFields(report, sections);

    await report.save();

    /*
    |--------------------------------------------------------------------------
    | RETURN UPDATED REPORT
    |--------------------------------------------------------------------------
    */

    const updatedReport = await Report.findById(report._id).populate(
      "teacher",
      "name email centre",
    );

    return res.json({
      message: "Checklist item updated successfully",
      report: prepareReport(updatedReport),
    });
  } catch (error) {
    console.error("updateCheckStatus error:", error);

    return res.status(error.statusCode || 500).json({
      message: error.message || "Failed to update checklist item",
    });
  }
};
const isIssueItem = (item) => {
  if (!item || typeof item !== "object") {
    return false;
  }

  const remark =
    typeof item.remark === "string"
      ? item.remark.trim()
      : "";

  return Boolean(remark);
};
const getIssuesSummary = async (req, res) => {
  if (!requireAdmin(req, res)) return;

  try {
    const reports = await Report.find({})
      .populate("teacher", "name email centre")
      .lean();

    const groups = {};

    reports.forEach((report) => {
      const sections = getSavedSections(report);

      if (!Array.isArray(sections)) {
        return;
      }

      sections.forEach((section) => {
        if (!Array.isArray(section?.items)) {
          return;
        }

        section.items.forEach((item) => {
          if (!isIssueItem(item)) {
            return;
          }

          const label = String(item?.label || "Unknown problem").trim();

          const groupKey = label.toLowerCase();

          if (!groups[groupKey]) {
            groups[groupKey] = {
              label,
              totalCount: 0,
              openCount: 0,
              resolvedCount: 0,
              followedCount: 0,
              teacherIds: new Set(),
            };
          }

          groups[groupKey].totalCount += 1;

          if (item?.status === "resolved") {
            groups[groupKey].resolvedCount += 1;
          } else {
            groups[groupKey].openCount += 1;
          }

          if (item?.followed) {
            groups[groupKey].followedCount += 1;
          }

          if (report?.teacher?._id) {
            groups[groupKey].teacherIds.add(String(report.teacher._id));
          }
        });
      });
    });

    const data = Object.values(groups)
      .map((group) => ({
        label: group.label,
        totalCount: Number(group.totalCount) || 0,
        openCount: Number(group.openCount) || 0,
        resolvedCount: Number(group.resolvedCount) || 0,
        followedCount: Number(group.followedCount) || 0,
        teacherCount: group.teacherIds.size,
      }))
      .sort((a, b) => b.openCount - a.openCount);

    /*
    |--------------------------------------------------------------------------
    | IMPORTANT
    |--------------------------------------------------------------------------
    | Frontend directly expects:
    |
    | summary = [...]
    |
    | So return the array directly.
    */

    return res.json(data);
  } catch (error) {
    console.error("getIssuesSummary error:", error);

    return res.status(500).json({
      message: "Failed to load issue summary",
    });
  }
};
const getIssuesList = async (req, res) => {
  if (!requireAdmin(req, res)) return;

  try {
    const reports = await Report.find({})
      .populate("teacher", "name email centre")
      .sort({
        date: -1,
        createdAt: -1,
      })
      .lean();

    const issues = [];

    reports.forEach((report) => {
      const sections = getSavedSections(report);

      if (!Array.isArray(sections)) {
        return;
      }

      sections.forEach((section) => {
        if (!Array.isArray(section?.items)) {
          return;
        }

        section.items.forEach((item, itemIndex) => {
          if (!isIssueItem(item)) {
            return;
          }

          /*
            |--------------------------------------------------------------------------
            | FLATTEN ITEM
            |--------------------------------------------------------------------------
            | Frontend directly expects:
            |
            | issue.label
            | issue.remark
            | issue.checked
            | issue.status
            | issue.followed
            |
            */

          issues.push({
            reportId: report._id,

            date: report.date,

            teacher: report.teacher || null,

            /*
              | New frontend names
              */
            section: section.key,
            index: itemIndex,

            label: item?.label || "",

            checked: Boolean(item?.checked),

            remark: item?.remark || "",

            status: item?.status === "resolved" ? "resolved" : "open",

            adminRemark: item?.adminRemark || "",

            followed: Boolean(item?.followed),

            resolvedBy: item?.resolvedBy || null,

            resolvedAt: item?.resolvedAt || null,

            sectionTitle: section?.title || "",

            /*
              |--------------------------------------------------------------------------
              | BACKWARD COMPATIBILITY
              |--------------------------------------------------------------------------
              */

            sectionKey: section.key,

            itemIndex,

            item: {
              key: item?.key || "",

              label: item?.label || "",

              checked: Boolean(item?.checked),

              remark: item?.remark || "",

              status: item?.status === "resolved" ? "resolved" : "open",

              adminRemark: item?.adminRemark || "",

              followed: Boolean(item?.followed),

              resolvedBy: item?.resolvedBy || null,

              resolvedAt: item?.resolvedAt || null,
            },
          });
        });
      });
    });

    /*
    |--------------------------------------------------------------------------
    | FRONTEND EXPECTS ARRAY
    |--------------------------------------------------------------------------
    */

    return res.json(issues);
  } catch (error) {
    console.error("getIssuesList error:", error);

    return res.status(500).json({
      message: "Failed to load issues",
    });
  }
};

const deleteReport = async (req, res) => {
  if (!requireAdmin(req, res)) return;
  const report = await Report.findById(req.params.id);
  if (!report) return res.status(404).json({ message: "Report not found" });
  await report.deleteOne();
  res.json({ message: "Report deleted successfully" });
};

module.exports = {
  createReport,
  getReportTemplate,
  updateReportTemplate,
  getTodayReport,
  getMyReports,
  getAllReports,
  getReportById,
  updateReport,
  updateCheckStatus,
  getIssuesSummary,
  getIssuesList,
  deleteReport,
};

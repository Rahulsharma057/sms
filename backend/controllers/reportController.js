  const Report = require("../models/Report");
  const VALID_SECTIONS = ["morningChecks", "middayChecks", "afternoonChecks"];
  const VALID_STATUSES = ["open", "resolved"];

  const getTodayIST = () => {
    const now = new Date();
    const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;
    const ist = new Date(now.getTime() + IST_OFFSET_MS);
    return ist.toISOString().slice(0, 10);
  };

  // POST /api/reports  (teacher)
  const createReport = async (req, res) => {
    const {
      date, dutyOfficerName, centreBatch,
      morningChecks, middayChecks, afternoonChecks,
      positiveObservations, hygieneLapses, maintenanceFollowUp, urgentMatters,
      signature, countersignedBy,
    } = req.body;

    if (!date || !dutyOfficerName) {
      return res.status(400).json({ message: "Date and Duty Officer name are required" });
    }

    const existing = await Report.findOne({ teacher: req.user._id, date });
    if (existing) {
      return res.status(409).json({
        message: "You have already submitted a report for this date.",
        report: existing,
      });
    }

    const report = await Report.create({
      teacher: req.user._id,
      date, dutyOfficerName, centreBatch,
      morningChecks, middayChecks, afternoonChecks,
      positiveObservations, hygieneLapses, maintenanceFollowUp, urgentMatters,
      signature, countersignedBy,
    });

    res.status(201).json(report);
  };

  // GET /api/reports/today  (teacher — IST date)
  const getTodayReport = async (req, res) => {
    const date = getTodayIST();
    const report = await Report.findOne({ teacher: req.user._id, date });
    res.json(report || null);
  };

  // GET /api/reports/mine  (teacher)
  const getMyReports = async (req, res) => {
    const reports = await Report.find({ teacher: req.user._id }).sort({ createdAt: -1 });
    res.json(reports);
  };
// GET /api/reports  (superadmin)
const getAllReports = async (req, res) => {
  const filter = {};
  if (req.query.teacher) filter.teacher = req.query.teacher;
  if (req.query.from || req.query.to) {
    filter.date = {};
    if (req.query.from) filter.date.$gte = req.query.from;
    if (req.query.to) filter.date.$lte = req.query.to;
  }

  const NOT_URGENT_REGEX = /^\s*(none)?\s*$/i;
  if (req.query.urgent === "true") {
    filter.urgentMatters = { $exists: true, $not: NOT_URGENT_REGEX };
  } else if (req.query.urgent === "false") {
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
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit),
    Report.countDocuments(filter),
  ]);

  res.json({
    reports,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.max(Math.ceil(total / limit), 1),
    },
  });
};

  // GET /api/reports/:id
  const getReportById = async (req, res) => {
    const report = await Report.findById(req.params.id).populate("teacher", "name email centre");
    if (!report) return res.status(404).json({ message: "Report not found" });

    if (req.user.role !== "superadmin" && String(report.teacher._id) !== String(req.user._id)) {
      return res.status(403).json({ message: "Not authorized to view this report" });
    }
    res.json(report);
  };

  /* =====================================================
    ISSUE TRACKER  (superadmin)
    An "issue" = a checklist item that has a teacher remark,
    or was left unchecked — i.e. something that needs attention.
  ===================================================== */

  const isIssueItem = (item) => (item.remark && item.remark.trim()) || item.checked === false;

  // GET /api/reports/issues/summary  (superadmin)
  // Groups issues by their checklist label — "which problem happens most".
  // GET /api/reports/issues/summary  (superadmin)
  const getIssuesSummary = async (req, res) => {
    const reports = await Report.find({}).populate("teacher", "name").select("morningChecks middayChecks afternoonChecks teacher");

    const groups = {}; // key -> { label, totalCount, openCount, resolvedCount, followedCount, teacherIds: Set }

    reports.forEach((report) => {
      VALID_SECTIONS.forEach((section) => {
        (report[section] || []).forEach((item) => {
          if (!isIssueItem(item)) return;

          const key = (item.label || "").trim().toLowerCase();
          if (!groups[key]) {
            groups[key] = {
              label: item.label,
              totalCount: 0,
              openCount: 0,
              resolvedCount: 0,
              followedCount: 0,
              teacherIds: new Set(),
            };
          }
          groups[key].totalCount += 1;
          if (item.status === "resolved") groups[key].resolvedCount += 1;
          else groups[key].openCount += 1;
          if (item.followed) groups[key].followedCount += 1;
          if (report.teacher?._id) groups[key].teacherIds.add(String(report.teacher._id));
        });
      });
    });

    const summary = Object.values(groups)
      .map((g) => ({
        label: g.label,
        totalCount: g.totalCount,
        openCount: g.openCount,
        resolvedCount: g.resolvedCount,
        followedCount: g.followedCount,
        teacherCount: g.teacherIds.size, // 👈 "kitne logo ka same issue hai"
      }))
      .sort((a, b) => b.totalCount - a.totalCount);

    res.json(summary);
  };

  // GET /api/reports/issues  (superadmin)
  // Flattened list of individual issue occurrences, with filters.
  // query: ?label=&status=open|resolved&followed=true&section=
  const getIssuesList = async (req, res) => {
    const { label, status, followed, section } = req.query;

    const reports = await Report.find({}).populate("teacher", "name email").sort({ date: -1 });

    const sectionsToScan = section && VALID_SECTIONS.includes(section) ? [section] : VALID_SECTIONS;
    const results = [];

    reports.forEach((report) => {
      sectionsToScan.forEach((sec) => {
        (report[sec] || []).forEach((item, index) => {
          if (!isIssueItem(item)) return;
          if (label && (item.label || "").trim().toLowerCase() !== label.trim().toLowerCase()) return;
          if (status && item.status !== status) return;
          if (followed === "true" && !item.followed) return;

          results.push({
            reportId: report._id,
            date: report.date,
            teacher: report.teacher
              ? { _id: report.teacher._id, name: report.teacher.name, email: report.teacher.email }
              : null,
            section: sec,
            index,
            label: item.label,
            remark: item.remark,
            checked: item.checked,
            status: item.status,
            adminRemark: item.adminRemark,
            followed: !!item.followed,
            resolvedAt: item.resolvedAt,
          });
        });
      });
    });

    res.json(results);
  };

  // PATCH /api/reports/:id/check-status  (superadmin)
  // body: { section, index, status?, adminRemark?, followed? }
  const updateCheckStatus = async (req, res) => {
    const { section, index, status, adminRemark, followed } = req.body;

    if (!VALID_SECTIONS.includes(section)) {
      return res.status(400).json({ message: "Invalid section." });
    }
    if (status !== undefined && !VALID_STATUSES.includes(status)) {
      return res.status(400).json({ message: "Invalid status." });
    }
    if (typeof index !== "number" || index < 0) {
      return res.status(400).json({ message: "Invalid item index." });
    }

    const report = await Report.findById(req.params.id);
    if (!report) return res.status(404).json({ message: "Report not found" });

    const item = report[section]?.[index];
    if (!item) return res.status(404).json({ message: "Checklist item not found" });

    if (status !== undefined) {
      item.status = status;
      if (status === "resolved") {
        item.resolvedBy = req.user._id;
        item.resolvedAt = new Date();
      } else {
        item.resolvedBy = undefined;
        item.resolvedAt = undefined;
      }
    }
    if (adminRemark !== undefined) item.adminRemark = adminRemark;
    if (followed !== undefined) item.followed = !!followed;

    await report.save();
    res.json(report);
  };


const deleteReport = async (req, res) => {
  const report = await Report.findById(req.params.id);
  if (!report) return res.status(404).json({ message: "Report not found" });

  await report.deleteOne();
  res.json({ message: "Report deleted successfully", id: req.params.id });
};

module.exports = {
  createReport, getTodayReport, getMyReports, getAllReports, getReportById,
  updateCheckStatus, getIssuesSummary, getIssuesList, deleteReport,
};
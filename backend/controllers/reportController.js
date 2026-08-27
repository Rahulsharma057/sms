const Report = require("../models/Report");

// IST-correct "today" — plain new Date().toISOString() gives UTC date,
// which is wrong for ~5.5 hours every night in IST. Shift to IST before slicing.
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

  // one report per teacher per day
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

// GET /api/reports/today  (teacher — check if already submitted today, IST date)
const getTodayReport = async (req, res) => {
  const date = getTodayIST();
  const report = await Report.findOne({ teacher: req.user._id, date });
  res.json(report || null);
};

// GET /api/reports/mine  (teacher - own reports)
const getMyReports = async (req, res) => {
  const reports = await Report.find({ teacher: req.user._id }).sort({ createdAt: -1 });
  res.json(reports);
};

// GET /api/reports  (superadmin - all reports, optional ?teacher=&from=&to=&urgent=)
const getAllReports = async (req, res) => {
  const filter = {};
  if (req.query.teacher) filter.teacher = req.query.teacher;
  if (req.query.from || req.query.to) {
    filter.date = {};
    if (req.query.from) filter.date.$gte = req.query.from;
    if (req.query.to) filter.date.$lte = req.query.to;
  }

  // urgent = "true"  -> only reports where urgentMatters has real content (not empty / "None")
  // urgent = "false" -> only reports where it's empty or "None"
  const NOT_URGENT_REGEX = /^\s*(none)?\s*$/i;
  if (req.query.urgent === "true") {
    filter.urgentMatters = { $exists: true, $not: NOT_URGENT_REGEX };
  } else if (req.query.urgent === "false") {
    filter.$or = [
      { urgentMatters: { $exists: false } },
      { urgentMatters: { $regex: NOT_URGENT_REGEX } },
    ];
  }

  const reports = await Report.find(filter).populate("teacher", "name email centre").sort({ createdAt: -1 });
  res.json(reports);
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

module.exports = { createReport, getTodayReport, getMyReports, getAllReports, getReportById };
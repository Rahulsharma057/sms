const Attendance = require("../models/Attendance");
const Batch = require("../models/Batch");

const computePercentage = (present, registered) =>
  registered > 0 ? Number(((present / registered) * 100).toFixed(2)) : 0;

// GET /api/attendance/status?batch=&date=  (teacher)
const getAttendanceStatus = async (req, res) => {
  const { batch, date } = req.query;
  if (!batch || !date) return res.status(400).json({ message: "batch and date are required" });

  const record = await Attendance.findOne({ batch, date });
  res.json(record || null);
};

// POST /api/attendance  (teacher)
// body: { batch, date, boysPresent, girlsPresent, remarks }
const markAttendance = async (req, res) => {
  const { batch, date, boysPresent, girlsPresent, remarks } = req.body;
  if (!batch || !date) return res.status(400).json({ message: "batch and date are required" });

  const batchDoc = await Batch.findById(batch);
  if (!batchDoc) return res.status(404).json({ message: "Batch not found" });

  const isAssigned = batchDoc.assignedTeachers.some((t) => String(t) === String(req.user._id));
  if (req.user.role !== "superadmin" && !isAssigned) {
    return res.status(403).json({ message: "You are not assigned to this batch" });
  }

  const existing = await Attendance.findOne({ batch, date });
  if (existing) {
    return res.status(409).json({
      message: "Attendance for this batch on this date is already submitted.",
      attendance: existing,
    });
  }

  const attendance = await Attendance.create({
    batch, date,
    boysPresent: Number(boysPresent) || 0,
    girlsPresent: Number(girlsPresent) || 0,
    remarks: remarks || "",
    markedBy: req.user._id,
  });
  res.status(201).json(attendance);
};

// PUT /api/attendance/:id  (edit same-day record)
const updateAttendance = async (req, res) => {
  const { boysPresent, girlsPresent, remarks } = req.body;
  const attendance = await Attendance.findById(req.params.id);
  if (!attendance) return res.status(404).json({ message: "Attendance record not found" });

  if (req.user.role !== "superadmin" && String(attendance.markedBy) !== String(req.user._id)) {
    return res.status(403).json({ message: "Not authorized to edit this record" });
  }

  if (boysPresent !== undefined) attendance.boysPresent = Number(boysPresent) || 0;
  if (girlsPresent !== undefined) attendance.girlsPresent = Number(girlsPresent) || 0;
  if (remarks !== undefined) attendance.remarks = remarks;

  await attendance.save();
  res.json(attendance);
};

// GET /api/attendance  (superadmin — filters: batch, course, teacher, from, to)
const getAllAttendance = async (req, res) => {
  const { batch, course, teacher, from, to } = req.query;
  const filter = {};
  if (batch) filter.batch = batch;
  if (teacher) filter.markedBy = teacher;
  if (from || to) {
    filter.date = {};
    if (from) filter.date.$gte = from;
    if (to) filter.date.$lte = to;
  }

  let results = await Attendance.find(filter)
    .populate({ path: "batch", select: "course batchName sanctionedSeats registeredCount", populate: { path: "course", select: "name" } })
    .populate("markedBy", "name email")
    .sort({ date: -1 });

  if (course) results = results.filter((r) => String(r.batch?.course?._id) === course);

  const withPercentage = results.map((r) => {
    const totalPresent = r.boysPresent + r.girlsPresent;
    return {
      ...r.toObject(),
      totalPresent,
      percentage: computePercentage(totalPresent, r.batch?.registeredCount),
    };
  });

  res.json(withPercentage);
};

// GET /api/attendance/mine  (teacher — own history)
const getMyAttendanceHistory = async (req, res) => {
  const records = await Attendance.find({ markedBy: req.user._id })
    .populate({ path: "batch", select: "course batchName registeredCount", populate: { path: "course", select: "name" } })
    .sort({ date: -1 })
    .limit(60);
  res.json(records);
};

// GET /api/attendance/daily-sheet?date=YYYY-MM-DD  (superadmin)
// Full register-style sheet — EVERY batch listed, whether marked or not.
// This mirrors the uploaded report's structure (Faculty/Course/Batch/
// Sanctioned/Registered/Male/Female/% /Remarks).
const getDailySheet = async (req, res) => {
  const { date } = req.query;
  if (!date) return res.status(400).json({ message: "date is required" });

  const batches = await Batch.find({ active: true })
    .populate("course", "name")
    .populate("assignedTeachers", "name")
    .sort({ "course.name": 1, batchName: 1 });

  const attendanceForDate = await Attendance.find({ date });
  const byBatch = {};
  attendanceForDate.forEach((a) => { byBatch[String(a.batch)] = a; });

  const sheet = batches.map((b) => {
    const a = byBatch[String(b._id)];
    const boysPresent = a?.boysPresent ?? null;
    const girlsPresent = a?.girlsPresent ?? null;
    const totalPresent = a ? a.boysPresent + a.girlsPresent : null;
    return {
      faculty: b.assignedTeachers?.map((t) => t.name).join(", ") || "-",
      course: b.course?.name || "-",
      batch: b.batchName,
      sanctioned: b.sanctionedSeats,
      registered: b.registeredCount,
      admission: b.admissionCount || 0,
      dropoutCompletion: b.dropoutCompletionCount || 0,
      maleRegistered: b.maleRegistered || 0,
      femaleRegistered: b.femaleRegistered || 0,
      boysPresent,
      girlsPresent,
      totalPresent,
      percentage: totalPresent !== null ? computePercentage(totalPresent, b.registeredCount) : null,
      remarks: a?.remarks || "",
      marked: !!a,
    };
  });

  // Submitted batches pehle, phir jo abhi tak mark nahi hui
  sheet.sort((a, b) => (a.marked === b.marked ? 0 : a.marked ? -1 : 1));
  sheet.forEach((row, i) => { row.sNo = i + 1; });

  // ---- TOTALS ROW (admin ke liye niche summary) ----
  const totals = sheet.reduce(
    (acc, r) => {
      acc.sanctioned += r.sanctioned || 0;
      acc.registered += r.registered || 0;
      acc.admission += r.admission || 0;
      acc.dropoutCompletion += r.dropoutCompletion || 0;
      acc.maleRegistered += r.maleRegistered || 0;
      acc.femaleRegistered += r.femaleRegistered || 0;
      acc.boysPresent += r.boysPresent || 0;
      acc.girlsPresent += r.girlsPresent || 0;
      acc.totalPresent += r.totalPresent || 0;
      acc.batchesMarked += r.marked ? 1 : 0;
      acc.batchesTotal += 1;
      return acc;
    },
    {
      sanctioned: 0, registered: 0, admission: 0, dropoutCompletion: 0,
      maleRegistered: 0, femaleRegistered: 0, boysPresent: 0, girlsPresent: 0,
      totalPresent: 0, batchesMarked: 0, batchesTotal: 0,
    }
  );
  totals.percentage = computePercentage(totals.totalPresent, totals.registered);

  res.json({ date, rows: sheet, totals });
};
// GET /api/attendance/my-status?date=YYYY-MM-DD  (teacher — which of my batches are pending today)
const getMyBatchesStatus = async (req, res) => {
  const { date } = req.query;
  if (!date) return res.status(400).json({ message: "date is required" });

  const Batch = require("../models/Batch");
  const myBatches = await Batch.find({ assignedTeachers: req.user._id, active: true }).select("_id");
  const batchIds = myBatches.map((b) => b._id);

  const marked = await Attendance.find({ batch: { $in: batchIds }, date }).select("batch");
  const markedIds = new Set(marked.map((m) => String(m.batch)));

  const status = {};
  batchIds.forEach((id) => { status[String(id)] = markedIds.has(String(id)); });
  res.json(status); // { "<batchId>": true/false }
};
module.exports = {
  getAttendanceStatus, markAttendance, updateAttendance,
  getAllAttendance, getMyAttendanceHistory, getDailySheet, getMyBatchesStatus,
};
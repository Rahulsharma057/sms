const Batch = require("../models/Batch");
const Attendance = require("../models/Attendance");

const populateBatch = (query) =>
  query.populate("course", "name").populate("assignedTeachers", "name email");

// GET /api/batches  (superadmin)
const getBatches = async (req, res) => {
  const batches = await populateBatch(Batch.find({})).sort({ createdAt: -1 });
  res.json(batches);
};

// GET /api/batches/mine  (teacher)
const getMyBatches = async (req, res) => {
  const batches = await populateBatch(
    Batch.find({ assignedTeachers: req.user._id, active: true })
  ).sort({ batchName: 1 });
  res.json(batches);
};

// GET /api/batches/:id
const getBatchById = async (req, res) => {
  const batch = await populateBatch(Batch.findById(req.params.id));
  if (!batch) return res.status(404).json({ message: "Batch not found" });
  res.json(batch);
};

// POST /api/batches  (superadmin)
const createBatch = async (req, res) => {
  const { course, batchName, sanctionedSeats, registeredCount, assignedTeachers } = req.body;
  if (!course || !batchName) {
    return res.status(400).json({ message: "Course and batch name are required" });
  }

  const exists = await Batch.findOne({ course, batchName });
  if (exists) return res.status(409).json({ message: "This course + batch already exists" });

  const batch = await Batch.create({
    course, batchName,
    sanctionedSeats: sanctionedSeats || 0,
    registeredCount: registeredCount || 0,
    assignedTeachers: assignedTeachers || [],
  });
  const populated = await populateBatch(Batch.findById(batch._id));
  res.status(201).json(populated);
};

// PUT /api/batches/:id  (superadmin)
const updateBatch = async (req, res) => {
  const { course, batchName, sanctionedSeats, registeredCount, assignedTeachers, active } = req.body;
  const batch = await Batch.findById(req.params.id);
  if (!batch) return res.status(404).json({ message: "Batch not found" });

  if (course !== undefined) batch.course = course;
  if (batchName !== undefined) batch.batchName = batchName;
  if (sanctionedSeats !== undefined) batch.sanctionedSeats = sanctionedSeats;
  if (registeredCount !== undefined) batch.registeredCount = registeredCount;
  if (assignedTeachers !== undefined) batch.assignedTeachers = assignedTeachers;
  if (active !== undefined) batch.active = active;

  await batch.save();
  const populated = await populateBatch(Batch.findById(batch._id));
  res.json(populated);
};

// DELETE /api/batches/:id  (superadmin)
const deleteBatch = async (req, res) => {
  const batch = await Batch.findById(req.params.id);
  if (!batch) return res.status(404).json({ message: "Batch not found" });
  await Attendance.deleteMany({ batch: batch._id });
  await batch.deleteOne();
  res.json({ message: "Batch deleted successfully", id: req.params.id });
};

module.exports = { getBatches, getMyBatches, getBatchById, createBatch, updateBatch, deleteBatch };
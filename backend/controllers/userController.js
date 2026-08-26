const User = require("../models/User");

// GET /api/users/teachers  (superadmin)
const getTeachers = async (req, res) => {
  const teachers = await User.find({ role: "teacher" })
    .select("-password")
    .sort({ createdAt: -1 });

  res.json(teachers);
};

// POST /api/users  (superadmin creates a teacher account)
const createTeacher = async (req, res) => {
  const { name, email, password, centre } = req.body;

  if (!name || !email || !password) {
    return res
      .status(400)
      .json({ message: "Name, email and password are required" });
  }

  const exists = await User.findOne({ email: email.toLowerCase() });

  if (exists) return res.status(400).json({ message: "Email already registered" });

  const teacher = await User.create({
    name,
    email: email.toLowerCase(),
    password,
    centre,
    role: "teacher",
  });

  res.status(201).json({
    id: teacher._id,
    name: teacher.name,
    email: teacher.email,
    centre: teacher.centre,
    role: teacher.role,
    active: teacher.active,
  });
};

// =====================================================
// PUT /api/users/:id  (superadmin edits a teacher)
// =====================================================
// Password is optional here — only sent when the admin
// actually wants to reset it. Everything else is a plain
// field update.
// =====================================================

const updateTeacher = async (req, res) => {
  const { name, email, centre, password } = req.body;

  const teacher = await User.findById(req.params.id);

  if (!teacher) {
    return res.status(404).json({ message: "Teacher not found" });
  }

  if (email && email.toLowerCase() !== teacher.email) {
    const exists = await User.findOne({
      email: email.toLowerCase(),
      _id: { $ne: teacher._id },
    });

    if (exists) {
      return res.status(400).json({ message: "Email already registered" });
    }

    teacher.email = email.toLowerCase();
  }

  if (name !== undefined) teacher.name = name;
  if (centre !== undefined) teacher.centre = centre;

  // Only touch password if a new one was actually provided.
  // Assumes the User model hashes password in a pre-save hook.
  if (password) teacher.password = password;

  await teacher.save();

  res.json({
    id: teacher._id,
    name: teacher.name,
    email: teacher.email,
    centre: teacher.centre,
    role: teacher.role,
    active: teacher.active,
  });
};

// =====================================================
// DELETE /api/users/:id  (superadmin removes a teacher)
// =====================================================

const deleteTeacher = async (req, res) => {
  const teacher = await User.findById(req.params.id);

  if (!teacher) {
    return res.status(404).json({ message: "Teacher not found" });
  }

  await teacher.deleteOne();

  res.json({
    message: "Teacher deleted successfully",
    id: req.params.id,
  });
};

// PATCH /api/users/:id/toggle-active  (superadmin)
const toggleActive = async (req, res) => {
  const teacher = await User.findById(req.params.id);
  if (!teacher) return res.status(404).json({ message: "Not found" });
  teacher.active = !teacher.active;
  await teacher.save();
  res.json({ id: teacher._id, active: teacher.active });
};

module.exports = {
  getTeachers,
  createTeacher,
  updateTeacher,
  deleteTeacher,
  toggleActive,
};
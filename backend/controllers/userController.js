const User = require("../models/User");

// GET /api/users/teachers  (superadmin)
const getTeachers = async (req, res) => {
  const teachers = await User.find({ role: "teacher" }).select("-password").sort({ createdAt: -1 });
  res.json(teachers);
};

// POST /api/users  (superadmin creates a teacher account)
const createTeacher = async (req, res) => {
  const { name, email, password, centre } = req.body;
  if (!name || !email || !password) {
    return res.status(400).json({ message: "Name, email and password are required" });
  }
  const exists = await User.findOne({ email: email.toLowerCase() });
  if (exists) return res.status(400).json({ message: "Email already registered" });

  const teacher = await User.create({ name, email, password, centre, role: "teacher" });
  res.status(201).json({
    id: teacher._id, name: teacher.name, email: teacher.email, centre: teacher.centre, role: teacher.role,
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

module.exports = { getTeachers, createTeacher, toggleActive };

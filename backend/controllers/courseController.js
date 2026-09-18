const Course = require("../models/Course");
const Batch = require("../models/Batch");

const getCourses = async (req, res) => {
  const courses = await Course.find({}).sort({ name: 1 });
  res.json(courses);
};

const createCourse = async (req, res) => {
  const { name } = req.body;
  if (!name?.trim()) return res.status(400).json({ message: "Course name is required" });

  const exists = await Course.findOne({ name: name.trim() });
  if (exists) return res.status(409).json({ message: "This course already exists" });

  const course = await Course.create({ name: name.trim() });
  res.status(201).json(course);
};

const updateCourse = async (req, res) => {
  const { name } = req.body;
  const course = await Course.findById(req.params.id);
  if (!course) return res.status(404).json({ message: "Course not found" });

  if (name?.trim() && name.trim() !== course.name) {
    const exists = await Course.findOne({ name: name.trim(), _id: { $ne: course._id } });
    if (exists) return res.status(409).json({ message: "Another course already has this name" });
    course.name = name.trim();
    await course.save();
  }
  res.json(course);
};

const deleteCourse = async (req, res) => {
  const inUse = await Batch.findOne({ course: req.params.id });
  if (inUse) return res.status(409).json({ message: "Course is in use by a batch — remove that batch first" });

  const course = await Course.findByIdAndDelete(req.params.id);
  if (!course) return res.status(404).json({ message: "Course not found" });
  res.json({ message: "Course deleted", id: req.params.id });
};

module.exports = { getCourses, createCourse, updateCourse, deleteCourse };
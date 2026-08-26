const Task = require("../models/Task");

// POST /api/tasks  (superadmin assigns a task to a teacher)
const createTask = async (req, res) => {
  const { title, description, assignedTo, dueDate } = req.body;
  if (!title || !assignedTo) return res.status(400).json({ message: "Title and assignedTo are required" });

  const task = await Task.create({
    title, description, assignedTo, dueDate,
    assignedBy: req.user._id,
  });
  const populated = await task.populate([
    { path: "assignedTo", select: "name email" },
    { path: "assignedBy", select: "name email" },
  ]);
  res.status(201).json(populated);
};

// GET /api/tasks/mine  (teacher - tasks assigned to them)
const getMyTasks = async (req, res) => {
  const tasks = await Task.find({ assignedTo: req.user._id })
    .populate("assignedBy", "name email")
    .sort({ createdAt: -1 });
  res.json(tasks);
};

// GET /api/tasks  (superadmin - all tasks)
const getAllTasks = async (req, res) => {
  const tasks = await Task.find()
    .populate("assignedTo", "name email")
    .populate("assignedBy", "name email")
    .sort({ createdAt: -1 });
  res.json(tasks);
};

// GET /api/tasks/:id
const getTaskById = async (req, res) => {
  const task = await Task.findById(req.params.id)
    .populate("assignedTo", "name email")
    .populate("assignedBy", "name email")
    .populate("messages.sender", "name role");
  if (!task) return res.status(404).json({ message: "Task not found" });

  const isOwner = String(task.assignedTo._id) === String(req.user._id);
  if (req.user.role !== "superadmin" && !isOwner) {
    return res.status(403).json({ message: "Not authorized" });
  }
  res.json(task);
};

// PATCH /api/tasks/:id/status  (teacher updates status of own task)
const updateStatus = async (req, res) => {
  const { status } = req.body;
  if (!["pending", "in-progress", "completed"].includes(status)) {
    return res.status(400).json({ message: "Invalid status" });
  }
  const task = await Task.findById(req.params.id);
  if (!task) return res.status(404).json({ message: "Task not found" });

  const isOwner = String(task.assignedTo) === String(req.user._id);
  if (req.user.role !== "superadmin" && !isOwner) {
    return res.status(403).json({ message: "Not authorized" });
  }
  task.status = status;
  await task.save();
  res.json(task);
};

// POST /api/tasks/:id/messages  (chat about a task - either side)
const addMessage = async (req, res) => {
  const { text } = req.body;
  if (!text?.trim()) return res.status(400).json({ message: "Message text required" });

  const task = await Task.findById(req.params.id);
  if (!task) return res.status(404).json({ message: "Task not found" });

  const isOwner = String(task.assignedTo) === String(req.user._id);
  if (req.user.role !== "superadmin" && !isOwner) {
    return res.status(403).json({ message: "Not authorized" });
  }

  task.messages.push({ sender: req.user._id, senderName: req.user.name, text: text.trim() });
  await task.save();
  const populated = await task.populate("messages.sender", "name role");
  res.status(201).json(populated.messages[populated.messages.length - 1]);
};

module.exports = { createTask, getMyTasks, getAllTasks, getTaskById, updateStatus, addMessage };

const Task = require("../models/Task");

// POST /api/tasks  (superadmin assigns a task to a teacher)
const createTask = async (req, res) => {
  try {
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
  } catch (err) {
    console.error("createTask error:", err);
    res.status(500).json({ message: "Could not create task" });
  }
};

// GET /api/tasks/mine  (teacher - tasks assigned to them)
const getMyTasks = async (req, res) => {
  try {
    const tasks = await Task.find({ assignedTo: req.user._id })
      .populate("assignedBy", "name email")
      .sort({ createdAt: -1 });
    res.json(tasks);
  } catch (err) {
    console.error("getMyTasks error:", err);
    res.status(500).json({ message: "Could not load tasks" });
  }
};

// GET /api/tasks  (superadmin - all tasks)
const getAllTasks = async (req, res) => {
  try {
    const tasks = await Task.find()
      .populate("assignedTo", "name email")
      .populate("assignedBy", "name email")
      .sort({ createdAt: -1 });
    res.json(tasks);
  } catch (err) {
    console.error("getAllTasks error:", err);
    res.status(500).json({ message: "Could not load tasks" });
  }
};

// GET /api/tasks/:id
const getTaskById = async (req, res) => {
  try {
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
  } catch (err) {
    console.error("getTaskById error:", err);
    res.status(500).json({ message: "Could not load task" });
  }
};

// PATCH /api/tasks/:id/status  (teacher updates status of own task)
const updateStatus = async (req, res) => {
  try {
    const { status } = req.body;
    if (!["pending", "in-progress", "completed"].includes(status)) {
      return res.status(400).json({ message: "Invalid status" });
    }
    const task = await Task.findById(req.params.id).select("assignedTo status");
    if (!task) return res.status(404).json({ message: "Task not found" });

    const isOwner = String(task.assignedTo) === String(req.user._id);
    if (req.user.role !== "superadmin" && !isOwner) {
      return res.status(403).json({ message: "Not authorized" });
    }

    // Atomic update — avoids a version conflict with a concurrent
    // addMessage/markMessagesSeen write on the same task document.
    const updated = await Task.findByIdAndUpdate(
      req.params.id,
      { $set: { status } },
      { new: true },
    );
    res.json(updated);
  } catch (err) {
    console.error("updateStatus error:", err);
    res.status(500).json({ message: "Could not update status" });
  }
};

// POST /api/tasks/:id/messages  (chat about a task - either side)
const addMessage = async (req, res) => {
  try {
    const { text } = req.body;
    if (!text?.trim()) return res.status(400).json({ message: "Message text required" });

    const task = await Task.findById(req.params.id).select("assignedTo");
    if (!task) return res.status(404).json({ message: "Task not found" });

    const isOwner = String(task.assignedTo) === String(req.user._id);
    if (req.user.role !== "superadmin" && !isOwner) {
      return res.status(403).json({ message: "Not authorized" });
    }

    // Atomic $push instead of load->modify->save — two people messaging at
    // almost the same instant can no longer race into a VersionError.
    const updated = await Task.findByIdAndUpdate(
      req.params.id,
      {
        $push: {
          messages: {
            sender: req.user._id,
            senderName: req.user.name,
            text: text.trim(),
            // sender automatically "sees" their own message
            seenBy: [req.user._id],
          },
        },
      },
      { new: true },
    ).populate("messages.sender", "name role");

    res.status(201).json(updated.messages[updated.messages.length - 1]);
  } catch (err) {
    console.error("addMessage error:", err);
    res.status(500).json({ message: "Could not send message" });
  }
};

// PATCH /api/tasks/:id/messages/seen  (mark all messages in this task as seen by current user)
const markMessagesSeen = async (req, res) => {
  try {
    const task = await Task.findById(req.params.id).select("assignedTo");
    if (!task) return res.status(404).json({ message: "Task not found" });

    const isOwner = String(task.assignedTo) === String(req.user._id);
    if (req.user.role !== "superadmin" && !isOwner) {
      return res.status(403).json({ message: "Not authorized" });
    }

    // Atomic update: $addToSet on every array element via the "$[]" all-positional
    // operator. No load->modify->save round trip, so this can be called as often
    // as we like (polling, mount, etc.) without ever hitting a VersionError, even
    // if it lands at the exact same moment as a new message being pushed.
    await Task.updateOne(
      { _id: req.params.id },
      { $addToSet: { "messages.$[].seenBy": req.user._id } },
    );

    res.json({ ok: true });
  } catch (err) {
    console.error("markMessagesSeen error:", err);
    res.status(500).json({ message: "Could not update seen status" });
  }
};

module.exports = {
  createTask, getMyTasks, getAllTasks, getTaskById, updateStatus, addMessage, markMessagesSeen,
};
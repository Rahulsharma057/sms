
const Task = require("../models/Task");
const { createNotification } = require("../services/notificationService");

// ======================================================
// POST /api/tasks
// SuperAdmin assigns a task to a teacher
// ======================================================
const createTask = async (req, res) => {
  try {
    const { title, description, assignedTo, dueDate } = req.body;

    if (!title || !assignedTo) {
      return res.status(400).json({
        message: "Title and assignedTo are required",
      });
    }

    const task = await Task.create({
      title,
      description,
      assignedTo,
      dueDate,
      assignedBy: req.user._id,
    });

    const populated = await task.populate([
      { path: "assignedTo", select: "name email" },
      { path: "assignedBy", select: "name email" },
    ]);

    // ======================================================
    // NOTIFICATION: New Task
    // Notify the teacher who received the task
    // ======================================================
    await createNotification({
      recipient: assignedTo,
      type: "NEW_TASK",
      title: "New Task Assigned",
      message: `You have been assigned a new task: "${title}"`,
      task: task._id,
    });

    res.status(201).json(populated);
  } catch (err) {
    console.error("createTask error:", err);
    res.status(500).json({
      message: "Could not create task",
    });
  }
};

// ======================================================
// GET /api/tasks/mine
// Teacher - tasks assigned to them
// ======================================================
const getMyTasks = async (req, res) => {
  try {
    const tasks = await Task.find({
      assignedTo: req.user._id,
    })
      .populate("assignedBy", "name email")
      .sort({ createdAt: -1 });

    res.json(tasks);
  } catch (err) {
    console.error("getMyTasks error:", err);
    res.status(500).json({
      message: "Could not load tasks",
    });
  }
};

// ======================================================
// GET /api/tasks
// SuperAdmin - all tasks
// ======================================================
const getAllTasks = async (req, res) => {
  try {
    const tasks = await Task.find()
      .populate("assignedTo", "name email")
      .populate("assignedBy", "name email")
      .sort({ createdAt: -1 });

    res.json(tasks);
  } catch (err) {
    console.error("getAllTasks error:", err);
    res.status(500).json({
      message: "Could not load tasks",
    });
  }
};

// ======================================================
// GET /api/tasks/:id
// Get single task
// ======================================================
const getTaskById = async (req, res) => {
  try {
    const task = await Task.findById(req.params.id)
      .populate("assignedTo", "name email")
      .populate("assignedBy", "name email")
      .populate("messages.sender", "name role");

    if (!task) {
      return res.status(404).json({
        message: "Task not found",
      });
    }

    const isOwner =
      String(task.assignedTo._id) === String(req.user._id);

    if (req.user.role !== "superadmin" && !isOwner) {
      return res.status(403).json({
        message: "Not authorized",
      });
    }

    res.json(task);
  } catch (err) {
    console.error("getTaskById error:", err);
    res.status(500).json({
      message: "Could not load task",
    });
  }
};

// ======================================================
// PATCH /api/tasks/:id/status
// Teacher / SuperAdmin updates task status
// ======================================================
const updateStatus = async (req, res) => {
  try {
    const { status } = req.body;

    if (!["pending", "in-progress", "completed"].includes(status)) {
      return res.status(400).json({
        message: "Invalid status",
      });
    }

    const task = await Task.findById(req.params.id).select(
      "assignedTo assignedBy status title"
    );

    if (!task) {
      return res.status(404).json({
        message: "Task not found",
      });
    }

    const isOwner =
      String(task.assignedTo) === String(req.user._id);

    if (req.user.role !== "superadmin" && !isOwner) {
      return res.status(403).json({
        message: "Not authorized",
      });
    }

    // ======================================================
    // Atomic status update
    // ======================================================
    const updated = await Task.findByIdAndUpdate(
      req.params.id,
      {
        $set: {
          status,
        },
      },
      {
        new: true,
      }
    )
      .populate("assignedTo", "name email")
      .populate("assignedBy", "name email");

    // ======================================================
    // NOTIFICATION: Task Status
    //
    // If teacher changes status:
    // → notify SuperAdmin / task creator
    //
    // If SuperAdmin changes status:
    // → notify assigned teacher
    // ======================================================
    const recipient =
      String(req.user._id) === String(task.assignedBy)
        ? task.assignedTo
        : task.assignedBy;

    // Don't notify if recipient somehow equals current user
    if (String(recipient) !== String(req.user._id)) {
      await createNotification({
        recipient,
        type: "TASK_STATUS",
        title: "Task Status Updated",
        message: `Task "${task.title}" status changed to "${status}".`,
        task: task._id,
      });
    }

    res.json(updated);
  } catch (err) {
    console.error("updateStatus error:", err);
    res.status(500).json({
      message: "Could not update status",
    });
  }
};

// ======================================================
// POST /api/tasks/:id/messages
// Teacher / SuperAdmin sends message
// ======================================================
const addMessage = async (req, res) => {
  try {
    const { text } = req.body;

    if (!text?.trim()) {
      return res.status(400).json({
        message: "Message text required",
      });
    }

    const task = await Task.findById(req.params.id).select(
      "assignedTo assignedBy title"
    );

    if (!task) {
      return res.status(404).json({
        message: "Task not found",
      });
    }

    const isOwner =
      String(task.assignedTo) === String(req.user._id);

    const isAssigner =
      String(task.assignedBy) === String(req.user._id);

    if (!isOwner && !isAssigner) {
      return res.status(403).json({
        message: "Not authorized",
      });
    }

    // ======================================================
    // Atomic message push
    // ======================================================
    const updated = await Task.findByIdAndUpdate(
      req.params.id,
      {
        $push: {
          messages: {
            sender: req.user._id,
            senderName: req.user.name,
            text: text.trim(),
            seenBy: [req.user._id],
          },
        },
      },
      {
        new: true,
      }
    ).populate("messages.sender", "name role");

    const newMessage =
      updated.messages[updated.messages.length - 1];

    // ======================================================
    // NOTIFICATION: New Message
    //
    // Teacher sends → notify SuperAdmin
    // SuperAdmin sends → notify Teacher
    // ======================================================
    const recipient = isOwner
      ? task.assignedBy
      : task.assignedTo;

    if (String(recipient) !== String(req.user._id)) {
      await createNotification({
        recipient,
        type: "NEW_MESSAGE",
        title: "New Task Message",
        message: `${req.user.name} sent a message on task "${task.title}".`,
        task: task._id,
      });
    }

    res.status(201).json(newMessage);
  } catch (err) {
    console.error("addMessage error:", err);
    res.status(500).json({
      message: "Could not send message",
    });
  }
};

// ======================================================
// PATCH /api/tasks/:id/messages/seen
// Mark all messages as seen
// ======================================================
const markMessagesSeen = async (req, res) => {
  try {
    const task = await Task.findById(req.params.id).select(
      "assignedTo assignedBy"
    );

    if (!task) {
      return res.status(404).json({
        message: "Task not found",
      });
    }

    const isOwner =
      String(task.assignedTo) === String(req.user._id);

    const isAssigner =
      String(task.assignedBy) === String(req.user._id);

    if (!isOwner && !isAssigner) {
      return res.status(403).json({
        message: "Not authorized",
      });
    }

    // ======================================================
    // Atomic seen update
    // ======================================================
    await Task.updateOne(
      {
        _id: req.params.id,
      },
      {
        $addToSet: {
          "messages.$[].seenBy": req.user._id,
        },
      }
    );

    res.json({
      ok: true,
    });
  } catch (err) {
    console.error("markMessagesSeen error:", err);
    res.status(500).json({
      message: "Could not update seen status",
    });
  }
};
// ======================================================
// DELETE /api/tasks/:id
// SuperAdmin - delete a task
// ======================================================
const deleteTask = async (req, res) => {
  try {
    const task = await Task.findById(req.params.id).select(
      "_id title assignedTo assignedBy"
    );

    if (!task) {
      return res.status(404).json({
        message: "Task not found",
      });
    }

    // Only SuperAdmin can reach this endpoint
    await Task.findByIdAndDelete(req.params.id);

    res.json({
      success: true,
      message: "Task deleted successfully",
      data: {
        _id: task._id,
      },
    });
  } catch (err) {
    console.error("deleteTask error:", err);

    res.status(500).json({
      message: "Could not delete task",
    });
  }
};
// ======================================================
// EXPORTS
// ======================================================
module.exports = {
  createTask,
  getMyTasks,
  getAllTasks,
  getTaskById,
  updateStatus,
  addMessage,
  markMessagesSeen,  deleteTask,
};

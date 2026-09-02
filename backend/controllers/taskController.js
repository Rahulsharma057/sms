const mongoose = require("mongoose");
const Task = require("../models/Task");
const { createNotification } = require("../services/notificationService");

// ======================================================
// HELPERS
// ======================================================

const toId = (value) => {
  if (!value) return null;

  if (typeof value === "object" && value._id) {
    return String(value._id);
  }

  return String(value);
};

const isSameId = (a, b) => {
  if (!a || !b) return false;
  return toId(a) === toId(b);
};

const isSuperAdmin = (role) => {
  return String(role || "").toLowerCase() === "superadmin";
};

// ======================================================
// TASK PARTICIPANTS
// ======================================================

const getTaskParticipants = (task) => {
  // GROUP
  if (task.mode === "GROUP") {
    return Array.isArray(task.participants)
      ? task.participants
          .filter(Boolean)
          .map(toId)
      : [];
  }

  // INDIVIDUAL / SEPARATE
  if (task.assignedTo) {
    return [toId(task.assignedTo)];
  }

  return [];
};

// ======================================================
// CHECK PARTICIPANT
// ======================================================

const isTaskParticipant = (task, userId) => {
  if (!userId) return false;

  const user = String(userId);

  return getTaskParticipants(task).some(
    (participantId) => participantId === user
  );
};

// ======================================================
// CHECK ASSIGNER
// ======================================================

const isTaskAssigner = (task, userId) => {
  if (!task?.assignedBy || !userId) return false;

  return isSameId(task.assignedBy, userId);
};

// ======================================================
// FINAL ACCESS CHECK
// ======================================================

const canAccessTask = (task, userId, role) => {
  if (!task || !userId) return false;

  // SuperAdmin can access everything
  if (isSuperAdmin(role)) {
    return true;
  }

  // Task creator can access
  if (isTaskAssigner(task, userId)) {
    return true;
  }

  // Assigned teacher / group participant
  if (isTaskParticipant(task, userId)) {
    return true;
  }

  return false;
};

// ======================================================
// NOTIFICATION HELPER
// ======================================================

const notifyUsers = async ({
  recipients = [],
  senderId,
  type,
  title,
  message,
  task,
}) => {
  const uniqueRecipients = [
    ...new Set(
      recipients
        .filter(Boolean)
        .map(toId)
        .filter(Boolean)
        .filter((id) => id !== String(senderId))
    ),
  ];

  if (!uniqueRecipients.length) {
    return;
  }

  await Promise.all(
    uniqueRecipients.map((recipient) =>
      createNotification({
        recipient,
        type,
        title,
        message,
        task,
      })
    )
  );
};

// ======================================================
// POST /api/tasks
//
// INDIVIDUAL
// One teacher = one task
//
// SEPARATE
// Multiple teachers = separate tasks/chats
//
// GROUP
// Multiple teachers = one task/shared chat
// ======================================================

const createTask = async (req, res) => {
  try {
    const {
      title,
      description,
      assignedTo,
      assignedToList,
      dueDate,
      mode = "INDIVIDUAL",
    } = req.body;

    if (!title?.trim()) {
      return res.status(400).json({
        message: "Task title is required",
      });
    }

    if (!["INDIVIDUAL", "SEPARATE", "GROUP"].includes(mode)) {
      return res.status(400).json({
        message: "Invalid task mode",
      });
    }

    if (!req.user?._id) {
      return res.status(401).json({
        message: "Authentication required",
      });
    }

    // ==================================================
    // INDIVIDUAL
    // ==================================================

    if (mode === "INDIVIDUAL") {
      if (!assignedTo) {
        return res.status(400).json({
          message: "Please select a teacher",
        });
      }

      if (!mongoose.Types.ObjectId.isValid(assignedTo)) {
        return res.status(400).json({
          message: "Invalid teacher",
        });
      }

      const task = await Task.create({
        title: title.trim(),
        description: description?.trim() || "",
        mode: "INDIVIDUAL",
        assignedTo,
        participants: [],
        assignedBy: req.user._id,
        dueDate: dueDate || "",
      });

      const populated = await task.populate([
        {
          path: "assignedTo",
          select: "name email role",
        },
        {
          path: "assignedBy",
          select: "name email role",
        },
      ]);

      await createNotification({
        recipient: assignedTo,
        type: "NEW_TASK",
        title: "New Task Assigned",
        message: `You have been assigned a new task: "${task.title}"`,
        task: task._id,
      });

      return res.status(201).json(populated);
    }

    // ==================================================
    // SEPARATE
    // ==================================================

    if (mode === "SEPARATE") {
      const teachers = Array.isArray(assignedToList)
        ? [
            ...new Set(
              assignedToList
                .filter(Boolean)
                .map(String)
            ),
          ]
        : [];

      if (!teachers.length) {
        return res.status(400).json({
          message: "Please select at least one teacher",
        });
      }

      if (teachers.length < 2) {
        return res.status(400).json({
          message:
            "Select at least two teachers for separate assignment",
        });
      }

      const invalidTeacher = teachers.some(
        (id) => !mongoose.Types.ObjectId.isValid(id)
      );

      if (invalidTeacher) {
        return res.status(400).json({
          message: "One or more teacher IDs are invalid",
        });
      }

      const docs = teachers.map((teacherId) => ({
        title: title.trim(),
        description: description?.trim() || "",
        mode: "SEPARATE",
        assignedTo: teacherId,
        participants: [],
        assignedBy: req.user._id,
        dueDate: dueDate || "",
      }));

      const createdTasks = await Task.insertMany(docs);

      await Promise.all(
        createdTasks.map((task) =>
          createNotification({
            recipient: task.assignedTo,
            type: "NEW_TASK",
            title: "New Task Assigned",
            message: `You have been assigned a new task: "${task.title}"`,
            task: task._id,
          })
        )
      );

      const populatedTasks = await Task.find({
        _id: {
          $in: createdTasks.map((task) => task._id),
        },
      })
        .populate("assignedTo", "name email role")
        .populate("assignedBy", "name email role")
        .sort({ createdAt: -1 });

      return res.status(201).json({
        mode: "SEPARATE",
        count: populatedTasks.length,
        tasks: populatedTasks,
      });
    }

    // ==================================================
    // GROUP
    // ==================================================

    if (mode === "GROUP") {
      const participants = Array.isArray(assignedToList)
        ? [
            ...new Set(
              assignedToList
                .filter(Boolean)
                .map(String)
            ),
          ]
        : [];

      if (!participants.length) {
        return res.status(400).json({
          message: "Please select at least one teacher",
        });
      }

      if (participants.length < 2) {
        return res.status(400).json({
          message:
            "Select at least two teachers for a group task",
        });
      }

      const invalidParticipant = participants.some(
        (id) => !mongoose.Types.ObjectId.isValid(id)
      );

      if (invalidParticipant) {
        return res.status(400).json({
          message: "One or more participant IDs are invalid",
        });
      }

      const task = await Task.create({
        title: title.trim(),
        description: description?.trim() || "",
        mode: "GROUP",
        assignedTo: null,
        participants,
        assignedBy: req.user._id,
        dueDate: dueDate || "",
      });

      const populated = await task.populate([
        {
          path: "participants",
          select: "name email role",
        },
        {
          path: "assignedBy",
          select: "name email role",
        },
      ]);

      await notifyUsers({
        recipients: participants,
        senderId: req.user._id,
        type: "NEW_TASK",
        title: "New Group Task",
        message: `You have been added to a group task: "${task.title}"`,
        task: task._id,
      });

      return res.status(201).json(populated);
    }

    return res.status(400).json({
      message: "Invalid task mode",
    });
  } catch (err) {
    console.error("createTask error:", err);

    return res.status(500).json({
      message: "Could not create task",
    });
  }
};

// ======================================================
// GET /api/tasks/mine
//
// Teacher gets:
// INDIVIDUAL -> assignedTo
// SEPARATE   -> assignedTo
// GROUP      -> participants
// ======================================================

const getMyTasks = async (req, res) => {
  try {
    if (!req.user?._id) {
      return res.status(401).json({
        message: "Authentication required",
      });
    }

    const userId = req.user._id;

    const tasks = await Task.find({
      $or: [
        {
          assignedTo: userId,
        },
        {
          participants: userId,
        },
      ],
    })
      .populate("assignedBy", "name email role")
      .populate("assignedTo", "name email role")
      .populate("participants", "name email role")
      .sort({ createdAt: -1 });

    return res.json(tasks);
  } catch (err) {
    console.error("getMyTasks error:", err);

    return res.status(500).json({
      message: "Could not load tasks",
    });
  }
};

// ======================================================
// GET /api/tasks
// SUPERADMIN
// ======================================================

const getAllTasks = async (req, res) => {
  try {
    const tasks = await Task.find()
      .populate("assignedTo", "name email role")
      .populate("participants", "name email role")
      .populate("assignedBy", "name email role")
      .sort({ createdAt: -1 });

    return res.json(tasks);
  } catch (err) {
    console.error("getAllTasks error:", err);

    return res.status(500).json({
      message: "Could not load tasks",
    });
  }
};

// ======================================================
// GET /api/tasks/:id
// ======================================================

const getTaskById = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        message: "Invalid task ID",
      });
    }

    const task = await Task.findById(id)
      .populate("assignedTo", "name email role")
      .populate("participants", "name email role")
      .populate("assignedBy", "name email role")
      .populate("messages.sender", "name role");

    if (!task) {
      return res.status(404).json({
        message: "Task not found",
      });
    }

    if (
      !canAccessTask(
        task,
        req.user?._id,
        req.user?.role
      )
    ) {
      return res.status(403).json({
        message: "Not authorized",
      });
    }

    return res.json(task);
  } catch (err) {
    console.error("getTaskById error:", err);

    return res.status(500).json({
      message: "Could not load task",
    });
  }
};

// ======================================================
// PATCH /api/tasks/:id/status
// ======================================================

const updateStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        message: "Invalid task ID",
      });
    }

    if (
      !["pending", "in-progress", "completed"].includes(status)
    ) {
      return res.status(400).json({
        message: "Invalid status",
      });
    }

    const task = await Task.findById(id).select(
      "assignedTo assignedBy participants status title mode"
    );

    if (!task) {
      return res.status(404).json({
        message: "Task not found",
      });
    }

    if (
      !canAccessTask(
        task,
        req.user?._id,
        req.user?.role
      )
    ) {
      return res.status(403).json({
        message: "Not authorized",
      });
    }

    const oldStatus = task.status;

    const updated = await Task.findByIdAndUpdate(
      id,
      {
        $set: {
          status,
        },
      },
      {
        new: true,
        runValidators: true,
      }
    )
      .populate("assignedTo", "name email role")
      .populate("participants", "name email role")
      .populate("assignedBy", "name email role");

    // ==================================================
    // NOTIFICATION RECIPIENTS
    // ==================================================

    let recipients = [];

    if (isTaskAssigner(task, req.user._id)) {
      // Admin changed status
      recipients = getTaskParticipants(task);
    } else {
      // Teacher changed status
      recipients = [
        task.assignedBy,
      ];

      // Group: notify other participants also
      if (task.mode === "GROUP") {
        recipients.push(...getTaskParticipants(task));
      }
    }

    await notifyUsers({
      recipients,
      senderId: req.user._id,
      type: "TASK_STATUS",
      title: "Task Status Updated",
      message: `Task "${task.title}" status changed from "${oldStatus}" to "${status}".`,
      task: task._id,
    });

    return res.json(updated);
  } catch (err) {
    console.error("updateStatus error:", err);

    return res.status(500).json({
      message: "Could not update status",
    });
  }
};

// ======================================================
// POST /api/tasks/:id/messages
// ======================================================

const addMessage = async (req, res) => {
  try {
    const { id } = req.params;
    const { text } = req.body;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        message: "Invalid task ID",
      });
    }

    if (!text?.trim()) {
      return res.status(400).json({
        message: "Message text required",
      });
    }

    const task = await Task.findById(id).select(
      "assignedTo assignedBy participants title mode"
    );

    if (!task) {
      return res.status(404).json({
        message: "Task not found",
      });
    }

    if (
      !canAccessTask(
        task,
        req.user?._id,
        req.user?.role
      )
    ) {
      return res.status(403).json({
        message: "Not authorized",
      });
    }

    const updated = await Task.findByIdAndUpdate(
      id,
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
        runValidators: true,
      }
    ).populate("messages.sender", "name role");

    if (!updated) {
      return res.status(404).json({
        message: "Task not found",
      });
    }

    const newMessage =
      updated.messages[updated.messages.length - 1];

    // ==================================================
    // NOTIFICATION RECIPIENTS
    // ==================================================

    let recipients = [];

    if (task.mode === "GROUP") {
      recipients = [
        task.assignedBy,
        ...task.participants,
      ];
    } else {
      recipients = [
        task.assignedBy,
        task.assignedTo,
      ];
    }

    await notifyUsers({
      recipients,
      senderId: req.user._id,
      type: "NEW_MESSAGE",
      title:
        task.mode === "GROUP"
          ? "New Group Task Message"
          : "New Task Message",
      message: `${req.user.name} sent a message on task "${task.title}".`,
      task: task._id,
    });

    return res.status(201).json(newMessage);
  } catch (err) {
    console.error("addMessage error:", err);

    return res.status(500).json({
      message: "Could not send message",
    });
  }
};

// ======================================================
// PATCH /api/tasks/:id/messages/seen
// ======================================================

const markMessagesSeen = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        message: "Invalid task ID",
      });
    }

    const task = await Task.findById(id).select(
      "assignedTo assignedBy participants mode"
    );

    if (!task) {
      return res.status(404).json({
        message: "Task not found",
      });
    }

    if (
      !canAccessTask(
        task,
        req.user?._id,
        req.user?.role
      )
    ) {
      return res.status(403).json({
        message: "Not authorized",
      });
    }

    await Task.updateOne(
      {
        _id: id,
      },
      {
        $addToSet: {
          "messages.$[].seenBy": req.user._id,
        },
      }
    );

    return res.json({
      ok: true,
    });
  } catch (err) {
    console.error("markMessagesSeen error:", err);

    return res.status(500).json({
      message: "Could not update seen status",
    });
  }
};

// ======================================================
// DELETE /api/tasks/:id
// SUPERADMIN
// ======================================================

const deleteTask = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        message: "Invalid task ID",
      });
    }

    const task = await Task.findById(id).select(
      "_id title assignedTo assignedBy participants mode"
    );

    if (!task) {
      return res.status(404).json({
        message: "Task not found",
      });
    }

    await Task.findByIdAndDelete(id);

    return res.json({
      success: true,
      message: "Task deleted successfully",
      data: {
        _id: task._id,
      },
    });
  } catch (err) {
    console.error("deleteTask error:", err);

    return res.status(500).json({
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
  markMessagesSeen,
  deleteTask,
};
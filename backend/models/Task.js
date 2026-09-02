const mongoose = require("mongoose");

const messageSchema = new mongoose.Schema(
  {
    sender: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    senderName: {
      type: String,
      required: true,
    },

    text: {
      type: String,
      required: true,
      trim: true,
    },

    seenBy: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
    ],
  },
  { timestamps: true },
);

const taskSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true,
    },

    description: {
      type: String,
      default: "",
      trim: true,
    },

    // --------------------------------------------------
    // INDIVIDUAL / SEPARATE
    // assignedTo contains one teacher
    //
    // GROUP
    // assignedTo = null
    // participants contains multiple teachers
    // --------------------------------------------------
    mode: {
      type: String,
      enum: ["INDIVIDUAL", "SEPARATE", "GROUP"],
      default: "INDIVIDUAL",
    },

    assignedTo: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },

    participants: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
    ],

    assignedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    status: {
      type: String,
      enum: ["pending", "in-progress", "completed"],
      default: "pending",
    },

    dueDate: {
      type: String,
      default: "",
    },

    messages: [messageSchema],
  },
  {
    timestamps: true,
  },
);

// --------------------------------------------------
// Helpful indexes
// --------------------------------------------------

taskSchema.index({ assignedTo: 1, createdAt: -1 });
taskSchema.index({ participants: 1, createdAt: -1 });
taskSchema.index({ assignedBy: 1, createdAt: -1 });

module.exports = mongoose.model("Task", taskSchema);

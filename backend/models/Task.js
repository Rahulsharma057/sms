const mongoose = require("mongoose");

const messageSchema = new mongoose.Schema(
  {
    sender: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    senderName: { type: String, required: true },
    text: { type: String, required: true },
  },
  { timestamps: true }
);

const taskSchema = new mongoose.Schema(
  {
    title: { type: String, required: true },
    description: { type: String, default: "" },
    assignedTo: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    assignedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    status: { type: String, enum: ["pending", "in-progress", "completed"], default: "pending" },
    dueDate: { type: String, default: "" },
    messages: [messageSchema],
  },
  { timestamps: true }
);

module.exports = mongoose.model("Task", taskSchema);

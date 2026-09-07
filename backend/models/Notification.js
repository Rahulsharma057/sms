const mongoose = require("mongoose");

const notificationSchema = new mongoose.Schema(
  {
    recipient: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    type: {
      type: String,
      enum: [
        "NEW_TASK",
        "NEW_MESSAGE",
        "TASK_STATUS",
        "NEW_NOTICE",
        "NEW_DYNAMIC_REPORT",
        "DYNAMIC_REPORT_SUBMITTED",
        "NEW_FORM", // NEW: a form was published / assigned to this user
      ],
      required: true,
    },

    title: {
      type: String,
      required: true,
      trim: true,
    },

    message: {
      type: String,
      required: true,
      trim: true,
    },

    task: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Task",
      default: null,
    },

    notice: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Notice",
      default: null,
    },

    dynamicReport: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "DynamicReport",
      default: null,
    },

    form: { // NEW
      type: mongoose.Schema.Types.ObjectId,
      ref: "FormTemplate",
      default: null,
    },

    isRead: {
      type: Boolean,
      default: false,
      index: true,
    },
  },
  {
    timestamps: true,
  },
);

module.exports = mongoose.model("Notification", notificationSchema);
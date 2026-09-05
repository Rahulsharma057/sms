const mongoose = require("mongoose");

const checkItemSchema = new mongoose.Schema(
  {
    key: { type: String, default: "" },
    label: { type: String, required: true },
    checked: { type: Boolean, default: false },
    remark: { type: String, default: "" },
    status: { type: String, enum: ["open", "resolved"], default: "open" },
    adminRemark: { type: String, default: "" },
    resolvedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    resolvedAt: { type: Date },
    followed: { type: Boolean, default: false },
  },
  { _id: false },
);

const reportSectionSchema = new mongoose.Schema(
  {
    key: { type: String, required: true },
    title: { type: String, required: true },
    timing: { type: String, default: "" },
    items: { type: [checkItemSchema], default: [] },
  },
  { _id: false },
);

const customFieldSchema = new mongoose.Schema(
  {
    key: { type: String, required: true },
    label: { type: String, required: true },
    type: {
      type: String,
      enum: ["text", "textarea", "number", "date", "select", "checkbox"],
      default: "text",
    },
    value: { type: mongoose.Schema.Types.Mixed },
    options: { type: [String], default: [] },
    required: { type: Boolean, default: false },
  },
  { _id: false },
);

// Kept for backward compatibility with existing reports.
const sectionMetaSchema = new mongoose.Schema(
  {
    title: { type: String, default: "" },
    timing: { type: String, default: "" },
  },
  { _id: false },
);

const reportSchema = new mongoose.Schema(
  {
    teacher: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    date: { type: String, required: true },
    dutyOfficerName: { type: String, required: true },
    shiftTiming: { type: String, default: "" },
    centreBatch: { type: String, default: "" },

    // New source of truth. A report stores its own complete section snapshot.
    sections: { type: [reportSectionSchema], default: [] },

    // Legacy fields intentionally retained so old reports and old clients continue to work.
    morningChecks: { type: [checkItemSchema], default: [] },
    middayChecks: { type: [checkItemSchema], default: [] },
    afternoonChecks: { type: [checkItemSchema], default: [] },
    sectionMeta: {
      morningChecks: { type: sectionMetaSchema, default: () => ({}) },
      middayChecks: { type: sectionMetaSchema, default: () => ({}) },
      afternoonChecks: { type: sectionMetaSchema, default: () => ({}) },
    },
    customSections: { type: [reportSectionSchema], default: [] },
    customFields: { type: [customFieldSchema], default: [] },

    positiveObservations: { type: String, default: "" },
    hygieneLapses: { type: String, default: "" },
    maintenanceFollowUp: { type: String, default: "" },
    urgentMatters: { type: String, default: "" },
    signature: { type: String, default: "" },
    countersignedBy: { type: String, default: "" },
  },
  { timestamps: true },
);


module.exports = mongoose.model("Report", reportSchema);

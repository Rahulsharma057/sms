const mongoose = require("mongoose");

// ============================================================
// UPDATE models/Report.js — replace the existing checkItemSchema
// with this version (adds admin follow-up tracking per item)
// ============================================================
const checkItemSchema = new mongoose.Schema(
  {
    label: { type: String, required: true },
    checked: { type: Boolean, default: false },
    remark: { type: String, default: "" },

    // --- Admin follow-up ---
    status: { type: String, enum: ["open", "resolved"], default: "open" },
    adminRemark: { type: String, default: "" },
    resolvedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    resolvedAt: { type: Date },
    followed: { type: Boolean, default: false }, // admin ki personal follow-list ke liye
  },
  { _id: false }
);

// Everything else in Report.js (reportSchema, module.exports) stays the same.
const reportSchema = new mongoose.Schema(
  {
    teacher: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    date: { type: String, required: true },
    dutyOfficerName: { type: String, required: true },
    shiftTiming: { type: String, default: "" },
    centreBatch: { type: String, default: "" },

    morningChecks: [checkItemSchema],
    middayChecks: [checkItemSchema],
    afternoonChecks: [checkItemSchema],

    positiveObservations: { type: String, default: "" },
    hygieneLapses: { type: String, default: "" },
    maintenanceFollowUp: { type: String, default: "" },
    urgentMatters: { type: String, default: "" },

    signature: { type: String, default: "" },
    countersignedBy: { type: String, default: "" },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Report", reportSchema);

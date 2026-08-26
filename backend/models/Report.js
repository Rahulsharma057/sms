const mongoose = require("mongoose");

const checkItemSchema = new mongoose.Schema(
  {
    label: { type: String, required: true },
    checked: { type: Boolean, default: false },
    remark: { type: String, default: "" },
  },
  { _id: false }
);

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

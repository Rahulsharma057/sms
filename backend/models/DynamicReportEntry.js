const mongoose = require("mongoose");

const answerSchema = new mongoose.Schema(
  {
    fieldKey: { type: String, required: true },
    label: { type: String, default: "" },
    value: { type: mongoose.Schema.Types.Mixed },
  },
  { _id: false },
);

const dynamicReportEntrySchema = new mongoose.Schema(
  {
    report: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "DynamicReport",
      required: true,
      index: true,
    },
    submittedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    date: { type: String, required: true }, // YYYY-MM-DD — the day this entry covers
    answers: { type: [answerSchema], default: [] },
  },
  { timestamps: true },
);

// One submission per user, per report, per day.
dynamicReportEntrySchema.index(
  { report: 1, submittedBy: 1, date: 1 },
  { unique: true },
);

module.exports = mongoose.model("DynamicReportEntry", dynamicReportEntrySchema);
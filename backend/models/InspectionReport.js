const mongoose = require("mongoose");

const issueSchema = new mongoose.Schema(
  {
    problemName: { type: String, required: true, trim: true },
    location: { type: String, default: "", trim: true },
    direction: { type: String, default: "", trim: true },
    brokenSince: { type: String, default: "", trim: true },
    description: { type: String, default: "" },

    photo: {
      url: { type: String, default: "" },
      publicId: { type: String, default: "" },
    },

    voiceNote: {
      url: { type: String, default: "" },
      publicId: { type: String, default: "" },
      durationSeconds: { type: Number, default: 0 },
    },

    status: { type: String, enum: ["open", "resolved"], default: "open" },
    adminRemark: { type: String, default: "" },
    resolvedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    resolvedAt: { type: Date },
  },
  { timestamps: true },
);

const inspectionReportSchema = new mongoose.Schema(
  {
    reportedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    status: { type: String, enum: ["draft", "submitted"], default: "draft", index: true },
    issues: { type: [issueSchema], default: [] },
    submittedAt: { type: Date },
  },
  { timestamps: true },
);

module.exports = mongoose.model("InspectionReport", inspectionReportSchema);
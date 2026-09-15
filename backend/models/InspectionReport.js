const mongoose = require("mongoose");

const UNITS = ["ft", "m", "in", "cm"];

const issueSchema = new mongoose.Schema(
  {
    problemName: { type: String, required: true, trim: true },
    location: { type: String, default: "", trim: true },
    direction: { type: String, default: "", trim: true },
    brokenSince: { type: String, default: "", trim: true },
    description: { type: String, default: "" },

    // NEW: quantity + measurements
    quantity: { type: Number, default: null, min: 0 },
    length: { type: Number, default: null, min: 0 },
    height: { type: Number, default: null, min: 0 },
    unit: { type: String, enum: UNITS, default: "ft" },

    // CHANGED: single photo -> multiple photos
    photos: {
      type: [
        {
          url: { type: String, required: true },
          publicId: { type: String, required: true },
        },
      ],
      default: [],
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

    // NEW: admin lock — freezes editing once set
    locked: { type: Boolean, default: false, index: true },
    lockedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    lockedAt: { type: Date },
  },
  { timestamps: true },
);

module.exports = mongoose.model("InspectionReport", inspectionReportSchema);
module.exports.UNITS = UNITS;
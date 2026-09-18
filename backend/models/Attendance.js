const mongoose = require("mongoose");

const attendanceSchema = new mongoose.Schema(
  {
    batch: { type: mongoose.Schema.Types.ObjectId, ref: "Batch", required: true },
    date: { type: String, required: true }, // "YYYY-MM-DD"
    markedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    boysPresent: { type: Number, default: 0, min: 0 },
    girlsPresent: { type: Number, default: 0, min: 0 },
    remarks: { type: String, default: "" },
  },
  { timestamps: true }
);

attendanceSchema.index({ batch: 1, date: 1 }, { unique: true });

module.exports = mongoose.model("Attendance", attendanceSchema);
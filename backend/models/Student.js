const mongoose = require("mongoose");

const studentSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    gender: { type: String, enum: ["male", "female"], required: true },
    batch: { type: mongoose.Schema.Types.ObjectId, ref: "Batch", required: true },
    admissionDate: { type: Date, default: Date.now },
    status: { type: String, enum: ["active", "dropout", "completed"], default: "active" },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Student", studentSchema);
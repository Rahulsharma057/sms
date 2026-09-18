const mongoose = require("mongoose");

const batchSchema = new mongoose.Schema(
  {
    course: { type: mongoose.Schema.Types.ObjectId, ref: "Course", required: true },
    batchName: { type: String, required: true, trim: true },
    sanctionedSeats: { type: Number, default: 0 },
    registeredCount: { type: Number, default: 0 }, // 👈 naya field
    assignedTeachers: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
    active: { type: Boolean, default: true },
  },
  { timestamps: true }
);

batchSchema.index({ course: 1, batchName: 1 }, { unique: true });

module.exports = mongoose.model("Batch", batchSchema);
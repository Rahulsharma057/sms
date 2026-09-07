const mongoose = require("mongoose");

const FIELD_TYPES = [
  "text",
  "textarea",
  "number",
  "date",
  "select",
  "multiselect",
  "checkbox",
  "checkbox_remark", // checkbox + optional remark, checklist-item style
  "rating",
];

const reportFieldSchema = new mongoose.Schema(
  {
    key: { type: String, required: true },
    label: { type: String, required: true },
    fieldType: { type: String, enum: FIELD_TYPES, default: "text" },
    required: { type: Boolean, default: false },
    options: { type: [String], default: [] }, // used for select / multiselect
    maxRating: { type: Number, default: 5 }, // used only when fieldType === "rating"
  },
  { _id: false },
);

const dynamicReportSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true },
    description: { type: String, default: "" },
    fields: { type: [reportFieldSchema], default: [] },

    // FREQUENCY
    frequency: {
      type: String,
      enum: ["daily", "weekly", "custom"],
      default: "daily",
    },
    // weekly: which weekdays it's due, 0=Sun ... 6=Sat
    weekDays: { type: [Number], default: [] },
    // custom: specific due dates, "YYYY-MM-DD"
    customDates: { type: [String], default: [] },

    // AUDIENCE
    targetType: { type: String, enum: ["all", "specific"], default: "all" },
    targetUsers: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],

    isActive: { type: Boolean, default: true },

    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true },
);

module.exports = mongoose.model("DynamicReport", dynamicReportSchema);
module.exports.FIELD_TYPES = FIELD_TYPES;
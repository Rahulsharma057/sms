const mongoose = require("mongoose");

const templateItemSchema = new mongoose.Schema(
  { key: { type: String, required: true }, label: { type: String, required: true } },
  { _id: false },
);

const templateSectionSchema = new mongoose.Schema(
  {
    key: { type: String, required: true },
    title: { type: String, required: true },
    timing: { type: String, default: "" },
    items: { type: [templateItemSchema], default: [] },
  },
  { _id: false },
);

const customFieldSchema = new mongoose.Schema(
  {
    key: { type: String, required: true },
    label: { type: String, required: true },
    type: { type: String, enum: ["text", "textarea", "number", "date", "select", "checkbox"], default: "text" },
    options: { type: [String], default: [] },
    required: { type: Boolean, default: false },
  },
  { _id: false },
);

// NEW: label/enabled config for the fixed (non-checklist) report fields.
const fixedFieldConfigSchema = new mongoose.Schema(
  {
    label: { type: String, required: true },
    enabled: { type: Boolean, default: true },
  },
  { _id: false },
);

const reportTemplateSchema = new mongoose.Schema(
  {
    name: { type: String, default: "Daily Report", unique: true },
    sections: { type: [templateSectionSchema], default: [] },
    customFields: { type: [customFieldSchema], default: [] },

    // NEW: lets admin rename/hide Observations, Urgent Matters, Verification fields.
    fixedFields: {
      positiveObservations: {
        type: fixedFieldConfigSchema,
        default: () => ({ label: "Major positive observations", enabled: true }),
      },
      hygieneLapses: {
        type: fixedFieldConfigSchema,
        default: () => ({ label: "Cleanliness / hygiene lapses noted", enabled: true }),
      },
      maintenanceFollowUp: {
        type: fixedFieldConfigSchema,
        default: () => ({ label: "Maintenance items needing follow-up action", enabled: true }),
      },
      urgentMatters: {
        type: fixedFieldConfigSchema,
        default: () => ({ label: "Urgent Matters", enabled: true }),
      },
      signature: {
        type: fixedFieldConfigSchema,
        default: () => ({ label: "Signature of Duty Officer", enabled: true }),
      },
      countersignedBy: {
        type: fixedFieldConfigSchema,
        default: () => ({ label: "Countersigned by", enabled: true }),
      },
    },
  },
  { timestamps: true },
);

module.exports = mongoose.model("ReportTemplate", reportTemplateSchema);
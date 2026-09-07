const mongoose = require("mongoose");
const crypto = require("crypto");

const fieldSchema = new mongoose.Schema(
  {
    label: { type: String, required: true, trim: true },
    fieldType: {
      type: String,
      enum: ["text", "number", "rating", "checkbox"],
      default: "text",
    },
    required: { type: Boolean, default: false },
    placeholder: { type: String, default: "" },
    // when true, the public form shows an extra optional remark box next to this field
    allowRemark: { type: Boolean, default: false },
    order: { type: Number, default: 0 },
  },
  { _id: true }
);

const formTemplateSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true },
    description: { type: String, default: "" },

    // layout / look-and-feel of the public page
    theme: {
      primaryColor: { type: String, default: "#7e22ce" },
      headerText: { type: String, default: "" },
      submitButtonLabel: { type: String, default: "Submit" },
      successMessage: { type: String, default: "Thank you! Your response has been recorded." },
    },

    fields: [fieldSchema],

    // public link — /forms/<slug> on the frontend
    slug: { type: String, required: true, unique: true, index: true },
    isPublished: { type: Boolean, default: false },

    // who sees it inside the portal (dashboard / sidebar)
    targetType: { type: String, enum: ["all", "specific"], default: "all" },
    targetUsers: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],

    // whether publishing/assigning this form should notify recipients
    notifyUsers: { type: Boolean, default: true },

    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  },
  { timestamps: true }
);

// slug ek baar hi generate hota h (create ke time), baad me change nahi hota
// taaki share kiya hua link/QR hamesha kaam kare
formTemplateSchema.statics.generateSlug = function (title) {
  const base =
    (title || "form")
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "")
      .slice(0, 40) || "form";
  const suffix = crypto.randomBytes(3).toString("hex");
  return `${base}-${suffix}`;
};

module.exports = mongoose.model("FormTemplate", formTemplateSchema);
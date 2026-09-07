const mongoose = require("mongoose");

const answerSchema = new mongoose.Schema(
  {
    fieldId: { type: mongoose.Schema.Types.ObjectId, required: true },
    label: { type: String, required: true }, // snapshot — safe even if the field is edited/removed later
    value: { type: mongoose.Schema.Types.Mixed, default: "" },
    remark: { type: String, default: "" }, // optional note, only used when the field has allowRemark
  },
  { _id: false }
);

const formResponseSchema = new mongoose.Schema(
  {
    form: { type: mongoose.Schema.Types.ObjectId, ref: "FormTemplate", required: true },
    submittedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" }, // null = anonymous / public submission
    answers: [answerSchema],
  },
  { timestamps: true }
);

module.exports = mongoose.model("FormResponse", formResponseSchema);
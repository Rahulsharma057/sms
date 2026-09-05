const mongoose = require("mongoose");
const templateItemSchema = new mongoose.Schema({ key: { type: String, required: true }, label: { type: String, required: true } }, { _id: false });
const templateSectionSchema = new mongoose.Schema({ key: { type: String, required: true }, title: { type: String, required: true }, timing: { type: String, default: "" }, items: { type: [templateItemSchema], default: [] } }, { _id: false });
const customFieldSchema = new mongoose.Schema({ key: { type: String, required: true }, label: { type: String, required: true }, type: { type: String, enum: ["text","textarea","number","date","select","checkbox"], default: "text" }, options: { type: [String], default: [] }, required: { type: Boolean, default: false } }, { _id: false });
const reportTemplateSchema = new mongoose.Schema({ name: { type: String, default: "Daily Report", unique: true }, sections: { type: [templateSectionSchema], default: [] }, customFields: { type: [customFieldSchema], default: [] } }, { timestamps: true });
module.exports = mongoose.model("ReportTemplate", reportTemplateSchema);

const mongoose = require("mongoose");

const NOTICE_TYPES = ["warning", "notice", "announcement", "update"];

const noticeSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true },
    subtitle: { type: String, trim: true },
    caption: { type: String, trim: true },
    // Supports a light markdown-style syntax: **bold** and *italic*,
    // rendered by the frontend (see formatNoticeText helper on each page).
    information: { type: String, trim: true },

    // Classifies the notice so it can be styled/filtered — e.g. a red
    // "Warning" badge vs a blue "Update" badge.
    type: { type: String, enum: NOTICE_TYPES, default: "notice" },

    // Optional call-to-action button shown to users viewing the notice.
    buttonLabel: { type: String, trim: true },
    buttonUrl: { type: String, trim: true },

    // TARGETING — "all" shows this notice to every user; "specific" shows
    // it only to the users listed in targetUsers.
    targetType: { type: String, enum: ["all", "specific"], default: "all" },
    targetUsers: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],

    // Only active notices are visible to teachers/users; superadmin sees all.
    isActive: { type: Boolean, default: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Notice", noticeSchema);
module.exports.NOTICE_TYPES = NOTICE_TYPES;

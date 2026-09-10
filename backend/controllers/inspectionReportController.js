const InspectionReport = require("../models/InspectionReport");
const User = require("../models/User");
const { createNotification } = require("../services/notificationService"); // adjust path if different
const {
  uploadBufferToCloudinary,
  deleteFromCloudinary,
} = require("../utils/uploadToCloudinary");
const isAdmin = (req) => String(req.user?.role || "").toLowerCase() === "superadmin";

const requireAdmin = (req, res) => {
  if (!isAdmin(req)) {
    res.status(403).json({ message: "Admin access required" });
    return false;
  }
  return true;
};

/* =====================================================
   TEACHER: DRAFT + ISSUES
===================================================== */

// GET /api/inspection-reports/mine/draft
const getMyDraft = async (req, res) => {
  const draft = await InspectionReport.findOne({
    reportedBy: req.user._id,
    status: "draft",
  }).sort({ createdAt: -1 });

  res.json(draft || null);
};

// GET /api/inspection-reports/mine/history
const getMyHistory = async (req, res) => {
  const reports = await InspectionReport.find({
    reportedBy: req.user._id,
    status: "submitted",
  }).sort({ submittedAt: -1 });

  res.json({ reports });
};

// POST /api/inspection-reports/issues  (multipart: photo, voiceNote files + text fields)
const addIssue = async (req, res) => {
  try {
    const {
      reportId,
      problemName,
      location,
      direction,
      brokenSince,
      description,
      voiceNoteDuration,
    } = req.body;

    if (!problemName || !problemName.trim()) {
      return res.status(400).json({ message: "Problem name is required." });
    }

    // Reuse the existing draft if there is one; otherwise create a new one.
    let report = null;

    if (reportId) {
      report = await InspectionReport.findOne({
        _id: reportId,
        reportedBy: req.user._id,
        status: "draft",
      });
      if (!report) {
        return res.status(404).json({ message: "Draft report not found." });
      }
    } else {
      report = await InspectionReport.findOne({
        reportedBy: req.user._id,
        status: "draft",
      });
    }

    if (!report) {
      report = await InspectionReport.create({
        reportedBy: req.user._id,
        status: "draft",
        issues: [],
      });
    }

    const issue = {
      problemName: problemName.trim(),
      location: (location || "").trim(),
      direction: (direction || "").trim(),
      brokenSince: (brokenSince || "").trim(),
      description: (description || "").trim(),
      photo: {},
      voiceNote: {},
      status: "open",
    };

    // multer .fields() puts files under req.files.<fieldname>[0]
    const photoFile = req.files?.photo?.[0];
    const voiceFile = req.files?.voiceNote?.[0];

    if (photoFile) {
      const uploaded = await uploadBufferToCloudinary(photoFile.buffer, {
        folder: "inspection-reports/photos",
        resourceType: "image",
      });
      issue.photo = { url: uploaded.secure_url, publicId: uploaded.public_id };
    }

    if (voiceFile) {
      const uploaded = await uploadBufferToCloudinary(voiceFile.buffer, {
        folder: "inspection-reports/voice-notes",
        resourceType: "video", // audio lives under Cloudinary's "video" resource type
      });
      issue.voiceNote = {
        url: uploaded.secure_url,
        publicId: uploaded.public_id,
        durationSeconds: Number(voiceNoteDuration) || Math.round(uploaded.duration || 0),
      };
    }

    report.issues.push(issue);
    await report.save();

    res.status(201).json(report);
  } catch (error) {
    console.error("addIssue error:", error);
    res.status(500).json({ message: "Could not add this issue." });
  }
};

// DELETE /api/inspection-reports/:reportId/issues/:issueId
const deleteIssue = async (req, res) => {
  const report = await InspectionReport.findOne({
    _id: req.params.reportId,
    reportedBy: req.user._id,
    status: "draft",
  });
  if (!report) return res.status(404).json({ message: "Draft report not found." });

  report.issues = report.issues.filter((i) => String(i._id) !== req.params.issueId);
  await report.save();

  res.json(report);
};
// PATCH /api/inspection-reports/:reportId/issues/:issueId
const updateIssue = async (req, res) => {
  try {
    const report = await InspectionReport.findOne({
      _id: req.params.reportId,
      reportedBy: req.user._id,
      status: "draft",
    });

    if (!report) {
      return res.status(404).json({
        message: "Draft report not found.",
      });
    }

    const issue = report.issues.id(req.params.issueId);

    if (!issue) {
      return res.status(404).json({
        message: "Issue not found.",
      });
    }

    const {
      problemName,
      location,
      direction,
      brokenSince,
      description,
      voiceNoteDuration,
    } = req.body;

    if (!problemName || !problemName.trim()) {
      return res.status(400).json({
        message: "Problem name is required.",
      });
    }

    // Update text fields
    issue.problemName = problemName.trim();
    issue.location = (location || "").trim();
    issue.direction = (direction || "").trim();
    issue.brokenSince = (brokenSince || "").trim();
    issue.description = (description || "").trim();

    // ------------------------------------
    // Replace Photo
    // ------------------------------------
    const photoFile = req.files?.photo?.[0];

    if (photoFile) {
      // Delete old Cloudinary photo
      if (issue.photo?.publicId) {
        await deleteFromCloudinary(
          issue.photo.publicId,
          "image"
        );
      }

      const uploadedPhoto =
        await uploadBufferToCloudinary(
          photoFile.buffer,
          {
            folder: "inspection-reports/photos",
            resourceType: "image",
          }
        );

      issue.photo = {
        url: uploadedPhoto.secure_url,
        publicId: uploadedPhoto.public_id,
      };
    }

    // ------------------------------------
    // Replace Voice Note
    // ------------------------------------
    const voiceFile = req.files?.voiceNote?.[0];

    if (voiceFile) {
      // Delete old Cloudinary voice
      if (issue.voiceNote?.publicId) {
        await deleteFromCloudinary(
          issue.voiceNote.publicId,
          "video"
        );
      }

      const uploadedVoice =
        await uploadBufferToCloudinary(
          voiceFile.buffer,
          {
            folder: "inspection-reports/voice-notes",
            resourceType: "video",
          }
        );

      issue.voiceNote = {
        url: uploadedVoice.secure_url,
        publicId: uploadedVoice.public_id,
        durationSeconds:
          Number(voiceNoteDuration) ||
          Math.round(uploadedVoice.duration || 0),
      };
    }

    await report.save();

    return res.json(report);
  } catch (error) {
    console.error("updateIssue error:", error);

    return res.status(500).json({
      message: "Could not update this issue.",
    });
  }
};  
// POST /api/inspection-reports/:reportId/submit
const submitReport = async (req, res) => {
  const report = await InspectionReport.findOne({
    _id: req.params.reportId,
    reportedBy: req.user._id,
    status: "draft",
  });
  if (!report) return res.status(404).json({ message: "Draft report not found." });

  if (!report.issues.length) {
    return res.status(400).json({ message: "Add at least one issue before submitting." });
  }

  report.status = "submitted";
  report.submittedAt = new Date();
  await report.save();

  const admins = await User.find({ role: "superadmin" }).select("_id");
  await Promise.all(
    admins.map((admin) =>
      createNotification({
        recipient: admin._id,
        type: "NEW_INSPECTION_REPORT",
        title: "New inspection report",
        message: `${req.user?.name || "A teacher"} submitted an inspection report with ${report.issues.length} issue(s).`,
        inspectionReport: report._id,
      }),
    ),
  );

  res.json(report);
};

/* =====================================================
   ADMIN
===================================================== */

// GET /api/inspection-reports
const getAllReports = async (req, res) => {
  if (!requireAdmin(req, res)) return;

  const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
  const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 15, 1), 100);
  const skip = (page - 1) * limit;

  const filter = { status: "submitted" };

  const [reports, total] = await Promise.all([
    InspectionReport.find(filter)
      .populate("reportedBy", "name email")
      .sort({ submittedAt: -1 })
      .skip(skip)
      .limit(limit),
    InspectionReport.countDocuments(filter),
  ]);

  res.json({
    reports,
    pagination: { page, limit, total, totalPages: Math.max(Math.ceil(total / limit), 1) },
  });
};

// GET /api/inspection-reports/:id
const getReportById = async (req, res) => {
  const report = await InspectionReport.findById(req.params.id).populate("reportedBy", "name email");
  if (!report) return res.status(404).json({ message: "Report not found." });

  const isOwner = String(report.reportedBy._id) === String(req.user._id);
  if (!isAdmin(req) && !isOwner) {
    return res.status(403).json({ message: "Not authorized to view this report." });
  }

  res.json(report);
};

// DELETE /api/inspection-reports/:id
// DELETE /api/inspection-reports/:id
const deleteReport = async (req, res) => {
  try {
    if (!requireAdmin(req, res)) return;

    const report = await InspectionReport.findById(req.params.id);

    if (!report) {
      return res.status(404).json({
        message: "Inspection report not found.",
      });
    }

    /*
     * ==========================================
     * DELETE CLOUDINARY FILES FIRST
     * ==========================================
     */

    const cloudinaryDeleteTasks = [];

    for (const issue of report.issues || []) {
      // Delete photo
      if (issue.photo?.publicId) {
        cloudinaryDeleteTasks.push(
          deleteFromCloudinary(
            issue.photo.publicId,
            "image"
          )
        );
      }

      // Delete voice note
      // Cloudinary audio is stored as resource_type: "video"
      if (issue.voiceNote?.publicId) {
        cloudinaryDeleteTasks.push(
          deleteFromCloudinary(
            issue.voiceNote.publicId,
            "video"
          )
        );
      }
    }

    // Delete all Cloudinary files in parallel
    await Promise.all(cloudinaryDeleteTasks);

    /*
     * ==========================================
     * DELETE MONGODB REPORT
     * ==========================================
     */

    await InspectionReport.findByIdAndDelete(req.params.id);

    res.json({
      message: "Inspection report and its files deleted successfully.",
      reportId: req.params.id,
    });
  } catch (error) {
    console.error("deleteReport error:", error);

    res.status(500).json({
      message: "Could not delete inspection report.",
    });
  }
};
// PATCH /api/inspection-reports/:reportId/issues/:issueId/status
const updateIssueStatus = async (req, res) => {
  if (!requireAdmin(req, res)) return;

  const report = await InspectionReport.findById(req.params.reportId);
  if (!report) return res.status(404).json({ message: "Report not found." });

  const issue = report.issues.id(req.params.issueId);
  if (!issue) return res.status(404).json({ message: "Issue not found." });

  const { status, adminRemark } = req.body;

  if (status !== undefined) {
    issue.status = status === "resolved" ? "resolved" : "open";
    if (issue.status === "resolved") {
      issue.resolvedBy = req.user._id;
      issue.resolvedAt = new Date();
    } else {
      issue.resolvedBy = undefined;
      issue.resolvedAt = undefined;
    }
  }

  if (adminRemark !== undefined) {
    issue.adminRemark = String(adminRemark || "");
  }

  await report.save();

  const populated = await InspectionReport.findById(report._id).populate("reportedBy", "name email");
  res.json(populated);
};

// GET /api/inspection-reports/summary — for admin dashboard widget
const getSummary = async (req, res) => {
  if (!requireAdmin(req, res)) return;

  const [totalReports, recentReports, allSubmitted] = await Promise.all([
    InspectionReport.countDocuments({ status: "submitted" }),
    InspectionReport.find({ status: "submitted" })
      .populate("reportedBy", "name")
      .select("issues submittedAt reportedBy")
      .sort({ submittedAt: -1 })
      .limit(5),
    InspectionReport.find({ status: "submitted" }).select("issues"),
  ]);

  const allIssues = allSubmitted.flatMap((r) => r.issues);
  const openIssues = allIssues.filter((i) => i.status !== "resolved").length;

  res.json({
    totalReports,
    totalIssues: allIssues.length,
    openIssues,
    recentReports,
  });
};

module.exports = {
  getMyDraft,
  getMyHistory,
  addIssue,
  deleteIssue,
  updateIssue,
  submitReport,
  getAllReports,
  getReportById,
  updateIssueStatus,
  getSummary,
  deleteReport,
};
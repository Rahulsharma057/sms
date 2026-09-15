const InspectionReport = require("../models/InspectionReport");
const User = require("../models/User");
const { createNotification } = require("../services/notificationService"); // adjust path if different
const {
  uploadBufferToCloudinary,
  deleteFromCloudinary,
} = require("../utils/uploadToCloudinary");

// Add near the top, with the other requires — replace the old one:
const PDFDocument = require("pdfkit");
const {
  appendReportToPdf,
  prefetchReportImages,
  drawBulkPdfHeader,
} = require("../utils/generateInspectionPdf");
const VALID_UNITS = ["ft", "m", "in", "cm"];

const isAdmin = (req) => String(req.user?.role || "").toLowerCase() === "superadmin";

const requireAdmin = (req, res) => {
  if (!isAdmin(req)) {
    res.status(403).json({ message: "Admin access required" });
    return false;
  }
  return true;
};

const toNumberOrNull = (v) => (v === undefined || v === null || v === "" ? null : Number(v));

/* =====================================================
   PERMISSION HELPER — used by any edit-style endpoint
   Rules:
   - Draft reports: only the owning teacher can touch them.
   - Submitted + unlocked: owner OR admin can edit.
   - Submitted + locked: nobody can edit.
===================================================== */

const getEditableReport = async (reportId, user) => {
  const report = await InspectionReport.findById(reportId);
  if (!report) {
    return { report: null, error: { status: 404, message: "Report not found." } };
  }

  const isOwner = String(report.reportedBy) === String(user._id);
  const userIsAdmin = String(user?.role || "").toLowerCase() === "superadmin";

  if (!isOwner && !userIsAdmin) {
    return { report: null, error: { status: 403, message: "Not authorized to edit this report." } };
  }

  if (report.status === "draft" && !isOwner) {
    return { report: null, error: { status: 403, message: "Not authorized to edit this report." } };
  }

  if (report.status === "submitted" && report.locked) {
    return {
      report: null,
      error: { status: 400, message: "This report is locked and can no longer be edited." },
    };
  }

  return { report, error: null };
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

// POST /api/inspection-reports/issues  (multipart: photos[], voiceNote + text fields)
const addIssue = async (req, res) => {
  try {
    const {
      reportId,
      problemName,
      location,
      direction,
      brokenSince,
      description,
      quantity,
      length,
      height,
      unit,
      voiceNoteDuration,
    } = req.body;

    if (!problemName || !problemName.trim()) {
      return res.status(400).json({ message: "Problem name is required." });
    }

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
      quantity: toNumberOrNull(quantity),
      length: toNumberOrNull(length),
      height: toNumberOrNull(height),
      unit: VALID_UNITS.includes(unit) ? unit : "ft",
      photos: [],
      voiceNote: {},
      status: "open",
    };

    const photoFiles = req.files?.photos || [];
    const voiceFile = req.files?.voiceNote?.[0];

    if (photoFiles.length) {
      const uploads = await Promise.all(
        photoFiles.map((file) =>
          uploadBufferToCloudinary(file.buffer, {
            folder: "inspection-reports/photos",
            resourceType: "image",
          }),
        ),
      );
      issue.photos = uploads.map((u) => ({ url: u.secure_url, publicId: u.public_id }));
    }

    if (voiceFile) {
      const uploaded = await uploadBufferToCloudinary(voiceFile.buffer, {
        folder: "inspection-reports/voice-notes",
        resourceType: "video",
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
// (Whole-issue delete stays draft-only — evidence on a submitted report
// shouldn't disappear entirely; individual photos can still be removed
// via updateIssue's removePhotoIds.)
const deleteIssue = async (req, res) => {
  const report = await InspectionReport.findOne({
    _id: req.params.reportId,
    reportedBy: req.user._id,
    status: "draft",
  });
  if (!report) return res.status(404).json({ message: "Draft report not found." });

  const issue = report.issues.id(req.params.issueId);
  if (issue) {
    await Promise.all([
      ...(issue.photos || []).map((p) => deleteFromCloudinary(p.publicId, "image")),
      issue.voiceNote?.publicId ? deleteFromCloudinary(issue.voiceNote.publicId, "video") : Promise.resolve(),
    ]);
  }

  report.issues = report.issues.filter((i) => String(i._id) !== req.params.issueId);
  await report.save();

  res.json(report);
};

// PATCH /api/inspection-reports/:reportId/issues/:issueId
// Now allowed for: owning teacher (draft OR submitted-unlocked), or admin (submitted-unlocked).
const updateIssue = async (req, res) => {
  try {
    const { report, error } = await getEditableReport(req.params.reportId, req.user);
    if (error) return res.status(error.status).json({ message: error.message });

    const issue = report.issues.id(req.params.issueId);
    if (!issue) return res.status(404).json({ message: "Issue not found." });

    const {
      problemName,
      location,
      direction,
      brokenSince,
      description,
      quantity,
      length,
      height,
      unit,
      voiceNoteDuration,
      removePhotoIds,
      removeVoiceNote,
    } = req.body;

    if (!problemName || !problemName.trim()) {
      return res.status(400).json({ message: "Problem name is required." });
    }

    issue.problemName = problemName.trim();
    issue.location = (location || "").trim();
    issue.direction = (direction || "").trim();
    issue.brokenSince = (brokenSince || "").trim();
    issue.description = (description || "").trim();
    if (quantity !== undefined) issue.quantity = toNumberOrNull(quantity);
    if (length !== undefined) issue.length = toNumberOrNull(length);
    if (height !== undefined) issue.height = toNumberOrNull(height);
    if (unit !== undefined && VALID_UNITS.includes(unit)) issue.unit = unit;

    // ------------------------------------
    // Remove selected existing photos
    // ------------------------------------
    if (removePhotoIds) {
      let idsToRemove = [];
      try {
        idsToRemove = JSON.parse(removePhotoIds);
      } catch {
        idsToRemove = [];
      }

      if (Array.isArray(idsToRemove) && idsToRemove.length) {
        const toDelete = (issue.photos || []).filter((p) => idsToRemove.includes(p.publicId));
        await Promise.all(toDelete.map((p) => deleteFromCloudinary(p.publicId, "image")));
        issue.photos = (issue.photos || []).filter((p) => !idsToRemove.includes(p.publicId));
      }
    }

    // ------------------------------------
    // Add new photos
    // ------------------------------------
    const newPhotoFiles = req.files?.photos || [];
    if (newPhotoFiles.length) {
      const uploads = await Promise.all(
        newPhotoFiles.map((file) =>
          uploadBufferToCloudinary(file.buffer, {
            folder: "inspection-reports/photos",
            resourceType: "image",
          }),
        ),
      );
      issue.photos = [
        ...(issue.photos || []),
        ...uploads.map((u) => ({ url: u.secure_url, publicId: u.public_id })),
      ];
    }

    // ------------------------------------
    // Voice note: remove or replace
    // ------------------------------------
    if (removeVoiceNote === "true" && issue.voiceNote?.publicId) {
      await deleteFromCloudinary(issue.voiceNote.publicId, "video");
      issue.voiceNote = {};
    }

    const voiceFile = req.files?.voiceNote?.[0];
    if (voiceFile) {
      if (issue.voiceNote?.publicId) {
        await deleteFromCloudinary(issue.voiceNote.publicId, "video");
      }
      const uploadedVoice = await uploadBufferToCloudinary(voiceFile.buffer, {
        folder: "inspection-reports/voice-notes",
        resourceType: "video",
      });
      issue.voiceNote = {
        url: uploadedVoice.secure_url,
        publicId: uploadedVoice.public_id,
        durationSeconds: Number(voiceNoteDuration) || Math.round(uploadedVoice.duration || 0),
      };
    }

    await report.save();

    const populated = await InspectionReport.findById(report._id).populate("reportedBy", "name email");
    return res.json(populated);
  } catch (error) {
    console.error("updateIssue error:", error);
    return res.status(500).json({ message: "Could not update this issue." });
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
const deleteReport = async (req, res) => {
  try {
    if (!requireAdmin(req, res)) return;

    const report = await InspectionReport.findById(req.params.id);
    if (!report) {
      return res.status(404).json({ message: "Inspection report not found." });
    }

    const cloudinaryDeleteTasks = [];
    for (const issue of report.issues || []) {
      for (const photo of issue.photos || []) {
        if (photo.publicId) cloudinaryDeleteTasks.push(deleteFromCloudinary(photo.publicId, "image"));
      }
      if (issue.voiceNote?.publicId) {
        cloudinaryDeleteTasks.push(deleteFromCloudinary(issue.voiceNote.publicId, "video"));
      }
    }

    await Promise.all(cloudinaryDeleteTasks);
    await InspectionReport.findByIdAndDelete(req.params.id);

    res.json({
      message: "Inspection report and its files deleted successfully.",
      reportId: req.params.id,
    });
  } catch (error) {
    console.error("deleteReport error:", error);
    res.status(500).json({ message: "Could not delete inspection report." });
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

// PATCH /api/inspection-reports/:id/lock  { locked: true|false }
const setReportLock = async (req, res) => {
  if (!requireAdmin(req, res)) return;

  const report = await InspectionReport.findById(req.params.id);
  if (!report) return res.status(404).json({ message: "Report not found." });

  if (report.status !== "submitted") {
    return res.status(400).json({ message: "Only submitted reports can be locked." });
  }

  const locked = Boolean(req.body.locked);
  report.locked = locked;
  report.lockedBy = locked ? req.user._id : undefined;
  report.lockedAt = locked ? new Date() : undefined;
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
// GET /api/inspection-reports/:id/pdf
const downloadReportPdf = async (req, res) => {
  try {
    if (!requireAdmin(req, res)) return;

    const report = await InspectionReport.findById(req.params.id).populate("reportedBy", "name email");
    if (!report) return res.status(404).json({ message: "Report not found." });

    // Photo downloads + PDF generation can legitimately take a while for
    // reports with many issues — don't let Node's default socket timeout
    // kill the connection partway through.
    req.setTimeout(0);
    res.setTimeout(0);

    const doc = new PDFDocument({ margin: 50, autoFirstPage: true });

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="inspection-${report.reportedBy?.name || "report"}-${report._id}.pdf"`,
    );

    doc.pipe(res);
    await appendReportToPdf(doc, report);
    doc.end();
  } catch (error) {
    console.error("downloadReportPdf error:", error);
    if (!res.headersSent) {
      res.status(500).json({ message: "Could not generate PDF." });
    } else {
      res.end();
    }
  }
};

// POST /api/inspection-reports/bulk-pdf   body: { reportIds: [...] }
const downloadReportsBulkPdf = async (req, res) => {
  try {
    if (!requireAdmin(req, res)) return;

    const { reportIds } = req.body;

    if (
      !Array.isArray(reportIds) ||
      reportIds.length === 0
    ) {
      return res.status(400).json({
        message:
          "Select at least one report to download.",
      });
    }

    // ========================================================
    // REMOVE DUPLICATES
    // ========================================================

    const uniqueReportIds = [
      ...new Set(
        reportIds.map((id) =>
          String(id)
        )
      ),
    ];

    // ========================================================
    // FETCH REPORTS
    // ========================================================

    const reports =
      await InspectionReport.find({
        _id: {
          $in: uniqueReportIds,
        },
        status: "submitted",
      }).populate(
        "reportedBy",
        "name email"
      );

    if (!reports.length) {
      return res.status(404).json({
        message:
          "No matching reports found.",
      });
    }

    // ========================================================
    // PRESERVE SELECTED ORDER
    // ========================================================

    const orderMap = new Map(
      uniqueReportIds.map(
        (id, index) => [
          String(id),
          index,
        ]
      )
    );

    reports.sort(
      (a, b) =>
        (orderMap.get(
          String(a._id)
        ) ?? 0) -
        (orderMap.get(
          String(b._id)
        ) ?? 0)
    );

    // ========================================================
    // DISABLE TIMEOUT
    // ========================================================

    req.setTimeout(0);
    res.setTimeout(0);

    // ========================================================
    // CREATE PDF
    // ========================================================

    const doc =
      new PDFDocument({
        margin: 50,
        autoFirstPage: true,
      });

    // ========================================================
    // RESPONSE
    // ========================================================

    res.setHeader(
      "Content-Type",
      "application/pdf"
    );

    res.setHeader(
      "Content-Disposition",
      `attachment; filename="inspection-reports-${Date.now()}.pdf"`
    );

    res.setHeader(
      "Cache-Control",
      "no-store"
    );

    doc.pipe(res);

    // ========================================================
    // ⭐ HEADER ONLY ONCE
    // ========================================================

    drawBulkPdfHeader(doc);

    // ========================================================
    // PREFETCH IMAGES
    // ========================================================

    const imageMaps =
      await Promise.all(
        reports.map((report) =>
          prefetchReportImages(
            report
          )
        )
      );

    // ========================================================
    // RENDER REPORTS
    // ========================================================

    for (
      let i = 0;
      i < reports.length;
      i++
    ) {
      const report =
        reports[i];

      // ------------------------------------------------------
      // Every report after first = new page
      // ------------------------------------------------------

      if (i > 0) {
        doc.addPage();
      }

      try {
        await appendReportToPdf(
          doc,
          report,
          imageMaps[i]
        );
      } catch (reportError) {
        console.error(
          `Bulk PDF: failed to render report ${report._id}:`,
          reportError.message
        );

        doc
          .font("Helvetica")
          .fontSize(10)
          .fillColor("#dc2626")
          .text(
            "Could not render this report."
          );
      }
    }

    // ========================================================
    // END PDF
    // ========================================================

    doc.end();
  } catch (error) {
    console.error(
      "downloadReportsBulkPdf error:",
      error
    );

    if (!res.headersSent) {
      return res.status(500).json({
        message:
          "Could not generate combined PDF.",
      });
    }

    res.end();
  }
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
  setReportLock,
  downloadReportPdf,       
  downloadReportsBulkPdf,   
};
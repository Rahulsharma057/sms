const express = require("express");
const {
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
} = require("../controllers/inspectionReportController");
const { protect } = require("../middleware/auth");
const inspectionUpload = require("../middleware/inspectionUpload");

const router = express.Router();

router.use(protect);

const issueFileFields = inspectionUpload.fields([
  { name: "photos", maxCount: 6 },
  { name: "voiceNote", maxCount: 1 },
]);

// Static routes before /:id
router.get("/mine/draft", getMyDraft);
router.get("/mine/history", getMyHistory);
router.get("/summary", getSummary);
router.get("/", getAllReports);
router.post("/bulk-pdf", downloadReportsBulkPdf);

router.post("/issues", issueFileFields, addIssue);

router.get("/:id", getReportById);
router.get("/:id/pdf", downloadReportPdf);
router.delete("/:id", deleteReport);
router.patch("/:id/lock", setReportLock);

router.delete("/:reportId/issues/:issueId", deleteIssue);
router.patch("/:reportId/issues/:issueId", issueFileFields, updateIssue);
router.post("/:reportId/submit", submitReport);
router.patch("/:reportId/issues/:issueId/status", updateIssueStatus);

module.exports = router;
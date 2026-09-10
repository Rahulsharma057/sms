const express = require("express");
const {
  getMyDraft,
  getMyHistory,
  addIssue,
  deleteIssue,  updateIssue,
  submitReport,
  getAllReports,
  getReportById,
  updateIssueStatus,
  getSummary, deleteReport,
} = require("../controllers/inspectionReportController");
const { protect } = require("../middleware/auth");
const inspectionUpload = require("../middleware/inspectionUpload");

const router = express.Router();

router.use(protect);

// Static routes before /:id
router.get("/mine/draft", getMyDraft);
router.get("/mine/history", getMyHistory);
router.get("/summary", getSummary);
router.get("/", getAllReports);

router.post(
  "/issues",
  inspectionUpload.fields([
    { name: "photo", maxCount: 1 },
    { name: "voiceNote", maxCount: 1 },
  ]),
  addIssue,
);

router.get("/:id", getReportById);

router.delete("/:id", deleteReport);
router.delete("/:reportId/issues/:issueId", deleteIssue);
router.patch(
  "/:reportId/issues/:issueId",
  inspectionUpload.fields([
    { name: "photo", maxCount: 1 },
    { name: "voiceNote", maxCount: 1 },
  ]),
  updateIssue
);
router.post("/:reportId/submit", submitReport);
router.patch("/:reportId/issues/:issueId/status", updateIssueStatus);

module.exports = router;
const express = require("express");
const {
  createReport, getTodayReport, getMyReports, getAllReports, getReportById,
  updateCheckStatus, getIssuesSummary, getIssuesList, deleteReport,
} = require("../controllers/reportController");
const { protect, isSuperAdmin } = require("../middleware/auth");

const router = express.Router();

router.use(protect);
router.post("/", createReport);
router.get("/today", getTodayReport);

//  aur /mine, /:id se PEHLE hone chahiye warna Express unhe id samajh lega
router.get("/issues/summary", isSuperAdmin, getIssuesSummary);
router.get("/issues", isSuperAdmin, getIssuesList);
router.get("/mine", getMyReports);
router.get("/", isSuperAdmin, getAllReports);
router.get("/:id", getReportById);

router.patch("/:id/check-status", isSuperAdmin, updateCheckStatus);
router.delete("/:id", isSuperAdmin, deleteReport);

module.exports = router;
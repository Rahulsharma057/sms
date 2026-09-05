const express = require("express");
const {
  createReport,
  getReportTemplate,
  updateReportTemplate,
  getTodayReport,
  getMyReports,
  getAllReports,
  getReportById,
  updateCheckStatus,
  updateReport,
  getIssuesSummary,
  getIssuesList,
  deleteReport,
} = require("../controllers/reportController");
const { protect } = require("../middleware/auth");

const router = express.Router();

const allowAdmin = (req, res, next) => {
  const role = String(req.user?.role || "").toLowerCase();
  if (!["admin", "superadmin"].includes(role)) {
    return res.status(403).json({ message: "Admin access required" });
  }
  next();
};

router.use(protect);

// Static routes must stay before /:id.
router.get("/template", getReportTemplate);
router.put("/template", allowAdmin, updateReportTemplate);
router.get("/today", getTodayReport);
router.get("/issues/summary", allowAdmin, getIssuesSummary);
router.get("/issues", allowAdmin, getIssuesList);
router.get("/mine", getMyReports);
router.get("/", allowAdmin, getAllReports);

router.get("/:id", getReportById);
router.patch("/:id/check-status", allowAdmin, updateCheckStatus);
router.patch("/:id", allowAdmin, updateReport);
router.delete("/:id", allowAdmin, deleteReport);

router.post("/", createReport);

module.exports = router;

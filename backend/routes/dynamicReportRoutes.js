const express = require("express");
const {
  createDynamicReport,
  updateDynamicReport,
  deleteDynamicReport,
  getAllDynamicReports,
  getDynamicReportById,
  getVisibleDynamicReports,
  getDynamicReportForFilling,
  submitDynamicReportEntry,
  getMyDynamicReportEntries,
  getDynamicReportEntries,
  exportDynamicReportEntriesPdf,
  deleteDynamicReportEntry,
} = require("../controllers/dynamicReportController");
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

// Static routes before /:id
router.get("/visible", getVisibleDynamicReports);
router.get("/mine", getMyDynamicReportEntries);
router.get("/", allowAdmin, getAllDynamicReports);
router.post("/", allowAdmin, createDynamicReport);

router.get("/:id", allowAdmin, getDynamicReportById);
router.patch("/:id", allowAdmin, updateDynamicReport);
router.delete("/:id", allowAdmin, deleteDynamicReport);

router.get("/:id/fill", getDynamicReportForFilling);
router.post("/:id/submit", submitDynamicReportEntry);
router.get("/:id/entries", allowAdmin, getDynamicReportEntries);
router.get("/:id/entries/pdf", allowAdmin, exportDynamicReportEntriesPdf);
router.delete("/:id/entries/:entryId", allowAdmin, deleteDynamicReportEntry);

module.exports = router;
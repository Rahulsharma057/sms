const express = require("express");
const {
  createReport, getTodayReport, getMyReports, getAllReports, getReportById,
} = require("../controllers/reportController");
const { protect, isSuperAdmin } = require("../middleware/auth");

const router = express.Router();

router.use(protect);
router.post("/", createReport);
router.get("/today", getTodayReport);   // ⚠️ /:id se pehle honi chahiye
router.get("/mine", getMyReports);
router.get("/", isSuperAdmin, getAllReports);
router.get("/:id", getReportById);

module.exports = router;
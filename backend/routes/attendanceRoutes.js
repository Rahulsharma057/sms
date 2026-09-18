const express = require("express");
const {
  getAttendanceStatus, markAttendance, updateAttendance,
  getAllAttendance, getMyAttendanceHistory, getDailySheet, getMyBatchesStatus,
} = require("../controllers/attendanceController");
const { protect, isSuperAdmin } = require("../middleware/auth");

const router = express.Router();
router.use(protect);

router.get("/status", getAttendanceStatus);
router.get("/mine", getMyAttendanceHistory);
router.get("/daily-sheet", isSuperAdmin, getDailySheet); // ⚠️ /:id se pehle nahi lagega kyunki koi /:id route hi nahi
router.get("/", isSuperAdmin, getAllAttendance);
router.post("/", markAttendance);
router.put("/:id", updateAttendance);
router.get("/my-status", getMyBatchesStatus); 
module.exports = router;
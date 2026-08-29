const express = require("express");
const {
  createNotice, updateNotice, deleteNotice,
  getAllNotices, getActiveNotices, getNoticeById,
} = require("../controllers/noticeController");
const { protect, isSuperAdmin } = require("../middleware/auth");

const router = express.Router();

router.use(protect);

// ⚠️ /active, /:id se PEHLE hona chahiye warna Express "active" ko id samajh lega
router.get("/active", getActiveNotices);

router.post("/", isSuperAdmin, createNotice);
router.get("/", isSuperAdmin, getAllNotices);
router.get("/:id", getNoticeById);
router.patch("/:id", isSuperAdmin, updateNotice);
router.delete("/:id", isSuperAdmin, deleteNotice);

module.exports = router;
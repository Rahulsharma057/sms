
const express = require("express");

const {
  getMyNotifications,
  getUnreadCount,
  markAsRead,
  markAllAsRead, subscribeToPush,
} = require("../controllers/notificationController");

const { protect } = require("../middleware/auth");

const router = express.Router();

// All notification routes require login
router.use(protect);

// Get current user's notifications
router.get("/", getMyNotifications);

// Get unread notification count
router.get("/unread-count", getUnreadCount);

// Mark all notifications as read
router.patch("/read-all", markAllAsRead);

// Mark single notification as read
router.patch("/:id/read", markAsRead);
router.post("/push/subscribe", subscribeToPush);
module.exports = router;

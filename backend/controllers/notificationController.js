const Notification = require("../models/Notification");
const User = require("../models/User");
// ======================================================
// GET /api/notifications
// Get current user's notifications
// ======================================================
const getMyNotifications = async (req, res) => {
  try {
    const notifications = await Notification.find({
      recipient: req.user._id,
    })
      .populate("task", "title status")
      .populate("notice", "title subtitle type isActive")
      .sort({ createdAt: -1 })
      .limit(50);

    res.json(notifications);
  } catch (err) {
    console.error("getMyNotifications error:", err);

    res.status(500).json({
      message: "Could not load notifications",
    });
  }
};

// ======================================================
// GET /api/notifications/unread-count
// Get unread notification count
// ======================================================
const getUnreadCount = async (req, res) => {
  try {
    const count = await Notification.countDocuments({
      recipient: req.user._id,
      isRead: false,
    });

    res.json({
      count,
    });
  } catch (err) {
    console.error("getUnreadCount error:", err);

    res.status(500).json({
      message: "Could not get unread notification count",
    });
  }
};

// ======================================================
// PATCH /api/notifications/:id/read
// Mark single notification as read
// ======================================================
const markAsRead = async (req, res) => {
  try {
    const notification = await Notification.findOneAndUpdate(
      {
        _id: req.params.id,
        recipient: req.user._id,
      },
      {
        $set: {
          isRead: true,
        },
      },
      {
        new: true,
      },
    ).populate("task", "title status");

    if (!notification) {
      return res.status(404).json({
        message: "Notification not found",
      });
    }

    res.json(notification);
  } catch (err) {
    console.error("markAsRead error:", err);

    res.status(500).json({
      message: "Could not mark notification as read",
    });
  }
};

// ======================================================
// PATCH /api/notifications/read-all
// Mark all current user's notifications as read
// ======================================================
const markAllAsRead = async (req, res) => {
  try {
    await Notification.updateMany(
      {
        recipient: req.user._id,
        isRead: false,
      },
      {
        $set: {
          isRead: true,
        },
      },
    );

    res.json({
      ok: true,
      message: "All notifications marked as read",
    });
  } catch (err) {
    console.error("markAllAsRead error:", err);

    res.status(500).json({
      message: "Could not mark all notifications as read",
    });
  }
};
const subscribeToPush = async (req, res) => {
  try {
    const subscription = req.body;
    if (!subscription?.endpoint) {
      return res.status(400).json({ message: "Invalid push subscription" });
    }
    await User.findByIdAndUpdate(
      req.user._id,
      { $set: { pushSubscription: subscription } },
      { new: true },
    );
    res.json({
      success: true,
      message: "Push subscription saved successfully",
    });
  } catch (err) {
    console.error("subscribeToPush error:", err);
    res.status(500).json({ message: "Could not save push subscription" });
  }
}; // ======================================================
// DELETE /api/notifications/:id
// Delete current user's single notification
// ======================================================
const deleteNotification = async (req, res) => {
  try {
    const { id } = req.params;

    // Sirf wahi notification delete hogi
    // jo currently logged-in user ki hai
    const notification = await Notification.findOneAndDelete({
      _id: id,
      recipient: req.user._id,
    });

    if (!notification) {
      return res.status(404).json({
        success: false,
        message: "Notification not found",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Notification deleted successfully",
    });
  } catch (error) {
    console.error("deleteNotification error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to delete notification",
    });
  }
};
module.exports = {
  getMyNotifications,
  getUnreadCount,
  markAsRead,
  markAllAsRead,
  subscribeToPush,
  deleteNotification,
};

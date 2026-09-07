const Notification = require("../models/Notification");
const User = require("../models/User");
const { sendPushNotification } = require("./pushService");

// Maps each Notification "type" to a mute-able category.
const NOTIFICATION_CATEGORY_MAP = {
  NEW_TASK: "TASK",
  TASK_STATUS: "TASK",
  NEW_MESSAGE: "TASK",
  NEW_NOTICE: "NOTICE",
  NEW_DYNAMIC_REPORT: "REPORT",
  DYNAMIC_REPORT_SUBMITTED: "REPORT",
  NEW_FORM: "FORM",
};

const createNotification = async ({
  recipient,
  type,
  title,
  message,
  task = null,
  notice = null,
  dynamicReport = null,
  form = null,
}) => {
  try {
    // ==========================================
    // 1. CHECK IF THIS CATEGORY IS MUTED
    // ==========================================

    const user = await User.findById(recipient).select(
      "pushSubscription notificationPreferences"
    );

    const category = NOTIFICATION_CATEGORY_MAP[type];
    const mutedTypes = user?.notificationPreferences?.mutedTypes || [];

    if (category && mutedTypes.includes(category)) {
      console.log(`🔇 Skipping ${type} notification — user has muted ${category}`);
      return null;
    }

    // ==========================================
    // 2. SAVE NOTIFICATION IN DATABASE
    // ==========================================

    const notification = await Notification.create({
      recipient,
      type,
      title,
      message,
      task,
      notice,
      dynamicReport,
      form,
    });

    // ==========================================
    // 3. SEND PHONE / BROWSER PUSH
    // ==========================================

    if (user?.pushSubscription?.endpoint) {
      await sendPushNotification(user.pushSubscription, {
        title,
        body: message,

        notificationId: notification._id.toString(),

        taskId: task ? task.toString() : null,

        noticeId: notice ? notice.toString() : null,

        type,

        url: task
          ? `/tasks/${task}`
          : notice
            ? `/notices/${notice}`
            : "/notifications",
      });
    } else {
      console.log(`ℹ️ User ${recipient} has no push subscription`);
    }

    return notification;
  } catch (error) {
    console.error("createNotification error:", error);
    return null;
  }
};

module.exports = {
  createNotification,
};
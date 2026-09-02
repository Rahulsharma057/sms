const Notification = require("../models/Notification");
const User = require("../models/User");
const { sendPushNotification } = require("./pushService");

const createNotification = async ({
  recipient,
  type,
  title,
  message,
  task = null,
  notice = null,
}) => {
  try {
    // ==========================================
    // 1. SAVE NOTIFICATION IN DATABASE
    // ==========================================

    const notification = await Notification.create({
      recipient,
      type,
      title,
      message,
      task,
      notice,
    });

    // ==========================================
    // 2. FIND RECIPIENT
    // ==========================================

    const user = await User.findById(recipient).select("pushSubscription");

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

    // Notification fail hone par
    // main operation fail nahi hoga.
    return null;
  }
};

module.exports = {
  createNotification,
};

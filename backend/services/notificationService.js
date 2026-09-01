
const Notification = require("../models/Notification");
const User = require("../models/User");
const { sendPushNotification } = require("./pushService");

const createNotification = async ({
  recipient,
  type,
  title,
  message,
  task = null,
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
    });

    // ==========================================
    // 2. FIND RECIPIENT
    // ==========================================

    const user = await User.findById(recipient).select(
      "pushSubscription"
    );

    // ==========================================
    // 3. SEND PHONE PUSH NOTIFICATION
    // ==========================================

    if (user?.pushSubscription?.endpoint) {
      await sendPushNotification(
        user.pushSubscription,
        {
          title,
          body: message,

          // Data frontend ko milega
          notificationId: notification._id.toString(),

          taskId: task ? task.toString() : null,

          type,

          url: task
            ? `/tasks/${task}`
            : "/notifications",
        }
      );
    } else {
      console.log(
        `ℹ️ User ${recipient} has no push subscription`
      );
    }

    return notification;
  } catch (error) {
    console.error(
      "createNotification error:",
      error
    );

    // Notification fail hone ki wajah se
    // main task operation fail nahi hona chahiye.
    return null;
  }
};

module.exports = {
  createNotification,
};


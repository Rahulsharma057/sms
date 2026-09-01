
const webpush = require("web-push");

webpush.setVapidDetails(
  process.env.VAPID_SUBJECT,
  process.env.VAPID_PUBLIC_KEY,
  process.env.VAPID_PRIVATE_KEY
);

/**
 * Send Web Push notification
 */
const sendPushNotification = async (subscription, payload) => {
  if (!subscription?.endpoint) {
    return;
  }

  try {
    await webpush.sendNotification(
      subscription,
      JSON.stringify(payload)
    );

    console.log("✅ Push notification sent");
  } catch (error) {
    console.error(
      "❌ Push notification error:",
      error.statusCode,
      error.body || error.message
    );

    // Subscription expired / invalid
    if (
      error.statusCode === 404 ||
      error.statusCode === 410
    ) {
      console.log("⚠️ Push subscription expired or invalid");
    }
  }
};

module.exports = {
  sendPushNotification,
};

const urlBase64ToUint8Array = (base64String) => {
  const padding = "=".repeat(
    (4 - (base64String.length % 4)) % 4
  );

  const base64 = (
    base64String + padding
  )
    .replace(/-/g, "+")
    .replace(/_/g, "/");

  const rawData = window.atob(base64);

  return Uint8Array.from(
    [...rawData].map((char) => char.charCodeAt(0))
  );
};


export const registerPushNotifications = async (api) => {
  try {
    if (
      typeof window === "undefined" ||
      !("serviceWorker" in navigator) ||
      !("PushManager" in window) ||
      !("Notification" in window)
    ) {
      console.log(
        "Push notifications are not supported."
      );

      return false;
    }

    // ==========================================
    // REGISTER SERVICE WORKER
    // ==========================================

    const registration =
      await navigator.serviceWorker.register("/sw.js");

    console.log(
      "✅ Service Worker registered:",
      registration
    );

    // ==========================================
    // ASK NOTIFICATION PERMISSION
    // ==========================================

    let permission = Notification.permission;

    if (permission === "default") {
      permission =
        await Notification.requestPermission();
    }

    if (permission !== "granted") {
      console.log(
        "❌ Notification permission denied."
      );

      return false;
    }

    // ==========================================
    // CHECK EXISTING SUBSCRIPTION
    // ==========================================

    let subscription =
      await registration.pushManager.getSubscription();

    // ==========================================
    // CREATE SUBSCRIPTION
    // ==========================================

    if (!subscription) {
      const publicKey =
        process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;

      if (!publicKey) {
        console.error(
          "❌ NEXT_PUBLIC_VAPID_PUBLIC_KEY missing"
        );

        return false;
      }

      subscription =
        await registration.pushManager.subscribe({
          userVisibleOnly: true,

          applicationServerKey:
            urlBase64ToUint8Array(publicKey),
        });
    }

    // ==========================================
    // SAVE SUBSCRIPTION TO BACKEND
    // ==========================================

    await api.post(
      "/notifications/push/subscribe",
      subscription.toJSON()
    );

    console.log(
      "✅ Push subscription saved."
    );

    return true;
  } catch (error) {
    console.error(
      "❌ Push notification setup failed:",
      error
    );

    return false;
  }
};
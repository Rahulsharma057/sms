"use client";

import { useEffect } from "react";
import { useAuth } from "../context/AuthContext";
import api from "../lib/api";
import { registerPushNotifications } from "../lib/pushNotifications";

export default function PushNotificationSetup() {
  const { user } = useAuth();

  useEffect(() => {
    if (!user) return;

    registerPushNotifications(api);
  }, [user]);

  return null;
}
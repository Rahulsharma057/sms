
"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
} from "react";

import { useRouter } from "next/navigation";

import api from "../lib/api";
import { registerPushNotifications } from "../lib/pushNotifications";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const router = useRouter();

  // ======================================================
  // LOAD LOGGED-IN USER
  // ======================================================

  useEffect(() => {
    const load = async () => {
      const token =
        typeof window !== "undefined"
          ? localStorage.getItem("token")
          : null;

      if (!token) {
        setLoading(false);
        return;
      }

      try {
        const { data } = await api.get("/auth/me");

        setUser(data.user);
      } catch {
        localStorage.removeItem("token");
      } finally {
        setLoading(false);
      }
    };

    load();
  }, []);

  // ======================================================
  // PUSH NOTIFICATION SETUP
  // Runs automatically after user is available
  // ======================================================

  useEffect(() => {
    if (!user) return;

    const setupPushNotifications = async () => {
      try {
        await registerPushNotifications(api);

        console.log(
          "✅ Push notification setup completed"
        );
      } catch (error) {
        console.error(
          "❌ Push notification setup failed:",
          error
        );
      }
    };

    setupPushNotifications();
  }, [user]);

  // ======================================================
  // LOGIN
  // ======================================================

  const login = async (email, password) => {
    const { data } = await api.post("/auth/login", {
      email,
      password,
    });

    localStorage.setItem("token", data.token);

    setUser(data.user);

    // Push notification setup will automatically
    // run because user state changes above.

    if (data.user.role === "superadmin") {
      router.push("/admin/dashboard");
    } else {
      router.push("/teacher/dashboard");
    }
  };

  // ======================================================
  // LOGOUT
  // ======================================================

  const logout = async () => {
    try {
      await api.post("/auth/logout");
    } catch {}

    localStorage.removeItem("token");

    setUser(null);

    router.push("/login");
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        setUser,
        loading,
        login,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);

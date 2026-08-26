"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Box, CircularProgress } from "@mui/material";
import { useAuth } from "../context/AuthContext";

export default function ProtectedRoute({ role, children }) {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    if (!user) {
      router.replace("/login");
    } else if (role && user.role !== role) {
      router.replace(user.role === "superadmin" ? "/admin/dashboard" : "/teacher/dashboard");
    }
  }, [user, loading, role, router]);

  if (loading || !user || (role && user.role !== role)) {
    return (
      <Box sx={{ display: "flex", justifyContent: "center", alignItems: "center", height: "100vh" }}>
        <CircularProgress />
      </Box>
    );
  }

  return children;
}

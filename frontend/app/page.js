"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "../context/AuthContext";
import { Box, CircularProgress, Typography, Stack } from "@mui/material";
import { SchoolOutlined } from "@mui/icons-material";

export default function Home() {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    if (!user) router.replace("/login");
    else if (user.role === "superadmin") router.replace("/admin/reports");
    else router.replace("/teacher/dashboard");
  }, [user, loading, router]);

  return (
    <Box
      sx={{
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        minHeight: "100dvh",
        px: 2,
        bgcolor: "#F7F8FA",
      }}
    >
      <Stack
        spacing={{ xs: 2, sm: 2.5 }}
        alignItems="center"
        sx={{
          textAlign: "center",
          maxWidth: 280,
          width: "100%",
        }}
      >
        {/* Brand mark */}
        <Box
          sx={{
            width: { xs: 56, sm: 64 },
            height: { xs: 56, sm: 64 },
            borderRadius: "18px",
            bgcolor: "#6366F1",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            boxShadow: "0 8px 20px rgba(99, 102, 241, 0.25)",
          }}
        >
          <SchoolOutlined sx={{ color: "white", fontSize: { xs: 28, sm: 32 } }} />
        </Box>

        {/* Spinner + label */}
        <Box sx={{ position: "relative", display: "inline-flex" }}>
          <CircularProgress size={32} thickness={4} sx={{ color: "#6366F1" }} />
        </Box>

        <Typography
          variant="body2"
          sx={{ color: "text.secondary", fontWeight: 500, letterSpacing: 0.2 }}
        >
          Getting things ready…
        </Typography>
      </Stack>
    </Box>
  );
}
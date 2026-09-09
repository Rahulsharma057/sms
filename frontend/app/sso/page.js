"use client";

import { Suspense, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Box, CircularProgress, Typography, Stack } from "@mui/material";

/**
 * SSO handoff receiver for the Task & Report Management app.
 *
 * The Portal redirects here as:
 *   https://sms-ivory-pi.vercel.app/sso?token=<jwt>
 *
 * Stores the token the same way AuthContext's login() does, then hard-
 * redirects to "/" so AuthProvider's existing useEffect (GET /auth/me)
 * picks it up and routes the user to /admin/... or /teacher/... as normal.
 *
 * Install at: app/sso/page.js in the sms-ivory-pi project.
 */
function SsoReceiver() {
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    const token = searchParams.get("token");

    if (!token) {
      router.replace("/login");
      return;
    }

    localStorage.setItem("token", token);
    window.location.replace("/");
  }, [router, searchParams]);

  return (
    <Box
      sx={{
        minHeight: "100dvh",
        width: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        bgcolor: "#F7F8FA",
      }}
    >
      <Stack spacing={2} alignItems="center">
        <CircularProgress size={32} thickness={4} sx={{ color: "#6366F1" }} />
        <Typography variant="body2" sx={{ color: "text.secondary", fontWeight: 500 }}>
          Signing you in…
        </Typography>
      </Stack>
    </Box>
  );
}

export default function SsoReceiverPage() {
  return (
    <Suspense fallback={null}>
      <SsoReceiver />
    </Suspense>
  );
}

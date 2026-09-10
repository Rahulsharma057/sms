"use client";

import { Suspense, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Box, CircularProgress, Typography, Stack } from "@mui/material";

// The portal's own URL - used later to power the "Switch app" menu
// inside the app once the user is logged in via SSO.
const PORTAL_URL = "https://sso-portal-ten.vercel.app";

/**
 * SSO handoff receiver for the Task & Report Management app.
 *
 * The Portal redirects here as:
 *   https://sms-ivory-pi.vercel.app/sso?token=<jwt>
 *
 * Stores the token the same way AuthContext's login() does, PLUS a marker
 * that this session came from the portal - Navbar.js reads that marker to
 * decide whether to show the "Switch app" option.
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
    localStorage.setItem("sso_portal_url", PORTAL_URL);
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
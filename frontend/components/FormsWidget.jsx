"use client";

import { useEffect, useState } from "react";
import { Box, Paper, Typography, Stack, Button, CircularProgress } from "@mui/material";
import { DynamicForm, ArrowForward } from "@mui/icons-material";
import api from "../lib/api";

// Drop this component anywhere — e.g. teacher dashboard or a sidebar —
// to show the forms an admin has published and targeted to this user.
//
//   import FormsWidget from "../../components/FormsWidget";
//   ...
//   <FormsWidget />
//
export default function FormsWidget() {
  const [forms, setForms] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .get("/forms/visible")
      .then((res) => setForms(res.data || []))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <Paper elevation={0} sx={{ p: 2, border: "1px solid #e2e8f0", borderRadius: 2.5, display: "flex", justifyContent: "center" }}>
        <CircularProgress size={20} sx={{ color: "#7e22ce" }} />
      </Paper>
    );
  }

  if (forms.length === 0) return null; // nothing assigned — stay out of the way

  return (
    <Paper elevation={0} sx={{ p: 2, border: "1px solid #e2e8f0", borderRadius: 2.5 }}>
      <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1.5 }}>
        <DynamicForm sx={{ color: "#7e22ce", fontSize: 20 }} />
        <Typography fontWeight={700}>Forms for you</Typography>
      </Stack>
      <Stack spacing={1}>
        {forms.map((f) => (
          <Box
            key={f._id}
            sx={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              p: 1.2,
              borderRadius: 2,
              border: "1px solid #f1f5f9",
              "&:hover": { bgcolor: "#faf5ff" },
            }}
          >
            <Box sx={{ minWidth: 0 }}>
              <Typography fontWeight={600} fontSize="0.88rem" noWrap>
                {f.title}
              </Typography>
              {f.description && (
                <Typography variant="caption" color="text.secondary" noWrap sx={{ display: "block" }}>
                  {f.description}
                </Typography>
              )}
            </Box>
            <Button
              size="small"
              endIcon={<ArrowForward fontSize="small" />}
              href={`/forms/${f.slug}`}
              target="_blank"
              rel="noopener noreferrer"
              sx={{ textTransform: "none", flexShrink: 0, color: "#7e22ce" }}
            >
              Fill
            </Button>
          </Box>
        ))}
      </Stack>
    </Paper>
  );
}

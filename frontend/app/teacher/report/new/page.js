"use client";
import { Box } from "@mui/material";
import ProtectedRoute from "../../../../components/ProtectedRoute";
import Navbar from "../../../../components/Navbar";
import ChecklistForm from "../../../../components/ChecklistForm";

export default function NewReportPage() {
  return (
    <ProtectedRoute role="teacher">
      <Box>
        <Navbar />
        <ChecklistForm />
      </Box>
    </ProtectedRoute>
  );
}

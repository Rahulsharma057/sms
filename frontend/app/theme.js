"use client";
import { createTheme } from "@mui/material/styles";

const theme = createTheme({
  palette: {
    primary: { main: "#1e3a5f" },
    secondary: { main: "#2e7d32" },
    background: { default: "#f4f6f8" },
  },
  shape: { borderRadius: 10 },
  typography: {
    fontFamily: "'Inter', 'Roboto', 'Helvetica', 'Arial', sans-serif",
  },
  components: {
    MuiButton: { styleOverrides: { root: { textTransform: "none", fontWeight: 600 } } },
    MuiPaper: { styleOverrides: { root: { borderRadius: 12 } } },
  },
});

export default theme;

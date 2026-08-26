"use client";
import { useState } from "react";
import {
  Box, Paper, TextField, Button, Typography, Alert, InputAdornment, IconButton,
} from "@mui/material";
import { Visibility, VisibilityOff, School } from "@mui/icons-material";
import { useAuth } from "../../context/AuthContext";

export default function LoginPage() {
  const { login } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await login(email, password);
    } catch (err) {
      setError(err?.response?.data?.message || "Login failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box
      sx={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "linear-gradient(135deg, #1e3a5f 0%, #2e7d32 100%)",
        p: 2,
      }}
    >
      <Paper elevation={8} sx={{ p: { xs: 3, sm: 5 }, width: "100%", maxWidth: 420 }}>
        <Box sx={{ display: "flex", flexDirection: "column", alignItems: "center", mb: 3 }}>
          <School sx={{ fontSize: 44, color: "primary.main" }} />
          <Typography variant="h5" fontWeight={700} mt={1} textAlign="center">
            Duty Officer Checklist
          </Typography>
          <Typography variant="body2" color="text.secondary" textAlign="center">
            Sign in with your registered email
          </Typography>
        </Box>

        {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

        <Box component="form" onSubmit={handleSubmit}>
          <TextField
            label="Email"
            type="email"
            fullWidth
            required
            margin="normal"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <TextField
            label="Password"
            type={showPassword ? "text" : "password"}
            fullWidth
            required
            margin="normal"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            InputProps={{
              endAdornment: (
                <InputAdornment position="end">
                  <IconButton onClick={() => setShowPassword((s) => !s)} edge="end">
                    {showPassword ? <VisibilityOff /> : <Visibility />}
                  </IconButton>
                </InputAdornment>
              ),
            }}
          />
          <Button
            type="submit"
            fullWidth
            variant="contained"
            size="large"
            disabled={loading}
            sx={{ mt: 3, py: 1.3 }}
          >
            {loading ? "Signing in..." : "Login"}
          </Button>
        </Box>

        <Typography variant="caption" color="text.secondary" display="block" textAlign="center" mt={3}>
          Teachers: use the email/password given by your admin.
          <br />
          Forgot your password? Contact the Superadmin.
        </Typography>
      </Paper>
    </Box>
  );
}

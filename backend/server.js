require("dotenv").config();

const express = require("express");
const cors = require("cors");
const cookieParser = require("cookie-parser");
const connectDB = require("./config/db");

const authRoutes = require("./routes/authRoutes");
const userRoutes = require("./routes/userRoutes");
const reportRoutes = require("./routes/reportRoutes");
const taskRoutes = require("./routes/taskRoutes");
const noticeRoutes = require("./routes/noticeRoutes");
const notificationRoutes = require("./routes/notificationRoutes");
const app = express();

connectDB();

/* =========================
  CORS CONFIGURATION
========================= */

const allowedOrigins = [
process.env.CLIENT_URL,
"https://sms-ivory-pi.vercel.app",
"https://sms-5umg175jc-rahulsharma3-9031s-projects.vercel.app",
"http://localhost:3000",
"http://localhost:3001",
].filter(Boolean);

console.log("Allowed CORS origins:", allowedOrigins);

app.use(
cors({
  origin: (origin, callback) => {
    console.log("Request Origin:", origin);

    // Allow requests without Origin
    // Postman, server-to-server, health checks, etc.
    if (!origin) {
      return callback(null, true);
    }

    // Exact allowed origins
    if (allowedOrigins.includes(origin)) {
      console.log("✅ CORS allowed:", origin);
      return callback(null, true);
    }

    /*
      * Allow Vercel deployment URLs.
      *
      * This handles URLs such as:
      * https://sms-ivory-pi.vercel.app
      * https://sms-xxxxx-rahulsharma3-9031s-projects.vercel.app
      *
      * So a new Vercel deployment URL won't
      * immediately cause a CORS error.
      */
    if (
      origin.startsWith("https://sms-") &&
      origin.endsWith(".vercel.app")
    ) {
      console.log("✅ Vercel CORS allowed:", origin);
      return callback(null, true);
    }

    console.error("❌ CORS blocked:", origin);

    return callback(
      new Error(`Not allowed by CORS: ${origin}`)
    );
  },

  credentials: true,

  methods: [
    "GET",
    "POST",
    "PUT",
    "PATCH",
    "DELETE",
    "OPTIONS",
  ],

  allowedHeaders: [
    "Content-Type",
    "Authorization",
  ],
})
);

/* =========================
  MIDDLEWARE
========================= */

app.use(express.json());
app.use(cookieParser());

/* =========================
  HEALTH CHECK
========================= */
/* =========================
  HEALTH CHECK
========================= */

app.get("/health", (_req, res) => {
res.status(200).send("OK");
});

app.get("/api/health", (_req, res) => {
res.status(200).json({
  success: true,
  status: "ok",
  message: "SMS backend is running",
});
});

/* =========================
  ROUTES
========================= */

app.use("/api/auth", authRoutes);
app.use("/api/users", userRoutes);
app.use("/api/reports", reportRoutes);
app.use("/api/tasks", taskRoutes);
app.use("/api/notifications", notificationRoutes);
app.use("/api/forms", require("./routes/formRoutes"));
app.use("/api/notices", noticeRoutes);
app.use("/api/dynamic-reports", require("./routes/dynamicReportRoutes"));
/* =========================
  ERROR HANDLER
========================= */

app.use((err, req, res, next) => {
console.error("Server Error:", err);

res.status(err.status || 500).json({
  success: false,
  message: err.message || "Server error",
});
});

/* =========================
  SERVER
========================= */

const PORT = process.env.PORT || 5001;

app.listen(PORT, "0.0.0.0", () => {
console.log(`Server running on port ${PORT}`);
});
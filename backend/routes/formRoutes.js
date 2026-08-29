const express = require("express");
const {
  createForm,
  updateForm,
  deleteForm,
  getAllForms,
  getFormById,
  getVisibleForms,
  getPublicForm,
  submitResponse,
  getFormResponses,
} = require("../controllers/formController");
const { protect, isSuperAdmin } = require("../middleware/auth");

const router = express.Router();

// ---- Public routes — NO auth, this is what the QR/link points to ----
router.get("/public/:slug", getPublicForm);
router.post("/public/:slug/submit", submitResponse);

// ---- Everything below requires login ----
router.use(protect);

router.get("/visible", getVisibleForms); // for teacher dashboard / sidebar

router.post("/", isSuperAdmin, createForm);
router.get("/", isSuperAdmin, getAllForms);
router.get("/:id", isSuperAdmin, getFormById);
router.patch("/:id", isSuperAdmin, updateForm);
router.delete("/:id", isSuperAdmin, deleteForm);
router.get("/:id/responses", isSuperAdmin, getFormResponses);

module.exports = router;

// Reminder: mount this in your server entry file (e.g. server.js / app.js):
//   app.use("/api/forms", require("./routes/formRoutes"));

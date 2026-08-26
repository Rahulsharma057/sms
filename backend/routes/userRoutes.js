const express = require("express");
const {
  getTeachers,
  createTeacher,
  updateTeacher,
  deleteTeacher,
  toggleActive,
} = require("../controllers/userController");
const { protect, isSuperAdmin } = require("../middleware/auth");

const router = express.Router();

router.use(protect, isSuperAdmin);

router.get("/teachers", getTeachers);

router.post("/", createTeacher);

router.put("/:id", updateTeacher);

router.patch("/:id/toggle-active", toggleActive);

router.delete("/:id", deleteTeacher);

module.exports = router;
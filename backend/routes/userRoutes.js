const express = require("express");
const { getTeachers, createTeacher, toggleActive } = require("../controllers/userController");
const { protect, isSuperAdmin } = require("../middleware/auth");

const router = express.Router();

router.use(protect, isSuperAdmin);
router.get("/teachers", getTeachers);
router.post("/", createTeacher);
router.patch("/:id/toggle-active", toggleActive);

module.exports = router;

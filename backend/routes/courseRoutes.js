const express = require("express");
const { getCourses, createCourse, updateCourse, deleteCourse } = require("../controllers/courseController");
const { protect, isSuperAdmin } = require("../middleware/auth");

const router = express.Router();
router.use(protect);

router.get("/", getCourses);
router.post("/", isSuperAdmin, createCourse);
router.put("/:id", isSuperAdmin, updateCourse);
router.delete("/:id", isSuperAdmin, deleteCourse);

module.exports = router;
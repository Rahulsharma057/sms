const express = require("express");
const {
  createTask, getMyTasks, getAllTasks, getTaskById, updateStatus, addMessage,
} = require("../controllers/taskController");
const { protect, isSuperAdmin } = require("../middleware/auth");

const router = express.Router();

router.use(protect);
router.post("/", isSuperAdmin, createTask);
router.get("/mine", getMyTasks);
router.get("/", isSuperAdmin, getAllTasks);
router.get("/:id", getTaskById);
router.patch("/:id/status", updateStatus);
router.post("/:id/messages", addMessage);

module.exports = router;

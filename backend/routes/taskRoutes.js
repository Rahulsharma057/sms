const express = require("express");
const {
  createTask,
  getMyTasks,
  getAllTasks,
  getTaskById,
  updateStatus,
  addMessage,
  markMessagesSeen,
  deleteTask,
} = require("../controllers/taskController");
const { protect, isSuperAdmin } = require("../middleware/auth");

const router = express.Router();

router.use(protect);
router.post("/", isSuperAdmin, createTask);
router.get("/mine", getMyTasks);
router.get("/", isSuperAdmin, getAllTasks);
router.get("/:id", getTaskById);
router.delete("/:id", isSuperAdmin, deleteTask);
router.patch("/:id/status", updateStatus);
router.post("/:id/messages", addMessage);
router.patch("/:id/messages/seen", markMessagesSeen);

module.exports = router;

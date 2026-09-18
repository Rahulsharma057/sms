const express = require("express");
const {
  getBatches, getMyBatches, getBatchById, createBatch, updateBatch, deleteBatch,
} = require("../controllers/batchController");
const { protect, isSuperAdmin } = require("../middleware/auth");

const router = express.Router();
router.use(protect);

router.get("/mine", getMyBatches);
router.get("/", isSuperAdmin, getBatches);
router.post("/", isSuperAdmin, createBatch);
router.get("/:id", getBatchById);
router.put("/:id", isSuperAdmin, updateBatch);
router.delete("/:id", isSuperAdmin, deleteBatch);

module.exports = router;
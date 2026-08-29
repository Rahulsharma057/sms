const Notice = require("../models/Notice");

const VALID_TYPES = ["warning", "notice", "announcement", "update"];

const sanitizeTargeting = ({ targetType, targetUsers }) => {
  const type = targetType === "specific" ? "specific" : "all";
  const users = type === "specific" && Array.isArray(targetUsers) ? targetUsers : [];
  return { targetType: type, targetUsers: users };
};

const sanitizeType = (type) => (VALID_TYPES.includes(type) ? type : "notice");

// POST /api/notices  (superadmin)
const createNotice = async (req, res) => {
  const {
    title, subtitle, caption, information, type,
    buttonLabel, buttonUrl, isActive,
    targetType, targetUsers,
  } = req.body;

  if (!title || !title.trim()) {
    return res.status(400).json({ message: "Title is required." });
  }

  const { targetType: safeType, targetUsers: safeUsers } = sanitizeTargeting({ targetType, targetUsers });

  if (safeType === "specific" && safeUsers.length === 0) {
    return res.status(400).json({ message: "Select at least one user, or choose 'All users'." });
  }

  const notice = await Notice.create({
    title: title.trim(),
    subtitle,
    caption,
    information,
    type: sanitizeType(type),
    buttonLabel,
    buttonUrl,
    isActive: isActive !== undefined ? !!isActive : true,
    targetType: safeType,
    targetUsers: safeUsers,
    createdBy: req.user._id,
  });

  const populated = await notice.populate("targetUsers", "name email");
  res.status(201).json(populated);
};

// PATCH /api/notices/:id  (superadmin)
const updateNotice = async (req, res) => {
  const {
    title, subtitle, caption, information, type,
    buttonLabel, buttonUrl, isActive,
    targetType, targetUsers,
  } = req.body;

  const notice = await Notice.findById(req.params.id);
  if (!notice) return res.status(404).json({ message: "Notice not found" });

  if (title !== undefined) {
    if (!title.trim()) return res.status(400).json({ message: "Title cannot be empty." });
    notice.title = title.trim();
  }
  if (subtitle !== undefined) notice.subtitle = subtitle;
  if (caption !== undefined) notice.caption = caption;
  if (information !== undefined) notice.information = information;
  if (type !== undefined) notice.type = sanitizeType(type);
  if (buttonLabel !== undefined) notice.buttonLabel = buttonLabel;
  if (buttonUrl !== undefined) notice.buttonUrl = buttonUrl;
  if (isActive !== undefined) notice.isActive = !!isActive;

  if (targetType !== undefined || targetUsers !== undefined) {
    const { targetType: safeType, targetUsers: safeUsers } = sanitizeTargeting({
      targetType: targetType !== undefined ? targetType : notice.targetType,
      targetUsers: targetUsers !== undefined ? targetUsers : notice.targetUsers,
    });

    if (safeType === "specific" && safeUsers.length === 0) {
      return res.status(400).json({ message: "Select at least one user, or choose 'All users'." });
    }

    notice.targetType = safeType;
    notice.targetUsers = safeUsers;
  }

  await notice.save();
  const populated = await notice.populate("targetUsers", "name email");
  res.json(populated);
};

// DELETE /api/notices/:id  (superadmin)
const deleteNotice = async (req, res) => {
  const notice = await Notice.findById(req.params.id);
  if (!notice) return res.status(404).json({ message: "Notice not found" });

  await notice.deleteOne();
  res.json({ message: "Notice deleted successfully", id: req.params.id });
};

// GET /api/notices  (superadmin — sees all, active + inactive, any targeting)
// query: ?search=&type=&page=&limit=
const getAllNotices = async (req, res) => {
  const filter = {};

  if (req.query.search) {
    const regex = new RegExp(req.query.search.trim(), "i");
    filter.$or = [{ title: regex }, { subtitle: regex }, { information: regex }];
  }

  if (req.query.type && VALID_TYPES.includes(req.query.type)) {
    filter.type = req.query.type;
  }

  const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
  const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 10, 1), 100);
  const skip = (page - 1) * limit;

  const [notices, total] = await Promise.all([
    Notice.find(filter)
      .populate("createdBy", "name email")
      .populate("targetUsers", "name email")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit),
    Notice.countDocuments(filter),
  ]);

  res.json({
    notices,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.max(Math.ceil(total / limit), 1),
    },
  });
};

// GET /api/notices/active  (any authenticated user)
// Returns only notices visible to THIS user: targetType "all", or
// targetType "specific" where req.user._id is in targetUsers.
// query: ?search=&type=&page=&limit=&since= (ISO date, for notification polling)
const getActiveNotices = async (req, res) => {
  const filter = {
    isActive: true,
    $or: [
      { targetType: "all" },
      { targetType: "specific", targetUsers: req.user._id },
    ],
  };

  const andClauses = [];

  if (req.query.search) {
    const regex = new RegExp(req.query.search.trim(), "i");
    andClauses.push({ $or: [{ title: regex }, { subtitle: regex }, { information: regex }] });
  }

  if (req.query.type && VALID_TYPES.includes(req.query.type)) {
    filter.type = req.query.type;
  }

  // Used by the frontend's lightweight polling: "any notices created after
  // this timestamp that I can see?" — powers the new-notice notification.
  if (req.query.since) {
    const sinceDate = new Date(req.query.since);
    if (!Number.isNaN(sinceDate.getTime())) {
      andClauses.push({ createdAt: { $gt: sinceDate } });
    }
  }

  if (andClauses.length > 0) {
    andClauses.unshift({ $or: filter.$or });
    filter.$and = andClauses;
    delete filter.$or;
  }

  const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
  const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 10, 1), 100);
  const skip = (page - 1) * limit;

  const [notices, total] = await Promise.all([
    Notice.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit),
    Notice.countDocuments(filter),
  ]);

  res.json({
    notices,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.max(Math.ceil(total / limit), 1),
    },
  });
};

// GET /api/notices/:id
const getNoticeById = async (req, res) => {
  const notice = await Notice.findById(req.params.id)
    .populate("createdBy", "name email")
    .populate("targetUsers", "name email");

  if (!notice) return res.status(404).json({ message: "Notice not found" });

  if (req.user.role !== "superadmin") {
    const isVisible =
      notice.isActive &&
      (notice.targetType === "all" ||
        notice.targetUsers.some((u) => String(u._id) === String(req.user._id)));

    if (!isVisible) {
      return res.status(403).json({ message: "This notice is not available." });
    }
  }

  res.json(notice);
};

module.exports = {
  createNotice,
  updateNotice,
  deleteNotice,
  getAllNotices,
  getActiveNotices,
  getNoticeById,
};

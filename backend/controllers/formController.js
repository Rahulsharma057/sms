const mongoose = require("mongoose");
const FormTemplate = require("../models/FormTemplate");
const FormResponse = require("../models/FormResponse");
const User = require("../models/User");
const { createNotification } = require("../services/notificationService");

const ALLOWED_FIELD_TYPES = ["text", "number", "rating", "checkbox"];

const sanitizeFields = (fields) => {
  if (!Array.isArray(fields)) return [];
  return fields
    .filter((f) => f && f.label && f.label.trim())
    .map((f, index) => {
      const clean = {
        label: f.label.trim(),
        fieldType: ALLOWED_FIELD_TYPES.includes(f.fieldType) ? f.fieldType : "text",
        required: !!f.required,
        placeholder: f.placeholder || "",
        allowRemark: !!f.allowRemark,
        order: index,
      };
      // keep the same _id for fields that already existed, so past responses
      // (which store fieldId + label + value) stay traceable to the field
      if (f._id && mongoose.Types.ObjectId.isValid(f._id)) {
        clean._id = f._id;
      }
      return clean;
    });
};

const sanitizeTargeting = ({ targetType, targetUsers }) => {
  const type = targetType === "specific" ? "specific" : "all";
  const users = type === "specific" && Array.isArray(targetUsers) ? targetUsers : [];
  return { targetType: type, targetUsers: users };
};

const sanitizeTheme = (theme = {}) => ({
  primaryColor: theme.primaryColor || "#7e22ce",
  headerText: theme.headerText || "",
  submitButtonLabel: theme.submitButtonLabel || "Submit",
  successMessage: theme.successMessage || "Thank you! Your response has been recorded.",
});

// ==========================================================
// Notify the form's audience (all teachers, or the specific
// selected users) that a new form is available. Only fires
// when the form's own notifyUsers toggle is on.
// ==========================================================
const notifyFormRecipients = async (form) => {
  if (!form.notifyUsers) return;

  let recipientIds = [];

  if (form.targetType === "all") {
    const teachers = await User.find({ role: "teacher", active: true }).select("_id");
    recipientIds = teachers.map((u) => u._id);
  } else {
    recipientIds = form.targetUsers || [];
  }

  await Promise.all(
    recipientIds.map((userId) =>
      createNotification({
        recipient: userId,
        type: "NEW_FORM",
        title: "New form available",
        message: `A new form "${form.title}" has been shared with you.`,
        form: form._id,
      })
    )
  );
};

// POST /api/forms  (superadmin)
const createForm = async (req, res) => {
  const { title, description, fields, theme, targetType, targetUsers, isPublished, notifyUsers } = req.body;

  if (!title || !title.trim()) {
    return res.status(400).json({ message: "Title is required." });
  }

  const safeFields = sanitizeFields(fields);
  if (safeFields.length === 0) {
    return res.status(400).json({ message: "Add at least one field." });
  }

  const { targetType: safeType, targetUsers: safeUsers } = sanitizeTargeting({ targetType, targetUsers });
  if (safeType === "specific" && safeUsers.length === 0) {
    return res.status(400).json({ message: "Select at least one user, or choose 'All users'." });
  }

  let slug = FormTemplate.generateSlug(title);
  while (await FormTemplate.exists({ slug })) {
    slug = FormTemplate.generateSlug(title); // practically never loops, just a safety net
  }

  const form = await FormTemplate.create({
    title: title.trim(),
    description,
    fields: safeFields,
    theme: sanitizeTheme(theme),
    slug,
    isPublished: !!isPublished,
    targetType: safeType,
    targetUsers: safeUsers,
    notifyUsers: notifyUsers === undefined ? true : !!notifyUsers,
    createdBy: req.user._id,
  });

  if (form.isPublished) {
    await notifyFormRecipients(form);
  }

  const populated = await form.populate("targetUsers", "name email");
  res.status(201).json(populated);
};

// PATCH /api/forms/:id  (superadmin)
const updateForm = async (req, res) => {
  const { title, description, fields, theme, targetType, targetUsers, isPublished, notifyUsers } = req.body;

  const form = await FormTemplate.findById(req.params.id);
  if (!form) return res.status(404).json({ message: "Form not found" });

  const wasPublished = form.isPublished;

  if (title !== undefined) {
    if (!title.trim()) return res.status(400).json({ message: "Title cannot be empty." });
    form.title = title.trim();
  }
  if (description !== undefined) form.description = description;
  if (theme !== undefined) form.theme = sanitizeTheme(theme);
  if (notifyUsers !== undefined) form.notifyUsers = !!notifyUsers;

  if (fields !== undefined) {
    const safeFields = sanitizeFields(fields);
    if (safeFields.length === 0) {
      return res.status(400).json({ message: "Add at least one field." });
    }
    form.fields = safeFields;
  }

  if (isPublished !== undefined) form.isPublished = !!isPublished;

  if (targetType !== undefined || targetUsers !== undefined) {
    const { targetType: safeType, targetUsers: safeUsers } = sanitizeTargeting({
      targetType: targetType !== undefined ? targetType : form.targetType,
      targetUsers: targetUsers !== undefined ? targetUsers : form.targetUsers,
    });
    if (safeType === "specific" && safeUsers.length === 0) {
      return res.status(400).json({ message: "Select at least one user, or choose 'All users'." });
    }
    form.targetType = safeType;
    form.targetUsers = safeUsers;
  }

  await form.save();

  // Only fire when the form is *newly* going live (draft -> published),
  // so editing an already-published form doesn't spam notifications.
  if (!wasPublished && form.isPublished) {
    await notifyFormRecipients(form);
  }

  const populated = await form.populate("targetUsers", "name email");
  res.json(populated);
};

// DELETE /api/forms/:id  (superadmin)
const deleteForm = async (req, res) => {
  const form = await FormTemplate.findById(req.params.id);
  if (!form) return res.status(404).json({ message: "Form not found" });

  await FormResponse.deleteMany({ form: form._id });
  await form.deleteOne();
  res.json({ message: "Form deleted successfully", id: req.params.id });
};

// GET /api/forms  (superadmin — list, search + pagination)
const getAllForms = async (req, res) => {
  const filter = {};
  if (req.query.search) {
    const regex = new RegExp(req.query.search.trim(), "i");
    filter.$or = [{ title: regex }, { description: regex }];
  }

  const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
  const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 10, 1), 100);
  const skip = (page - 1) * limit;

  const [forms, total] = await Promise.all([
    FormTemplate.find(filter)
      .populate("createdBy", "name email")
      .populate("targetUsers", "name email")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit),
    FormTemplate.countDocuments(filter),
  ]);

  const counts = await FormResponse.aggregate([
    { $match: { form: { $in: forms.map((f) => f._id) } } },
    { $group: { _id: "$form", count: { $sum: 1 } } },
  ]);
  const countMap = Object.fromEntries(counts.map((c) => [String(c._id), c.count]));
  const withCounts = forms.map((f) => ({ ...f.toObject(), responseCount: countMap[String(f._id)] || 0 }));

  res.json({
    forms: withCounts,
    pagination: { page, limit, total, totalPages: Math.max(Math.ceil(total / limit), 1) },
  });
};

// GET /api/forms/:id  (superadmin)
const getFormById = async (req, res) => {
  const form = await FormTemplate.findById(req.params.id)
    .populate("createdBy", "name email")
    .populate("targetUsers", "name email");
  if (!form) return res.status(404).json({ message: "Form not found" });
  res.json(form);
};

// GET /api/forms/visible  (any authenticated user — dashboard / sidebar list)
const getVisibleForms = async (req, res) => {
  const forms = await FormTemplate.find({
    isPublished: true,
    $or: [{ targetType: "all" }, { targetType: "specific", targetUsers: req.user._id }],
  })
    .select("title description slug theme createdAt")
    .sort({ createdAt: -1 });

  res.json(forms);
};

// GET /api/forms/public/:slug  (NO auth — the public fill page)
const getPublicForm = async (req, res) => {
  const form = await FormTemplate.findOne({ slug: req.params.slug, isPublished: true }).select(
    "title description fields theme slug"
  );
  if (!form) return res.status(404).json({ message: "This form is not available." });
  res.json(form);
};

// POST /api/forms/public/:slug/submit  (NO auth)
const submitResponse = async (req, res) => {
  const form = await FormTemplate.findOne({ slug: req.params.slug, isPublished: true });
  if (!form) return res.status(404).json({ message: "This form is not available." });

  const { answers } = req.body;
  if (!Array.isArray(answers)) {
    return res.status(400).json({ message: "Invalid submission." });
  }

  const answerMap = new Map(answers.map((a) => [String(a.fieldId), a.value]));
  const remarkMap = new Map(answers.map((a) => [String(a.fieldId), a.remark]));
  const cleanAnswers = [];

  for (const field of form.fields) {
    const raw = answerMap.get(String(field._id));
    const rawRemark = field.allowRemark ? String(remarkMap.get(String(field._id)) || "").trim() : "";

    // ---- checkbox: value is boolean (checked / not checked) ----
    if (field.fieldType === "checkbox") {
      const checked = raw === true || raw === "true";
      if (field.required && !checked) {
        return res.status(400).json({ message: `"${field.label}" must be checked.` });
      }
      cleanAnswers.push({ fieldId: field._id, label: field.label, value: checked, remark: rawRemark });
      continue;
    }

    // ---- rating: integer 1-5 ----
    if (field.fieldType === "rating") {
      const isEmpty = raw === undefined || raw === null || raw === "";
      if (field.required && isEmpty) {
        return res.status(400).json({ message: `"${field.label}" is required.` });
      }
      if (!isEmpty) {
        const num = Number(raw);
        if (isNaN(num) || num < 1 || num > 5) {
          return res.status(400).json({ message: `"${field.label}" must be a rating between 1 and 5.` });
        }
        cleanAnswers.push({ fieldId: field._id, label: field.label, value: num, remark: rawRemark });
      } else {
        cleanAnswers.push({ fieldId: field._id, label: field.label, value: "", remark: rawRemark });
      }
      continue;
    }

    // ---- text / number (existing behaviour) ----
    if (field.required && (raw === undefined || raw === null || String(raw).trim() === "")) {
      return res.status(400).json({ message: `"${field.label}" is required.` });
    }
    if (field.fieldType === "number" && raw !== undefined && raw !== "" && isNaN(Number(raw))) {
      return res.status(400).json({ message: `"${field.label}" must be a number.` });
    }

    cleanAnswers.push({
      fieldId: field._id,
      label: field.label,
      value: field.fieldType === "number" && raw !== "" && raw !== undefined ? Number(raw) : raw ?? "",
      remark: rawRemark,
    });
  }

  const response = await FormResponse.create({
    form: form._id,
    submittedBy: req.user?._id, // only set if this route is ever placed behind optional auth
    answers: cleanAnswers,
  });

  res.status(201).json({ message: form.theme?.successMessage || "Submitted successfully.", id: response._id });
};

// GET /api/forms/:id/responses  (superadmin — pagination + search + date filter)
const getFormResponses = async (req, res) => {
  // BUGFIX: previously this only selected "title fields", so isPublished was
  // never sent to the frontend and the responses page always showed "Draft".
  const form = await FormTemplate.findById(req.params.id).select("title fields isPublished");
  if (!form) return res.status(404).json({ message: "Form not found" });

  const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
  const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 20, 1), 200);
  const skip = (page - 1) * limit;

  const filter = { form: form._id };

  if (req.query.from || req.query.to) {
    filter.createdAt = {};
    if (req.query.from) {
      const start = new Date(req.query.from);
      if (!isNaN(start.getTime())) filter.createdAt.$gte = start;
    }
    if (req.query.to) {
      const end = new Date(req.query.to);
      if (!isNaN(end.getTime())) {
        end.setHours(23, 59, 59, 999);
        filter.createdAt.$lte = end;
      }
    }
    if (Object.keys(filter.createdAt).length === 0) delete filter.createdAt;
  }

  if (req.query.search && req.query.search.trim()) {
    const regex = new RegExp(req.query.search.trim(), "i");
    filter["answers.value"] = regex;
  }

  const [responses, total] = await Promise.all([
    FormResponse.find(filter)
      .populate("submittedBy", "name email")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit),
    FormResponse.countDocuments(filter),
  ]);

  res.json({
    form: { _id: form._id, title: form.title, fields: form.fields, isPublished: form.isPublished },
    responses,
    pagination: { page, limit, total, totalPages: Math.max(Math.ceil(total / limit), 1) },
  });
};

module.exports = {
  createForm,
  updateForm,
  deleteForm,
  getAllForms,
  getFormById,
  getVisibleForms,
  getPublicForm,
  submitResponse,
  getFormResponses,
};
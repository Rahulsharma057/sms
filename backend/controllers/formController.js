const mongoose = require("mongoose");
const FormTemplate = require("../models/FormTemplate");
const FormResponse = require("../models/FormResponse");

const ALLOWED_FIELD_TYPES = ["text", "number"];

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

// POST /api/forms  (superadmin)
const createForm = async (req, res) => {
  const { title, description, fields, theme, targetType, targetUsers, isPublished } = req.body;

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
    createdBy: req.user._id,
  });

  const populated = await form.populate("targetUsers", "name email");
  res.status(201).json(populated);
};

// PATCH /api/forms/:id  (superadmin)
const updateForm = async (req, res) => {
  const { title, description, fields, theme, targetType, targetUsers, isPublished } = req.body;

  const form = await FormTemplate.findById(req.params.id);
  if (!form) return res.status(404).json({ message: "Form not found" });

  if (title !== undefined) {
    if (!title.trim()) return res.status(400).json({ message: "Title cannot be empty." });
    form.title = title.trim();
  }
  if (description !== undefined) form.description = description;
  if (theme !== undefined) form.theme = sanitizeTheme(theme);

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
  const cleanAnswers = [];

  for (const field of form.fields) {
    const raw = answerMap.get(String(field._id));

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
    });
  }

  const response = await FormResponse.create({
    form: form._id,
    submittedBy: req.user?._id, // only set if this route is ever placed behind optional auth
    answers: cleanAnswers,
  });

  res.status(201).json({ message: form.theme?.successMessage || "Submitted successfully.", id: response._id });
};

// GET /api/forms/:id/responses  (superadmin)
const getFormResponses = async (req, res) => {
  const form = await FormTemplate.findById(req.params.id).select("title fields");
  if (!form) return res.status(404).json({ message: "Form not found" });

  const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
  const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 20, 1), 200);
  const skip = (page - 1) * limit;

  const [responses, total] = await Promise.all([
    FormResponse.find({ form: form._id })
      .populate("submittedBy", "name email")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit),
    FormResponse.countDocuments({ form: form._id }),
  ]);

  res.json({
    form: { _id: form._id, title: form.title, fields: form.fields },
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

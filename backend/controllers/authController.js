const jwt = require("jsonwebtoken");
const User = require("../models/User");

const generateToken = (id) =>
  jwt.sign({ id }, process.env.JWT_SECRET, { expiresIn: "7d" });

const setTokenCookie = (res, token) => {
  res.cookie("token", token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 7 * 24 * 60 * 60 * 1000,
  });
};

// POST /api/auth/login
const login = async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ message: "Email and password required" });

  const user = await User.findOne({ email: email.toLowerCase() });
  if (!user || !(await user.matchPassword(password))) {
    return res.status(401).json({ message: "Invalid email or password" });
  }
  if (!user.active) return res.status(403).json({ message: "Account disabled. Contact admin." });

  const token = generateToken(user._id);
  setTokenCookie(res, token);

  res.json({
    token,
    user: { id: user._id, name: user.name, email: user.email, role: user.role, centre: user.centre },
  });
};

// POST /api/auth/logout
const logout = (req, res) => {
  res.clearCookie("token");
  res.json({ message: "Logged out" });
};

// GET /api/auth/me
const getMe = async (req, res) => {
  res.json({ user: req.user });
};

module.exports = { login, logout, getMe };

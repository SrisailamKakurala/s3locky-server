const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const User = require("../models/User");
require("dotenv").config();

const router = express.Router();

// Function to generate Access & Refresh Tokens
const generateTokens = (userId) => {
  console.log("JWT_SECRET: ", process.env.JWT_SECRET);
  console.log("JWT_REFRESH_SECRET: ", process.env.JWT_REFRESH_SECRET);
  const accessToken = jwt.sign({ userId }, process.env.JWT_SECRET, { expiresIn: "15m" }); // Short expiry
  const refreshToken = jwt.sign({ userId }, process.env.JWT_REFRESH_SECRET, { expiresIn: "7d" }); // Long expiry
  return { accessToken, refreshToken };
};

// Signup Route
router.post("/signup", async (req, res) => {
  console.log("reached signup");
  try {
    const { email, password } = req.body;
    console.log(email, password);

    // Check if user already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) return res.status(400).json({ message: "User already exists" });

    // Hash password
    const hashedPassword = await bcrypt.hash(password, "lksjfldskjflkdsjlskaf");

    // Create new user
    const newUser = new User({ email, password: hashedPassword });
    await newUser.save();

    // Generate tokens
    const { accessToken, refreshToken } = generateTokens(newUser._id);

    res.status(201).json({
      message: "User registered successfully",
      accessToken,
      refreshToken,
      user: { _id: newUser._id, email: newUser.email }, // Exclude password
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Login Route
router.post("/login", async (req, res) => {
  console.log("reached login");

  try {
    const { email, password } = req.body;
    console.log(email, password);

    // Check if user exists
    const user = await User.findOne({ email });
    if (!user) return res.status(400).json({ message: "User not found" });

    // Compare password
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return res.status(400).json({ message: "Invalid credentials" });

    // Generate tokens
    const { accessToken, refreshToken } = generateTokens(user._id);

    res.json({
      message: "Login successful",
      accessToken,
      refreshToken,
      user: { _id: user._id, email: user.email }, // Exclude password
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Refresh Token Route
router.post("/refresh", async (req, res) => {
  const { refreshToken } = req.body;
  if (!refreshToken) return res.status(401).json({ message: "Refresh token required" });

  try {
    const decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET);
    const { accessToken, refreshToken: newRefreshToken } = generateTokens(decoded.userId);
    res.json({ accessToken, refreshToken: newRefreshToken });
  } catch (err) {
    res.status(403).json({ message: "Invalid refresh token" });
  }
});

// Middleware to Protect Routes
const authMiddleware = (req, res, next) => {
  const token = req.header("Authorization")?.split(" ")[1];
  if (!token) return res.status(401).json({ message: "Access denied" });

  try {
    const verified = jwt.verify(token, process.env.JWT_SECRET);
    req.user = verified;
    next();
  } catch (err) {
    res.status(401).json({ message: "Invalid token" });
  }
};

// Protected Route Example
router.get("/protected", authMiddleware, (req, res) => {
  res.json({ message: "You accessed a protected route!", user: req.user });
});

module.exports = router;

// routes/auth.js
import express from "express";
import bcrypt from "bcrypt";
import { pool } from "../db.js";

const router = express.Router();

// Login endpoint
router.post("/login", async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ error: "Username and password required" });
    }

    // Find user
    const result = await pool.query(
      "SELECT id, username, password, full_name, role, admin_id FROM users WHERE username = $1",
      [username]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    const user = result.rows[0];

    // Compare password
    const isValid = await bcrypt.compare(password, user.password);

    if (!isValid) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    // Return user info (without password)
    res.json({
      id: user.id,
      username: user.username,
      fullName: user.full_name,
      role: user.role,
      adminId: user.admin_id
    });
  } catch (err) {
    console.error("Login error:", err);
    res.status(500).json({ error: err.message });
  }
});

// Create new user (admin only)
router.post("/create-user", async (req, res) => {
  try {
    const { username, password, fullName, role, adminId } = req.body;

    if (!username || !password || !fullName) {
      return res.status(400).json({ error: "All fields required" });
    }

    // Validate role
    if (role && !['admin', 'driver'].includes(role)) {
      return res.status(400).json({ error: "Invalid role" });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Insert user
    const result = await pool.query(
      "INSERT INTO users (username, password, full_name, role, admin_id) VALUES ($1, $2, $3, $4, $5) RETURNING id, username, full_name, role",
      [username, hashedPassword, fullName, role || 'driver', adminId || null]
    );

    res.json(result.rows[0]);
  } catch (err) {
    console.error("Create user error:", err);
    res.status(500).json({ error: err.message });
  }
});

export default router;
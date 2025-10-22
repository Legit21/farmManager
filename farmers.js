import express from "express";
import { pool } from "../db.js";

const router = express.Router();

// Get all farmers
router.get("/", async (req, res) => {
  const result = await pool.query("SELECT id, name, contact FROM farmers ORDER BY name");
  res.json(result.rows);
});

// Add a new farmer
router.post("/", async (req, res) => {
  const { name, contact } = req.body;
  const result = await pool.query(
    "INSERT INTO farmers (name, contact) VALUES ($1, $2) RETURNING *",
    [name, contact]
  );
  res.json(result.rows[0]);
});

export default router;

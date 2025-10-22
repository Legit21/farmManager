import express from "express";
import { pool } from "../db.js";

const router = express.Router();

// Get all services
router.get("/", async (req, res) => {
  try {
    const result = await pool.query('SELECT id, "type", rate FROM "services" ORDER BY "type"');
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// Add new service
router.post("/", async (req, res) => {
  try {
    const { type, rate } = req.body;
    const result = await pool.query(
      'INSERT INTO services ("type", rate) VALUES ($1, $2) RETURNING *',
      [type, rate]
    );
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

export default router;

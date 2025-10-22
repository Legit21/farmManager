import express from "express";
import { pool } from "../db.js";

const router = express.Router();

// Add service entry
router.post("/", async (req, res) => {
  const { farmerId, serviceId, hours, amountReceived, remark } = req.body;
  const result = await pool.query(
    `INSERT INTO hisaab_entries (farmer_id, service_id, hours, amount_received, remark, entry_date)
     VALUES ($1, $2, $3, $4, $5, NOW()) RETURNING *`,
    [farmerId, serviceId, hours, amountReceived || 0, remark || '']
  );
  res.json(result.rows[0]);
});

// Get all entries with farmer & service info
router.get("/", async (req, res) => {
  const result = await pool.query(`
    SELECT he.id, f.name as farmer_name, s.type as service_type, he.hours, s.rate, he.amount_received, he.entry_date
    FROM hisaab_entries he
    JOIN farmers f ON he.farmer_id = f.id
    JOIN services s ON he.service_id = s.id
    ORDER BY he.entry_date DESC
  `);
  res.json(result.rows);
});

export default router;

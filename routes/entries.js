// routes/entries.js - Updated
import express from "express";
import { pool } from "../db.js";

const router = express.Router();

// Add service entry with user_id
router.post("/", async (req, res) => {
  try {
    const { farmerId, serviceId, hours, amountReceived, remark, userId, entryDate } = req.body;
    
    if (!farmerId || !serviceId || hours === undefined || !userId) {
      return res.status(400).json({ 
        error: "Missing required fields",
        received: { farmerId, serviceId, hours, userId }
      });
    }
    
    // Use provided date or current date
    const dateToUse = entryDate || new Date().toISOString();
    
    const result = await pool.query(
      `INSERT INTO hisaab_entries (farmer_id, service_id, hours, amount_received, remark, user_id, entry_date)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
      [farmerId, serviceId, hours, amountReceived || 0, remark || '', userId, dateToUse]
    );
    
    res.json(result.rows[0]);
  } catch (err) {
    console.error("Error adding entry:", err);
    res.status(500).json({ error: err.message });
  }
});

// Get all entries for a specific user
router.get("/user/:userId", async (req, res) => {
  try {
    const { userId } = req.params;
    const result = await pool.query(`
      SELECT he.id, he.farmer_id, he.service_id, f.name as farmer_name, 
             s.type as service_type, he.hours, s.rate, he.amount_received, 
             he.entry_date, he.remark
      FROM hisaab_entries he
      JOIN farmers f ON he.farmer_id = f.id
      JOIN services s ON he.service_id = s.id
      WHERE he.user_id = $1
      ORDER BY he.entry_date DESC
    `, [userId]);
    res.json(result.rows);
  } catch (err) {
    console.error("Error fetching entries:", err);
    res.status(500).json({ error: err.message });
  }
});

// Get entries for a specific farmer and user
router.get("/farmer/:farmerId/user/:userId", async (req, res) => {
  try {
    const { farmerId, userId } = req.params;
    const result = await pool.query(`
      SELECT he.id, he.farmer_id, he.service_id, f.name as farmer_name, 
             s.type as service_type, he.hours, s.rate, he.amount_received, 
             he.entry_date, he.remark, (he.hours * s.rate) as cost
      FROM hisaab_entries he
      JOIN farmers f ON he.farmer_id = f.id
      JOIN services s ON he.service_id = s.id
      WHERE he.farmer_id = $1 AND he.user_id = $2
      ORDER BY he.entry_date DESC
    `, [farmerId, userId]);
    res.json(result.rows);
  } catch (err) {
    console.error("Error fetching farmer entries:", err);
    res.status(500).json({ error: err.message });
  }
});

export default router;
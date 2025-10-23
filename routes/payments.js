// routes/payments.js
import express from "express";
import { pool } from "../db.js";

const router = express.Router();

// Add payment
router.post("/", async (req, res) => {
  try {
    const { farmerId, userId, amount, paymentDate, remark } = req.body;
    
    if (!farmerId || !userId || !amount) {
      return res.status(400).json({ 
        error: "Missing required fields",
        received: { farmerId, userId, amount }
      });
    }
    
    const dateToUse = paymentDate || new Date().toISOString();
    
    const result = await pool.query(
      `INSERT INTO payments (farmer_id, user_id, amount, payment_date, remark)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [farmerId, userId, amount, dateToUse, remark || '']
    );
    
    res.json(result.rows[0]);
  } catch (err) {
    console.error("Error adding payment:", err);
    res.status(500).json({ error: err.message });
  }
});

// Get payments for a specific farmer
router.get("/farmer/:farmerId", async (req, res) => {
  try {
    const { farmerId } = req.params;
    const result = await pool.query(`
      SELECT p.id, p.farmer_id, p.user_id, p.amount, p.payment_date, p.remark,
             f.name as farmer_name, u.full_name as user_name
      FROM payments p
      JOIN farmers f ON p.farmer_id = f.id
      JOIN users u ON p.user_id = u.id
      WHERE p.farmer_id = $1
      ORDER BY p.payment_date DESC
    `, [farmerId]);
    res.json(result.rows);
  } catch (err) {
    console.error("Error fetching payments:", err);
    res.status(500).json({ error: err.message });
  }
});

// Get all payments for admin (optionally filtered by adminId)
router.get("/admin/:adminId", async (req, res) => {
  try {
    const { adminId } = req.params;
    const result = await pool.query(`
      SELECT p.id, p.farmer_id, p.user_id, p.amount, p.payment_date, p.remark,
             f.name as farmer_name, u.full_name as user_name
      FROM payments p
      JOIN farmers f ON p.farmer_id = f.id
      JOIN users u ON p.user_id = u.id
      WHERE u.id = $1 OR u.admin_id = $1
      ORDER BY p.payment_date DESC
    `, [adminId]);
    res.json(result.rows);
  } catch (err) {
    console.error("Error fetching admin payments:", err);
    res.status(500).json({ error: err.message });
  }
});

export default router;
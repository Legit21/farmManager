// routes/entries.js - Updated with Admin Access
import express from "express";
import { pool } from "../db.js";

const router = express.Router();

// Add service entry
router.post("/", async (req, res) => {
  try {
    const { farmerId, serviceId, hours, amountReceived, remark, userId, entryDate } = req.body;
    
    if (!farmerId || !serviceId || hours === undefined || !userId) {
      return res.status(400).json({ 
        error: "Missing required fields",
        received: { farmerId, serviceId, hours, userId }
      });
    }
    
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

// Update entry (admin only)
router.put("/:entryId", async (req, res) => {
  try {
    const { entryId } = req.params;
    const { farmerId, serviceId, hours, amountReceived, remark, entryDate } = req.body;
    
    const result = await pool.query(
      `UPDATE hisaab_entries 
       SET farmer_id = $1, service_id = $2, hours = $3, 
           amount_received = $4, remark = $5, entry_date = $6
       WHERE id = $7 
       RETURNING *`,
      [farmerId, serviceId, hours, amountReceived || 0, remark || '', entryDate, entryId]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Entry not found" });
    }
    
    res.json(result.rows[0]);
  } catch (err) {
    console.error("Error updating entry:", err);
    res.status(500).json({ error: err.message });
  }
});

// Delete entry (admin only)
router.delete("/:entryId", async (req, res) => {
  try {
    const { entryId } = req.params;
    
    const result = await pool.query(
      "DELETE FROM hisaab_entries WHERE id = $1 RETURNING *",
      [entryId]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Entry not found" });
    }
    
    res.json({ message: "Entry deleted successfully", entry: result.rows[0] });
  } catch (err) {
    console.error("Error deleting entry:", err);
    res.status(500).json({ error: err.message });
  }
});

// Get all entries for admin (includes driver entries)
router.get("/admin/:adminId", async (req, res) => {
  try {
    const { adminId } = req.params;
    const result = await pool.query(`
      SELECT he.id, he.farmer_id, he.service_id, f.name as farmer_name, 
             s.type as service_type, he.hours, s.rate, he.amount_received, 
             he.entry_date, he.remark, u.full_name as user_name, u.role as user_role,
             (he.hours * s.rate) as cost
      FROM hisaab_entries he
      JOIN farmers f ON he.farmer_id = f.id
      JOIN services s ON he.service_id = s.id
      JOIN users u ON he.user_id = u.id
      WHERE he.user_id = $1 OR u.admin_id = $1
      ORDER BY f.name, he.entry_date DESC
    `, [adminId]);
    res.json(result.rows);
  } catch (err) {
    console.error("Error fetching admin entries:", err);
    res.status(500).json({ error: err.message });
  }
});

// Get entries for a specific user
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

// Get entries for a specific farmer (for invoice - includes admin and driver entries)
router.get("/farmer/:farmerId/user/:userId", async (req, res) => {
  try {
    const { farmerId, userId } = req.params;
    
    // Get user info to check if admin
    const userResult = await pool.query(
      "SELECT id, role, admin_id FROM users WHERE id = $1",
      [userId]
    );
    
    if (userResult.rows.length === 0) {
      return res.status(404).json({ error: "User not found" });
    }
    
    const user = userResult.rows[0];
    let query;
    let params;
    
    // If admin, get all entries for this farmer (admin's + drivers')
    if (user.role === 'admin') {
      query = `
        SELECT he.id, he.farmer_id, he.service_id, f.name as farmer_name, 
               s.type as service_type, he.hours, s.rate, he.amount_received, 
               he.entry_date, he.remark, (he.hours * s.rate) as cost,
               u.full_name as user_name
        FROM hisaab_entries he
        JOIN farmers f ON he.farmer_id = f.id
        JOIN services s ON he.service_id = s.id
        JOIN users u ON he.user_id = u.id
        WHERE he.farmer_id = $1 AND (he.user_id = $2 OR u.admin_id = $2)
        ORDER BY he.entry_date DESC
      `;
      params = [farmerId, userId];
    } else {
      // If driver, get only their entries
      query = `
        SELECT he.id, he.farmer_id, he.service_id, f.name as farmer_name, 
               s.type as service_type, he.hours, s.rate, he.amount_received, 
               he.entry_date, he.remark, (he.hours * s.rate) as cost,
               u.full_name as user_name
        FROM hisaab_entries he
        JOIN farmers f ON he.farmer_id = f.id
        JOIN services s ON he.service_id = s.id
        JOIN users u ON he.user_id = u.id
        WHERE he.farmer_id = $1 AND he.user_id = $2
        ORDER BY he.entry_date DESC
      `;
      params = [farmerId, userId];
    }
    
    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (err) {
    console.error("Error fetching farmer entries:", err);
    res.status(500).json({ error: err.message });
  }
});

export default router;
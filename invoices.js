// invoices.js
import express from "express";
import { pool } from "../db.js";
import PDFDocument from "pdfkit";

const router = express.Router();

// Generate PDF Invoice for a farmer
router.get("/farmer/:farmerId", async (req, res) => {
  try {
    const { farmerId } = req.params;

    // Get farmer details
    const farmerResult = await pool.query(
      "SELECT id, name, contact FROM farmers WHERE id = $1",
      [farmerId]
    );

    if (farmerResult.rows.length === 0) {
      return res.status(404).json({ error: "Farmer not found" });
    }

    const farmer = farmerResult.rows[0];

    // Get all entries for this farmer
    const entriesResult = await pool.query(
      `SELECT he.id, he.entry_date, s.type as service_type,  
              he.hours, s.rate, (he.hours * s.rate) as cost
       FROM hisaab_entries he
       JOIN services s ON he.service_id = s.id
       WHERE he.farmer_id = $1
       ORDER BY he.entry_date DESC`,
      [farmerId]
    );

    const entries = entriesResult.rows;

    if (entries.length === 0) {
      return res.status(404).json({ error: "No entries found for this farmer" });
    }

    // Calculate total
    const totalCost = entries.reduce((sum, entry) => sum + parseFloat(entry.cost), 0);

    // Create PDF
    const doc = new PDFDocument({ margin: 50 });

    // Set response headers
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename=invoice_${farmer.name}_${Date.now()}.pdf`
    );

    // Pipe PDF to response
    doc.pipe(res);

    // Header
    doc.fontSize(24).text("Tipaniya Farm Services", { align: "center" });
    doc.moveDown(0.5);
    doc.fontSize(12).text(`Date: ${new Date().toLocaleDateString("en-IN")}`, { align: "center" });
    doc.moveDown(1.5);

    // Farmer Details
    doc.fontSize(14).text(`Farmer Name: ${farmer.name}`);
    doc.fontSize(12).text(`Contact: ${farmer.contact}`);
    doc.moveDown(1.5);

    // Table Header
    const tableTop = doc.y;
    const col1 = 50;
    const col2 = 80;
    const col3 = 170;
    const col4 = 280;
    const col5 = 390;
    const col6 = 480;

    doc.fontSize(10).font("Helvetica-Bold");
    doc.text("S.No", col1, tableTop);
    doc.text("Date", col2, tableTop);
    doc.text("Service Type", col3, tableTop);
    doc.text("Description", col4, tableTop);
    doc.text("Time (hrs)", col5, tableTop);
    doc.text("Cost (Rs)", col6, tableTop);

    // Draw line under header
    doc.moveTo(col1, tableTop + 15).lineTo(560, tableTop + 15).stroke();

    // Table Rows
    doc.font("Helvetica");
    let yPosition = tableTop + 25;

    entries.forEach((entry, index) => {
      if (yPosition > 700) {
        doc.addPage();
        yPosition = 50;
      }

      const formattedDate = new Date(entry.entry_date).toLocaleDateString("en-IN");
      const description = entry.remark || "-";
      const hours = parseFloat(entry.hours).toFixed(2);
      const cost = parseFloat(entry.cost).toFixed(2);

      doc.text((index + 1).toString(), col1, yPosition);
      doc.text(formattedDate, col2, yPosition);
      doc.text(entry.service_type, col3, yPosition);
      doc.text(description.substring(0, 20), col4, yPosition);
      doc.text(hours, col5, yPosition);
      doc.text(cost, col6, yPosition);

      yPosition += 25;
    });

    // Draw line before total
    doc.moveTo(col1, yPosition).lineTo(560, yPosition).stroke();
    yPosition += 10;

    // Total
    doc.fontSize(12).font("Helvetica-Bold");
    doc.text("Total:", col4, yPosition);
    doc.text(`Rs ${totalCost.toFixed(2)}`, col6, yPosition);

    // Footer
    doc.fontSize(10).font("Helvetica");
    doc.text(
      "Thank you",
      50,
      doc.page.height - 50,
      { align: "center" }
    );

    // Finalize PDF
    doc.end();
  } catch (err) {
    console.error("PDF Generation Error:", err);
    res.status(500).json({ error: err.message });
  }
});

export default router;
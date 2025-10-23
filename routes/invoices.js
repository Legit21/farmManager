// routes/invoices.js - Updated with Payments and HH:MM format
import express from "express";
import { pool } from "../db.js";
import PDFDocument from "pdfkit";

const router = express.Router();

// Helper function to convert decimal hours to HH:MM format
function hoursToHHMM(decimalHours) {
  const hours = Math.floor(decimalHours);
  const minutes = Math.round((decimalHours - hours) * 60);
  return `${hours}:${minutes.toString().padStart(2, '0')}`;
}

// Generate PDF Invoice for a farmer
router.get("/farmer/:farmerId", async (req, res) => {
  try {
    const { farmerId } = req.params;
    const { userId } = req.query;
    
    if (!userId) {
      return res.status(400).json({ error: "User ID required" });
    }

    // Get farmer details
    const farmerResult = await pool.query(
      "SELECT id, name, contact FROM farmers WHERE id = $1",
      [farmerId]
    );

    if (farmerResult.rows.length === 0) {
      return res.status(404).json({ error: "Farmer not found" });
    }

    const farmer = farmerResult.rows[0];

    // Get user info to check if admin
    const userResult = await pool.query(
      "SELECT id, role, admin_id FROM users WHERE id = $1",
      [userId]
    );
    
    if (userResult.rows.length === 0) {
      return res.status(404).json({ error: "User not found" });
    }
    
    const user = userResult.rows[0];
    
    // Get all entries for this farmer (admin gets all, driver gets own)
    let entriesQuery;
    let entriesParams;
    
    if (user.role === 'admin') {
      entriesQuery = `
        SELECT he.id, he.entry_date, s.type as service_type, he.remark,
                he.hours, s.rate, (he.hours * s.rate) as cost
        FROM hisaab_entries he
        JOIN services s ON he.service_id = s.id
        JOIN users u ON he.user_id = u.id
        WHERE he.farmer_id = $1 AND (he.user_id = $2 OR u.admin_id = $2)
        ORDER BY he.entry_date DESC
      `;
      entriesParams = [farmerId, userId];
    } else {
      entriesQuery = `
        SELECT he.id, he.entry_date, s.type as service_type, he.remark,
                he.hours, s.rate, (he.hours * s.rate) as cost
        FROM hisaab_entries he
        JOIN services s ON he.service_id = s.id
        WHERE he.farmer_id = $1 AND he.user_id = $2
        ORDER BY he.entry_date DESC
      `;
      entriesParams = [farmerId, userId];
    }

    const entriesResult = await pool.query(entriesQuery, entriesParams);
    const entries = entriesResult.rows;

    if (entries.length === 0) {
      return res.status(404).json({ error: "No entries found for this farmer" });
    }

    // Get all payments for this farmer
    const paymentsResult = await pool.query(
      `SELECT amount, payment_date, remark 
       FROM payments 
       WHERE farmer_id = $1 
       ORDER BY payment_date DESC`,
      [farmerId]
    );
    const payments = paymentsResult.rows;

    // Calculate totals
    const totalCost = entries.reduce((sum, entry) => sum + parseFloat(entry.cost), 0);
    const totalPaid = payments.reduce((sum, payment) => sum + parseFloat(payment.amount), 0);
    const balance = totalCost - totalPaid;

    // Create PDF
    const doc = new PDFDocument({ margin: 50 });

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename=invoice_${farmer.name}_${Date.now()}.pdf`
    );

    doc.pipe(res);

    // Header
    doc.fontSize(24).text("Tipaniya Krishi Seva", { align: "center" });
    // doc.fontSize(18).text("(टिपानिया कृषि सेवाएं)", { align: "center" });
    doc.moveDown(0.5);
    doc.fontSize(12).text(`Dinank/Date: ${new Date().toLocaleDateString("en-IN")}`, { align: "center" });
    doc.moveDown(1.5);

    // Farmer Details
    doc.fontSize(14).text(`Kisaan ka Naam: ${farmer.name} Ji`);
    // doc.fontSize(12).text(`Sampark Sutra / Contact: ${farmer.contact}`);
    doc.moveDown(1.5);

    // Service Entries Table
    doc.fontSize(14).font("Helvetica-Bold").text("Service Details");
    doc.moveDown(0.5);

    const tableTop = doc.y;
    const col1 = 50;
    const col2 = 90;
    const col3 = 170;
    const col4 = 280;
    const col5 = 390;
    const col6 = 480;

    doc.fontSize(10).font("Helvetica-Bold");
    doc.text("S.No", col1, tableTop);
    doc.text("Date", col2, tableTop);
    doc.text("Service", col3, tableTop);
    doc.text("Details", col4, tableTop);
    doc.text("Time", col5, tableTop);
    doc.text("Amount", col6, tableTop);

    // doc.fontSize(9);
    // doc.text("(क्र.सं.)", col1, tableTop + 12);
    // doc.text("(दिनांक)", col2, tableTop + 12);
    // doc.text("(सेवा)", col3, tableTop + 12);
    // doc.text("(विवरण)", col4, tableTop + 12);
    // doc.text("(समय)", col5, tableTop + 12);
    // doc.text("(राशि ₹)", col6, tableTop + 12);

    doc.moveTo(col1, tableTop + 25).lineTo(560, tableTop + 25).stroke();

    doc.font("Helvetica");
    let yPosition = tableTop + 35;

    entries.forEach((entry, index) => {
      if (yPosition > 700) {
        doc.addPage();
        yPosition = 50;
      }

      const formattedDate = new Date(entry.entry_date).toLocaleDateString("en-IN");
      const description = entry.remark || "-";
      const timeHHMM = hoursToHHMM(parseFloat(entry.hours));
      const cost = parseFloat(entry.cost).toFixed(2);

      doc.fontSize(10);
      doc.text((index + 1).toString(), col1, yPosition);
      doc.text(formattedDate, col2, yPosition, { width: 70 });
      doc.text(entry.service_type, col3, yPosition, { width: 100 });
      doc.text(description.substring(0, 25), col4, yPosition, { width: 100 });
      doc.text(timeHHMM, col5, yPosition);
      doc.text(cost, col6, yPosition);

      yPosition += 30;
    });

    doc.moveTo(col1, yPosition).lineTo(560, yPosition).stroke();
    yPosition += 15;

    // Service Total
    doc.fontSize(12).font("Helvetica-Bold");
    doc.text("Service Total:", col4, yPosition);
    doc.text(`Rs ${totalCost.toFixed(2)} /-`, col6, yPosition);
    yPosition += 30;

    // Payments Section
    if (payments.length > 0) {
      doc.fontSize(14).font("Helvetica-Bold");
      doc.text("Payments Received", 50, yPosition);
      yPosition += 25;

      doc.fontSize(10).font("Helvetica-Bold");
      doc.text("Date", col2, yPosition);
      doc.text("Amount (Rs)", col5, yPosition);
      doc.text("Remark", col4, yPosition);
      
      doc.moveTo(col1, yPosition + 15).lineTo(560, yPosition + 15).stroke();
      yPosition += 25;

      doc.font("Helvetica");
      payments.forEach((payment) => {
        if (yPosition > 700) {
          doc.addPage();
          yPosition = 50;
        }

        const paymentDate = new Date(payment.payment_date).toLocaleDateString("en-IN");
        const remark = payment.remark || "-";

        doc.text(paymentDate, col2, yPosition);
        doc.text(parseFloat(payment.amount).toFixed(2), col5, yPosition);
        doc.text(remark.substring(0, 30), col4, yPosition);

        yPosition += 25;
      });

      doc.moveTo(col1, yPosition).lineTo(560, yPosition).stroke();
      yPosition += 15;

      doc.fontSize(12).font("Helvetica-Bold");
      doc.text("Total Paid (Kuul Jama ):", col4, yPosition);
      doc.text(`Rs ${totalPaid.toFixed(2)} /-`, col6, yPosition);
      yPosition += 25;
    }

    // Final Balance
    doc.fontSize(14).font("Helvetica-Bold");
    doc.text("Balance Due:", col4, yPosition);
    doc.text(`Rs ${balance.toFixed(2)} /-`, col6, yPosition, {
      underline: true
    });

    // Footer
    doc.fontSize(10).font("Helvetica");
    doc.text(
      "Thank you!",
      50,
      doc.page.height - 100,
      { align: "center" }
    );

    doc.end();
  } catch (err) {
    console.error("PDF Generation Error:", err);
    res.status(500).json({ error: err.message });
  }
});

export default router;
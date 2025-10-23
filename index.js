import express from "express";
import cors from "cors";
import dotenv from "dotenv";

import farmersRouter from "./routes/farmers.js";
import servicesRouter from "./routes/services.js";
import entriesRouter from "./routes/entries.js";
import invoiceRoutes from "./routes/invoices.js";
import authRoutes from "./routes/auth.js";
import paymentRoutes from "./routes/payments.js";

dotenv.config();
const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// Routes
app.use("/farmers", farmersRouter);
app.use("/services", servicesRouter);
app.use("/entries", entriesRouter);
app.use("/invoices", invoiceRoutes);
app.use("/auth", authRoutes);
app.use("/payments", paymentRoutes);

app.get("/", (req, res) => {
  res.send("🚜 Tractor Hisaab API is running!");
});

app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});

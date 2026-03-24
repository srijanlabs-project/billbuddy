const express = require("express");
const cors = require("cors");
require("dotenv").config();

const authRoutes = require("./routes/authRoutes");
const mobileAuthRoutes = require("./routes/mobileAuthRoutes");
const roleRoutes = require("./routes/roleRoutes");
const userRoutes = require("./routes/userRoutes");
const customerRoutes = require("./routes/customerRoutes");
const productRoutes = require("./routes/productRoutes");
const quotationRoutes = require("./routes/quotationRoutes");
const paymentRoutes = require("./routes/paymentRoutes");
const ledgerRoutes = require("./routes/ledgerRoutes");
const dashboardRoutes = require("./routes/dashboardRoutes");
const whatsappRoutes = require("./routes/whatsappRoutes");
const sellerRoutes = require("./routes/sellerRoutes");
const sellerConfigRoutes = require("./routes/sellerConfigRoutes");
const planRoutes = require("./routes/planRoutes");
const subscriptionRoutes = require("./routes/subscriptionRoutes");
const notificationRoutes = require("./routes/notificationRoutes");
const securityGateRoutes = require("./routes/securityGateRoutes");
const rbacRoutes = require("./routes/rbacRoutes");
const { leadRoutes, publicLeadRoutes } = require("./routes/leadRoutes");
const mobileRoutes = require("./routes/mobileRoutes");
const { authenticate } = require("./middleware/auth");
const { basicSecurityHeaders, buildCorsOptions, createRateLimiter } = require("./middleware/security");
const { initializeDatabase } = require("./utils/initDb");

const app = express();
const authRateLimiter = createRateLimiter({ windowMs: 15 * 60 * 1000, max: 8 });
const otpRequestRateLimiter = createRateLimiter({ windowMs: 15 * 60 * 1000, max: 5 });

app.use(cors(buildCorsOptions()));
app.use(basicSecurityHeaders);
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

app.get("/", (_req, res) => {
  res.json({ status: "ok", service: "BillBuddy API" });
});

app.use("/api/auth/login", authRateLimiter);
app.use("/api/auth/bootstrap-admin", authRateLimiter);
app.use("/api/mobile-auth/login", authRateLimiter);
app.use("/api/mobile-auth/request-otp", otpRequestRateLimiter);
app.use("/api/auth", authRoutes);
app.use("/api/mobile-auth", mobileAuthRoutes);
app.use("/api/lead-capture", publicLeadRoutes);

app.use("/api", authenticate);
app.use("/api/roles", roleRoutes);
app.use("/api/users", userRoutes);
app.use("/api/customers", customerRoutes);
app.use("/api/products", productRoutes);
app.use("/api/quotations", quotationRoutes);
app.use("/api/payments", paymentRoutes);
app.use("/api/ledger", ledgerRoutes);
app.use("/api/dashboard", dashboardRoutes);
app.use("/api/whatsapp", whatsappRoutes);
app.use("/api/sellers", sellerRoutes);
app.use("/api/seller-configurations", sellerConfigRoutes);
app.use("/api/plans", planRoutes);
app.use("/api/subscriptions", subscriptionRoutes);
app.use("/api/notifications", notificationRoutes);
app.use("/api/security-gates", securityGateRoutes);
app.use("/api/leads", leadRoutes);
app.use("/api/mobile", mobileRoutes);
app.use("/api/rbac", rbacRoutes);

app.use((error, _req, res, _next) => {
  res.status(500).json({ message: error.message || "Something went wrong" });
});

const PORT = Number(process.env.PORT || 5000);

async function startServer() {
  try {
    await initializeDatabase();
    app.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
    });
  } catch (error) {
    console.error("Failed to start server:", error.message);
    process.exit(1);
  }
}

startServer();

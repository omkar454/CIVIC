// index.js
import express from "express";
import dotenv from "dotenv";
import mongoose from "mongoose";
import cors from "cors";
import cookieParser from "cookie-parser";

import authRoutes from "./routes/auth.js";
import reportRoutes from "./routes/reports.js";
import mediaRoutes from "./routes/media.js";
import votesCommentsRouter from "./routes/votesComments.js";
import adminRoutes from "./routes/admin.js";
import refreshRoutes from "./routes/refresh.js";
import userRoutes from "./routes/user.js";
import notificationsRoutes from "./routes/notifications.js";
import adminVerificationRoutes from "./routes/adminVerification.js";
import transferRoutes from "./routes/transfer.js"; // ✅ Import transfer routes
import visionRoutes from "./routes/visionRoutes.js"; // ✅ Import vision routes
import officerAnalyticsRoutes from "./routes/officerAnalytics.js";
import citizenRoutes from "./routes/citizenAnalytics.js";
import qrCodeRoutes from "./routes/qrCode.js";
import chatBotRoute from "./routes/chatBot.js"
import officerChatRoutes from "./routes/officerChat.js";
import mlRoutes from "./routes/mlRoutes.js"; // ✅ Import AI Analytics Proxy Rules
import { runSLACheck } from "./utils/slaEngine.js"; // ✅ Import SLA Engine

dotenv.config({ path: "./.env" });

const app = express();

// -----------------------------
// Middlewares
// -----------------------------
app.use(express.json({ limit: "10mb" })); // support large JSON bodies for media URLs
app.use(cookieParser());
app.use(cors({ origin: "http://localhost:5173", credentials: true }));

// -----------------------------
// API Routes
// -----------------------------
app.use("/api/auth", authRoutes);
app.use("/api/reports", reportRoutes);
app.use("/api/media", mediaRoutes);
app.use("/api/votesComments", votesCommentsRouter);
app.use("/api/admin", adminRoutes);
app.use("/api/refresh", refreshRoutes);
app.use("/api/users", userRoutes);
app.use("/api/notifications", notificationsRoutes);
app.use("/api/admin/verification", adminVerificationRoutes); // ✅ New verification route
app.use("/api/transfer", transferRoutes); // ✅ Register transfer routes
app.use("/api/vision", visionRoutes); // ✅ Vision Engine API
app.use("/api/officer", officerAnalyticsRoutes);
app.use("/api/citizen", citizenRoutes);
app.use("/api/qr", qrCodeRoutes);
app.use("/api/chat", chatBotRoute);
app.use("/api/officer-chat", officerChatRoutes);
app.use("/api/ml", mlRoutes); // ✅ Mount API Gateway for Python Microservices

// Health check
app.get("/", (req, res) => res.json({ message: "Server is working 🚀" }));

// -----------------------------
// Start server & connect to DB
// -----------------------------
const PORT = process.env.PORT || 5000;

mongoose
  .connect(process.env.MONGO_URI)
  .then(() => {
    console.log("✅ MongoDB connected");
    // 🕒 Run Startup SLA Audit
    runSLACheck().then(count => {
      if (count > 0) console.log(`📋 Startup Audit: ${count} New SLA breaches identified and logged.`);
      else console.log("✅ Startup Audit: No new SLA breaches.");
    });
    app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
  })
  .catch((err) => {
    console.error("MongoDB connection error:", err);
    process.exit(1);
  });

// -----------------------------
// Graceful shutdown
// -----------------------------
process.on("SIGINT", async () => {
  console.log("\nShutting down server...");
  try {
    await mongoose.connection.close();
    console.log("MongoDB disconnected");
    process.exit(0);
  } catch (err) {
    console.error("Error during shutdown:", err);
    process.exit(1);
  }
});

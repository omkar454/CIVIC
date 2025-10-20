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


// Health check
app.get("/", (req, res) => res.json({ message: "Server is working 🚀" }));

// -----------------------------
// Start server & connect to DB
// -----------------------------
const PORT = process.env.PORT || 5000;

mongoose
  .connect(process.env.MONGO_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  })
  .then(() => {
    console.log("✅ MongoDB connected");
    app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
  })
  .catch((err) => {
    console.error("MongoDB connection error:", err);
    process.exit(1);
  });

// -----------------------------
// Graceful shutdown
// -----------------------------
process.on("SIGINT", () => {
  console.log("\nShutting down server...");
  mongoose.connection.close(() => {
    console.log("MongoDB disconnected");
    process.exit(0);
  });
});

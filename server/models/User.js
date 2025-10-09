// models/User.js
import mongoose from "mongoose";

const UserSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Name is required"],
      trim: true,
    },
    email: {
      type: String,
      unique: true,
      required: [true, "Email is required"],
      lowercase: true,
      trim: true,
    },
    passwordHash: {
      type: String,
      required: [true, "Password is required"],
    },

    // User role
    role: {
      type: String,
      enum: ["citizen", "officer", "admin"],
      default: "citizen",
    },

    // Department (only for officers/admin)
    department: {
      type: String,
      enum: [
        "road",
        "sanitation",
        "streetlight",
        "water-supply",
        "drainage",
        "waste-management",
        "toilet",
        "park",
        "general",
      ],
      default: "general",
      validate: {
        validator: function (v) {
          if (this.role === "citizen" && v !== "general") return false;
          return true;
        },
        message: "Citizens cannot have a department",
      },
    },

    // Officer/Admin contact info (optional)
    phone: {
      type: String,
      trim: true,
      validate: {
        validator: function (v) {
          if (this.role === "citizen" && v) return false;
          return true;
        },
        message: "Citizens should not have phone info",
      },
    },
    designation: {
      type: String,
      trim: true,
      validate: {
        validator: function (v) {
          if (this.role === "citizen" && v) return false;
          return true;
        },
        message: "Citizens should not have designation info",
      },
    },

    // Citizen moderation
    warnings: { type: Number, default: 0 },
    blocked: { type: Boolean, default: false },

    // -----------------------------
    // Logs for reasons
    // -----------------------------
    warningLogs: [
      {
        reason: { type: String, required: true },
        date: { type: Date, default: Date.now },
        admin: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
      },
    ],
    blockedLogs: [
      {
        reason: { type: String, required: true },
        date: { type: Date, default: Date.now },
        admin: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
      },
    ],

    // Audit info
    lastLogin: { type: Date },
  },
  { timestamps: true }
);

// -----------------------------
// Indexes
// -----------------------------
UserSchema.index({ email: 1 }, { unique: true });
UserSchema.index({ role: 1, department: 1 });

// -----------------------------
// Pre-save hook (auto-block on warnings >=3)
// -----------------------------
UserSchema.pre("save", function (next) {
  if (this.warnings >= 3) {
    this.blocked = true;
  }
  next();
});

export default mongoose.model("User", UserSchema);

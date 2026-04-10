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

    // 🛡️ Advanced Moderation (6-Step System)
    abuseAttempts: { type: Number, default: 0 },
    abuseLogs: [
      {
        reason: { type: String, required: true },
        category: { type: String }, // "FakeImage", "DuplicateSpam", "SLA_BREACH", etc.
        entityId: { type: mongoose.Schema.Types.ObjectId }, // ✅ Link to Report or other entity
        date: { type: Date, default: Date.now },
        isHardStrike: { type: Boolean, default: false },
        admin: { type: mongoose.Schema.Types.ObjectId, ref: "User" }
      }
    ],

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
// -----------------------------
// Advanced Auto-Moderation (6stk System)
// -----------------------------
UserSchema.statics.autoWarn = async function (
  userId,
  reason,
  category = "General",
  adminId = null,
  entityId = null // ✅ Added entityId
) {
  const User = this;
  const user = await User.findById(userId);
  if (!user) return null;

  user.abuseAttempts += 1;
  let isHardStrike = false;
  let message = "";

  // The 6-Step Sequence Logic
  // 1, 2: Soft
  // 3: Strike 1
  // 4: Soft
  // 5: Strike 2
  // 6: Strike 3 (Block)
  if (user.abuseAttempts === 3) {
    user.warnings += 1;
    isHardStrike = true;
    message = `🚨 [STRIKE 1]: ${reason}`;
  } else if (user.abuseAttempts === 5) {
    user.warnings += 1;
    isHardStrike = true;
    message = `🚨 [STRIKE 2]: ${reason}`;
  } else if (user.abuseAttempts >= 6) {
    // 🛡️ SECURITY: Officers are never blocked automatically
    if (user.role !== "officer") {
      user.warnings = 3;
      user.blocked = true;
      message = `🚨 [FINAL STRIKE]: Account Blocked. Reason: ${reason}`;
    } else {
      message = `🚨 [CRITICAL AUDIT]: Performance Breach Logged. Reason: ${reason}`;
    }
    isHardStrike = true;
  } else {
    // Attempt 1, 2, 4 are Soft Warnings
    message = `⚠️ [AI ALERT]: ${reason}`;
  }

  // Push to Abuse Logs
  user.abuseLogs.push({
    reason,
    category,
    entityId, // ✅ Store link to report/entity
    isHardStrike,
    admin: adminId, 
    date: new Date()
  });

  // If it's a hard strike, also add to legacy warningLogs for Admin visibility
  if (isHardStrike) {
    user.warningLogs.push({
      reason: `[${adminId ? "MANUAL" : "AI"} ${category}] ${reason} (Attempt #${user.abuseAttempts})`,
      admin: adminId, 
      date: new Date()
    });
  }

  // If it's the final block, also add to legacy blockedLogs for Login compatibility
  if (user.blocked) {
    user.blockedLogs.push({
      reason: `${adminId ? "Manual Admin Block" : "Automated Block"}: ${reason} (Infraction History: ${user.abuseAttempts} attempts)`,
      admin: adminId,
      date: new Date()
    });
  }

  await user.save();

  // 🔔 Create Notification
  try {
    const Notification = mongoose.model("Notification");
    await Notification.create({
      user: user._id,
      message,
      type: isHardStrike ? "error" : "warning"
    });
  } catch (err) {
    console.error("AutoWarn notification failed:", err.message);
  }

  return { 
    attempts: user.abuseAttempts, 
    warnings: user.warnings, 
    blocked: user.blocked,
    message 
  };
};

UserSchema.pre("save", function (next) {
  if (this.warnings >= 3) {
    this.blocked = true;
  }
  next();
});

export default mongoose.model("User", UserSchema);

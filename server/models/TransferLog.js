// models/TransferLog.js
import mongoose from "mongoose";

const TransferLogSchema = new mongoose.Schema(
  {
    report: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Report",
      required: true,
    },
    requestedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    oldDepartment: {
      type: String,
      required: true,
    },
    newDepartment: {
      type: String,
      required: true,
    },
    reason: {
      type: String,
      required: true,
    },
    adminVerification: {
      verified: { type: Boolean, default: false },
      status: {
        type: String,
        enum: ["pending", "approved", "rejected"],
        default: "pending",
      },
      verifiedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
      verifiedAt: { type: Date },
      adminReason: { type: String },
    },
    status: {
      type: String,
      enum: ["pending", "completed", "rejected"],
      default: "pending",
    },
    createdAt: {
      type: Date,
      default: Date.now,
    },
    updatedAt: {
      type: Date,
      default: Date.now,
    },
  },
  { timestamps: true }
);

// Auto-update timestamp
TransferLogSchema.pre("save", function (next) {
  this.updatedAt = Date.now();
  next();
});

const TransferLog = mongoose.model("TransferLog", TransferLogSchema);

export default TransferLog;

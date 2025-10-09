// model/Report.js
import mongoose from "mongoose";

// -----------------------------
// Media Schema for status updates
// -----------------------------
const StatusMediaSchema = new mongoose.Schema({
  url: { type: String, required: true },
  mime: { type: String, required: true },
  uploadedBy: { type: String, enum: ["citizen", "officer"], required: true },
  uploadedAt: { type: Date, default: Date.now },
});

// -----------------------------
// Status History Schema
// -----------------------------
const StatusHistorySchema = new mongoose.Schema({
  status: { type: String, required: true },
  by: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  note: { type: String, default: "" },
  media: [StatusMediaSchema], // ✅ Media added
  at: { type: Date, default: Date.now },
});

// -----------------------------
// Comment Schema
// -----------------------------
const CommentSchema = new mongoose.Schema({
  message: { type: String, required: true },
  by: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  reply: { type: String, default: "" },
  repliedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  createdAt: { type: Date, default: Date.now },
});

// -----------------------------
// Media Schema
// -----------------------------
const MediaSchema = new mongoose.Schema({
  url: { type: String },
  mime: { type: String },
  uploadedBy: { type: String, enum: ["citizen", "officer"] },
});

// -----------------------------
// Admin Verification Schema
// -----------------------------
const AdminVerificationSchema = new mongoose.Schema({
  verified: { type: Boolean, default: null }, // null=pending, true=approved, false=rejected
  note: { type: String, default: "" },
  verifiedAt: { type: Date },
  history: [
    {
      admin: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
      action: { type: String, enum: ["approved", "rejected"] },
      note: { type: String },
      createdAt: { type: Date, default: Date.now },
    },
  ],
});

// -----------------------------
// Main Report Schema
// -----------------------------
const ReportSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true },
    description: { type: String, required: true, trim: true },
    category: {
      type: String,
      required: true,
      enum: [
        "pothole",
        "garbage",
        "streetlight",
        "water-logging",
        "toilet",
        "water-supply",
        "drainage",
        "waste-management",
        "park",
        "other",
      ],
    },
    severity: { type: Number, min: 1, max: 5, default: 3 },
    department: { type: String, default: "general" },
    assignedTo: { type: mongoose.Schema.Types.ObjectId, ref: "User" },

    location: {
      type: {
        type: String,
        enum: ["Point"],
        default: "Point",
      },
      coordinates: {
        type: [Number],
        validate: {
          validator: function (v) {
            if (
              (!v || v.length === 0) &&
              this.address &&
              this.address.trim() !== ""
            )
              return true;
            return (
              Array.isArray(v) &&
              v.length === 2 &&
              v.every((x) => typeof x === "number")
            );
          },
          message:
            "Either valid coordinates or a non-empty address is required.",
        },
      },
    },

    address: { type: String, trim: true, default: "" },
    media: [MediaSchema],
    votes: { type: Number, default: 0 },
    voters: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
    reporter: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    status: {
      type: String,
      enum: ["Open", "Acknowledged", "In Progress", "Resolved", "Rejected"],
      default: "Open",
    },

    // ✨ Pending officer update (waiting admin approval)
    pendingStatus: {
      type: String,
      enum: ["Resolved", "Rejected", null],
      default: null,
    },

    statusHistory: [StatusHistorySchema],
    comments: [CommentSchema],
    priorityScore: { type: Number, default: 0 },
    questionToOfficer: { type: String, default: "" },
    officerProofMedia: [
      {
        url: String,
        mime: String,
      },
    ],

    // ----------------------------- Admin Verification
    adminVerification: AdminVerificationSchema,
  },
  { timestamps: true }
);

ReportSchema.index({ location: "2dsphere" });

ReportSchema.pre("save", function (next) {
  const severity = this.severity || 3;
  const votes = this.votes || 0;
  this.priorityScore = severity * 10 + votes * 5;
  next();
});

export default mongoose.model("Report", ReportSchema);

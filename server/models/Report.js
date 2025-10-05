// models/Report.js
import mongoose from "mongoose";

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
      type: { type: String, enum: ["Point"], default: "Point" },
      coordinates: {
        type: [Number],
        required: true,
        validate: {
          validator: function (v) {
            return v.length === 2;
          },
          message: "Location must have [longitude, latitude]",
        },
      },
    },
    media: [{ url: { type: String }, mime: { type: String } }],
    votes: { type: Number, default: 0 },
    voters: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
    reporter: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    status: {
      type: String,
      enum: ["Open", "Acknowledged", "In Progress", "Resolved"],
      default: "Open",
    },
    statusHistory: [
      {
        status: { type: String, required: true },
        by: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
        note: { type: String, default: "" },
        at: { type: Date, default: Date.now },
      },
    ],
    priorityScore: { type: Number, default: 0 },
    comments: [
      {
        message: { type: String, required: true },
        by: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "User",
          required: true,
        },
        reply: { type: String, default: "" },
        repliedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
        createdAt: { type: Date, default: Date.now },
      },
    ],
  },
  { timestamps: true }
);

// -----------------------------
// Geo index
// -----------------------------
ReportSchema.index({ location: "2dsphere" });

// -----------------------------
// Pre-save hook to calculate priority
// -----------------------------
ReportSchema.pre("save", function (next) {
  const severity = this.severity || 3;
  const votes = this.votes || 0;
  this.priorityScore = severity * 10 + votes * 5;
  next();
});

export default mongoose.model("Report", ReportSchema);

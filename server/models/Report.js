import mongoose from "mongoose";

const ReportSchema = new mongoose.Schema(
  {
    title: { type: String, required: true },
    description: { type: String, required: true },
    category: { type: String, required: true },
    severity: { type: Number, min: 1, max: 5, default: 3 },
    location: {
      type: { type: String, enum: ["Point"], default: "Point" },
      coordinates: { type: [Number], required: true }, // [lng, lat]
    },
    media: [{ url: String, mime: String }],
    votes: { type: Number, default: 0 },
    reporter: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    status: {
      type: String,
      enum: ["Open", "Acknowledged", "In Progress", "Resolved"],
      default: "Open",
    },
    statusHistory: [
      {
        status: String,
        by: mongoose.Schema.Types.ObjectId,
        note: String,
        at: { type: Date, default: Date.now },
      },
    ],
    priorityScore: { type: Number, default: 0 },
  },
  { timestamps: true }
);

// 🔑 Explicitly add 2dsphere index for geolocation
ReportSchema.index({ location: "2dsphere" });

export default mongoose.model("Report", ReportSchema);

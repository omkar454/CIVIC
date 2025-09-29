import mongoose from "mongoose";

const ReportSchema = new mongoose.Schema(
  {
    title: { type: String, required: true },
    description: { type: String, required: true },
    category: { type: String, required: true },
    severity: { type: Number, min: 1, max: 5, default: 3 },

    // Geo location
    location: {
      type: { type: String, enum: ["Point"], default: "Point" },
      coordinates: { type: [Number], required: true }, // [lng, lat]
    },

    // Media
    media: [{ url: String, mime: String }],

    // Voting
    votes: { type: Number, default: 0 },
    voters: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }], // tracks users who voted

    // Reporter
    reporter: { type: mongoose.Schema.Types.ObjectId, ref: "User" },

    // Status
    status: {
      type: String,
      enum: ["Open", "Acknowledged", "In Progress", "Resolved"],
      default: "Open",
    },
    statusHistory: [
      {
        status: String,
        by: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
        note: String,
        at: { type: Date, default: Date.now },
      },
    ],

    // Priority score (optional)
    priorityScore: { type: Number, default: 0 },

    // Comments / Q&A
    comments: [
      {
        message: String, // citizen question
        by: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
        reply: String, // officer reply
        repliedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
        createdAt: { type: Date, default: Date.now },
      },
    ],
  },
  { timestamps: true }
);

// 2dsphere index for geolocation
ReportSchema.index({ location: "2dsphere" });

export default mongoose.model("Report", ReportSchema);

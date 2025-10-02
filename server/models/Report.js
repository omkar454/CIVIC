import mongoose from "mongoose";

const ReportSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, "Title is required"],
      trim: true,
    },
    description: {
      type: String,
      required: [true, "Description is required"],
    },
    category: {
      type: String,
      required: [true, "Category is required"],
      trim: true,
    },
    severity: {
      type: Number,
      min: 1,
      max: 5,
      default: 3,
    },

    // Geo location
    location: {
      type: {
        type: String,
        enum: ["Point"],
        default: "Point",
      },
      coordinates: {
        type: [Number], // [lng, lat]
        required: true,
      },
    },

    // Media (images/videos)
    media: [
      {
        url: { type: String, required: true },
        mime: { type: String, required: true },
      },
    ],

    // Voting (citizens only)
    votes: { type: Number, default: 0 },
    voters: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],

    // Reporter (citizen who created the report)
    reporter: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    // Current Status
    status: {
      type: String,
      enum: ["Open", "Acknowledged", "In Progress", "Resolved"],
      default: "Open",
    },

    // Status History
    statusHistory: [
      {
        status: {
          type: String,
          enum: ["Open", "Acknowledged", "In Progress", "Resolved"],
        },
        by: { type: mongoose.Schema.Types.ObjectId, ref: "User" }, // officer/admin
        note: String,
        at: { type: Date, default: Date.now },
      },
    ],

    // Priority (for officer/admin queue)
    priorityScore: { type: Number, default: 0 },

    // Q&A (citizen questions + officer/admin replies)
    comments: [
      {
        message: { type: String, required: true }, // citizen question
        by: { type: mongoose.Schema.Types.ObjectId, ref: "User" }, // citizen
        reply: String, // officer/admin reply
        repliedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
        createdAt: { type: Date, default: Date.now },
      },
    ],
  },
  { timestamps: true }
);

// Geo index for location-based queries
ReportSchema.index({ location: "2dsphere" });

export default mongoose.model("Report", ReportSchema);

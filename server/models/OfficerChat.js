// models/OfficerChat.js
import mongoose from "mongoose";

const OfficerChatSchema = new mongoose.Schema(
  {
    officer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    sender: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    message: {
      type: String,
      required: true,
    },
    attachments: [
      {
        url: { type: String, required: true },
        mime: { type: String, default: "image/jpeg" },
      },
    ],
    isAdminMessage: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: true }
);

// Indexes for fast fetching of conversation history
OfficerChatSchema.index({ officer: 1, createdAt: -1 });

export default mongoose.model("OfficerChat", OfficerChatSchema);

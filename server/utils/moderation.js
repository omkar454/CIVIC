// server/utils/moderation.js
import axios from "axios";
import dotenv from "dotenv";
import User from "../models/User.js";

dotenv.config();

const RAG_API_URL = process.env.RAG_API_URL || "http://127.0.0.1:8004";

/**
 * Calls the local Python RAG service to perform semantic vulgarity analysis.
 * If vulgarity is detected, it automatically issues a strike/audit.
 * 
 * @param {string} text - The text to scan.
 * @param {string} userId - The ID of the user who submitted the text.
 * @param {string} userRole - The role of the user (citizen/officer).
 * @param {string} entityId - (Optional) ID of the report or chat message for logging.
 * @returns {Promise<{ isVulgar: boolean, score: number }>}
 */
export async function checkVulgarity(text, userId, userRole, entityId = null) {
  if (!text || text.trim().length === 0) {
    return { isVulgar: false, score: 0 };
  }

  try {
    const response = await axios.post(`${RAG_API_URL}/scan-vulgarity`, {
      text: text,
      threshold: 0.4 
    });

    const { is_toxic, score } = response.data;

    if (is_toxic) {
      console.warn(`🚨 VULGARITY DETECTED [Score: ${score}] for user ${userId || "GUEST"}. Triggering Strike/Audit.`);

      const reason = `Automated Security Block: Inappropriate/Vulgar language detected in ${userRole === 'officer' ? "official communication" : "public interaction"}.`;

      // Only apply Strike/Audit if the user is already registered (not in registration phase)
      const { message: warnMessage, attempts } = await User.autoWarn(
        userId,
        reason,
        "Vulgarity",
        null, 
        entityId
      );

      return { isVulgar: true, score, attempts, message: warnMessage };
    }

    return { isVulgar: false, score };
  } catch (error) {
    console.error("⚠️ Moderation scan failed (Is RAG service running?):", error.message);
    // Fail safe: allow the message if the service is down, but log the warning
    return { isVulgar: false, score: 0 };
  }
}

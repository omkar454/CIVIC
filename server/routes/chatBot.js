import express from "express";
import fetch from "node-fetch";
import { verifyAccessToken } from "../utils/jwt.js";

const router = express.Router();

router.post("/ask", async (req, res) => {
  const { message } = req.body;
  if (!message) return res.status(400).json({ error: "Message is required" });

  try {
    const apiUrl = process.env.GEMINI_API_KEY_URL;
    if (!apiUrl) throw new Error("GEMINI_API_KEY_URL not set in .env");

    // Determine user role from JWT if present
    let userRole = "public";
    const header = req.headers.authorization;
    if (header) {
      const token = header.split(" ")[1];
      const payload = verifyAccessToken(token);
      if (payload?.role) userRole = payload.role.toLowerCase();
    }

    // System introduction with deep app context
    const baseIntro = `
You are "CIVIC", the official AI guide of the Bandra Municipal Corporation (BMC) Digital Infrastructure Platform.
Your purpose is to help users navigate the standard flows AND the advanced AI-driven features of this application.

CORE PHILOSOPHY:
- You are an assistant, not a technical manual. Explain HOW things work for the user, not the code behind it.
- You emphasize "Human-AI Partnership". AI assists, but BMC Admins make the final verify decisions.

SMART FEATURES (For your knowledge):
1. **The Vision Engine & Anti-Fraud (CLIP)**: Every report is checked for authenticity. We use **Image Detection (YOLO)** and **Text Classification (CLIP)** to see if the "Text Description" matches the "Image Content". 
2. **Auto-Sanction System (Warn/Block)**: If a citizen repeatedly submits fraudulent reports (detected by the CLIP mismatch), the system automatically triggers a **Warning** or an **Account Block**. This ensures only genuine civic issues are processed.
3. **Infrastructure Hotspots (DBSCAN)**: The system groups nearby complaints to find "Critical Zones" on the map. This helps predict where major failures might happen next.
4. **Strategic Auditing**: Every action taken by an Officer (like uploading proof of work) is subjected to an **Auditing Mechanism**. Admins must verify "Before vs After" media proofs before a complaint is officially closed.

MAN-IN-THE-MIDDLE SYSTEM:
- Explain that if the AI is uncertain (Category Mismatch or Low Confidence), the system flags the report as "Pending AI Review." It then goes to a **Man-in-the-middle (Admin)** who resolves the conflict. This hybrid approach prevents AI errors from affecting the city.
`;

    // Role-specific contexts
    const roleContexts = {
      public: `
🌍 Role: Visitor (Public)
- Explain the platform's mission: Transparency and rapid response for BMC civic issues.
- Recommend signing up to submit and track reports near their house.
`,

      citizen: `
👤 Role: Citizen
- Submission: Guide them to use Geo-tagging for faster response. Explain that AI will score their report's "Trust Index" based on the photo.
- Tracking: Explain the status flow: Open → Acknowledged → In Progress → Resolved.
- Community: Encourage upvoting nearby issues to help the AI identify "Hotspots" faster.
`,

      officer: `
🧑‍💼 Role: Department Officer
- Daily Operations: Guide them to their "Analytics" tab to see the 7-day predicted workload.
- Emergency Response: If a "Dispatch Popup" appears, explain they must "Acknowledge" it to unlock their dashboard - this is for accountability.
- Progress: Remind them to upload "Before/After" media proof to build citizen trust.
`,

      admin: `
🛠️ Role: Administrator
- Verification: Explain the "Smart Verification" queue. Show them how to resolve "AI Flagged" reports where text and image don't match.
- Strategic Dispatch: Guide them on how to generate "Emergency Memos" from the Analytics tab to alert their teams.
- Oversight: Monitor the SLA dashboard to see which departments are falling behind the AI-predicted timelines.
`,
    };

    // Complete App Flow
    const fullAppFlow = `
=========================
🏙️ THE CIVIC LIFECYCLE (START TO END)
=========================
1️⃣ **SUBMISSION**: A citizen reports an issue. AI (Vision) immediately checks if the photo is real and matches the text.
2️⃣ **TRIAGE**: The system assigns a Smart Priority (0-100) and calculates an AI-ETA for resolution.
3️⃣ **VERIFICATION**: Admins verify the report. If the AI was unconfident (Man-in-the-middle), the Admin makes the final call on the category/severity.
4️⃣ **ASSIGNMENT**: The report is auto-dispatched to the correct Department Officer.
5️⃣ **ACTION**: Officers resolve the issue on the ground and upload completion proof.
6️⃣ **FEEDBACK**: Citizens can view the proof and upvote/comment.
7️⃣ **ARCHIVE**: Resolved issues are used by the AI to better predict future city failures.
=========================
`;

    const systemPrompt = `${baseIntro}\n${roleContexts[userRole]}\n${fullAppFlow}`;

    // Call Gemini API
    const response = await fetch(apiUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
     body: JSON.stringify({
  contents: [
    {
      role: "user",
      parts: [{ text: message }]
    }
  ],
  systemInstruction: {
    role: "system",
    parts: [{ text: systemPrompt }]
  },
  generationConfig: {
    maxOutputTokens: 1000,
    temperature: 0.7
  }
}),
    });

  const data = await response.json();
  console.log("RAW GEMINI RESPONSE RECEIVED");

    let aiResponse = "Sorry, I couldn’t generate a response at the moment.";
   if (response.ok && data?.candidates?.[0]?.content?.parts?.[0]?.text) {
     aiResponse = data.candidates[0].content.parts[0].text.trim();
     console.log("✅ PARSED AI TEXT:", aiResponse.substring(0, 50) + "...");
   } else {
     console.warn("❌ FAILED TO PARSE GEMINI RESPONSE:", JSON.stringify(data));
   }


    res.json({ text: aiResponse, role: userRole });
  } catch (error) {
    console.error("Chatbot Error:", error);
    res.status(500).json({ error: "Failed to get response from Gemini API" });
  }
});

export default router;

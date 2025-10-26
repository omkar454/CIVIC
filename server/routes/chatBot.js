// routes/chatBot.js
import express from "express";
import fetch from "node-fetch"; // Make sure node-fetch is installed
const router = express.Router();

router.post("/ask", async (req, res) => {
  const { message } = req.body;

  if (!message) {
    return res.status(400).json({ error: "Message is required" });
  }

  try {
    
    // Gemini API endpoint
    const apiUrl = process.env.GEMINI_API_KEY_URL;
    if (!apiUrl) throw new Error("GEMINI_API_KEY_URL not set in .env");

    const systemPrompt = `
You are 'CIVIC', a helpful AI assistant for the CIVIC Public Issue Tracker app. Your role is to guide users on how to use the app and answer questions about civic complaints based only on the information below.

KEY FEATURES:
- Submit complaints with location, description, photo, and video
- View nearby complaints and upvote
- Track status via map and notifications
- Multilingual support

GUIDELINES:
- Be concise, friendly, and helpful
- Encourage civic participation
- Only answer based on provided info
`;

    const response = await fetch(apiUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: systemPrompt }] },
        contents: [{ parts: [{ text: message }] }],
        generationConfig: {
          maxOutputTokens: 250,
          temperature: 0.7,
        },
      }),
    });

    const data = await response.json();

    // Extract AI response safely
    let aiResponse = "Sorry, I could not generate a response.";
    if (response.ok && data.candidates?.length > 0) {
      aiResponse =
        data.candidates[0].content?.parts[0]?.text?.trim() || aiResponse;
    }

    res.json({ text: aiResponse });
  } catch (error) {
    console.error("Error calling Gemini API:", error);
    res.status(500).json({ error: "Failed to get response from Gemini API" });
  }
});

export default router;

// routes/chatBot.js — RAG-Enhanced CIVIC Chatbot
// Integrates with the Python RAG microservice for contextual, data-driven responses.
import express from "express";
import fetch from "node-fetch";
import { verifyAccessToken } from "../utils/jwt.js";

const router = express.Router();

const RAG_API_URL = process.env.RAG_API_URL || "http://127.0.0.1:8004";

/**
 * Calls the Python RAG microservice to find similar complaints.
 * Returns { duplicate, results_count, results, search_time_ms }
 */
async function searchRAG(query, namespace, topK = 5) {
  try {
    const response = await fetch(`${RAG_API_URL}/search`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query, namespace, top_k: topK }),
    });

    if (!response.ok) {
      console.warn("⚠️ RAG search returned non-OK status:", response.status);
      return null;
    }

    return await response.json();
  } catch (err) {
    console.warn("⚠️ RAG service unreachable:", err.message);
    return null;
  }
}

/**
 * Builds a contextual string from RAG search results to inject into the Gemini prompt.
 */
function buildRAGContext(ragResults, namespace) {
  if (!ragResults || !ragResults.results || ragResults.results.length === 0) {
    return "";
  }

  const isFAQ = namespace === "faq";
  let context = isFAQ 
    ? "\n=== RELEVANT PLATFORM MANUAL SECTIONS ===\n" 
    : "\n=== RELEVANT COMPLAINTS FROM DATABASE ===\n";

  ragResults.results.forEach((item, idx) => {
    const data = item.full_data || item.metadata || {};
    
    if (isFAQ) {
        context += `\n[Manual Section ${idx + 1}]\n`;
        context += `${data.description || "N/A"}\n`;
    } else {
        const label = item.label === "duplicate" ? "🔴 DUPLICATE" : item.label === "related" ? "🟡 RELATED" : "🟢 NEW";
        const score = (item.score * 100).toFixed(1);

        context += `\n${idx + 1}. [${label} — ${score}% match]\n`;
        context += `   Title: ${data.title || "N/A"}\n`;
        context += `   Description: ${(data.description || "N/A").substring(0, 200)}\n`;
        context += `   Category: ${data.category || "N/A"}\n`;
        context += `   Status: ${data.status || "N/A"}\n`;
        context += `   Department: ${data.department || "N/A"}\n`;
        if (data.address) context += `   Location: ${data.address}\n`;
        if (data.severity) context += `   Severity: ${data.severity}/5\n`;
        if (data.votes) context += `   Community Votes: ${data.votes}\n`;
    }
  });

  context += isFAQ ? "\n=== END OF MANUAL SECTIONS ===\n" : "\n=== END OF DATABASE RESULTS ===\n";
  return context;
}

router.post("/ask", async (req, res) => {
  const { message, namespace } = req.body;
  if (!message) return res.status(400).json({ error: "Message is required" });

  try {
    const apiUrl = process.env.GEMINI_API_KEY_URL;
    if (!apiUrl) throw new Error("GEMINI_API_KEY_URL not set in .env");

    // ─── 1. Determine user role from JWT ──────────────────────
    let userRole = "public";
    const header = req.headers.authorization;
    if (header) {
      const token = header.split(" ")[1];
      const payload = verifyAccessToken(token);
      if (payload?.role) userRole = payload.role.toLowerCase();
    }

    // ─── 2. Call RAG Service for context retrieval ────────────
    console.log(`🔍 RAG Search [${namespace || 'complaints'}]: "${message.substring(0, 60)}..."`);
    const ragResults = await searchRAG(message, namespace || "complaints");

    const ragContext = buildRAGContext(ragResults, namespace || "complaints");
    const hasDuplicate = ragResults?.duplicate || false;
    const similarIssues = ragResults?.results || [];

    if (ragResults) {
      console.log(`📊 RAG: ${ragResults.results_count} results, duplicate=${hasDuplicate}, time=${ragResults.search_time_ms}ms`);
    }

    // ─── 3. Build Gemini System Prompt ────────────────────────

    let baseIntro = `
You are "CIVIC", the AI assistant for the Bandra Municipal Corporation (BMC) Digital Infrastructure Platform.
You have access to REAL COMPLAINT DATA from the CIVIC database provided below as context.

STRICT FORMATTING RULES:
- NEVER use markdown. No asterisks (*), no hashes (#), no bold (**), no bullet points with asterisks.
- NEVER use emojis.
- Use plain text only. Use dashes (-) for lists and indentation for sub-items.
- For complaint data, use this exact structure:

  Resolved Issue: "Title" (Category)
    - Location: address or area
    - Status: Resolved
    - Details: brief description, severity, department

  Open Issue: "Title" (Category)
    - Description: what was reported
    - Status: Open
    - Details: category, department, any relevant info

CONTENT RULES:
- When complaint data is available, give a DETAILED response referencing each complaint individually.
- Include title, category, status, department, severity, and description for each complaint.
- Group by status (Resolved, Open, In Progress, etc.) when possible.
- If the user asks about a location, say you scanned the database for that area.
- If a duplicate exists (score above 80%), mention it and give its current status.
- Only explain platform features if the user specifically asks about them.
- Respond in the same language the user writes in.
`;

    if (namespace === "faq") {
      baseIntro = `
You are "CIVIC", the AI assistant for the Bandra Municipal Corporation (BMC) Digital Infrastructure Platform.
You are currently in 'General FAQ' mode. Your goal is to answer the user's questions about the platform STRICTLY using the FAQ manual context provided below.

STRICT FORMATTING RULES:
- NEVER use markdown. No asterisks (*), no hashes (#), no bold (**), no bullet points with asterisks.
- NEVER use emojis.
- Use plain text only. Use dashes (-) for lists and indentation for sub-items.

CONTENT RULES:
- Be conversional, direct, and highly helpful.
- DO NOT use the strict complaint formatting ("Resolved Issue:", "Open Issue:"). Just answer the user's question clearly.
- If the answer is not in the FAQ context provided, politely state that you do not have that information in the manuals.
- Respond in the same language the user writes in.
`;
    }

    const roleContexts = {
      public: `The user is a public visitor. Keep answers general and suggest signing up if they want to report issues.`,
      citizen: `The user is a registered citizen. They can file complaints, track status, and upvote issues.`,
      officer: `The user is a department officer. They manage assigned reports, update statuses, and upload resolution proofs.`,
    };

    const systemPrompt = `${baseIntro}\nUser role: ${roleContexts[userRole] || roleContexts.public}\n${ragContext}`;

    // ─── 4. Call Gemini API ───────────────────────────────────

    const response = await fetch(apiUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [
          {
            role: "user",
            parts: [{ text: message }],
          },
        ],
        systemInstruction: {
          role: "system",
          parts: [{ text: systemPrompt }],
        },
        generationConfig: {
          maxOutputTokens: 4096,
          temperature: 0.7,
        },
      }),
    });

    const data = await response.json();
    console.log(`RAW GEMINI RESPONSE [Status ${response.status}] RECEIVED`);

    let aiResponse = "Sorry, I couldn't generate a response at the moment.";

    if (response.ok && data?.candidates?.[0]?.content?.parts?.[0]?.text) {
      aiResponse = data.candidates[0].content.parts[0].text.trim();
      console.log("✅ PARSED AI TEXT:", aiResponse.substring(0, 80) + "...");
    } else if (response.status === 429 || data?.error?.status === "RESOURCE_EXHAUSTED") {
      console.warn("⚠️ GEMINI 429 QUOTA EXCEEDED");
      aiResponse = "API Quota Exceeded. The AI model has reached its daily limit for this API key. Please try again later or wait for the quota to reset.";
    } else if (response.status === 503 || data?.error?.code === 503) {
      console.warn("⚠️ GEMINI 503 HIGH DEMAND ERROR");
      aiResponse = "The AI model is currently experiencing high demand. The RAG system retrieved the data, but the AI could not process it right now. Please try again in a few seconds.";
    } else if (data?.candidates?.[0]?.finishReason === "SAFETY") {
      console.warn("⚠️ GEMINI RESPONSE BLOCKED BY SAFETY FILTER");
      aiResponse = "I'm sorry, but I cannot provide a response to that query due to safety guidelines. However, I have found some relevant complaints in our database for you to review below.";
    } else {
      console.warn("❌ FAILED TO PARSE GEMINI RESPONSE:", JSON.stringify(data, null, 2));
      if (data?.error?.message) {
        aiResponse = `AI Error: ${data.error.message}`;
      }
    }

    // ─── 5. Build Response ────────────────────────────────────

    // Extract simplified similar issues for the frontend
    const simplifiedSimilar = similarIssues
      .filter((item) => item.is_related || item.is_duplicate)
      .map((item) => ({
        id: item.id,
        title: item.full_data?.title || item.metadata?.title || "Unknown",
        category: item.full_data?.category || item.metadata?.category || "",
        status: item.full_data?.status || item.metadata?.status || "",
        score: item.score,
        label: item.label,
      }));

    res.json({
      text: aiResponse,
      role: userRole,
      duplicate: hasDuplicate,
      similar_issues: simplifiedSimilar,
      rag_search_time_ms: ragResults?.search_time_ms || null,
    });
  } catch (error) {
    console.error("Chatbot Error:", error);
    res.status(500).json({ error: "Failed to get response from Gemini API" });
  }
});

export default router;

import { useState, useRef, useEffect } from "react";

function ChatBot({ userRole = "public", token = null }) {
  const [namespaceContext, setNamespaceContext] = useState(null);
  const [messages, setMessages] = useState(() => {
    // Optional: load past chat from localStorage
    const saved = localStorage.getItem("civic_chat_history");
    return saved ? JSON.parse(saved) : [];
  });
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef(null);

  // ✅ Instant answers for common FAQs
  const instantAnswers = {
    "How do I file a complaint?":
      "Filing a complaint on CIVIC is simple:\n1️⃣ Go to 'Raise Issue' in the app.\n2️⃣ Add title, description, and category.\n3️⃣ Attach a photo/video if available.\n4️⃣ Pin the exact location.\nYour report will be sent to the concerned department!",
    "How can I track my complaint?":
      "Go to 'My Complaints' to see real-time updates — status moves from Open → Acknowledged → In Progress → Resolved.",
    "Can I upvote others' complaints?":
      "Yes! You can upvote others' issues to highlight common civic problems and improve visibility.",
    "What is SLA in CIVIC?":
      "SLA (Service Level Agreement) defines the expected resolution time for a complaint. Delays beyond SLA are flagged to the admin for accountability.",
    "How does verification work?":
      "There are two layers of verification:\n1️⃣ Citizen verification ensures reports are genuine.\n2️⃣ Admin verification checks officer submissions and resolutions.",
  };
  const quickQuestions = Object.keys(instantAnswers);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

useEffect(() => {
  // 🧹 Debounce localStorage + scrolling
  const id = setTimeout(() => {
    scrollToBottom();
    localStorage.setItem("civic_chat_history", JSON.stringify(messages));
  }, 50); // even 50ms debounce is enough

  return () => clearTimeout(id);
}, [messages]);


  // ✅ Core message send handler
  async function sendMessage(quickQ = null) {
    const userMessage = (quickQ || input).trim();
    if (!userMessage) return;

    // Add user message
    setMessages((prev) => [...prev, { role: "user", text: userMessage }]);
    setInput("");
    setLoading(true);

    // Check for instant answer
    if (instantAnswers[userMessage]) {
      setTimeout(() => {
        setMessages((prev) => [
          ...prev,
          { role: "ai", text: instantAnswers[userMessage] },
        ]);
        setLoading(false);
      }, 250);
      return;
    }

    try {
      const res = await fetch("http://localhost:5000/api/chat/ask", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ message: userMessage, namespace: namespaceContext || "complaints" }),
      });

      let data = {};
      try {
        data = await res.json(); // ✅ direct safe JSON parsing
      } catch (e) {
        console.error("Invalid JSON from server:", e);
        data = { text: "Server sent invalid JSON." };
      }

      const aiResponse =
        data.text ||
        "CIVIC Assistant is currently unavailable. Please try again shortly.";

      // Build the AI message object with RAG metadata
      const aiMessage = {
        role: "ai",
        text: aiResponse,
        duplicate: data.duplicate || false,
        similar_issues: data.similar_issues || [],
        rag_search_time_ms: data.rag_search_time_ms || null,
      };

      setMessages((prev) => [...prev, aiMessage]);
    } catch (err) {
      console.error("ChatBot error:", err);
      setMessages((prev) => [
        ...prev,
        {
          role: "ai",
          text: "⚠️ Unable to connect to server. Try again later.",
        },
      ]);
    } finally {
      setLoading(false);
    }
  }

  const handleKeyPress = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  // ✅ Render a single message bubble
  function renderMessage(msg, idx) {
    if (msg.role === "user") {
      return (
        <div key={idx} className="flex justify-end">
          <div className="px-4 py-3 rounded-2xl max-w-[80%] break-words text-sm bg-purple-600 text-white rounded-br-lg">
            {msg.text}
          </div>
        </div>
      );
    }

    // AI message
    return (
      <div key={idx} className="flex flex-col items-start gap-2">
        {/* Duplicate Alert Banner */}
        {msg.duplicate && (
          <div className="w-full max-w-[85%] bg-red-900/40 border border-red-500/50 rounded-xl px-4 py-2.5 text-sm">
            <div className="flex items-center gap-2 text-red-300 font-semibold mb-1">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.34 16.5c-.77.833.192 2.5 1.732 2.5z" />
              </svg>
              Duplicate Detected
            </div>
            <p className="text-red-200 text-xs">A similar complaint already exists in the system. Consider upvoting the existing one instead.</p>
          </div>
        )}

        {/* Main AI Response */}
        <div className="px-4 py-3 rounded-2xl max-w-[80%] break-words text-sm bg-gray-700 text-gray-100 rounded-bl-lg whitespace-pre-wrap">
          {msg.text}
        </div>

        {/* Similar Issues Cards */}
        {msg.similar_issues && msg.similar_issues.length > 0 && (
          <div className="w-full max-w-[85%] space-y-1.5 mt-1">
            <p className="text-xs text-gray-400 font-medium px-1">
              📋 Related Complaints ({msg.similar_issues.length})
            </p>
            {msg.similar_issues.map((issue, i) => (
              <div
                key={i}
                className={`rounded-lg px-3 py-2 text-xs border ${
                  issue.label === "duplicate"
                    ? "bg-red-900/20 border-red-700/40 text-red-200"
                    : "bg-yellow-900/20 border-yellow-700/40 text-yellow-200"
                }`}
              >
                <div className="flex justify-between items-start gap-2">
                  <span className="font-medium truncate flex-1">{issue.title}</span>
                  <span className={`shrink-0 text-[10px] rounded-full px-2 py-0.5 font-semibold ${
                    issue.label === "duplicate"
                      ? "bg-red-500/30 text-red-300"
                      : "bg-yellow-500/30 text-yellow-300"
                  }`}>
                    {issue.label === "duplicate" ? "DUPLICATE" : "RELATED"} {(issue.score * 100).toFixed(0)}%
                  </span>
                </div>
                <div className="flex gap-3 mt-1 text-[10px] opacity-70">
                  {issue.category && <span>📂 {issue.category}</span>}
                  {issue.status && <span>📊 {issue.status}</span>}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* RAG metadata footer */}
        {msg.rag_search_time_ms && (
          <span className="text-[10px] text-gray-500 px-1">
            🔍 RAG search: {msg.rag_search_time_ms}ms
          </span>
        )}
      </div>
    );
  }

  const handleBack = () => {
    setNamespaceContext(null);
    setMessages([]); // Clear chat history when switching modes
  };

  if (!namespaceContext) {
    return (
      <div className="flex flex-col w-full h-full bg-gray-900 text-white p-6 justify-center items-center">
        <div className="w-16 h-16 bg-purple-600 rounded-full flex items-center justify-center mb-6 shadow-lg shadow-purple-500/20">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
          </svg>
        </div>
        <h1 className="text-2xl font-bold mb-2">CIVIC Assistant</h1>
        <p className="text-gray-400 mb-8 max-w-xs text-center text-sm">Select an AI mode to get started.</p>
        
        <div className="w-full max-w-sm space-y-4">
          <button 
            onClick={() => setNamespaceContext("faq")}
            className="w-full bg-gray-800 hover:bg-gray-700 border border-gray-700 p-4 rounded-xl flex items-center gap-4 transition-all hover:border-purple-500 group"
          >
            <span className="text-2xl">📚</span>
            <div className="text-left flex-1">
              <h3 className="font-semibold text-white group-hover:text-purple-400 transition-colors">General FAQs</h3>
              <p className="text-xs text-gray-400">Ask how to use the platform</p>
            </div>
            <span className="text-gray-500 group-hover:text-purple-400">→</span>
          </button>
          
          <button 
            onClick={() => setNamespaceContext("complaints")}
            className="w-full bg-gray-800 hover:bg-gray-700 border border-gray-700 p-4 rounded-xl flex items-center gap-4 transition-all hover:border-purple-500 group"
          >
            <span className="text-2xl">📍</span>
            <div className="text-left flex-1">
              <h3 className="font-semibold text-white group-hover:text-purple-400 transition-colors">Search Complaints</h3>
              <p className="text-xs text-gray-400">Query live neighborhood issues</p>
            </div>
            <span className="text-gray-500 group-hover:text-purple-400">→</span>
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col w-full h-full bg-gray-900 text-white">
      {/* Header */}
      <div className="bg-gray-800/90 border-b border-gray-700 p-4 flex items-center gap-3 shadow-md relative">
        <button onClick={handleBack} className="absolute left-4 p-2 text-gray-400 hover:text-white transition">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
          </svg>
        </button>
        <div className="ml-10 w-8 h-8 bg-purple-500 rounded-full flex items-center justify-center">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-5 w-5 text-white"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
            />
          </svg>
        </div>
        <div>
          <h1 className="font-semibold text-lg">
            {namespaceContext === "faq" ? "General FAQs" : "Complaint Search"}
          </h1>
          <p className="text-xs text-gray-400">
            RAG-Powered · Role: {userRole.charAt(0).toUpperCase() + userRole.slice(1)}
          </p>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-gray-800/40">
        {messages.length === 0 ? (
          <div className="text-center text-gray-400 mt-10">
            <p className="text-white font-semibold mb-2 text-lg">
              👋 Hello! I'm CIVIC, your AI assistant.
            </p>
            <p className="mb-1 text-sm text-gray-400">
              I'm powered by <span className="text-purple-400 font-medium">RAG</span> — I'm using the <span className="text-white font-bold">{namespaceContext === "faq" ? 'FAQ Knowledge Base' : 'Complaint Database'}</span>.
            </p>
            <p className="mb-4 text-xs text-gray-500">
              {namespaceContext === "faq" ? 'Ask me how to use the platform!' : 'Ask me about active issues or duplicates.'}
            </p>
            <div className="flex flex-col gap-2 max-w-sm mx-auto">
              {quickQuestions.map((q, idx) => (
                <button
                  key={idx}
                  onClick={() => sendMessage(q)}
                  className="bg-gray-700 hover:bg-gray-600 text-white border border-gray-600 rounded-lg py-2 px-4 text-sm text-left"
                >
                  {q}
                </button>
              ))}
            </div>
          </div>
        ) : (
          messages.map((msg, idx) => renderMessage(msg, idx))
        )}

        {loading && (
          <div className="flex justify-start">
            <div className="bg-gray-700 text-white px-4 py-3 rounded-2xl rounded-bl-lg flex items-center gap-3">
              <div className="flex gap-1">
                <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></span>
                <span
                  className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"
                  style={{ animationDelay: "0.15s" }}
                ></span>
                <span
                  className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"
                  style={{ animationDelay: "0.3s" }}
                ></span>
              </div>
              <span className="italic text-gray-300 text-xs">
                CIVIC is searching & thinking...
              </span>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="p-4 bg-gray-800 border-t border-gray-700 flex items-center gap-2">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyPress={handleKeyPress}
          placeholder="Ask about CIVIC platform..."
          disabled={loading}
          className="flex-1 bg-gray-700 border border-gray-600 text-white placeholder-gray-400 rounded-full px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
        />
        <button
          onClick={() => sendMessage()}
          disabled={loading || !input.trim()}
          className="bg-purple-600 hover:bg-purple-700 disabled:bg-purple-800 rounded-full p-3 w-12 h-12 flex items-center justify-center text-white transition"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 20 20"
            fill="currentColor"
            className="w-5 h-5"
          >
            <path d="M10.894 2.553a1 1 0 00-1.788 0l-7 14a1 1 0 001.169 1.409l5-1.429A1 1 0 009 15.571V11a1 1 0 112 0v4.571a1 1 0 00.725.962l5 1.428a1 1 0 001.17-1.408l-7-14z" />
          </svg>
        </button>
      </div>
    </div>
  );
}

export default ChatBot;

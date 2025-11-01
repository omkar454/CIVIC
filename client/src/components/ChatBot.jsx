import { useState, useRef, useEffect } from "react";

function ChatBot({ userRole = "public", token = null }) {
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
    "Can I upvote others’ complaints?":
      "Yes! You can upvote others’ issues to highlight common civic problems and improve visibility.",
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
    scrollToBottom();
    localStorage.setItem("civic_chat_history", JSON.stringify(messages));
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
        body: JSON.stringify({ message: userMessage }),
      });

      const text = await res.text();
      const data = text ? JSON.parse(text) : {};
      const aiResponse =
        data.text ||
        "CIVIC Assistant is currently unavailable. Please try again shortly.";

      setMessages((prev) => [...prev, { role: "ai", text: aiResponse }]);
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

  return (
    <div className="flex flex-col w-full h-full bg-gray-900 text-white">
      {/* Header */}
      <div className="bg-gray-800/90 border-b border-gray-700 p-4 flex items-center gap-3 shadow-md">
        <div className="w-8 h-8 bg-purple-500 rounded-full flex items-center justify-center">
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
          <h1 className="font-semibold text-lg">CIVIC Assistant</h1>
          <p className="text-xs text-gray-400">
            Role: {userRole.charAt(0).toUpperCase() + userRole.slice(1)}
          </p>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-gray-800/40">
        {messages.length === 0 ? (
          <div className="text-center text-gray-400 mt-10">
            <p className="text-white font-semibold mb-2 text-lg">
              👋 Hello! I'm CIVIC, your assistant.
            </p>
            <p className="mb-4 text-sm text-gray-400">
              Ask me anything about using the CIVIC app — complaint submission,
              tracking, SLA, or departments.
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
          messages.map((msg, idx) => (
            <div
              key={idx}
              className={`flex ${
                msg.role === "user" ? "justify-end" : "justify-start"
              }`}
            >
              <div
                className={`px-4 py-3 rounded-2xl max-w-[80%] break-words text-sm ${
                  msg.role === "user"
                    ? "bg-purple-600 text-white rounded-br-lg"
                    : "bg-gray-700 text-gray-100 rounded-bl-lg"
                }`}
              >
                {msg.text}
              </div>
            </div>
          ))
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
                CIVIC is thinking...
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

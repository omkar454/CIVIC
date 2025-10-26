import { useState, useRef, useEffect } from "react";

function Chatbot() {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef(null);

  // Predefined instant answers
  const instantAnswers = {
    "How do I file a complaint?":
      "Filing a complaint on CIVIC is simple:\n1. Report: Open the CIVIC app and look for 'Raise Issues' or 'Report'.\n2. Describe: Provide a clear description of your problem.\n3. Add Visuals: Upload a photo or video.\n4. Pin Location: Mark the exact spot using the map.\nYour report makes the community better!",
    "How to view other complaints?":
      "To view complaints:\n1. Tap the map or nearby issues section.\n2. Browse through issues, upvote or comment.\n3. Track real-time status by following updates.",
    "How long will my complaint take?":
      "Resolution times vary by issue and department workload. You can always track your complaint status in the app, and new features will improve notifications and escalation.",
    "Can I upvote complaints?":
      "Yes! You can upvote others' complaints. This helps highlight common issues so authorities prioritize them.",
  };

  const quickQuestions = Object.keys(instantAnswers);

  const handleQuickQuestion = (question) => {
    generateAnswer(question); // Don't set input, just send
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

async function generateAnswer(quickQuestion = null) {
  const userMessage = (quickQuestion || input).trim();
  if (!userMessage) return;

  setInput("");
  setMessages((prev) => [...prev, { role: "user", text: userMessage }]);
  setLoading(true);

  // Instant answers
  if (instantAnswers[userMessage]) {
    setTimeout(() => {
      setMessages((prev) => [
        ...prev,
        { role: "ai", text: instantAnswers[userMessage] },
      ]);
      setLoading(false);
    }, 200);
    return;
  }

  try {
    const response = await fetch("http://localhost:5000/api/chat/ask", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: userMessage }),
    });

    let data = {};
    try {
      // Try parsing only if response is not empty
      const text = await response.text();
      data = text ? JSON.parse(text) : {};
    } catch (parseErr) {
      console.error("Failed to parse JSON:", parseErr);
    }

    if (!response.ok) {
      console.error("Backend error:", data);
      throw new Error(`Backend returned status ${response.status}`);
    }

    const aiResponse =
      data.text ||
      "CIVIC can help you report, track, and resolve civic issues. Please try again later.";

    setMessages((prev) => [...prev, { role: "ai", text: aiResponse }]);
  } catch (error) {
    console.error("Error generating answer:", error);
    setMessages((prev) => [
      ...prev,
      { role: "ai", text: "Error generating answer. Please try again later." },
    ]);
  } finally {
    setLoading(false);
  }
}


  const handleKeyPress = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      generateAnswer();
    }
  };

  return (
    <div className="flex flex-col w-full h-full bg-transparent">
      {/* Header */}
      <div className="bg-gray-800/90 backdrop-blur-md border-b border-gray-700 p-4 shadow-sm flex-shrink-0 z-10">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-purple-500 rounded-full flex items-center justify-center">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-6 w-6 text-white"
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
          <h1 className="text-lg font-semibold text-white">CIVIC</h1>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 bg-gray-800/50">
        <div className="flex flex-col gap-3">
          {messages.length === 0 && (
            <div className="text-center p-6 text-gray-300">
              <p className="text-lg font-semibold text-white mb-2">
                Hello! I am the CIVIC Assistant.
              </p>
              <p className="text-sm text-gray-400 mb-6">
                Ask me anything about CIVIC features or reporting problems.
              </p>
              <div className="flex flex-col gap-2">
                {quickQuestions.map((q, idx) => (
                  <button
                    key={idx}
                    onClick={() => handleQuickQuestion(q)}
                    className="w-full bg-gray-700 hover:bg-gray-600 border border-gray-600 rounded-lg py-3 px-4 text-sm text-white text-left"
                  >
                    {q}
                  </button>
                ))}
              </div>
            </div>
          )}

          {messages.map((msg, idx) => (
            <div
              key={idx}
              className={`flex ${
                msg.role === "user" ? "justify-end" : "justify-start"
              }`}
            >
              <div
                className={`p-3 rounded-2xl max-w-[80%] break-words text-sm ${
                  msg.role === "user"
                    ? "bg-blue-600 text-white rounded-br-lg"
                    : "bg-gray-700 text-white rounded-bl-lg"
                }`}
              >
                <p>{msg.text}</p>
              </div>
            </div>
          ))}

          {loading && (
            <div className="flex justify-start">
              <div className="p-3 rounded-2xl bg-gray-700 text-white rounded-bl-lg">
                <div className="flex items-center gap-2">
                  <div className="flex gap-1">
                    <span
                      className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"
                      style={{ animationDelay: "0s" }}
                    ></span>
                    <span
                      className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"
                      style={{ animationDelay: "0.2s" }}
                    ></span>
                    <span
                      className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"
                      style={{ animationDelay: "0.4s" }}
                    ></span>
                  </div>
                  <span className="text-sm italic text-gray-300">
                    CIVIC is thinking...
                  </span>
                </div>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Input */}
      <div className="p-4 bg-gray-800/90 backdrop-blur-md border-t border-gray-700 flex-shrink-0">
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="Ask about the CIVIC platform..."
            disabled={loading}
            className="flex-1 border border-gray-600 rounded-full py-3 px-4 text-sm bg-gray-700 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500"
          />
          <button
            onClick={() => generateAnswer()}
            disabled={loading || !input.trim()}
            className="bg-purple-600 text-white rounded-full p-3 w-12 h-12 flex items-center justify-center hover:bg-purple-700 disabled:bg-purple-800 disabled:text-gray-400"
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
    </div>
  );
}

export default Chatbot;

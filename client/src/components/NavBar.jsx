// src/components/Navbar.jsx
import { Link } from "react-router-dom";
import { useState } from "react";
import NotificationBell from "./NotificationBell";
import GoogleTranslate from "./GoogleTranslate"; // <-- 1. IMPORT
import ChatModal from "./ChatBotModal"; // <-- 2. IMPORT CHAT MODAL
export default function Navbar({
  darkMode,
  toggleDarkMode,
  handleLogout,
  role,
  name,
  onOpenChat,
}) {
  const [showChatModal, setShowChatModal] = useState(false);
  
  // Only show notification bell for officers and citizens
  const showNotificationBell = role === "citizen" || role === "officer" || role === "admin";
  
  const handleOpenChat = () => {
    setShowChatModal(true);
  };
  
  const handleCloseChat = () => {
    setShowChatModal(false);
  };

  return (
    <nav className="flex justify-between items-center bg-white dark:bg-gray-800 shadow px-6 py-3">
      <div className="text-xl font-bold text-blue-600 dark:text-blue-300">
        BMC Portal
      </div>

      <div className="flex items-center gap-4">
        {role && (
          <span className="text-sm text-gray-700 dark:text-gray-300">
            Welcome, <strong>{name}</strong> ({role})
          </span>
        )}
        <div className="relative">
          <button 
            onClick={handleOpenChat} 
            className="relative p-2 rounded-full text-blue-600 dark:text-blue-300 hover:bg-gray-100 dark:hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-50 transition-colors group"
            aria-label="Open Civic Assistant" // Good for accessibility
          >
            <div className="relative">
              <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center shadow-lg group-hover:shadow-blue-500/50 transition-all duration-300">
                <svg
                  viewBox="0 0 32 32"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-5 w-5"
                >
                  {/* Outer rounded rectangle */}
                  <rect
                    x="6"
                    y="10"
                    width="20"
                    height="12"
                    rx="6"
                    stroke="#20E0E0"
                    strokeWidth="2"
                    fill="none"
                  />
                  {/* Left ear */}
                  <rect
                    x="2"
                    y="15"
                    width="4"
                    height="4"
                    rx="1"
                    stroke="#20E0E0"
                    strokeWidth="2"
                    fill="none"
                  />
                  {/* Right ear */}
                  <rect
                    x="26"
                    y="15"
                    width="4"
                    height="4"
                    rx="1"
                    stroke="#20E0E0"
                    strokeWidth="2"
                    fill="none"
                  />
                  {/* Eyes */}
                  <rect
                    x="11"
                    y="15"
                    width="2"
                    height="4"
                    rx="1"
                    fill="#20E0E0"
                  />
                  <rect
                    x="19"
                    y="15"
                    width="2"
                    height="4"
                    rx="1"
                    fill="#20E0E0"
                  />
                  {/* Antenna */}
                  <rect
                    x="15"
                    y="6"
                    width="2"
                    height="6"
                    rx="1"
                    fill="#20E0E0"
                  />
                </svg>
              </div>
              {/* Pulsing indicator */}
              <div className="absolute -top-1 -right-1 w-3 h-3 bg-green-500 rounded-full animate-pulse"></div>
            </div>
          </button>
          
          {/* Chat Modal Dropdown */}
          {showChatModal && <ChatModal onClose={handleCloseChat} />}
        </div>
        {showNotificationBell && <NotificationBell />}

        <GoogleTranslate /> {/* <-- 2. ADD COMPONENT HERE */}

        <button
          onClick={toggleDarkMode}
          className="px-3 py-1 rounded bg-gray-200 dark:bg-gray-700"
        >
          {darkMode ? "Light" : "Dark"}
        </button>

        {role && (
          <button
            onClick={handleLogout}
            className="px-3 py-1 rounded bg-red-500 text-white"
          >
            Logout
          </button>
        )}
      </div>
    </nav>
  );
}

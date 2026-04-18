import React from 'react';
import { useNavigate } from 'react-router-dom';

const SecurityBlockModal = ({ isOpen, onClose, fraudData }) => {
  const navigate = useNavigate();
  if (!isOpen) return null;

  const userRole = localStorage.getItem("role"); // citizen, officer, admin
  const isOfficer = userRole === "officer";

  const attempts = fraudData?.abuseData?.attempts || 0;
  const isPermanent = attempts >= 6 && !isOfficer;

  // Theme configuration based on role/severity
  // Note: 'black' doesn't have a -600 suffix in tailwind, so we handle it explicitly
  const themes = {
    officer: {
      title: "CONDUCT ADVISORY",
      colorClass: "border-indigo-600 dark:border-indigo-500",
      bgClass: "bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600",
      icon: "⚖️",
      titleColor: "text-indigo-600 dark:text-indigo-400"
    },
    permanent: {
      title: "ACCESS TERMINATED",
      colorClass: "border-black dark:border-red-900",
      bgClass: "bg-black text-white",
      icon: "🚫",
      titleColor: "text-black dark:text-red-500"
    },
    warning: {
      title: "SECURITY BLOCK",
      colorClass: "border-red-600 dark:border-red-500",
      bgClass: "bg-red-100 dark:bg-red-900/30 text-red-600 animate-bounce",
      icon: "👮",
      titleColor: "text-red-600 dark:text-red-400"
    }
  };

  const theme = isOfficer ? themes.officer : (isPermanent ? themes.permanent : themes.warning);

  return (
    <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/90 backdrop-blur-md p-4">
      <div className={`bg-white dark:bg-gray-800 rounded-3xl shadow-2xl p-8 max-w-md w-full border-r-8 border-l-8 transform transition-all duration-500 scale-105 ${theme.colorClass}`}>
        <div className="flex flex-col items-center text-center space-y-6">
          <div className={`w-24 h-24 rounded-full flex items-center justify-center ${theme.bgClass}`}>
            <span className="text-4xl">{theme.icon}</span>
          </div>
          
          <div className="space-y-2">
            <h3 className={`text-3xl font-black uppercase tracking-tighter ${theme.titleColor}`}>
              {theme.title}
            </h3>
            
            {/* 🛑 Only show Violation Dots for Citizens */}
            {!isOfficer && !isPermanent && (
              <div className="flex items-center justify-center gap-2">
                <div className="flex gap-1">
                  {[...Array(6)].map((_, i) => (
                    <div 
                      key={i} 
                      className={`h-2 w-6 rounded-full ${i < attempts ? "bg-red-600" : "bg-gray-200 dark:bg-gray-700"}`}
                    />
                  ))}
                </div>
                <span className="text-xs font-black text-red-600 uppercase">{attempts}/6 Violations</span>
              </div>
            )}
          </div>

          <p className="text-gray-600 dark:text-gray-300 font-medium leading-relaxed">
            {fraudData?.message || "🛡️ [ADVISORY]: Please avoid using unprofessional or vulgar language in official communications."}
            <br />
            <span className="text-sm opacity-70 mt-4 block">
              {isOfficer 
                ? "Staff members are expected to maintain professional standards. This incident has been specifically logged for Administrative review."
                : (isPermanent 
                    ? "This account is now permanently disabled. No further actions are allowed." 
                    : "Continuous violations will result in immediate account termination.")
              }
            </span>
          </p>

          <div className="w-full pt-4 flex flex-col gap-3">
            {isPermanent ? (
              <button
                onClick={() => {
                  localStorage.clear();
                  navigate("/login");
                  window.location.reload(); 
                }}
                className="w-full bg-black hover:bg-gray-900 text-white font-bold py-4 rounded-2xl shadow-xl transition-all active:scale-95 flex items-center justify-center gap-2"
              >
                Logout & Exit Platform
              </button>
            ) : (
              <>
                {!isOfficer && (
                  <button
                    onClick={() => navigate("/")}
                    className="w-full bg-red-600 hover:bg-red-700 text-white font-bold py-4 rounded-2xl shadow-lg shadow-red-500/30 transition-all active:scale-95 flex items-center justify-center gap-2"
                  >
                    🛡️ View Account Integrity
                  </button>
                )}
                <button
                  onClick={onClose}
                  className={`w-full ${isOfficer ? "bg-indigo-600 hover:bg-indigo-700 text-white py-4 rounded-2xl shadow-lg" : "text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 text-sm"} font-bold transition-all active:scale-95`}
                >
                  {isOfficer ? "Acknowledge" : "Confirm & Dismiss"}
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default SecurityBlockModal;

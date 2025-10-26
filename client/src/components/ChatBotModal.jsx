import React, { useEffect, useRef } from 'react';
import Chatbot from './ChatBot'; // Import the chatbot component

export default function ChatModal({ onClose }) {
  const modalRef = useRef(null);

  // Close dropdown when clicking outside -:
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (modalRef.current && !modalRef.current.contains(event.target)) {
        onClose();
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [onClose]);

  return (
    <div 
      ref={modalRef}
      className="fixed top-20 right-5 bg-gray-800 rounded-lg shadow-2xl w-96 h-[600px] flex flex-col overflow-hidden border border-gray-700 z-[1001]"
      onClick={(e) => e.stopPropagation()} // Prevent clicks inside modal from closing it
    >
      {/* Close Button */}
      <button 
        className="absolute top-3 right-3 text-gray-400 hover:text-white z-20 bg-gray-700 rounded-full w-8 h-8 flex items-center justify-center"
        onClick={onClose}
        aria-label="Close chat"
      >
        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
      
      {/* Render your chatbot component inside the modal */}
      <Chatbot />
    </div>
  );
}


import React, { useState, useEffect, useRef } from "react";
import axios from "axios";
import { Send, Paperclip, X, Image as ImageIcon, User, ShieldCheck } from "lucide-react";
import { Button } from "./ui/button";
import SecurityBlockModal from "./SecurityBlockModal";

/**
 * OfficerMessenger Components
 * @param {string} officerId - The ID of the officer in the chat
 * @param {boolean} isAdminView - Whether the current user is viewing as an Admin
 */
export default function OfficerMessenger({ officerId, isAdminView }) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [attachments, setAttachments] = useState([]); // Local file objects
  const [uploading, setUploading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [showSecurityModal, setShowSecurityModal] = useState(false);
  const [securityData, setSecurityData] = useState(null);
  
  const scrollRef = useRef(null);
  const token = localStorage.getItem("accessToken");

  // Fetch history
  const fetchMessages = async () => {
    try {
      const res = await axios.get(`http://localhost:5000/api/officer-chat/${officerId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setMessages(res.data);
    } catch (err) {
      console.error("Failed to fetch messages:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMessages();
    const interval = setInterval(fetchMessages, 5000); // Poll every 5 seconds
    return () => clearInterval(interval);
  }, [officerId]);

  useEffect(() => {
    // Scroll to bottom on new messages
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleFileChange = (e) => {
    const files = Array.from(e.target.files);
    setAttachments((prev) => [...prev, ...files]);
  };

  const removeAttachment = (index) => {
    setAttachments((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!input.trim() && attachments.length === 0) return;

    setUploading(true);
    let uploadedMedia = [];

    try {
      // 1. Upload attachments if any
      if (attachments.length > 0) {
        const formData = new FormData();
        attachments.forEach((file) => formData.append("media", file));
        
        const mediaRes = await axios.post("http://localhost:5000/api/media", formData, {
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "multipart/form-data"
          }
        });
        uploadedMedia = mediaRes.data.uploaded;
      }

      // 2. Send message
      const res = await axios.post(
        "http://localhost:5000/api/officer-chat/send",
        {
          officerId,
          message: input || (attachments.length > 0 ? "[Attached Media]" : ""),
          attachments: uploadedMedia
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      setMessages((prev) => [...prev, res.data]);
      setInput("");
      setAttachments([]);
    } catch (err) {
      console.error("Failed to send message:", err);
      if (err.response?.status === 403 && err.response?.data?.abuseData) {
        setSecurityData(err.response.data);
        setShowSecurityModal(true);
      } else {
        alert("Error sending message. Please try again.");
      }
    } finally {
      setUploading(false);
    }
  };

  const formatTime = (ts) => {
    return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className="flex flex-col h-[600px] bg-slate-50 dark:bg-gray-900 rounded-xl shadow-inner border border-slate-200 dark:border-gray-800 overflow-hidden">
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 p-4 border-b flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-blue-100 dark:bg-blue-900 flex items-center justify-center text-blue-600 dark:text-blue-300">
            {isAdminView ? <User size={20} /> : <ShieldCheck size={20} />}
          </div>
          <div>
            <h3 className="font-bold text-slate-800 dark:text-white">
              {isAdminView ? "Command Center" : "Admin Support Desk"}
            </h3>
            <p className="text-xs text-slate-500 dark:text-gray-400">
              {isAdminView ? "Direct line to assigned Officer" : "Direct line to Municipality Admins"}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
           <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
           <span className="text-xs font-medium text-slate-500 uppercase tracking-wider">Live Session</span>
        </div>
      </div>

      {/* Messages Feed */}
      <div 
        ref={scrollRef}
        className="flex-1 overflow-y-auto p-4 space-y-4 scroll-smooth"
      >
        {loading ? (
          <div className="flex justify-center items-center h-full">
            <p className="text-slate-400 animate-pulse">Establishing secure link...</p>
          </div>
        ) : messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-slate-400 space-y-2 opacity-60">
            <Send size={40} />
            <p>No messages yet. {isAdminView ? "Send a command to get started." : "Report any issues to the Admin here."}</p>
          </div>
        ) : (
          messages.map((msg, idx) => {
            const isMe = isAdminView ? msg.isAdminMessage : !msg.isAdminMessage;
            return (
              <div 
                key={msg._id} 
                className={`flex flex-col ${isMe ? "items-end" : "items-start"}`}
              >
                <div className={`max-w-[80%] rounded-2xl p-3 shadow-sm ${
                  isMe 
                    ? "bg-blue-600 text-white rounded-tr-none" 
                    : "bg-white dark:bg-gray-800 text-slate-800 dark:text-gray-200 rounded-tl-none"
                }`}>
                  <p className="text-sm leading-relaxed whitespace-pre-wrap">{msg.message}</p>
                  
                  {msg.attachments?.length > 0 && (
                    <div className="mt-2 grid grid-cols-1 gap-2">
                       {msg.attachments.map((at, i) => (
                         <img 
                            key={i} 
                            src={at.url} 
                            alt="attachment" 
                            className="rounded-lg max-h-60 object-cover cursor-pointer hover:opacity-90 transition"
                            onClick={() => window.open(at.url, '_blank')}
                         />
                       ))}
                    </div>
                  )}
                  
                  <div className={`text-[10px] mt-1 opacity-70 ${isMe ? "text-right" : "text-left"}`}>
                    {formatTime(msg.createdAt)}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Footer / Input */}
      <div className="bg-white dark:bg-gray-800 p-4 border-t">
        {/* Attachment Previews */}
        {attachments.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-3">
             {attachments.map((file, i) => (
               <div key={i} className="relative group">
                 <img 
                    src={URL.createObjectURL(file)} 
                    className="w-16 h-16 object-cover rounded-lg border-2 border-blue-500 shadow-lg"
                    alt="preview"
                 />
                 <button 
                    onClick={() => removeAttachment(i)}
                    className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 shadow-md hover:bg-red-600 transition"
                 >
                   <X size={12} />
                 </button>
               </div>
             ))}
          </div>
        )}

        <form onSubmit={handleSendMessage} className="flex gap-2 items-end">
          <div className="flex-1 relative">
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={isAdminView ? "Enter command or feedback..." : "Message admin or report AI mismatch..."}
              className="w-full bg-slate-50 dark:bg-gray-700 border border-slate-200 dark:border-gray-600 rounded-2xl py-3 px-4 pr-12 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:text-white resize-none max-h-32 min-h-[48px]"
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleSendMessage(e);
                }
              }}
            />
            <label className="absolute right-3 bottom-3 text-slate-400 hover:text-blue-500 cursor-pointer p-1 rounded-full transition hover:bg-slate-100 dark:hover:bg-gray-600">
              <input type="file" multiple className="hidden" onChange={handleFileChange} accept="image/*" />
              <Paperclip size={20} />
            </label>
          </div>
          <Button 
            disabled={uploading || (!input.trim() && attachments.length === 0)}
            type="submit"
            className="rounded-full w-12 h-12 flex items-center justify-center p-0 shrink-0 bg-blue-600 hover:bg-blue-700 text-white"
          >
            {uploading ? (
               <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
            ) : (
               <Send size={20} />
            )}
          </Button>
        </form>
      </div>
      <SecurityBlockModal 
        isOpen={showSecurityModal} 
        onClose={() => setShowSecurityModal(false)}
        fraudData={securityData}
      />
    </div>
  );
}

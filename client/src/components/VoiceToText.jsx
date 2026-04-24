import React, { useState, useRef, useEffect } from "react";
import axios from "axios";

export default function VoiceToText({ onTranscription, onError, className = "" }) {
  const [recordingStatus, setRecordingStatus] = useState("idle"); // idle, recording, transcribing
  const [timeLeft, setTimeLeft] = useState(20);
  const [detectedLanguage, setDetectedLanguage] = useState("");
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const timerRef = useRef(null);
  const token = localStorage.getItem("accessToken");

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaRecorderRef.current = new MediaRecorder(stream);
      audioChunksRef.current = [];
      setDetectedLanguage("");

      mediaRecorderRef.current.ondataavailable = (e) => {
        if (e.data.size > 0) {
          audioChunksRef.current.push(e.data);
        }
      };

      mediaRecorderRef.current.onstop = async () => {
        setRecordingStatus("transcribing");
        const audioBlob = new Blob(audioChunksRef.current, { type: "audio/webm" });
        const formData = new FormData();
        formData.append("audio", audioBlob, "recording.webm");

        try {
          const res = await axios.post("http://localhost:5000/api/ml/transcribe", formData, {
            headers: { Authorization: `Bearer ${token}` }
          });
          
          if (res.data.success && res.data.text) {
            onTranscription(res.data.text, res.data.language);
            if (res.data.language) {
              setDetectedLanguage(res.data.language);
            }
          }
        } catch (error) {
          console.error("Transcription error:", error);
          if (onError) onError("Transcription failed. Please try again.");
        } finally {
          setRecordingStatus("idle");
          stream.getTracks().forEach(track => track.stop());
        }
      };

      mediaRecorderRef.current.start();
      setRecordingStatus("recording");
      setTimeLeft(20);
      
      timerRef.current = setInterval(() => {
        setTimeLeft((prev) => {
          if (prev <= 1) {
            stopRecording();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);

    } catch (err) {
      console.error("Microphone Access Error:", err);
      if (onError) onError("Microphone access denied. Please check permissions.");
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === "recording") {
      mediaRecorderRef.current.stop();
      clearInterval(timerRef.current);
    }
  };

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  return (
    <div className={`flex items-center gap-3 ${className}`}>
      {/* Language Indicator */}
      {detectedLanguage && (
        <span className="text-[10px] bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300 px-2 py-0.5 rounded shadow-sm font-bold tracking-wide uppercase">
          {detectedLanguage}
        </span>
      )}

      {/* Recording Status */}
      {recordingStatus === "recording" && (
        <div className="flex items-center gap-2">
          <span className="relative flex h-3 w-3">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500"></span>
          </span>
          <span className="text-xs text-red-500 font-bold animate-pulse">
            00:{timeLeft.toString().padStart(2, '0')}
          </span>
          <button 
            type="button" 
            onClick={stopRecording} 
            className="text-[10px] font-bold uppercase tracking-wider bg-red-100 text-red-600 px-2 py-1 rounded hover:bg-red-200 transition"
          >
            Stop
          </button>
        </div>
      )}

      {/* Transcribing Status */}
      {recordingStatus === "transcribing" && (
        <span className="text-xs text-blue-500 font-bold animate-pulse">Transcribing...</span>
      )}

      {/* Mic Button */}
      {recordingStatus === "idle" && (
        <button
          type="button"
          onClick={startRecording}
          className="text-gray-500 hover:text-blue-600 bg-gray-50 hover:bg-blue-50 dark:bg-gray-800 dark:hover:bg-blue-900/30 p-2 rounded-full transition-all shadow-sm active:scale-95 border border-gray-200 dark:border-gray-700"
          title="Use Voice-to-Text"
        >
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 18.75a6 6 0 006-6v-1.5m-6 7.5a6 6 0 01-6-6v-1.5m6 7.5v3.75m-3.75 0h7.5M12 15.75a3 3 0 01-3-3V4.5a3 3 0 116 0v8.25a3 3 0 01-3 3z" />
          </svg>
        </button>
      )}
    </div>
  );
}

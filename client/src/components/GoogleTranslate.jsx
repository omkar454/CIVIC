// src/components/GoogleTranslate.jsx
import React, { useEffect, useState, useRef } from "react";

const SCRIPT_ID = "google-translate-script";

const setLanguageCookie = (lang) => {
  document.cookie = `googtrans=/en/${lang}; path=/`;
  window.location.reload();
};

const resetLanguageCookie = () => {
  document.cookie = "googtrans=; path=/; expires=Thu, 01 Jan 1970 00:00:01 GMT;";
  window.location.reload();
};

const GoogleTranslate = () => {
  const [showDropdown, setShowDropdown] = useState(false);
  const dropdownRef = useRef(null);

  // Load Google Translate script robustly
  useEffect(() => {
    if (document.getElementById(SCRIPT_ID)) {
      return;
    }

    window.googleTranslateElementInit = () => {
      new window.google.translate.TranslateElement(
        {
          pageLanguage: "en",
          includedLanguages: "en,hi,mr,gu", // <--- Gujarati added here
          layout: window.google.translate.TranslateElement.InlineLayout.SIMPLE,
          autoDisplay: false,
        },
        "google_translate_element_hidden"
      );
    };

    const script = document.createElement("script");
    script.id = SCRIPT_ID;
    script.src =
      "https://translate.google.com/translate_a/element.js?cb=googleTranslateElementInit";
    script.async = true;
    document.body.appendChild(script);

    return () => {
      const existingScript = document.getElementById(SCRIPT_ID);
      if (existingScript) {
        existingScript.remove();
      }
      delete window.googleTranslateElementInit;
    };
  }, []);

  // =================================================================
  // === THIS IS THE CRUCIAL FIX FOR THE PAGE JUMP ===
  // This useEffect will run constantly to fight Google's script
  // which adds an inline `top` style to the <body> tag.
  useEffect(() => {
    const intervalId = setInterval(() => {
      const body = document.body;
      if (body.style.top && body.style.top !== "0px") {
        // Remove the 'top' property added by Google
        body.style.removeProperty("top");
      }
    }, 100); // Check every 100ms

    // Clean up the interval when the component unmounts
    return () => clearInterval(intervalId);
  }, []); // Empty array ensures this runs only once on mount
  // =================================================================

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [dropdownRef]);

  const handleLanguageChange = (lang) => {
    if (lang === "en") {
      resetLanguageCookie();
    } else {
      setLanguageCookie(lang);
    }
    setShowDropdown(false);
  };
    useEffect(() => {
    const hideTranslateBar = () => {
        const frames = document.querySelectorAll("iframe");
        frames.forEach((frame) => {
        if (frame.classList.contains("goog-te-banner-frame")) {
            frame.style.display = "none";
        }
        });

        const banner = document.querySelector(".goog-te-banner-frame");
        const balloon = document.querySelector(".goog-te-balloon-frame");
        const tooltip = document.querySelector("#goog-gt-tt");

        [banner, balloon, tooltip].forEach((el) => {
        if (el) {
            el.style.display = "none";
            el.style.visibility = "hidden";
            el.style.opacity = "0";
            el.style.height = "0";
        }
        });

        document.body.style.top = "0px";
    };

    const intervalId = setInterval(hideTranslateBar, 500);
    return () => clearInterval(intervalId);
    }, []);
  return (
    <div style={{ position: "relative" }} ref={dropdownRef}>
      {/* Custom Toggle Button */}
      <button
        id="translateToggle"
        onClick={() => setShowDropdown((prev) => !prev)}
        className="px-4 py-2 rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 transition"
        >
        Translate
        </button>

      {/* Our Custom Dropdown */}
      {showDropdown && (
        <div
          className="custom-translate-dropdown"
          style={{
            position: "absolute",
            top: "calc(100% + 5px)",
            right: 0,
            backgroundColor: "white",
            border: "1px solid #ccc",
            borderRadius: "4px",
            boxShadow: "0 2px 10px rgba(0,0,0,0.1)",
            zIndex: 1001,
            overflow: "hidden",
            minWidth: "120px",
          }}
        >
          <button
            className="custom-translate-option"
            onClick={() => handleLanguageChange("mr")}
          >
            मराठी
          </button>
          <button
            className="custom-translate-option"
            onClick={() => handleLanguageChange("hi")}
          >
            हिंदी
          </button>
          <button
            className="custom-translate-option"
            onClick={() => handleLanguageChange("en")}
          >
            English
          </button>
          <button
            className="custom-translate-option"
            onClick={() => handleLanguageChange("gu")}
          >
            ગુજરાતી
          </button>
        </div>
      )}

      {/* Hidden div to hold the *actual* Google widget */}
      <div
        id="google_translate_element_hidden"
        style={{ display: "none" }}
      ></div>

      {/* Styles for the *widget* and *our dropdown* ONLY */}
      <style>{`
        /* Hide the default Google widget and all its parts */
        #google_translate_element_hidden,
        .goog-te-gadget,
        .goog-te-combo,
        .goog-te-combo select,
        .goog-te-combo .goog-te-menu-value {
          display: none !important;
          visibility: hidden !important;
        }

        /* Hide specific Google elements if they appear */
        .VIpgJd-ZVi9od-ORHb-OEVmCD, /* The Google logo container */
        .VIpgJd-ZVi9od-ORHb-OEVmCD img { /* The Google logo itself */
            display: none !important;
            visibility: hidden !important;
        }

        /* Custom Dropdown Styling */
        .custom-translate-option {
          display: block;
          width: 100%;
          padding: 8px 16px;
          text-align: left;
          background-color: #fff;
          color: #333;
          border: none;
          cursor: pointer;
          white-space: nowrap;
        }
        .custom-translate-option:hover {
          background-color: #f0f0f0;
        }
      `}</style>
    </div>
  );
};

export default GoogleTranslate;
# 🏙️ Civic Issue Tracker

![MERN Stack](https://img.shields.io/badge/MERN-Full%20Stack-blue)
![Status](https://img.shields.io/badge/Status-Active-brightgreen)
![Development](https://img.shields.io/badge/Development-Ongoing-orange)
![License](https://img.shields.io/badge/License-MIT-green)

A comprehensive **Civil Issue Tracking Platform** designed to empower citizens, streamline officer operations, and modernize civic governance. Built with the **MERN Stack** (MongoDB, Express.js, React.js, Node.js), it ensures transparency, accountability, and efficient resolution of urban issues.

---

## 👥 Meet the Team

| 👨‍💻 **Omkar Raut** | 👨‍💻 **Aryan Salunke** | 👨‍💻 **Aryan Pathak** | 👨‍💻 **Vedant Patil** |
| :---: | :---: | :---: | :---: |

---

## 🌟 Key Features

### 🏛️ For Citizens
- **📍 Easy Reporting**: Submit issues via **GPS Location**, **Manual Address**, or **Map Pin**.
- **📸 Evidence Based**: Mandatory photo/video proof for authentic reporting.
- **👀 Real-Time Tracking**: Monitor your report's journey from *Open* ➝ *Resolved*.
- **🗳️ Community Engagement**: Upvote critical issues & discuss solutions in threads.
- **🤖 AI Chatbot (CIVIC)**: Get instant help in **English, Hindi, Marathi, or Gujarati**.

### 👮‍♂️ For Officers
- **📋 Dedicated Dashboard**: View assigned tasks prioritized by urgency.
- **⏳ SLA Monitoring**: Live countdown timers to prevent overdue reports.
- **🔄 Smart Workflow**: Update status with mandatory proof of work.
- **🔁 Transfer Requests**: Seamless inter-departmental transfers if misrouted.

### 🔐 For Administrators
- **📊 Analytics Hub**: Visual data on issue density, officer performance, and resolution rates.
- **🗺️ Heatmaps**: Identify high-density problem areas instantly.
- **🛡️ Governance Tools**: Verify reports, manage SLAs, and moderate user activity.
- **📑 Data Export**: Download verified reports (JSON/CSV) for official use.

---

## 🏗️ System Architecture

Our platform follows a robust **Service-Oriented Architecture**:

- **Frontend**: **React.js (Vite)** + **Tailwind CSS** for a responsive, modern UI.
- **Backend**: **Node.js** + **Express.js** orchestrating workflows & notifications.
- **Database**: **MongoDB** for flexible, scalable data storage.
- **Media**: **Cloudinary** for secure, optimized image/video hosting.
- **Security**: **JWT Authentication** + Role-Based Access Control (RBAC).
- **AI Integration**: **Google Gemini API** for intelligent chatbot assistance.

---

## 🔄 Complaint Lifecycle

Every report follows a transparent, strict lifecycle to ensure accountability.

| Status | Description | Action Required |
| :--- | :--- | :--- |
| 🔴 **Open** | Report submitted by Citizen. | Admin verifies validity. |
| 🟡 **Acknowledged** | Verified & assigned to Dept. | SLA Timer Starts ⏱️. |
| 🔵 **In Progress** | Officer starts work. | Field evidence mandatory. |
| 🟢 **Resolved** | Work completed. | Admin confirms fix & closes. |
| ❌ **Rejected** | Invalid or Duplicate. | Reason recorded clearly. |

---

## ⚙️ How It Works (Workflow)

### 1. Submission & Routing
Citizens report issues which are auto-classified.

**Categorization Strategy:**
| Category | Assigned Department |
| :--- | :--- |
| 🕳️ Pothole | Road Dept |
| 🗑️ Garbage | Sanitation Dept |
| 💡 Streetlight | Electrical Dept |
| 🌊 Drainage | Drainage Dept |
| 🚽 Public Toilet | Health/Sanitation |

### 2. Priority & SLA Assignment
The system calculates a **Priority Score** to ensure urgent issues are tackled first.

> **Formula:** `Priority Score = (Severity × 10) + (Community Votes × 5)`

**SLA Timelines:**
- **🚨 High Priority (Score ≥ 60)**: 2 Days
- **⚠️ Medium Priority (Score ≥ 30)**: 4 Days
- **⏳ Low Priority (< 30)**: 7 Days

---

## 🛠️ Technology Stack

### Client-Side
*   ⚛️ **React.js** (Vite)
*   🎨 **Tailwind CSS**
*   🗺️ **Leaflet / React-Leaflet** (Maps)
*   📈 **Recharts** (Analytics)
*   🔌 **Axios** (API Requests)

### Server-Side
*   🟢 **Node.js & Express.js**
*   🍃 **MongoDB + Mongoose**
*   ☁️ **Cloudinary SDK**
*   🔐 **JWT & Bcrypt**
*   🧠 **Gemini AI API**

---

## 🚀 Getting Started

Follow these steps to set up the project locally.

### Prerequisites
- Node.js (v16+)
- MongoDB (Local or Atlas)
- Cloudinary Account (for media)
- Google Gemini API Key (optional, for Chatbot)

### Installation

1.  **Clone the Repo**
    ```bash
    git clone https://github.com/yourusername/civic-issue-tracker.git
    cd civic-issue-tracker
    ```

2.  **Server Setup**
    ```bash
    cd server
    npm install
    ```
    **Create a `.env` file in `/server`:**
    ```env
    PORT=5000
    MONGO_URI=your_mongodb_connection_string
    JWT_SECRET=your_jwt_secret_key
    CLOUDINARY_CLOUD_NAME=your_cloud_name
    CLOUDINARY_API_KEY=your_api_key
    CLOUDINARY_API_SECRET=your_api_secret
    GEMINI_API_KEY_URL=https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=YOUR_KEY
    ```
    **Start Server:** `npm run dev`

3.  **Client Setup**
    ```bash
    cd ../client
    npm install
    npm run dev
    ```

---

## 🔮 Roadmap & Future Scope

- [ ] **Mobile App**: Native Android/iOS application.
- [ ] **ML Vision**: Auto-detect compliant categories from uploaded photos.
- [ ] **IoT Sensors**: Integration with smart city sensors for auto-reporting.
- [ ] **Predictive AI**: Forecast infrastructure failures before they happen.

---

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---

> Built with ❤️ for better cities.

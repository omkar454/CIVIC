// src/App.jsx
import { Routes, Route, useNavigate } from "react-router-dom";
import { useState, useEffect } from "react";

import Home from "./pages/Home";
import Register from "./pages/Register";
import Login from "./pages/Login";
import ReportForm from "./pages/ReportForm";
import ReportsLists from "./pages/ReportsLists";
import ReportDetail from "./pages/ReportDetail";
import ReportTracking from "./pages/ReportTracking";
import OfficerQueue from "./pages/OfficerQueue";
import AdminPage from "./pages/AdminPage";
import AdminVerification from "./pages/AdminVerification";
import AdminTransferVerification from "./pages/AdminTransferVerification";
import OfficerInspect from "./pages/OfficerInspect";
import CitizenReportCard from "./pages/CitizenReportCard";
import NotificationsPage from "./pages/NotificationsPage";


import PrivateRoute from "./components/PrivateRoute";
import Sidebar from "./components/Sidebar";
import Navbar from "./components/NavBar";
import LandingPage from "./pages/LandingPage";

function App() {
  const [userRole, setUserRole] = useState(null);
  const [userName, setUserName] = useState("");
  const [darkMode, setDarkMode] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    const role = localStorage.getItem("role");
    const name = localStorage.getItem("name");
    setUserRole(role);
    setUserName(name || "");

    const savedMode = localStorage.getItem("darkMode");
    if (savedMode === "true") setDarkMode(true);
  }, []);
  const handleLogout = () => {
    localStorage.clear();
    setUserRole(null);
    setUserName("");
    navigate("/login");
  };

  const toggleDarkMode = () => {
    setDarkMode((prev) => {
      localStorage.setItem("darkMode", !prev);
      return !prev;
    });
  };

  return (
    <div
      className={`min-h-screen flex ${
        darkMode ? "dark bg-gray-900 text-white" : "bg-gray-100 text-gray-900"
      }`}
    >
      {userRole && <Sidebar role={userRole} name={userName} />}
      <div className="flex-1 flex flex-col">
        <Navbar
          darkMode={darkMode}
          toggleDarkMode={toggleDarkMode}
          handleLogout={handleLogout}
          role={userRole}
          name={userName}
        />

        <main className="p-6 flex-1">
          <Routes>
            {!userRole ? (
              <>
              <Route path="/" element={<LandingPage />} />
                <Route
                  path="/login"
                  element={
                    <Login
                      setUserRole={setUserRole}
                      setUserName={setUserName}
                    />
                  }
                />
                <Route
                  path="/register"
                  element={
                    <Register
                      setUserRole={setUserRole}
                      setUserName={setUserName}
                    />
                  }
                />
                <Route path="*" element={<LandingPage />} />
              </>
            ) : (
              <>
                <Route path="/" element={<Home />} />
                <Route
                  path="/notifications"
                  element={
                    <PrivateRoute roles={["citizen", "officer", "admin"]}>
                      <NotificationsPage />
                    </PrivateRoute>
                  }
                />

                {/* Officer Routes */}
                <Route
                  path="/officer-queue"
                  element={
                    <PrivateRoute roles={["officer"]}>
                      <OfficerQueue />
                    </PrivateRoute>
                  }
                />

                {/* Admin Routes */}
                <Route
                  path="/admin"
                  element={
                    <PrivateRoute roles={["admin"]}>
                      <AdminPage />
                    </PrivateRoute>
                  }
                />
                <Route
                  path="/admin/verification"
                  element={
                    <PrivateRoute roles={["admin"]}>
                      <AdminVerification />
                    </PrivateRoute>
                  }
                />
                <Route
                  path="/admin/transfer-verification"
                  element={
                    <PrivateRoute roles={["admin"]}>
                      <AdminTransferVerification darkMode={darkMode} />
                    </PrivateRoute>
                  }
                />
                <Route
                  path="/admin/inspect/:id"
                  element={
                    <PrivateRoute roles={["admin"]}>
                      <OfficerInspect />
                    </PrivateRoute>
                  }
                />
                <Route
                  path="/admin/citizen-inspect/:id"
                  element={
                    <PrivateRoute roles={["admin"]}>
                      <CitizenReportCard />
                    </PrivateRoute>
                  }
                />

                {/* Citizen Routes */}
                <Route
                  path="/report"
                  element={
                    <PrivateRoute roles={["citizen"]}>
                      <ReportForm />
                    </PrivateRoute>
                  }
                />
                <Route
                  path="/reports"
                  element={
                    <PrivateRoute roles={["citizen", "officer", "admin"]}>
                      <ReportsLists darkMode={darkMode} />
                    </PrivateRoute>
                  }
                />
                <Route
                  path="/reports/:id"
                  element={
                    <PrivateRoute roles={["citizen", "officer", "admin"]}>
                      <ReportDetail darkMode={darkMode} />
                    </PrivateRoute>
                  }
                />
                <Route
                  path="/reports/:id/track"
                  element={
                    <PrivateRoute roles={["citizen", "officer", "admin"]}>
                      <ReportTracking darkMode={darkMode} mode="track" />
                    </PrivateRoute>
                  }
                />
              </>
            )}
          </Routes>
        </main>
      </div>
    </div>
  );
}

export default App;

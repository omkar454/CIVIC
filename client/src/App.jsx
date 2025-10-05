// src/App.jsx
import { Routes, Route, useNavigate } from "react-router-dom";
import { useState, useEffect } from "react";

import Home from "./pages/Home";
import Register from "./pages/Register";
import Login from "./pages/Login";
import ReportForm from "./pages/ReportForm";
import ReportsLists from "./pages/ReportsLists";
import ReportDetail from "./pages/ReportDetail";
import OfficerQueue from "./pages/OfficerQueue";
import AdminPage from "./pages/AdminPage";

import PrivateRoute from "./components/PrivateRoute";
import Sidebar from "./components/Sidebar";
import Navbar from "./components/Navbar";

function App() {
  const [userRole, setUserRole] = useState(null);
  const [userName, setUserName] = useState(""); // ✅ NEW
  const [darkMode, setDarkMode] = useState(false);
  const navigate = useNavigate();

  // Load role + name + dark mode from localStorage
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
    setUserName(""); // ✅ reset name
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
      {/* Sidebar only if logged in */}
      {userRole && <Sidebar role={userRole} name={userName} />}{" "}
      {/* ✅ pass name */}
      {/* Main content */}
      <div className="flex-1 flex flex-col">
        <Navbar
          darkMode={darkMode}
          toggleDarkMode={toggleDarkMode}
          handleLogout={handleLogout}
          role={userRole}
          name={userName} // ✅ pass name to Navbar
        />

        <main className="p-6 flex-1">
          <Routes>
            {!userRole ? (
              <>
                <Route
                  path="/login"
                  element={
                    <Login
                      setUserRole={setUserRole}
                      setUserName={setUserName}
                    />
                  } // ✅ send both
                />
                <Route
                  path="/register"
                  element={
                    <Register
                      setUserRole={setUserRole}
                      setUserName={setUserName}
                    />
                  } // ✅ send both
                />
                <Route
                  path="*"
                  element={
                    <Login
                      setUserRole={setUserRole}
                      setUserName={setUserName}
                    />
                  }
                />
              </>
            ) : (
              <>
                <Route path="/" element={<Home />} />
                <Route
                  path="/officer-queue"
                  element={
                    <PrivateRoute roles={["officer"]}>
                      <OfficerQueue />
                    </PrivateRoute>
                  }
                />
                <Route
                  path="/admin"
                  element={
                    <PrivateRoute roles={["admin"]}>
                      <AdminPage />
                    </PrivateRoute>
                  }
                />
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
              </>
            )}
          </Routes>
        </main>
      </div>
    </div>
  );
}

export default App;

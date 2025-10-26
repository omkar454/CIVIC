import { Routes, Route, useNavigate, useLocation } from "react-router-dom";
import { useState, useEffect } from "react";

// Pages (Updated to use .jsx extension for resolution)
import Home from "./pages/Home.jsx";
import Register from "./pages/Register.jsx";
import Login from "./pages/Login.jsx";
import ReportForm from "./pages/ReportForm.jsx";
import ReportsLists from "./pages/ReportsLists.jsx";
import ReportDetail from "./pages/ReportDetail.jsx";
import ReportTracking from "./pages/ReportTracking.jsx";
import OfficerQueue from "./pages/OfficerQueue.jsx";
import AdminPage from "./pages/AdminPage.jsx";
import AdminVerification from "./pages/AdminVerification.jsx";
import AdminTransferVerification from "./pages/AdminTransferVerification.jsx";
import OfficerInspect from "./pages/OfficerInspect.jsx";
import CitizenReportCard from "./pages/CitizenReportCard.jsx";
import NotificationsPage from "./pages/NotificationsPage.jsx";
import LandingPage from "./pages/LandingPage.jsx";

// Components (Updated to use .jsx extension for resolution)
import PrivateRoute from "./components/PrivateRoute.jsx";
import Sidebar from "./components/Sidebar.jsx";
import Navbar from "./components/NavBar.jsx";

function App() {
  const [userRole, setUserRole] = useState(null);
  const [userName, setUserName] = useState("");
  const [darkMode, setDarkMode] = useState(false);

  const navigate = useNavigate();
  const location = useLocation(); // Imported and used to get the current URL path

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

  // Logic to conditionally hide the Navbar.
  // The Navbar is hidden ONLY when the user is logged out (!userRole)
  // AND they are on the root path ("/").
  const isLandingPage = !userRole && location.pathname === "/";
  const showNavbar = !isLandingPage;

  return (
    <div
      className={`min-h-screen flex ${
        darkMode ? "dark bg-gray-900 text-white" : "bg-gray-100 text-gray-900"
      }`}
    >
      {/* Sidebar is only shown if user is logged in */}
      {userRole && <Sidebar role={userRole} name={userName} />}

      <div className="flex-1 flex flex-col">
        {/* Conditional rendering of Navbar */}
        {showNavbar && (
          <Navbar
            darkMode={darkMode}
            toggleDarkMode={toggleDarkMode}
            handleLogout={handleLogout}
            role={userRole}
            name={userName}
          />
        )}

        {/* Adjust padding for the main content. Use p-0 when the Navbar is hidden. */}
        <main className={`flex-1 ${showNavbar ? "p-6" : "p-0"}`}>
          <Routes>
            {!userRole ? (
              <>
                {/* Unauthenticated Routes */}
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
                {/* Authenticated Routes */}
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

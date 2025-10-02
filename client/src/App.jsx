// App.jsx
import { Routes, Route, Link, useNavigate } from "react-router-dom";
import { useState, useEffect } from "react";

import Home from "./pages/Home";
import Register from "./pages/Register";
import Login from "./pages/Login";
import ReportForm from "./pages/ReportForm";
import ReportsList from "./pages/ReportsLists";
import ReportDetail from "./pages/ReportDetail";
import OfficerQueue from "./pages/OfficerQueue";
import AdminPage from "./pages/AdminPage"; // Admin dashboard
import PrivateRoute from "./components/PrivateRoute";

function App() {
  const [userRole, setUserRole] = useState(null);
  const navigate = useNavigate();

  // Get role from localStorage on page load
  useEffect(() => {
    const role = localStorage.getItem("role");
    setUserRole(role);
  }, []);

  const handleLogout = () => {
    localStorage.clear();
    setUserRole(null);
    navigate("/login");
  };

  return (
    <div>
      {/* Navigation */}
      <nav className="bg-blue-600 text-white p-4 flex justify-between items-center">
        <h1 className="font-bold">CIVIC</h1>
        <div className="space-x-4">
          {!userRole ? (
            <>
              <Link to="/login">Login</Link>
              <Link to="/register">Register</Link>
            </>
          ) : (
            <>
              <Link to="/">Home</Link>

              {/* Citizen-only link */}
              {userRole === "citizen" && <Link to="/report">Report Issue</Link>}

              {/* All logged-in users */}
              <Link to="/reports">All Reports</Link>

              {/* Officer-only link */}
              {userRole === "officer" && (
                <Link to="/officer-queue">Officer Queue</Link>
              )}

              {/* Admin-only link */}
              {userRole === "admin" && <Link to="/admin">Admin Dashboard</Link>}

              <button onClick={handleLogout} className="ml-2 underline">
                Logout
              </button>
            </>
          )}
        </div>
      </nav>

      {/* Routes */}
      <main className="p-4">
        <Routes>
          {/* Guest routes */}
          {!userRole ? (
            <>
              <Route
                path="/login"
                element={<Login setUserRole={setUserRole} />}
              />
              <Route
                path="/register"
                element={<Register setUserRole={setUserRole} />}
              />
              <Route path="*" element={<Login setUserRole={setUserRole} />} />
            </>
          ) : (
            <>
              {/* Logged-in routes */}
              <Route path="/" element={<Home />} />

              {/* Officer-only routes */}
              <Route
                path="/officer-queue"
                element={
                  <PrivateRoute roles={["officer"]}>
                    <OfficerQueue />
                  </PrivateRoute>
                }
              />

              {/* Admin-only route */}
              <Route
                path="/admin"
                element={
                  <PrivateRoute roles={["admin"]}>
                    <AdminPage />
                  </PrivateRoute>
                }
              />

              {/* Citizen-only routes */}
              <Route
                path="/report"
                element={
                  <PrivateRoute roles={["citizen"]}>
                    <ReportForm />
                  </PrivateRoute>
                }
              />

              {/* All logged-in users */}
              <Route
                path="/reports"
                element={
                  <PrivateRoute roles={["citizen", "officer", "admin"]}>
                    <ReportsList />
                  </PrivateRoute>
                }
              />
              <Route
                path="/reports/:id"
                element={
                  <PrivateRoute roles={["citizen", "officer", "admin"]}>
                    <ReportDetail />
                  </PrivateRoute>
                }
              />
            </>
          )}
        </Routes>
      </main>
    </div>
  );
}

export default App;

import { Routes, Route, Link } from "react-router-dom";
import Home from "./pages/Home";
import Register from "./pages/Register";
import Login from "./pages/Login";
import ReportForm from "./pages/ReportForm";
import ReportsList from "./pages/ReportsLists"; // corrected import name
import ReportDetail from "./pages/ReportDetail";

function App() {
  const token = localStorage.getItem("accessToken");

  return (
    <div>
      {/* Navbar */}
      <nav className="bg-blue-600 text-white p-4 flex justify-between items-center">
        <h1 className="font-bold text-lg">CIVIC</h1>
        <div className="space-x-4">
          <Link to="/">Home</Link>
          <Link to="/reports">All Issues</Link>
          {token ? (
            <Link to="/report">Submit Report</Link>
          ) : (
            <>
              <Link to="/register">Register</Link>
              <Link to="/login">Login</Link>
            </>
          )}
        </div>
      </nav>

      {/* Main content */}
      <main className="p-4 min-h-screen bg-gray-100">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/register" element={<Register />} />
          <Route path="/login" element={<Login />} />
          <Route path="/report" element={<ReportForm />} />
          <Route path="/reports" element={<ReportsList />} />
          <Route path="/reports/:id" element={<ReportDetail />} />
        </Routes>
      </main>
    </div>
  );
}

export default App;

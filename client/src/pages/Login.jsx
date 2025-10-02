// Login.jsx (updated)
import { useState } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";

export default function Login({ setUserRole }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const res = await axios.post("http://localhost:5000/api/auth/login", {
        email,
        password,
      });

      // Save tokens and user info
      localStorage.setItem("accessToken", res.data.accessToken);
      localStorage.setItem("role", res.data.role);
      localStorage.setItem("userId", res.data.userId);

      // Save warnings (read from backend User model)
      localStorage.setItem("warnings", res.data.warnings || 0);

      setUserRole(res.data.role);
      navigate("/"); // redirect to Home
    } catch (err) {
      console.error("Login error:", err);
      setError(err.response?.data?.message || "Login failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="max-w-md mx-auto p-4 bg-white shadow rounded"
    >
      <h2 className="text-lg font-semibold mb-3">Login</h2>

      {error && (
        <div className="bg-red-100 text-red-700 px-3 py-2 rounded mb-3 border border-red-400">
          {error}
        </div>
      )}

      <input
        type="email"
        placeholder="Email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        className="border w-full p-2 mb-2"
        required
      />

      <input
        type="password"
        placeholder="Password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        className="border w-full p-2 mb-2"
        required
      />

      <button
        type="submit"
        className="bg-blue-600 text-white px-4 py-2 rounded w-full"
        disabled={loading}
      >
        {loading ? "Logging in..." : "Login"}
      </button>

      <p className="mt-2 text-sm">
        Don't have an account?{" "}
        <span
          className="text-blue-600 underline cursor-pointer"
          onClick={() => navigate("/register")}
        >
          Register now
        </span>
      </p>
    </form>
  );
}

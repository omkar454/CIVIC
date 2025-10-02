import { useState } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";

export default function Register({ setUserRole }) {
  const [form, setForm] = useState({
    name: "",
    email: "",
    password: "",
    role: "citizen", // default
  });
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      const res = await axios.post("http://localhost:5000/api/auth/register", {
        name: form.name,
        email: form.email,
        password: form.password,
        role: form.role, // send role to backend
      });

      // Save token and user info
      localStorage.setItem("accessToken", res.data.accessToken);
      localStorage.setItem("role", res.data.role);
      localStorage.setItem("userId", res.data.userId);

      setUserRole(res.data.role);
      navigate("/"); // redirect to Home
    } catch (err) {
      console.error("Register error:", err);
      alert(err.response?.data?.message || "Registration failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="max-w-md mx-auto p-4 bg-white shadow rounded"
    >
      <h2 className="text-lg font-semibold mb-3">Register</h2>

      <input
        type="text"
        placeholder="Name"
        value={form.name}
        onChange={(e) => setForm({ ...form, name: e.target.value })}
        className="border w-full p-2 mb-2"
        required
      />

      <input
        type="email"
        placeholder="Email"
        value={form.email}
        onChange={(e) => setForm({ ...form, email: e.target.value })}
        className="border w-full p-2 mb-2"
        required
      />

      <input
        type="password"
        placeholder="Password"
        value={form.password}
        onChange={(e) => setForm({ ...form, password: e.target.value })}
        className="border w-full p-2 mb-2"
        required
      />

      {/* Role selection */}
      <select
        value={form.role}
        onChange={(e) => setForm({ ...form, role: e.target.value })}
        className="border w-full p-2 mb-2"
      >
        <option value="citizen">Citizen</option>
        <option value="officer">Officer</option>
        <option value="admin">Admin</option>
      </select>

      <button
        type="submit"
        className="bg-blue-600 text-white px-4 py-2 rounded w-full"
        disabled={loading}
      >
        {loading ? "Registering..." : "Register"}
      </button>

      <p className="mt-2 text-sm">
        Already have an account?{" "}
        <span
          className="text-blue-600 underline cursor-pointer"
          onClick={() => navigate("/login")}
        >
          Login now
        </span>
      </p>
    </form>
  );
}

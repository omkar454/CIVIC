import { useState } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";

export default function Register() {
  const [form, setForm] = useState({ name: "", email: "", password: "" });
  const nav = useNavigate();

  async function submit(e) {
    e.preventDefault();
    try {
      const res = await axios.post(
        "http://localhost:5000/api/auth/register",
        form,
        { withCredentials: true }
      );
      localStorage.setItem("accessToken", res.data.accessToken);
      nav("/report");
    } catch (err) {
      alert(err.response?.data?.message || "Error");
    }
  }

  return (
    <form
      className="max-w-md mx-auto p-4 bg-white shadow rounded"
      onSubmit={submit}
    >
      <h2 className="text-lg font-semibold mb-3">Register</h2>
      <input
        className="w-full border p-2 mb-2"
        placeholder="Name"
        value={form.name}
        onChange={(e) => setForm({ ...form, name: e.target.value })}
      />
      <input
        className="w-full border p-2 mb-2"
        placeholder="Email"
        value={form.email}
        onChange={(e) => setForm({ ...form, email: e.target.value })}
      />
      <input
        className="w-full border p-2 mb-2"
        type="password"
        placeholder="Password"
        value={form.password}
        onChange={(e) => setForm({ ...form, password: e.target.value })}
      />
      <button className="bg-blue-600 text-white px-4 py-2 rounded">
        Register
      </button>
    </form>
  );
}

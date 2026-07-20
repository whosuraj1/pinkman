import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../auth";

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [mode, setMode] = useState("user"); // just a UI hint; backend decides role
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const u = await login(username, password);
      navigate(u.role === "admin" ? "/dashboard" : "/dashboard");
    } catch {
      setError("Incorrect username or password");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="login-wrap">
      <form className="login-box card" onSubmit={submit}>
        <div className="brand" style={{ fontSize: 22, marginBottom: 4 }}>Pinkman</div>
        <div className="muted" style={{ marginBottom: 18 }}>Sign in to continue</div>

        <div className="toggle">
          <button type="button" className={mode === "admin" ? "active" : ""} onClick={() => setMode("admin")}>
            Admin Login
          </button>
          <button type="button" className={mode === "user" ? "active" : ""} onClick={() => setMode("user")}>
            Employee Login
          </button>
        </div>

        <label>Username</label>
        <input value={username} onChange={(e) => setUsername(e.target.value)} autoFocus />
        <label>Password</label>
        <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} />

        {error && <div className="error">{error}</div>}

        <button className="primary" style={{ width: "100%", marginTop: 18 }} disabled={loading}>
          {loading ? "Signing in..." : "Sign In"}
        </button>
      </form>
    </div>
  );
}

import { NavLink, useNavigate } from "react-router-dom";
import { useAuth } from "../auth";

export default function Sidebar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const isAdmin = user?.role === "admin";

  function handleLogout() {
    logout();
    navigate("/login");
  }

  const link = ({ isActive }) => "nav-link" + (isActive ? " active" : "");

  return (
    <aside className="sidebar">
      <div className="brand">Pinkman</div>
      <div className="role-tag">{isAdmin ? "ADMIN" : "EMPLOYEE"} · {user?.username}</div>

      <NavLink to="/dashboard" className={link}>Dashboard</NavLink>
      {isAdmin && <NavLink to="/users" className={link}>Users & Batches</NavLink>}
      <NavLink to="/process" className={link}>MrWhite AI</NavLink>
      <NavLink to="/my-batches" className={link}>My Batches</NavLink>
      <NavLink to="/tools" className={link}>Tools · Drive Upload</NavLink>
      {isAdmin && <NavLink to="/api-keys" className={link}>API Keys</NavLink>}
      <NavLink to="/finish" className={link}>Finish</NavLink>
      <NavLink to="/reports" className={link}>Reports</NavLink>

      <div className="spacer" />
      <button className="ghost" onClick={handleLogout}>Logout</button>
    </aside>
  );
}

import { useEffect, useState } from "react";
import api from "../api";

export default function Users() {
  const [users, setUsers] = useState([]);
  const [batches, setBatches] = useState([]);

  // create user form
  const [nu, setNu] = useState({ username: "", password: "", full_name: "", role: "user" });
  const [uErr, setUErr] = useState("");

  // create batch form
  const [nb, setNb] = useState({ name: "", drive_link: "", assigned_user_id: "", total_images: 0 });
  const [bErr, setBErr] = useState("");

  async function load() {
    const [u, b] = await Promise.all([api.get("/users"), api.get("/batches")]);
    setUsers(u.data);
    setBatches(b.data);
  }
  useEffect(() => { load(); }, []);

  async function createUser(e) {
    e.preventDefault();
    setUErr("");
    try {
      await api.post("/users", nu);
      setNu({ username: "", password: "", full_name: "", role: "user" });
      load();
    } catch (err) {
      setUErr(err.response?.data?.detail || "Failed to create user");
    }
  }

  async function createBatch(e) {
    e.preventDefault();
    setBErr("");
    try {
      await api.post("/batches", {
        ...nb,
        assigned_user_id: Number(nb.assigned_user_id),
        total_images: Number(nb.total_images),
      });
      setNb({ name: "", drive_link: "", assigned_user_id: "", total_images: 0 });
      load();
    } catch (err) {
      setBErr(err.response?.data?.detail || "Failed to create batch");
    }
  }

  const employees = users.filter((u) => u.role === "user");

  const [delErr, setDelErr] = useState("");
  async function deleteUser(u) {
    setDelErr("");
    if (!window.confirm(`Delete user "${u.username}"? This cannot be undone. Their assigned batches will be unassigned (not deleted).`)) {
      return;
    }
    try {
      await api.delete(`/users/${u.id}`);
      load();
    } catch (err) {
      setDelErr(err.response?.data?.detail || "Failed to delete user");
    }
  }

  return (
    <div>
      <h1 className="page-title">Users & Batches</h1>

      <div className="grid cols-2">
        <div className="card">
          <h3>Create user</h3>
          <form onSubmit={createUser}>
            <label>Username</label>
            <input value={nu.username} onChange={(e) => setNu({ ...nu, username: e.target.value })} required />
            <label>Full name</label>
            <input value={nu.full_name} onChange={(e) => setNu({ ...nu, full_name: e.target.value })} />
            <label>Password</label>
            <input type="password" value={nu.password} onChange={(e) => setNu({ ...nu, password: e.target.value })} required />
            <label>Role</label>
            <select value={nu.role} onChange={(e) => setNu({ ...nu, role: e.target.value })}>
              <option value="user">Employee</option>
              <option value="admin">Admin</option>
            </select>
            {uErr && <div className="error">{uErr}</div>}
            <button className="primary" style={{ marginTop: 14 }}>Create user</button>
          </form>
        </div>

        <div className="card">
          <h3>Assign batch</h3>
          <form onSubmit={createBatch}>
            <label>Batch name</label>
            <input value={nb.name} onChange={(e) => setNb({ ...nb, name: e.target.value })} required />
            <label>Google Drive ZIP link</label>
            <input value={nb.drive_link} onChange={(e) => setNb({ ...nb, drive_link: e.target.value })} placeholder="https://drive.google.com/..." />
            <div className="row">
              <div>
                <label>Assign to</label>
                <select value={nb.assigned_user_id} onChange={(e) => setNb({ ...nb, assigned_user_id: e.target.value })} required>
                  <option value="">Select employee</option>
                  {employees.map((u) => <option key={u.id} value={u.id}>{u.username}</option>)}
                </select>
              </div>
              <div>
                <label>Total images</label>
                <input type="number" min="0" value={nb.total_images} onChange={(e) => setNb({ ...nb, total_images: e.target.value })} />
              </div>
            </div>
            {bErr && <div className="error">{bErr}</div>}
            <button className="primary" style={{ marginTop: 14 }}>Assign batch</button>
          </form>
        </div>
      </div>

      <div className="card">
        <h3>All users</h3>
        <table>
          <thead><tr><th>ID</th><th>Username</th><th>Name</th><th>Role</th><th></th></tr></thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id}>
                <td>{u.id}</td><td>{u.username}</td><td>{u.full_name || "—"}</td><td>{u.role}</td>
                <td>
                  <button className="danger-btn" onClick={() => deleteUser(u)}>Delete</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {delErr && <div className="error">{delErr}</div>}
      </div>

      <div className="card">
        <h3>All batches</h3>
        <table>
          <thead><tr><th>Batch</th><th>Assigned</th><th>Images</th><th>Status</th></tr></thead>
          <tbody>
            {batches.map((b) => (
              <tr key={b.id}>
                <td>{b.name}</td>
                <td>{b.assigned_username || "—"}</td>
                <td>{b.processed_images}/{b.total_images}</td>
                <td><span className={`badge ${b.status}`}>{b.status.replace("_", " ")}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

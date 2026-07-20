import { useEffect, useState } from "react";
import api from "../api";

const COUNTRIES = ["UAE", "India"];

export default function StoreManagement() {
  const [stores, setStores] = useState([]);
  const [users, setUsers] = useState([]);
  const [msg, setMsg] = useState("");

  const [ns, setNs] = useState({ name: "", country: "UAE", user_ids: [] });
  const [editId, setEditId] = useState(null);
  const [edit, setEdit] = useState({ name: "", country: "UAE", user_ids: [] });

  async function load() {
    const { data } = await api.get("/stores");
    setStores(data);
  }
  useEffect(() => {
    load();
    api.get("/users").then((r) => setUsers(r.data)).catch(() => {});
  }, []);

  const toggleId = (list, id) => (list.includes(id) ? list.filter((x) => x !== id) : [...list, id]);

  async function addStore(e) {
    e.preventDefault();
    setMsg("");
    try {
      await api.post("/stores", ns);
      setNs({ name: "", country: "UAE", user_ids: [] });
      load();
    } catch (er) { setMsg(er.response?.data?.detail || "Failed to add store"); }
  }
  async function removeStore(s) {
    if (!window.confirm(`Delete store "${s.name}"?`)) return;
    await api.delete(`/stores/${s.id}`); load();
  }
  function startEdit(s) {
    setEditId(s.id);
    setEdit({ name: s.name, country: s.country, user_ids: s.assigned_user_ids || [] });
  }
  async function saveEdit(id) {
    await api.put(`/stores/${id}`, edit);
    setEditId(null);
    load();
  }

  const UserChecks = ({ selected, onToggle }) => (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 12 }}>
      {users.length === 0 && <span className="muted">No users yet</span>}
      {users.map((u) => (
        <label key={u.id} style={{ display: "flex", alignItems: "center", gap: 6, margin: 0, cursor: "pointer" }}>
          <input type="checkbox" style={{ width: "auto" }}
            checked={selected.includes(u.id)} onChange={() => onToggle(u.id)} />
          {u.username}{u.role === "admin" ? " (admin)" : ""}
        </label>
      ))}
    </div>
  );

  return (
    <div>
      <h1 className="page-title">Store Management</h1>

      <div className="card">
        <h3>Add store</h3>
        <p className="muted" style={{ marginTop: 0, fontSize: 12 }}>
          A store's country decides which template is used for files generated for it.
        </p>
        <form onSubmit={addStore}>
          <div className="row" style={{ alignItems: "flex-end" }}>
            <div style={{ flex: 2 }}>
              <label>Store name</label>
              <input value={ns.name} onChange={(e) => setNs({ ...ns, name: e.target.value })} placeholder="MyBrand UAE" required />
            </div>
            <div>
              <label>Country (template)</label>
              <select value={ns.country} onChange={(e) => setNs({ ...ns, country: e.target.value })}>
                {COUNTRIES.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
          </div>
          <label style={{ marginTop: 14 }}>Assigned users (only these users can generate for this store)</label>
          <UserChecks selected={ns.user_ids} onToggle={(id) => setNs({ ...ns, user_ids: toggleId(ns.user_ids, id) })} />
          <button className="primary" style={{ marginTop: 14 }}>Add store</button>
        </form>
        {msg && <div className="muted" style={{ marginTop: 10 }}>{msg}</div>}
      </div>

      <div className="card">
        <h3>Stores</h3>
        <table>
          <thead>
            <tr><th>Store</th><th>Country / Template</th><th>Assigned to</th><th></th></tr>
          </thead>
          <tbody>
            {stores.map((s) => (
              editId === s.id ? (
                <tr key={s.id}>
                  <td><input value={edit.name} onChange={(e) => setEdit({ ...edit, name: e.target.value })} /></td>
                  <td>
                    <select value={edit.country} onChange={(e) => setEdit({ ...edit, country: e.target.value })}>
                      {COUNTRIES.map((c) => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </td>
                  <td><UserChecks selected={edit.user_ids} onToggle={(id) => setEdit({ ...edit, user_ids: toggleId(edit.user_ids, id) })} /></td>
                  <td style={{ whiteSpace: "nowrap" }}>
                    <button className="success" onClick={() => saveEdit(s.id)}>Save</button>{" "}
                    <button className="ghost" onClick={() => setEditId(null)}>Cancel</button>
                  </td>
                </tr>
              ) : (
                <tr key={s.id}>
                  <td>{s.name}</td>
                  <td><span className="badge in_progress">{s.country}</span></td>
                  <td className="muted">{(s.assigned_users || []).join(", ") || "—"}</td>
                  <td style={{ whiteSpace: "nowrap" }}>
                    <button className="ghost" onClick={() => startEdit(s)}>Edit</button>{" "}
                    <button className="danger-btn" onClick={() => removeStore(s)}>Delete</button>
                  </td>
                </tr>
              )
            ))}
            {stores.length === 0 && <tr><td colSpan={4} className="muted">No stores yet. Add one above.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}

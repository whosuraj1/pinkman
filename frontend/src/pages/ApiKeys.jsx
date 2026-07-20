import { useEffect, useState } from "react";
import api from "../api";

export default function ApiKeys() {
  const [keys, setKeys] = useState([]);
  const [users, setUsers] = useState([]);
  const [model, setModel] = useState("");
  const [modelSaved, setModelSaved] = useState("");
  const [msg, setMsg] = useState("");

  // add form
  const [nk, setNk] = useState({ label: "", key_value: "", user_ids: [] });
  // inline edit
  const [editId, setEditId] = useState(null);
  const [edit, setEdit] = useState({ label: "", key_value: "", user_ids: [] });

  async function load() {
    const { data } = await api.get("/api-keys");
    setKeys(data.keys);
    setModel(data.model);
    setModelSaved(data.model);
  }
  useEffect(() => {
    load();
    api.get("/users").then((r) => setUsers(r.data)).catch(() => {});
  }, []);

  function toggleId(list, id) {
    return list.includes(id) ? list.filter((x) => x !== id) : [...list, id];
  }

  async function saveModel() {
    setMsg("");
    try {
      await api.put("/api-keys/settings/model", { model });
      setModelSaved(model);
      setMsg("Model name saved.");
    } catch (e) { setMsg(e.response?.data?.detail || "Failed to save model"); }
  }

  async function addKey(e) {
    e.preventDefault();
    setMsg("");
    try {
      await api.post("/api-keys", nk);
      setNk({ label: "", key_value: "", user_ids: [] });
      load();
    } catch (er) { setMsg(er.response?.data?.detail || "Failed to add key"); }
  }

  async function toggle(k) { await api.put(`/api-keys/${k.id}`, { enabled: !k.enabled }); load(); }
  async function resetQuota(k) { await api.post(`/api-keys/${k.id}/reset`); load(); }
  async function removeKey(k) {
    if (!window.confirm(`Delete "${k.label}"?`)) return;
    await api.delete(`/api-keys/${k.id}`); load();
  }
  function startEdit(k) {
    setEditId(k.id);
    setEdit({ label: k.label, key_value: "", user_ids: k.assigned_user_ids || [] });
  }
  async function saveEdit(id) {
    const body = { label: edit.label, user_ids: edit.user_ids };
    if (edit.key_value.trim()) body.key_value = edit.key_value.trim();
    await api.put(`/api-keys/${id}`, body);
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
      <h1 className="page-title">API Keys</h1>

      {/* Model name */}
      <div className="card">
        <h3>Gemini model</h3>
        <p className="muted" style={{ marginTop: 0 }}>The backend uses this model for all requests.</p>
        <div className="row" style={{ maxWidth: 520 }}>
          <input value={model} onChange={(e) => setModel(e.target.value)} placeholder="gemini-2.5-flash" />
          <button className="primary" disabled={!model.trim() || model === modelSaved} onClick={saveModel} style={{ flex: "0 0 auto" }}>Save</button>
        </div>
      </div>

      {/* Add key (with assigned users) */}
      <div className="card">
        <h3>Add API key</h3>
        <form onSubmit={addKey}>
          <div className="row" style={{ alignItems: "flex-end" }}>
            <div>
              <label>Label</label>
              <input value={nk.label} onChange={(e) => setNk({ ...nk, label: e.target.value })} placeholder="Key 1" />
            </div>
            <div style={{ flex: 2 }}>
              <label>API key</label>
              <input value={nk.key_value} onChange={(e) => setNk({ ...nk, key_value: e.target.value })} placeholder="AIza..." required />
            </div>
          </div>
          <label style={{ marginTop: 14 }}>Assigned users (a key can go to multiple users)</label>
          <UserChecks selected={nk.user_ids} onToggle={(id) => setNk({ ...nk, user_ids: toggleId(nk.user_ids, id) })} />
          <button className="primary" style={{ marginTop: 14 }}>Add</button>
        </form>
        {msg && <div className="muted" style={{ marginTop: 10 }}>{msg}</div>}
      </div>

      {/* Keys table */}
      <div className="card">
        <h3>Keys (round-robin rotation)</h3>
        <p className="muted" style={{ marginTop: 0, fontSize: 12 }}>
          Each user's rotation cycles only through the keys assigned to them. Quota
          Used = requests routed to the key; Remaining is ∞ (no manual limit).
        </p>
        <table>
          <thead>
            <tr><th>Label</th><th>Key</th><th>Assigned to</th><th>Quota Used</th><th>Remaining</th><th>Status</th><th></th></tr>
          </thead>
          <tbody>
            {keys.map((k) => (
              editId === k.id ? (
                <tr key={k.id}>
                  <td><input value={edit.label} onChange={(e) => setEdit({ ...edit, label: e.target.value })} /></td>
                  <td><input value={edit.key_value} onChange={(e) => setEdit({ ...edit, key_value: e.target.value })} placeholder="leave blank to keep" /></td>
                  <td><UserChecks selected={edit.user_ids} onToggle={(id) => setEdit({ ...edit, user_ids: toggleId(edit.user_ids, id) })} /></td>
                  <td>{k.quota_used}</td>
                  <td>∞</td>
                  <td>—</td>
                  <td style={{ whiteSpace: "nowrap" }}>
                    <button className="success" onClick={() => saveEdit(k.id)}>Save</button>{" "}
                    <button className="ghost" onClick={() => setEditId(null)}>Cancel</button>
                  </td>
                </tr>
              ) : (
                <tr key={k.id}>
                  <td>{k.label}</td>
                  <td className="muted">{k.key_masked}</td>
                  <td className="muted">{(k.assigned_users || []).join(", ") || "—"}</td>
                  <td>{k.quota_used}</td>
                  <td>{k.quota_remaining === null ? "∞" : k.quota_remaining}</td>
                  <td><span className={`badge ${k.status === "active" ? "completed" : k.status === "exhausted" ? "assigned" : "in_progress"}`}>{k.status}</span></td>
                  <td style={{ whiteSpace: "nowrap" }}>
                    <button onClick={() => toggle(k)}>{k.enabled ? "Disable" : "Enable"}</button>{" "}
                    <button className="ghost" onClick={() => startEdit(k)}>Edit</button>{" "}
                    <button className="ghost" onClick={() => resetQuota(k)}>Reset</button>{" "}
                    <button className="danger-btn" onClick={() => removeKey(k)}>Delete</button>
                  </td>
                </tr>
              )
            ))}
            {keys.length === 0 && <tr><td colSpan={7} className="muted">No API keys yet. Add one above.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}

import { useEffect, useState } from "react";
import api from "../api";

export default function ApiKeys() {
  const [keys, setKeys] = useState([]);
  const [model, setModel] = useState("");
  const [modelSaved, setModelSaved] = useState("");
  const [msg, setMsg] = useState("");

  // add form
  const [nk, setNk] = useState({ label: "", key_value: "" });
  // inline edit
  const [editId, setEditId] = useState(null);
  const [edit, setEdit] = useState({ label: "", key_value: "" });

  async function load() {
    const { data } = await api.get("/api-keys");
    setKeys(data.keys);
    setModel(data.model);
    setModelSaved(data.model);
  }
  useEffect(() => { load(); }, []);

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
      await api.post("/api-keys", { ...nk });
      setNk({ label: "", key_value: "" });
      load();
    } catch (er) { setMsg(er.response?.data?.detail || "Failed to add key"); }
  }

  async function toggle(k) {
    await api.put(`/api-keys/${k.id}`, { enabled: !k.enabled });
    load();
  }
  async function resetQuota(k) {
    await api.post(`/api-keys/${k.id}/reset`);
    load();
  }
  async function removeKey(k) {
    if (!window.confirm(`Delete "${k.label}"?`)) return;
    await api.delete(`/api-keys/${k.id}`);
    load();
  }
  function startEdit(k) {
    setEditId(k.id);
    setEdit({ label: k.label, key_value: "" });
  }
  async function saveEdit(id) {
    const body = { label: edit.label };
    if (edit.key_value.trim()) body.key_value = edit.key_value.trim();
    await api.put(`/api-keys/${id}`, body);
    setEditId(null);
    load();
  }

  return (
    <div>
      <h1 className="page-title">API Keys</h1>

      {/* Model name */}
      <div className="card">
        <h3>Gemini model</h3>
        <p className="muted" style={{ marginTop: 0 }}>
          The backend uses this model for all requests. Change it any time.
        </p>
        <div className="row" style={{ maxWidth: 520 }}>
          <input value={model} onChange={(e) => setModel(e.target.value)} placeholder="gemini-2.5-flash" />
          <button className="primary" disabled={!model.trim() || model === modelSaved} onClick={saveModel} style={{ flex: "0 0 auto" }}>
            Save
          </button>
        </div>
      </div>

      {/* Add key */}
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
            <button className="primary" style={{ flex: "0 0 auto" }}>Add</button>
          </div>
        </form>
        {msg && <div className="muted" style={{ marginTop: 10 }}>{msg}</div>}
      </div>

      {/* Keys table */}
      <div className="card">
        <h3>Keys (round-robin rotation)</h3>
        <p className="muted" style={{ marginTop: 0, fontSize: 12 }}>
          Requests cycle through enabled keys in order. Quota Used = requests routed to
          the key; Remaining = your daily limit − used (∞ if unlimited).
        </p>
        <table>
          <thead>
            <tr>
              <th>Label</th><th>Key</th><th>Quota Used</th><th>Quota Remaining</th><th>Status</th><th></th>
            </tr>
          </thead>
          <tbody>
            {keys.map((k) => (
              editId === k.id ? (
                <tr key={k.id}>
                  <td><input value={edit.label} onChange={(e) => setEdit({ ...edit, label: e.target.value })} /></td>
                  <td><input value={edit.key_value} onChange={(e) => setEdit({ ...edit, key_value: e.target.value })} placeholder="leave blank to keep" /></td>
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
            {keys.length === 0 && <tr><td colSpan={6} className="muted">No API keys yet. Add one above.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}

import { useEffect, useRef, useState } from "react";
import api from "../api";

export default function Finish() {
  const [batches, setBatches] = useState([]);
  const [msg, setMsg] = useState("");
  const [busyId, setBusyId] = useState(null);
  const fileRefs = useRef({});

  async function load() {
    const { data } = await api.get("/batches");
    setBatches(data);
  }
  useEffect(() => { load(); }, []);

  // Batches that have a generated template and aren't completed yet.
  const pending = batches.filter((b) => b.has_template && b.status !== "completed");
  const completed = batches.filter((b) => b.status === "completed");

  async function uploadCompleted(batchId, file) {
    if (!file) return;
    setBusyId(batchId);
    setMsg("");
    try {
      const form = new FormData();
      form.append("file", file);
      await api.post(`/batches/${batchId}/upload-completed`, form, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      setMsg("Completed file uploaded. You can now click Done.");
      await load();
    } catch (err) {
      setMsg(err.response?.data?.detail || "Upload failed");
    } finally {
      setBusyId(null);
    }
  }

  async function markDone(batchId) {
    setBusyId(batchId);
    setMsg("");
    try {
      await api.post(`/batches/${batchId}/done`);
      setMsg("Batch marked as completed.");
      await load();
    } catch (err) {
      setMsg(err.response?.data?.detail || "Could not mark done");
    } finally {
      setBusyId(null);
    }
  }

  async function download(batchId, filename) {
    const res = await api.get(`/batches/${batchId}/completed-file`, { responseType: "blob" });
    const url = window.URL.createObjectURL(res.data);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename || "completed.xlsx";
    a.click();
    window.URL.revokeObjectURL(url);
  }

  return (
    <div>
      <h1 className="page-title">Finish</h1>

      <div className="card">
        <h3>Complete a batch</h3>
        <p className="muted" style={{ marginTop: 0 }}>
          Upload your finished Amazon template (with the image URLs pasted in). Once
          uploaded, the <b>Done</b> button unlocks and marks the batch completed.
        </p>
        {msg && <div className="muted" style={{ marginBottom: 12 }}>{msg}</div>}

        <table>
          <thead>
            <tr><th>Batch</th><th>Completed file</th><th>Upload</th><th></th></tr>
          </thead>
          <tbody>
            {pending.map((b) => {
              const uploaded = !!b.completed_filename;
              return (
                <tr key={b.id}>
                  <td>{b.name}{b.assigned_username ? <span className="muted"> · {b.assigned_username}</span> : ""}</td>
                  <td>
                    {uploaded
                      ? <span className="badge completed">{b.completed_filename}</span>
                      : <span className="muted">not uploaded</span>}
                  </td>
                  <td>
                    <input
                      ref={(el) => (fileRefs.current[b.id] = el)}
                      type="file"
                      accept=".xlsx,.xls,.csv"
                      style={{ display: "none" }}
                      onChange={(e) => uploadCompleted(b.id, e.target.files[0])}
                    />
                    <button
                      disabled={busyId === b.id}
                      onClick={() => fileRefs.current[b.id]?.click()}
                    >
                      {uploaded ? "Replace file" : "Upload file"}
                    </button>
                  </td>
                  <td>
                    <button
                      className="success"
                      disabled={!uploaded || busyId === b.id}
                      onClick={() => markDone(b.id)}
                    >
                      Done
                    </button>
                  </td>
                </tr>
              );
            })}
            {pending.length === 0 && (
              <tr><td colSpan={4} className="muted">No batches ready to finish. Process a batch first.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="card">
        <h3>Completed batches</h3>
        <table>
          <thead>
            <tr><th>Batch</th><th>Completed at</th><th>Submitted file</th></tr>
          </thead>
          <tbody>
            {completed.map((b) => (
              <tr key={b.id}>
                <td>{b.name}{b.assigned_username ? <span className="muted"> · {b.assigned_username}</span> : ""}</td>
                <td className="muted">{b.completed_at ? new Date(b.completed_at).toLocaleString() : "—"}</td>
                <td>
                  {b.completed_filename
                    ? <button onClick={() => download(b.id, b.completed_filename)}>Download</button>
                    : <span className="muted">—</span>}
                </td>
              </tr>
            ))}
            {completed.length === 0 && (
              <tr><td colSpan={3} className="muted">No completed batches yet.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

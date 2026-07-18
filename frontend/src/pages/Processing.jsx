import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import api from "../api";

const IMAGE_RE = /\.(jpe?g|png|webp|gif|bmp|tiff?)$/i;

export default function Processing() {
  const [params] = useSearchParams();
  const preselectBatch = params.get("batch") || "";

  const [batches, setBatches] = useState([]);
  const [batchId, setBatchId] = useState(preselectBatch);
  const [files, setFiles] = useState([]);      // File objects from the folder picker
  const [jobId, setJobId] = useState(null);
  const [status, setStatus] = useState(null);  // {status, total, processed, remaining, current_image, report_id}
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const pollRef = useRef(null);
  const folderInputRef = useRef(null);

  useEffect(() => {
    api.get("/batches").then((r) => setBatches(r.data));
  }, []);

  function onFolderSelected(e) {
    const picked = Array.from(e.target.files).filter((f) => IMAGE_RE.test(f.name));
    setFiles(picked);
    setStatus(null);
    setJobId(null);
    setMsg(picked.length ? `${picked.length} image(s) found in folder.` : "No images found in that folder.");
  }

  async function startProcess() {
    if (!files.length) return;
    setBusy(true);
    setMsg("");
    try {
      const selectedBatch = batches.find((b) => String(b.id) === String(batchId));
      const { data } = await api.post("/processing/start", {
        batch_id: batchId ? Number(batchId) : null,
        batch_name: selectedBatch ? selectedBatch.name : "adhoc",
        image_names: files.map((f) => f.name),
      });
      setJobId(data.job_id);
      poll(data.job_id);
    } catch (err) {
      setMsg(err.response?.data?.detail || "Failed to start processing");
    } finally {
      setBusy(false);
    }
  }

  function poll(id) {
    clearInterval(pollRef.current);
    pollRef.current = setInterval(async () => {
      try {
        const { data } = await api.get(`/processing/status/${id}`);
        setStatus(data);
        if (data.status === "completed" || data.status === "error") {
          clearInterval(pollRef.current);
        }
      } catch {
        clearInterval(pollRef.current);
      }
    }, 700);
  }

  useEffect(() => () => clearInterval(pollRef.current), []);

  const isComplete = status?.status === "completed";
  const pct = status && status.total ? Math.round((status.processed / status.total) * 100) : 0;

  return (
    <div>
      <h1 className="page-title">Process Images</h1>

      <div className="card">
        <label>Batch (optional — links this run to an assigned batch)</label>
        <select value={batchId} onChange={(e) => setBatchId(e.target.value)} style={{ maxWidth: 400 }}>
          <option value="">Ad-hoc run (no batch)</option>
          {batches.filter((b) => b.status !== "completed").map((b) => (
            <option key={b.id} value={b.id}>{b.name}{b.assigned_username ? ` · ${b.assigned_username}` : ""}</option>
          ))}
        </select>

        <div style={{ marginTop: 18 }}>
          <label>Image folder</label>
          {/* webkitdirectory lets the browser pick an entire folder of images */}
          <input
            ref={folderInputRef}
            type="file"
            webkitdirectory=""
            directory=""
            multiple
            style={{ display: "none" }}
            onChange={onFolderSelected}
          />
          <div className="row" style={{ maxWidth: 500 }}>
            <button type="button" onClick={() => folderInputRef.current?.click()}>Select Folder</button>
            <button type="button" className="primary" disabled={!files.length || busy || (jobId && !isComplete && status?.status !== "error")} onClick={startProcess}>
              Start Process
            </button>
          </div>
          {msg && <div className="muted" style={{ marginTop: 10 }}>{msg}</div>}
        </div>
      </div>

      {status && (
        <div className="card">
          <h3>Live progress</h3>
          <div className="progress-track"><div className="progress-fill" style={{ width: `${pct}%` }} /></div>
          <div style={{ display: "flex", justifyContent: "space-between", marginTop: 10 }}>
            <span>Processed: <b>{status.processed}</b> / {status.total}</span>
            <span className="muted">Remaining: {status.remaining}</span>
            <span>{pct}%</span>
          </div>
          {status.current_image && <div className="muted" style={{ marginTop: 8 }}>Current: {status.current_image}</div>}
          {status.status === "error" && <div className="error">Error: {status.error}</div>}

          {isComplete && (
            <div style={{ marginTop: 16 }}>
              <div className="badge completed" style={{ marginRight: 12 }}>Amazon template generated</div>
              {status.report_id && (
                <a href="/reports"><button className="ghost">Download template (Reports)</button></a>
              )}
            </div>
          )}
        </div>
      )}

      <div className="card">
        <h3>Next steps</h3>
        <ol className="muted" style={{ margin: 0, paddingLeft: 18, lineHeight: 1.8 }}>
          <li>Download the generated Amazon template (from the <b>Reports</b> page).</li>
          <li>Edit your images and upload them via <b>Tools · Drive Upload</b> to get the image-links file.</li>
          <li>Paste those image URLs into the downloaded template and save it.</li>
          <li>Go to the <b>Finish</b> page, upload the completed template, and click <b>Done</b>.</li>
        </ol>
      </div>
    </div>
  );
}

import { useEffect, useRef, useState } from "react";
import api from "../api";

const IMAGE_RE = /\.(jpe?g|png|webp|gif|bmp|tiff?)$/i;

// Country options (radio). More can be added later.
const COUNTRIES = [
  { value: "UAE", label: "UAE" },
  { value: "India", label: "India" },
];

// Placeholder categories — replace/extend later. Each category will map to its own
// backend template. (Frontend only for now; no backend wiring yet.)
const CATEGORIES = [
  "Home & Kitchen",
  "Beauty & Personal Care",
  "Electronics",
  "Toys & Games",
  "Sports & Outdoors",
];

export default function Processing() {
  const [country, setCountry] = useState("");
  const [category, setCategory] = useState("");
  const [files, setFiles] = useState([]);      // File objects from the folder picker
  const [jobId, setJobId] = useState(null);
  const [status, setStatus] = useState(null);  // {status,total,processed,remaining,current_image,report_id}
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const pollRef = useRef(null);
  const folderInputRef = useRef(null);

  function onFolderSelected(e) {
    const picked = Array.from(e.target.files).filter((f) => IMAGE_RE.test(f.name));
    setFiles(picked);
    setStatus(null);
    setJobId(null);
    setMsg(picked.length ? `${picked.length} image(s) found in folder.` : "No images found in that folder.");
  }

  const ready = country && category && files.length;

  async function startProcess() {
    if (!ready) return;
    setBusy(true);
    setMsg("");
    try {
      const { data } = await api.post("/processing/start", {
        batch_id: null,
        batch_name: `${country}-${category}`.replace(/\s+/g, "_"),
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

  // Download the generated file directly here (not from Reports).
  async function downloadGenerated() {
    if (!status?.report_id) return;
    try {
      const res = await api.get(`/reports/${status.report_id}/download`, { responseType: "blob" });
      const url = window.URL.createObjectURL(res.data);
      const a = document.createElement("a");
      a.href = url;
      a.download = `amazon_template_${country}_${category}.xlsx`.replace(/\s+/g, "_");
      a.click();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      setMsg(err.response?.data?.detail || "Could not download the generated file");
    }
  }

  const isComplete = status?.status === "completed";
  const pct = status && status.total ? Math.round((status.processed / status.total) * 100) : 0;

  return (
    <div>
      <h1 className="page-title">MrWhite AI</h1>

      {/* Step 1: Country */}
      <div className="card">
        <label>Country</label>
        <div style={{ display: "flex", gap: 20, marginTop: 6 }}>
          {COUNTRIES.map((c) => (
            <label key={c.value} style={{ display: "flex", alignItems: "center", gap: 8, margin: 0, cursor: "pointer" }}>
              <input
                type="radio"
                name="country"
                value={c.value}
                checked={country === c.value}
                onChange={(e) => { setCountry(e.target.value); setCategory(""); }}
                style={{ width: "auto" }}
              />
              {c.label}
            </label>
          ))}
        </div>
      </div>

      {/* Step 2: Category (after country) */}
      <div className="card">
        <label>Category</label>
        <select
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          disabled={!country}
          style={{ maxWidth: 400 }}
        >
          <option value="">{country ? "Select a category" : "Select a country first"}</option>
          {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
      </div>

      {/* Step 3: Folder + Start */}
      <div className="card">
        <label>Image folder</label>
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
          <button
            type="button"
            className="primary"
            disabled={!ready || busy || (jobId && !isComplete && status?.status !== "error")}
            onClick={startProcess}
          >
            Start Process
          </button>
        </div>
        {!ready && (country || category || files.length) && (
          <div className="muted" style={{ marginTop: 10 }}>
            Select a country, a category, and an image folder to begin.
          </div>
        )}
        {msg && <div className="muted" style={{ marginTop: 10 }}>{msg}</div>}
      </div>

      {/* Progress */}
      {status && (
        <div className="card">
          <h3>Processing progress</h3>
          <div className="progress-track"><div className="progress-fill" style={{ width: `${pct}%` }} /></div>
          <div style={{ display: "flex", justifyContent: "space-between", marginTop: 10 }}>
            <span>Processed: <b>{status.processed}</b> / {status.total}</span>
            <span className="muted">Remaining: {status.remaining}</span>
            <span>{pct}%</span>
          </div>
          {status.current_image && <div className="muted" style={{ marginTop: 8 }}>Current: {status.current_image}</div>}
          {status.status === "error" && <div className="error">Error: {status.error}</div>}

          {isComplete && (
            <div style={{ marginTop: 16, display: "flex", alignItems: "center", gap: 12 }}>
              <span className="badge completed">Amazon template generated</span>
              <button className="success" onClick={downloadGenerated}>Download generated file</button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

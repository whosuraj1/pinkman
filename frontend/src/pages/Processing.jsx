import { useEffect, useRef, useState } from "react";
import api from "../api";

const IMAGE_RE = /\.(jpe?g|png|webp|gif|bmp|tiff?)$/i;

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
  const [stores, setStores] = useState([]);       // stores assigned to this user
  const [storeId, setStoreId] = useState("");
  const [category, setCategory] = useState("");
  const [keywordMode, setKeywordMode] = useState("not_specified"); // not_specified | specific
  const [searchKeyword, setSearchKeyword] = useState("");
  const [files, setFiles] = useState([]);      // File objects from the folder picker
  const [jobId, setJobId] = useState(null);
  const [status, setStatus] = useState(null);  // {status,total,processed,remaining,current_image,report_id}
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const pollRef = useRef(null);
  const folderInputRef = useRef(null);

  useEffect(() => {
    api.get("/stores/mine").then((r) => setStores(r.data)).catch(() => {});
  }, []);

  const selectedStore = stores.find((s) => String(s.id) === String(storeId));
  const country = selectedStore ? selectedStore.country : "";

  function onFolderSelected(e) {
    const picked = Array.from(e.target.files).filter((f) => IMAGE_RE.test(f.name));
    setFiles(picked);
    setStatus(null);
    setJobId(null);
    setMsg(picked.length ? `${picked.length} image(s) found in folder.` : "No images found in that folder.");
  }

  const keywordOk = keywordMode === "not_specified" || (keywordMode === "specific" && searchKeyword.trim());
  const ready = storeId && category && files.length && keywordOk;

  async function startProcess() {
    if (!ready) return;
    setBusy(true);
    setMsg("");
    try {
      const { data } = await api.post("/processing/start", {
        batch_id: null,
        batch_name: `${selectedStore.name}-${category}`.replace(/\s+/g, "_"),
        image_names: files.map((f) => f.name),
        store_id: selectedStore.id,
        country: selectedStore.country,
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

      {/* Step 1: Store (from the user's assigned stores; picks the template) */}
      <div className="card">
        <label>Store</label>
        {stores.length === 0 ? (
          <div className="muted" style={{ marginTop: 6 }}>
            No stores assigned to you yet. Ask your admin to assign a store.
          </div>
        ) : (
          <>
            <select
              value={storeId}
              onChange={(e) => { setStoreId(e.target.value); setCategory(""); }}
              style={{ maxWidth: 400 }}
            >
              <option value="">Select a store</option>
              {stores.map((s) => (
                <option key={s.id} value={s.id}>{s.name} — {s.country}</option>
              ))}
            </select>
            {selectedStore && (
              <div className="muted" style={{ marginTop: 8, fontSize: 12 }}>
                Template auto-selected: <b>{selectedStore.country}</b>
              </div>
            )}
          </>
        )}
      </div>

      {/* Step 2: Search keyword mode, then Amazon Category + Search Keyword */}
      <div className="card">
        <label>Search keyword</label>
        <div style={{ display: "flex", gap: 20, marginTop: 6, marginBottom: 16 }}>
          <label style={{ display: "flex", alignItems: "center", gap: 8, margin: 0, cursor: "pointer" }}>
            <input
              type="radio"
              name="keywordMode"
              value="not_specified"
              checked={keywordMode === "not_specified"}
              onChange={() => { setKeywordMode("not_specified"); setSearchKeyword(""); }}
              style={{ width: "auto" }}
            />
            Not Specified Search Keyword
          </label>
          <label style={{ display: "flex", alignItems: "center", gap: 8, margin: 0, cursor: "pointer" }}>
            <input
              type="radio"
              name="keywordMode"
              value="specific"
              checked={keywordMode === "specific"}
              onChange={() => setKeywordMode("specific")}
              style={{ width: "auto" }}
            />
            Specific Search Keyword
          </label>
        </div>

        <div className="row" style={{ alignItems: "flex-start" }}>
          <div>
            <label>Amazon Category</label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              disabled={!storeId}
            >
              <option value="">{storeId ? "Select a category" : "Select a store first"}</option>
              {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div>
            <label>Search Keyword</label>
            <input
              type="text"
              value={searchKeyword}
              onChange={(e) => setSearchKeyword(e.target.value)}
              disabled={keywordMode !== "specific"}
              placeholder={keywordMode === "specific" ? "e.g. stainless steel water bottle" : "Not specified"}
            />
          </div>
        </div>
        {keywordMode === "specific" && (
          <div className="muted" style={{ marginTop: 8, fontSize: 12 }}>
            The AI will focus on this product/object while analyzing the images.
          </div>
        )}
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
        {!ready && (storeId || category || files.length || searchKeyword) && (
          <div className="muted" style={{ marginTop: 10 }}>
            {keywordMode === "specific" && !searchKeyword.trim()
              ? "Enter a search keyword, or switch to \"Not Specified\"."
              : "Select a store, an Amazon category, and an image folder to begin."}
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

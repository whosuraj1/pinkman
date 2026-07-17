import { useEffect, useRef, useState } from "react";
import api from "../api";

const IMAGE_RE = /\.(jpe?g|png|webp|gif|bmp|tiff?)$/i;

export default function Tools() {
  const [storage, setStorage] = useState(null);
  const [files, setFiles] = useState([]);
  const [folderId, setFolderId] = useState("");
  const [cleanup, setCleanup] = useState(true);
  const [result, setResult] = useState(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const inputRef = useRef(null);

  useEffect(() => {
    api.get("/tools/drive/storage").then((r) => setStorage(r.data)).catch(() => {});
  }, []);

  function onSelect(e) {
    const picked = Array.from(e.target.files).filter((f) => IMAGE_RE.test(f.name));
    setFiles(picked);
    setResult(null);
    setMsg(picked.length ? `${picked.length} image(s) selected.` : "No images found.");
  }

  async function upload() {
    if (!files.length) return;
    setBusy(true);
    setMsg("");
    try {
      const { data } = await api.post("/tools/drive/upload", {
        folder_id: folderId,
        image_names: files.map((f) => f.name),
        cleanup_if_needed: cleanup,
      });
      setResult(data);
    } catch (err) {
      setMsg(err.response?.data?.detail || "Upload failed");
    } finally {
      setBusy(false);
    }
  }

  async function downloadLinks() {
    const res = await api.get(`/tools/drive/download/${result.links_file}`, { responseType: "blob" });
    const url = window.URL.createObjectURL(res.data);
    const a = document.createElement("a");
    a.href = url;
    a.download = result.links_file;
    a.click();
    window.URL.revokeObjectURL(url);
  }

  return (
    <div>
      <h1 className="page-title">Tools · Google Drive Upload</h1>

      {storage && (
        <div className="card">
          <h3>Drive storage</h3>
          <div className="progress-track">
            <div className="progress-fill" style={{ width: `${(storage.used_gb / storage.total_gb) * 100}%` }} />
          </div>
          <div className="muted" style={{ marginTop: 8 }}>
            {storage.used_gb} GB used of {storage.total_gb} GB · {storage.free_gb} GB free
          </div>
        </div>
      )}

      <div className="card">
        <h3>Upload images & get links</h3>
        <p className="muted">
          Checks available space, optionally deletes old images, uploads via the Drive API,
          and returns an XLSX of image links. (Prototype — real Drive code plugs in later.)
        </p>

        <label>Target Drive folder ID (optional)</label>
        <input value={folderId} onChange={(e) => setFolderId(e.target.value)} style={{ maxWidth: 400 }} placeholder="e.g. 1a2B3c..." />

        <label style={{ marginTop: 14 }}>
          <input type="checkbox" style={{ width: "auto", marginRight: 8 }} checked={cleanup} onChange={(e) => setCleanup(e.target.checked)} />
          Delete old images if storage is needed
        </label>

        <div style={{ marginTop: 14 }}>
          <input ref={inputRef} type="file" multiple style={{ display: "none" }} onChange={onSelect} accept="image/*" />
          <div className="row" style={{ maxWidth: 500 }}>
            <button type="button" onClick={() => inputRef.current?.click()}>Select Images</button>
            <button type="button" className="primary" disabled={!files.length || busy} onClick={upload}>
              {busy ? "Uploading..." : "Upload to Drive"}
            </button>
          </div>
          {msg && <div className="muted" style={{ marginTop: 10 }}>{msg}</div>}
        </div>
      </div>

      {result && (
        <div className="card">
          <h3>Result</h3>
          <p>Deleted old images: {result.deleted_old_images} · Uploaded: {result.uploaded}</p>
          <button className="success" onClick={downloadLinks}>Download links XLSX</button>
          <table style={{ marginTop: 14 }}>
            <thead><tr><th>Image</th><th>Drive link</th></tr></thead>
            <tbody>
              {result.links.map((l, i) => (
                <tr key={i}><td>{l.image_name}</td><td><a href={l.drive_link} target="_blank" rel="noreferrer">{l.drive_link}</a></td></tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

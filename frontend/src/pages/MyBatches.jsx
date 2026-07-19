import { useEffect, useState } from "react";
import api from "../api";

export default function MyBatches() {
  const [batches, setBatches] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get("/batches")
      .then((r) => setBatches(r.data))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div>
      <h1 className="page-title">My Batches</h1>

      <div className="card">
        <p className="muted" style={{ marginTop: 0 }}>
          Batches assigned to you by the admin. Download a batch, then process its
          images in <b>MrWhite AI</b>.
        </p>

        <table>
          <thead>
            <tr>
              <th>Batch</th>
              <th>Images</th>
              <th>Status</th>
              <th>Download</th>
            </tr>
          </thead>
          <tbody>
            {batches.map((b) => (
              <tr key={b.id}>
                <td>{b.name}</td>
                <td>{b.total_images || "—"}</td>
                <td><span className={`badge ${b.status}`}>{b.status.replace("_", " ")}</span></td>
                <td>
                  {b.drive_link
                    ? <a href={b.drive_link} target="_blank" rel="noreferrer"><button className="primary">Download ZIP</button></a>
                    : <span className="muted">no link</span>}
                </td>
              </tr>
            ))}
            {!loading && batches.length === 0 && (
              <tr><td colSpan={4} className="muted">No batches assigned to you yet.</td></tr>
            )}
            {loading && (
              <tr><td colSpan={4} className="muted">Loading…</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

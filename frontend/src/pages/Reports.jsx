import { useEffect, useState } from "react";
import api, { API_URL } from "../api";
import { useAuth } from "../auth";

export default function Reports() {
  const { user } = useAuth();
  const [reports, setReports] = useState([]);

  useEffect(() => {
    api.get("/reports").then((r) => setReports(r.data));
  }, []);

  async function download(id, filename) {
    // Fetch with auth header, then trigger a browser download of the blob.
    const res = await api.get(`/reports/${id}/download`, { responseType: "blob" });
    const url = window.URL.createObjectURL(res.data);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    window.URL.revokeObjectURL(url);
  }

  return (
    <div>
      <h1 className="page-title">Reports</h1>
      <div className="card">
        <p className="muted">Generated Amazon templates ready to upload to Amazon.</p>
        <table>
          <thead>
            <tr>
              <th>File</th>
              {user?.role === "admin" && <th>Employee</th>}
              <th>Created</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {reports.map((r) => (
              <tr key={r.id}>
                <td>{r.filename}</td>
                {user?.role === "admin" && <td>{r.username || "—"}</td>}
                <td className="muted">{new Date(r.created_at).toLocaleString()}</td>
                <td><button onClick={() => download(r.id, r.filename)}>Download</button></td>
              </tr>
            ))}
            {reports.length === 0 && (
              <tr><td colSpan={user?.role === "admin" ? 4 : 3} className="muted">No reports yet.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

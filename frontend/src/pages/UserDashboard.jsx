import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import api from "../api";

export default function UserDashboard() {
  const [batches, setBatches] = useState([]);

  async function load() {
    const { data } = await api.get("/batches");
    setBatches(data);
  }

  useEffect(() => {
    load();
    const t = setInterval(load, 4000);
    return () => clearInterval(t);
  }, []);

  const completed = batches.filter((b) => b.status === "completed").length;
  const pending = batches.length - completed;

  return (
    <div>
      <h1 className="page-title">My Dashboard</h1>

      <div className="grid cols-3">
        <div className="card stat"><div className="num">{batches.length}</div><div className="lbl">Assigned batches</div></div>
        <div className="card stat"><div className="num">{completed}</div><div className="lbl">Completed</div></div>
        <div className="card stat"><div className="num">{pending}</div><div className="lbl">Pending</div></div>
      </div>

      <div className="card">
        <h3>My batches</h3>
        <table>
          <thead>
            <tr><th>Batch</th><th>Drive link</th><th>Images</th><th>Status</th><th></th></tr>
          </thead>
          <tbody>
            {batches.map((b) => (
              <tr key={b.id}>
                <td>{b.name}</td>
                <td>{b.drive_link ? <a href={b.drive_link} target="_blank" rel="noreferrer">Open ZIP</a> : "—"}</td>
                <td>{b.processed_images}/{b.total_images}</td>
                <td><span className={`badge ${b.status}`}>{b.status.replace("_", " ")}</span></td>
                <td>
                  {b.status !== "completed" && (
                    <Link to="/my-batches"><button className="primary">Open</button></Link>
                  )}
                </td>
              </tr>
            ))}
            {batches.length === 0 && <tr><td colSpan={5} className="muted">No batches assigned yet. Ask your admin.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}

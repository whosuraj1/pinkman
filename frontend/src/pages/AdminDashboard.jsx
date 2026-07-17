import { useEffect, useState } from "react";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend,
} from "recharts";
import api from "../api";

const COLORS = ["#22c55e", "#4f8cff", "#f59e0b"];

export default function AdminDashboard() {
  const [progress, setProgress] = useState([]);
  const [batches, setBatches] = useState([]);

  async function load() {
    const [p, b] = await Promise.all([api.get("/users/progress"), api.get("/batches")]);
    setProgress(p.data);
    setBatches(b.data);
  }

  useEffect(() => {
    load();
    const t = setInterval(load, 5000); // keep admin view fresh
    return () => clearInterval(t);
  }, []);

  const totalUsers = progress.length;
  const totalBatches = batches.length;
  const completedBatches = batches.filter((b) => b.status === "completed").length;
  const totalImages = progress.reduce((s, u) => s + u.images_processed, 0);

  const statusPie = [
    { name: "Completed", value: batches.filter((b) => b.status === "completed").length },
    { name: "In Progress", value: batches.filter((b) => b.status === "in_progress").length },
    { name: "Assigned", value: batches.filter((b) => b.status === "assigned").length },
  ];

  return (
    <div>
      <h1 className="page-title">Admin Dashboard</h1>

      <div className="grid cols-3">
        <div className="card stat"><div className="num">{totalUsers}</div><div className="lbl">Employees</div></div>
        <div className="card stat"><div className="num">{completedBatches}/{totalBatches}</div><div className="lbl">Batches completed</div></div>
        <div className="card stat"><div className="num">{totalImages}</div><div className="lbl">Images processed</div></div>
      </div>

      <div className="grid cols-2">
        <div className="card">
          <h3>Work completed per employee</h3>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={progress}>
              <XAxis dataKey="username" stroke="#9aa2b1" fontSize={11} />
              <YAxis stroke="#9aa2b1" fontSize={11} allowDecimals={false} />
              <Tooltip contentStyle={{ background: "#171a21", border: "1px solid #2a2f3a", fontFamily: "Fira Code" }} />
              <Bar dataKey="images_processed" name="Images" fill="#4f8cff" radius={[4, 4, 0, 0]} />
              <Bar dataKey="completed_batches" name="Batches done" fill="#22c55e" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="card">
          <h3>Batch status</h3>
          <ResponsiveContainer width="100%" height={260}>
            <PieChart>
              <Pie data={statusPie} dataKey="value" nameKey="name" outerRadius={90} label>
                {statusPie.map((_, i) => <Cell key={i} fill={COLORS[i]} />)}
              </Pie>
              <Legend />
              <Tooltip contentStyle={{ background: "#171a21", border: "1px solid #2a2f3a", fontFamily: "Fira Code" }} />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="card">
        <h3>Employee progress</h3>
        <table>
          <thead>
            <tr><th>Employee</th><th>Batches</th><th>Completed</th><th>Images</th><th>Progress</th></tr>
          </thead>
          <tbody>
            {progress.map((u) => (
              <tr key={u.user_id}>
                <td>{u.full_name || u.username} <span className="muted">({u.username})</span></td>
                <td>{u.total_batches}</td>
                <td>{u.completed_batches}</td>
                <td>{u.images_processed}</td>
                <td style={{ width: 200 }}>
                  <div className="progress-track"><div className="progress-fill" style={{ width: `${u.completion_pct}%` }} /></div>
                  <span className="muted" style={{ fontSize: 11 }}>{u.completion_pct}%</span>
                </td>
              </tr>
            ))}
            {progress.length === 0 && <tr><td colSpan={5} className="muted">No employees yet.</td></tr>}
          </tbody>
        </table>
      </div>

      <div className="card">
        <h3>All batches</h3>
        <table>
          <thead>
            <tr><th>Batch</th><th>Assigned to</th><th>Images</th><th>Status</th></tr>
          </thead>
          <tbody>
            {batches.map((b) => (
              <tr key={b.id}>
                <td>{b.name}</td>
                <td>{b.assigned_username || "—"}</td>
                <td>{b.processed_images}/{b.total_images}</td>
                <td><span className={`badge ${b.status}`}>{b.status.replace("_", " ")}</span></td>
              </tr>
            ))}
            {batches.length === 0 && <tr><td colSpan={4} className="muted">No batches yet.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}

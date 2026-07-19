import { BrowserRouter, Routes, Route, Navigate, Outlet } from "react-router-dom";
import { AuthProvider, useAuth } from "./auth";
import ProtectedRoute from "./components/ProtectedRoute";
import Sidebar from "./components/Sidebar";
import Login from "./pages/Login";
import AdminDashboard from "./pages/AdminDashboard";
import UserDashboard from "./pages/UserDashboard";
import Users from "./pages/Users";
import Processing from "./pages/Processing";
import MyBatches from "./pages/MyBatches";
import Finish from "./pages/Finish";
import Reports from "./pages/Reports";
import Tools from "./pages/Tools";

function Layout() {
  return (
    <div className="layout">
      <Sidebar />
      <main className="content">
        <Outlet />
      </main>
    </div>
  );
}

// Dashboard branches by role.
function Dashboard() {
  const { user } = useAuth();
  return user?.role === "admin" ? <AdminDashboard /> : <UserDashboard />;
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />

          <Route
            element={
              <ProtectedRoute>
                <Layout />
              </ProtectedRoute>
            }
          >
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/process" element={<Processing />} />
            <Route path="/my-batches" element={<MyBatches />} />
            <Route path="/finish" element={<Finish />} />
            <Route path="/reports" element={<Reports />} />
            <Route path="/tools" element={<Tools />} />
            <Route
              path="/users"
              element={
                <ProtectedRoute adminOnly>
                  <Users />
                </ProtectedRoute>
              }
            />
          </Route>

          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}

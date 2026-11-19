
import {
  BrowserRouter as Router,
  Routes,
  Route,
  Navigate,
} from 'react-router-dom';

import Login from './pages/Login';
import Register from './pages/Register';
import BorrowerDashboard from './pages/BorrowerDashboard';
import AdminDashboard from './pages/AdminDashboard';
import TechnicianDashboard from './pages/TechnicianDashboard';

function App() {
  return (
    <Router>
      <div className="min-h-screen bg-gray-50 text-gray-900 font-sans">
        <Routes>
          {/* Default route */}
          <Route
            path="/"
            element={<Navigate to="/login" replace />}
          />

          {/* Authentication */}
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />

          {/* Staff Dashboard */}
          <Route
            path="/staff/dashboard"
            element={<BorrowerDashboard />}
          />

          {/* Administrator Dashboard */}
          <Route
            path="/admin/dashboard"
            element={<AdminDashboard />}
          />

          {/* Technician Dashboard */}
          <Route
            path="/technician/dashboard"
            element={<TechnicianDashboard />}
          />

          {/* Unknown routes */}
          <Route
            path="*"
            element={<Navigate to="/login" replace />}
          />
        </Routes>
      </div>
    </Router>
  );
}

export default App;


import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import AdminLayout from './components/layout/AdminLayout';
import Dashboard from './pages/Dashboard';
import Login from './pages/Login';
import Users from './pages/Users';
import Labs from './pages/Labs';
import Settings from './pages/Settings';
import Classes from './pages/Classes';
import Students from './pages/Students';
import Academic from './pages/Academic';
import MiniApps from './pages/MiniApps';

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/" element={<AdminLayout />}>
          <Route index element={<Dashboard />} />
          <Route path="classes" element={<Classes />} />
          <Route path="students" element={<Students />} />
          <Route path="academic" element={<Academic />} />
          <Route path="users" element={<Users />} />
          <Route path="labs" element={<Labs />} />
          <Route path="miniapps" element={<MiniApps />} />
          <Route path="settings" element={<Settings />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Router>
  );
}

export default App;

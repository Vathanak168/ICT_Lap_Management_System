import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Layout from './components/layout/Layout';
import Dashboard from './pages/Dashboard';
import Students from './pages/Students';
import Attendance from './pages/Attendance';
import SeatingPlan from './pages/SeatingPlan';
import Gradebook from './pages/Gradebook';
import PCIssues from './pages/PCIssues';
import LessonLog from './pages/LessonLog';
import Settings from './pages/Settings';
import Classes from './pages/Classes';
import Login from './pages/Login';
import Register from './pages/Register';
import UsersManagement from './pages/Users';
import ShiftSwitching from './pages/ShiftSwitching';
import LessonPlan from './pages/LessonPlan';
import MiniApps from './pages/MiniApps';
import Profile from './pages/Profile';
import PcSync from './pages/PcSync';
import ProtectedRoute from './components/auth/ProtectedRoute';
import { LanguageProvider } from './contexts/LanguageContext';
import { AuthProvider } from './contexts/AuthContext';
import { AcademicYearProvider } from './contexts/AcademicYearContext';

function App() {
  return (
    <AuthProvider>
      <LanguageProvider>
        <AcademicYearProvider>
          <BrowserRouter>
            <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            
            <Route element={<ProtectedRoute />}>
              <Route element={<Layout />}>
                <Route path="/" element={<Dashboard />} />
                <Route path="/classes" element={<Classes />} />
                <Route path="/students" element={<Students />} />
                <Route path="/attendance" element={<Attendance />} />
                <Route path="/seating" element={<SeatingPlan />} />
                <Route path="/grades" element={<Gradebook />} />
                <Route path="/issues" element={<PCIssues />} />
                <Route path="/lesson-log" element={<LessonLog />} />
                <Route path="/lesson-plan" element={<LessonPlan />} />
                <Route path="/shift-switching" element={<ShiftSwitching />} />
                <Route path="/miniapps" element={<MiniApps />} />
                <Route path="/profile" element={<Profile />} />
                <Route path="/pc-sync" element={<PcSync />} />
                <Route path="/settings" element={<Settings />} />
                
                {/* Admin only route */}
                <Route element={<ProtectedRoute allowedRoles={['admin']} />}>
                  <Route path="/users" element={<UsersManagement />} />
                </Route>
              </Route>
            </Route>
          </Routes>
        </BrowserRouter>
        </AcademicYearProvider>
      </LanguageProvider>
    </AuthProvider>
  );
}

export default App;

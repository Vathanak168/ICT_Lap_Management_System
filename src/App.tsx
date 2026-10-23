import { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Layout from './components/layout/Layout';
import ProtectedRoute from './components/auth/ProtectedRoute';
import { LanguageProvider } from './contexts/LanguageContext';
import { AuthProvider } from './contexts/AuthContext';
import { AcademicYearProvider } from './contexts/AcademicYearContext';

// Code-split page components for faster initial load
const Dashboard = lazy(() => import('./pages/Dashboard'));
const Students = lazy(() => import('./pages/Students'));
const Attendance = lazy(() => import('./pages/Attendance'));
const SeatingPlan = lazy(() => import('./pages/SeatingPlan'));
const Gradebook = lazy(() => import('./pages/Gradebook'));
const PCIssues = lazy(() => import('./pages/PCIssues'));
const LessonLog = lazy(() => import('./pages/LessonLog'));
const Settings = lazy(() => import('./pages/Settings'));
const Classes = lazy(() => import('./pages/Classes'));
const Login = lazy(() => import('./pages/Login'));
const Register = lazy(() => import('./pages/Register'));
const UsersManagement = lazy(() => import('./pages/Users'));
const ShiftSwitching = lazy(() => import('./pages/ShiftSwitching'));
const LessonPlan = lazy(() => import('./pages/LessonPlan'));
const MiniApps = lazy(() => import('./pages/MiniApps'));
const Profile = lazy(() => import('./pages/Profile'));
const PcSync = lazy(() => import('./pages/PcSync'));
const TeachingToday = lazy(() => import('./pages/teaching/TeachingToday'));
const TeachingProgress = lazy(() => import('./pages/teaching/TeachingProgress'));
const CurriculumLibrary = lazy(() => import('./pages/teaching/CurriculumLibrary'));
const TeachingSchedule = lazy(() => import('./pages/teaching/TeachingSchedule'));
const NotFound = lazy(() => import('./pages/NotFound'));

const PageFallback = () => (
  <div className="min-h-[50vh] flex flex-col items-center justify-center gap-3 p-6 text-slate-500 font-khmer">
    <div className="w-9 h-9 border-[3px] border-blue-500/25 border-t-[#0044CC] rounded-full animate-spin" />
    <span className="text-xs font-medium text-slate-400">កំពុងដំណើរការ...</span>
  </div>
);

function App() {
  return (
    <AuthProvider>
      <LanguageProvider>
        <BrowserRouter>
          <AcademicYearProvider>
            <Suspense fallback={<PageFallback />}>
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
                    {/* Teaching Tracker */}
                    <Route path="/teaching/today" element={<TeachingToday />} />
                    <Route path="/teaching/progress" element={<TeachingProgress />} />
                    <Route path="/teaching/schedule" element={<TeachingSchedule />} />
                    <Route path="/teaching/curriculum" element={<CurriculumLibrary />} />
                    {/* Legacy routes (hidden from nav, kept for bookmarks) */}
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

                {/* Catch-all 404 Route */}
                <Route path="*" element={<NotFound />} />
              </Routes>
            </Suspense>
          </AcademicYearProvider>
        </BrowserRouter>
      </LanguageProvider>
    </AuthProvider>
  );
}

export default App;

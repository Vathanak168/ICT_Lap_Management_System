import React from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { Loader2 } from 'lucide-react';

interface ProtectedRouteProps {
  allowedRoles?: ('admin' | 'teacher')[];
}

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ allowedRoles }) => {
  const { session, isLoading, role } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="w-10 h-10 text-[#2a5298] animate-spin" />
          <p className="text-gray-500 font-khmer">កំពុងផ្ទុកទិន្នន័យ...</p>
        </div>
      </div>
    );
  }

  if (!session) {
    return <Navigate to="/login" replace />;
  }

  if (session && allowedRoles && (!role || !allowedRoles.includes(role))) {
    // User doesn't have the required role (or role is null/undefined), redirect to dashboard
    return <Navigate to="/" replace />;
  }

  // Authorized, render child routes
  return <Outlet />;
};

export default ProtectedRoute;

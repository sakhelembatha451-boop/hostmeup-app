import { Navigate } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import type { UserRole } from '@/types';
import { Loader2 } from 'lucide-react';

interface ProtectedRouteProps {
  children: React.ReactNode;
  role?: UserRole;
  requireAdmin?: boolean;
}

export default function ProtectedRoute({ children, role, requireAdmin }: ProtectedRouteProps) {
  const { session, profile, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-6 h-6 text-ink animate-spin" />
      </div>
    );
  }

  if (!session) {
    return <Navigate to="/login" replace />;
  }

  // Session exists but profile not loaded yet — wait rather than redirecting
  if (!profile) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-6 h-6 text-ink animate-spin" />
      </div>
    );
  }

  if (role && profile.role !== role) {
    const redirectTo = profile.role === 'artist' ? '/artist-dashboard' : '/host-dashboard';
    return <Navigate to={redirectTo} replace />;
  }

  if (requireAdmin && !profile.is_admin) {
    return <Navigate to="/inbox" replace />;
  }

  return <>{children}</>;
}

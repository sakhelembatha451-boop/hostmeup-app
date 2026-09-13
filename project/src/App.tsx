import { BrowserRouter, Routes, Route, useLocation } from 'react-router-dom';
import { AuthProvider } from '@/context/AuthContext';
import Navbar from '@/components/Navbar';
import ProtectedRoute from '@/components/ProtectedRoute';
import LandingPage from '@/pages/LandingPage';
import LoginPage from '@/pages/LoginPage';
import SignupPage from '@/pages/SignupPage';
import ArtistBrowsePage from '@/pages/ArtistBrowsePage';
import ArtistProfilePage from '@/pages/ArtistProfilePage';
import ArtistProfileEditPage from '@/pages/ArtistProfileEditPage';
import BookingRequestPage from '@/pages/BookingRequestPage';
import HostDashboard from '@/pages/HostDashboard';
import ArtistDashboard from '@/pages/ArtistDashboard';
import InboxPage from '@/pages/InboxPage';
import AdminInboxPage from '@/pages/AdminInboxPage';
import AdminSettingsPage from '@/pages/AdminSettingsPage';
import { useAuth } from '@/context/AuthContext';
import { Navigate, Link } from 'react-router-dom';
import { Loader2 } from 'lucide-react';

function DashboardRedirect() {
  const { profile, loading } = useAuth();
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-6 h-6 text-ink animate-spin" />
      </div>
    );
  }
  if (!profile) return <Navigate to="/login" replace />;
  return <Navigate to={profile.role === 'artist' ? '/artist-dashboard' : '/host-dashboard'} replace />;
}

function Layout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />
      <main className="flex-1">{children}</main>
      <footer className="border-t border-line py-8 bg-paper">
        <div className="max-w-editorial mx-auto px-6 lg:px-12 flex flex-col sm:flex-row items-center justify-between gap-4">
          <span className="font-display text-lg font-bold text-ink">HostMeUp</span>
          <p className="text-xs text-ink-400 uppercase tracking-wide-sm">Connecting Creative Talent & Event Hosts</p>
          <p className="text-xs text-ink-400">Designed & Developed by Sakhele Mbatha</p>
<a
  href="https://www.instagram.com/hostmeup_mzansi/"
  target="_blank"
  rel="noopener noreferrer"
  aria-label="Follow HostMeUp on Instagram (opens in a new tab)"
  className="hover:underline flex items-center gap-1 text-emerald-800"
>
  Instagram
</a>
          </div>
      </footer>
    </div>
  );
}

function AppRoutes() {
  const location = useLocation();
  const isAuthPage = location.pathname === '/login' || location.pathname === '/signup';

  if (isAuthPage) {
    return (
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/signup" element={<SignupPage />} />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    );
  }

  return (
    <Layout>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/artists" element={<ArtistBrowsePage />} />
        <Route path="/artists/:id" element={<ArtistProfilePage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/signup" element={<SignupPage />} />
        <Route path="/dashboard" element={<DashboardRedirect />} />
        <Route
          path="/book/:id"
          element={
            <ProtectedRoute role="host">
              <BookingRequestPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/host-dashboard"
          element={
            <ProtectedRoute role="host">
              <HostDashboard />
            </ProtectedRoute>
          }
        />
        <Route
          path="/artist-dashboard"
          element={
            <ProtectedRoute role="artist">
              <ArtistDashboard />
            </ProtectedRoute>
          }
        />
        <Route
          path="/artist-profile/edit"
          element={
            <ProtectedRoute role="artist">
              <ArtistProfileEditPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/inbox"
          element={
            <ProtectedRoute>
              <InboxPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/inbox"
          element={
            <ProtectedRoute requireAdmin>
              <AdminInboxPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/settings"
          element={
            <ProtectedRoute>
              <AdminSettingsPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="*"
          element={
            <div className="min-h-screen flex flex-col items-center justify-center text-center px-4">
              <h1 className="font-display text-6xl font-bold text-ink mb-4">404</h1>
              <p className="text-lg text-ink-400 mb-8">Page not found</p>
              <Link to="/" className="btn-primary px-6 py-3 text-xs uppercase tracking-wide-sm">Back to Home</Link>
            </div>
          }
        />
      </Routes>
    </Layout>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <AppRoutes />
      </BrowserRouter>
    </AuthProvider>
  );
}

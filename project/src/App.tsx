import { BrowserRouter, Routes, Route, useLocation, Navigate, Link, useSearchParams, useNavigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { createClient } from '@supabase/supabase-js';
import { Loader2, CheckCircle2, AlertCircle } from 'lucide-react';
import { AuthProvider, useAuth } from '@/context/AuthContext';
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
import HostSettingsPage from '@/pages/HostSettingsPage';
import { InboxPage } from '@/pages/InboxPage';
import AdminInboxPage from '@/pages/AdminInboxPage';
import AdminDashboard from '@/pages/AdminDashboard';
import AdminSettingsPage from '@/pages/AdminSettingsPage';
import AdminVerification from '@/pages/AdminVerification';
import AdminSafetyPage from '@/pages/AdminSafetyPage';
import Legal from '@/components/Legal';

const supabaseUrl = 'https://eebgysablcbjeojywnyk.supabase.co';
const supabaseAnonKey = 'sb_publishable_Jb7ZXGW0uPCsmuIwXna1xA_yAf9zF7c';
const supabaseClient = createClient(supabaseUrl, supabaseAnonKey);

function BookingSuccessPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const rawBookingId = searchParams.get('booking_id');
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    async function confirmPayment() {
      if (!rawBookingId) {
        setStatus('error');
        setErrorMessage('No booking reference found in URL.');
        return;
      }

      // Clean and extract valid UUID from raw parameter (handles accidental markdown/URL suffix pollution)
      const uuidMatch = rawBookingId.match(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i);
      const bookingId = uuidMatch ? uuidMatch[0] : rawBookingId;

      try {
        // Call the secure backend RPC function
        const { error } = await supabaseClient.rpc('confirm_booking_payment', {
          target_booking_id: bookingId
        });

        if (error) throw error;

        setStatus('success');
        setTimeout(() => {
          navigate('/host-dashboard');
        }, 3000);
      } catch (err: any) {
        console.error('Payment confirmation error:', err);
        setStatus('error');
        setErrorMessage(err.message || 'Failed to update booking status.');
      }
    }

    confirmPayment();
  }, [rawBookingId, navigate]);

  return (
    <div className="min-h-[70vh] flex items-center justify-center px-4">
      <div className="max-w-md w-full bg-white p-8 rounded-xl shadow-sm border border-line text-center">
        {status === 'loading' && (
          <>
            <Loader2 className="w-12 h-12 text-emerald-600 animate-spin mx-auto mb-4" />
            <h1 className="text-xl font-bold text-ink mb-2">Confirming Payment...</h1>
            <p className="text-ink-400 text-sm">Please wait while we record your deposit and update your booking.</p>
          </>
        )}

        {status === 'success' && (
          <>
            <CheckCircle2 className="w-12 h-12 text-emerald-600 mx-auto mb-4" />
            <h1 className="text-xl font-bold text-ink mb-2">Payment Successful! 🎉</h1>
            <p className="text-ink-400 text-sm mb-4">Your deposit has been recorded and the booking is confirmed.</p>
            <p className="text-xs text-ink-300">Redirecting to your dashboard in 3 seconds...</p>
          </>
        )}

        {status === 'error' && (
          <>
            <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
            <h1 className="text-xl font-bold text-ink mb-2">Update Notice</h1>
            <p className="text-ink-400 text-sm mb-4">Payment was processed, but we encountered an issue updating the database:</p>
            <div className="bg-red-50 text-red-700 p-3 rounded text-xs text-left mb-6 break-words">
              {errorMessage}
            </div>
            <button
              onClick={() => navigate('/host-dashboard')}
              className="btn-primary w-full py-2.5 text-xs uppercase tracking-wide-sm"
            >
              Return to Dashboard
            </button>
          </>
        )}
      </div>
    </div>
  );
}

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
  if (profile.is_admin) return <Navigate to="/admin" replace />;
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
        <Route path="/success" element={<BookingSuccessPage />} />
        <Route
          path="/book/:id"
          element={
            <ProtectedRoute role="host">
              <BookingRequestPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/booking/:id"
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
          path="/host-settings"
          element={
            <ProtectedRoute role="host">
              <HostSettingsPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/host-profile/edit"
          element={<Navigate to="/host-settings" replace />}
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
          path="/inbox/:recipientId"
          element={
            <ProtectedRoute>
              <InboxPage />
            </ProtectedRoute>
          }
        />

        {/* ADMIN ROUTES */}
        <Route
          path="/admin"
          element={
            <ProtectedRoute requireAdmin>
              <AdminDashboard />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/verifications"
          element={
            <ProtectedRoute requireAdmin>
              <AdminVerification />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/safety"
          element={
            <ProtectedRoute requireAdmin>
              <AdminSafetyPage />
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
            <ProtectedRoute requireAdmin>
              <AdminSettingsPage />
            </ProtectedRoute>
          }
        />

        <Route path="/legal" element={<Legal />} />
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

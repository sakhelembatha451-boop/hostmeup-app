import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { LogOut, LayoutDashboard, User, Menu, X, Bell, Mail, Shield } from 'lucide-react';
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { markNotificationRead, markAllNotificationsRead } from '@/lib/messaging';
import type { Notification } from '@/types';

export default function Navbar() {
  const { profile, signOut } = useAuth();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);

  const dashboardPath = profile?.role === 'artist' ? '/artist-dashboard' : '/host-dashboard';
  const inboxPath = profile?.is_admin ? '/admin/inbox' : '/inbox';

  const handleSignOut = async () => {
    await signOut();
    navigate('/');
  };

  useEffect(() => {
    if (!profile) return;
    const loadNotifications = async () => {
      const { data } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', profile.id)
        .order('created_at', { ascending: false })
        .limit(10);
      const notifs = (data as Notification[]) || [];
      setNotifications(notifs);
      setUnreadCount(notifs.filter((n) => !n.read).length);
    };
    loadNotifications();
    const channel = supabase
      .channel(`notifications:${profile.id}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${profile.id}` },
        () => loadNotifications()
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [profile]);

  const handleNotifClick = async (notif: Notification) => {
    await markNotificationRead(notif.id);
    setNotifOpen(false);
    if (notif.conversation_id) navigate(inboxPath);
    else if (notif.booking_id) navigate(dashboardPath);
  };

  const handleMarkAllRead = async () => {
    if (!profile) return;
    await markAllNotificationsRead(profile.id);
    setNotifications(notifications.map((n) => ({ ...n, read: true })));
    setUnreadCount(0);
  };

  return (
    <nav className="sticky top-0 z-50 bg-paper/95 backdrop-blur-sm border-b border-line">
      <div className="max-w-editorial mx-auto px-6 lg:px-12">
        <div className="flex items-center justify-between h-20">
          <Link to="/" className="flex items-center gap-3 group" aria-label="HostMeUp home">
            <span className="font-display text-2xl font-bold text-ink tracking-tightest">HostMeUp</span>
          </Link>

          {/* Desktop nav */}
          <div className="hidden md:flex items-center gap-3 lg:gap-5">
            {profile ? (
              <>
                <Link to="/artists" className="text-xs font-medium text-ink-500 hover:text-ink transition-colors uppercase tracking-wide-sm" aria-label="Browse all talent">Browse</Link>
                <Link to={dashboardPath} aria-label="Go to your dashboard" className="flex items-center gap-1 text-xs font-medium text-ink-500 hover:text-ink transition-colors uppercase tracking-wide-sm">
                  <LayoutDashboard className="w-3.5 h-3.5" /> Dashboard
                </Link>
                {profile.role === 'artist' && (
                  <Link to="/artist-profile/edit" aria-label="Edit your talent profile" className="flex items-center gap-1 text-xs font-medium text-ink-500 hover:text-ink transition-colors uppercase tracking-wide-sm">
                    <User className="w-3.5 h-3.5" /> Profile
                  </Link>
                )}
                {/* Inbox */}
                <Link to={inboxPath} aria-label={profile.is_admin ? 'Go to admin inbox' : 'Go to your inbox'} className="flex items-center gap-1 text-xs font-medium text-ink-500 hover:text-ink transition-colors uppercase tracking-wide-sm">
                  <Mail className="w-3.5 h-3.5" /> {profile.is_admin ? 'Admin' : 'Inbox'}
                </Link>
                {profile.is_admin && (
                  <Link to="/admin/settings" aria-label="Admin settings" className="flex items-center gap-1 text-xs font-medium text-ink-500 hover:text-ink transition-colors uppercase tracking-wide-sm">
                    <Shield className="w-3.5 h-3.5" /> Settings
                  </Link>
                )}
                {/* Legal Links for Logged-In Users */}
                <a href="/legal#terms" className="text-xs font-medium text-ink-500 hover:text-ink transition-colors uppercase tracking-wide-sm">Terms</a>
                <a href="/legal#privacy" className="text-xs font-medium text-ink-500 hover:text-ink transition-colors uppercase tracking-wide-sm">Privacy</a>
                <a href="/legal#refunds" className="text-xs font-medium text-ink-500 hover:text-ink transition-colors uppercase tracking-wide-sm">Refunds</a>

                {/* Notifications */}
                <div className="relative">
                  <button onClick={() => setNotifOpen(!notifOpen)} aria-label={`${unreadCount} unread notifications`} className="relative flex items-center text-ink-500 hover:text-ink transition-colors">
                    <Bell className="w-4 h-4" />
                    {unreadCount > 0 && (
                      <span className="absolute -top-1.5 -right-1.5 w-4 h-4 bg-accent text-white text-[10px] font-bold flex items-center justify-center rounded-full">{unreadCount}</span>
                    )}
                  </button>
                  {notifOpen && (
                    <>
                      <div className="fixed inset-0 z-40" onClick={() => setNotifOpen(false)} />
                      <div className="absolute right-0 top-full mt-2 w-80 bg-paper border border-line shadow-lg z-50 animate-fade-in">
                        <div className="flex items-center justify-between p-4 border-b border-line">
                          <span className="text-xs uppercase tracking-wide-sm text-ink-500 font-medium">Notifications</span>
                          {unreadCount > 0 && <button onClick={handleMarkAllRead} className="text-xs text-accent hover:text-accent-600">Mark all read</button>}
                        </div>
                        <div className="max-h-80 overflow-y-auto">
                          {notifications.length === 0 ? (
                            <p className="text-sm text-ink-400 text-center py-8">No notifications yet.</p>
                          ) : (
                            notifications.map((notif) => (
                              <button key={notif.id} onClick={() => handleNotifClick(notif)}
                                className={`w-full text-left p-4 border-b border-line last:border-0 transition-colors hover:bg-paper-200 ${!notif.read ? 'bg-accent-50/50' : ''}`}>
                                <div className="flex items-start gap-2">
                                  {!notif.read && <span className="w-2 h-2 bg-accent rounded-full mt-1.5 flex-shrink-0" />}
                                  <div className={notif.read ? 'pl-4' : ''}>
                                    <p className="text-sm font-medium text-ink">{notif.title}</p>
                                    {notif.body && <p className="text-xs text-ink-400 mt-0.5 line-clamp-2">{notif.body}</p>}
                                    <p className="text-xs text-ink-300 mt-1">{new Date(notif.created_at).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}</p>
                                  </div>
                                </div>
                              </button>
                            ))
                          )}
                        </div>
                      </div>
                    </>
                  )}
                </div>
                <div className="w-px h-5 bg-line" />
                <div className="flex items-center gap-2">
                  {profile.avatar_url ? (
                    <img src={profile.avatar_url} alt={`Your profile photo`} width={32} height={32} className="w-8 h-8 rounded-full object-cover border border-line" />
                  ) : (
                    <div className="w-8 h-8 rounded-full bg-ink text-paper flex items-center justify-center font-medium text-sm">{profile.full_name?.[0]?.toUpperCase() || '?'}</div>
                  )}
                  <span className="text-xs font-medium text-ink-600 max-w-[80px] truncate">{profile.full_name || 'User'}</span>
                </div>
                <button onClick={handleSignOut} aria-label="Sign out of your account" className="flex items-center gap-1 text-xs font-medium text-ink-400 hover:text-ink transition-colors uppercase tracking-wide-sm">
                  <LogOut className="w-3.5 h-3.5" /> Exit
                </button>
              </>
            ) : (
              <>
                <Link to="/artists" aria-label="Browse all talent" className="text-xs font-medium text-ink-500 hover:text-ink transition-colors uppercase tracking-wide-sm">Browse</Link>
                <a href="/legal#terms" className="text-xs font-medium text-ink-500 hover:text-ink transition-colors uppercase tracking-wide-sm">Terms</a>
                <a href="/legal#privacy" className="text-xs font-medium text-ink-500 hover:text-ink transition-colors uppercase tracking-wide-sm">Privacy</a>
                <a href="/legal#refunds" className="text-xs font-medium text-ink-500 hover:text-ink transition-colors uppercase tracking-wide-sm">Refunds</a>
                <Link to="/login" aria-label="Sign in to your account" className="text-xs font-medium text-ink-500 hover:text-ink transition-colors uppercase tracking-wide-sm">Sign In</Link>
                <Link to="/signup" aria-label="Create a new account" className="btn-primary px-4 py-2 text-xs uppercase tracking-wide-sm">Get Started</Link>
              </>
            )}
          </div>

          {/* Mobile menu button */}
          <button onClick={() => setMenuOpen(!menuOpen)} aria-label={menuOpen ? 'Close menu' : 'Open menu'} aria-expanded={menuOpen} className="md:hidden p-2 text-ink hover:bg-paper-300 rounded-none">
            {menuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* Mobile menu */}
      {menuOpen && (
        <div className="md:hidden border-t border-line bg-paper animate-fade-in">
          <div className="px-6 py-4 space-y-1">
            {profile ? (
              <>
                <Link to="/artists" onClick={() => setMenuOpen(false)} className="block py-2.5 text-sm font-medium text-ink-600 hover:text-ink uppercase tracking-wide-sm">Browse</Link>
                <Link to={dashboardPath} onClick={() => setMenuOpen(false)} className="block py-2.5 text-sm font-medium text-ink-600 hover:text-ink uppercase tracking-wide-sm">Dashboard</Link>
                {profile.role === 'artist' && <Link to="/artist-profile/edit" onClick={() => setMenuOpen(false)} className="block py-2.5 text-sm font-medium text-ink-600 hover:text-ink uppercase tracking-wide-sm">Profile</Link>}
                <Link to={inboxPath} onClick={() => setMenuOpen(false)} className="block py-2.5 text-sm font-medium text-ink-600 hover:text-ink uppercase tracking-wide-sm">{profile.is_admin ? 'Admin Inbox' : 'Inbox'}</Link>
                {profile.is_admin && <Link to="/admin/settings" onClick={() => setMenuOpen(false)} className="block py-2.5 text-sm font-medium text-ink-600 hover:text-ink uppercase tracking-wide-sm">Admin Settings</Link>}
                <a href="/legal#terms" onClick={() => setMenuOpen(false)} className="block py-2.5 text-sm font-medium text-ink-600 hover:text-ink uppercase tracking-wide-sm">Terms & Conditions</a>
                <a href="/legal#privacy" onClick={() => setMenuOpen(false)} className="block py-2.5 text-sm font-medium text-ink-600 hover:text-ink uppercase tracking-wide-sm">Privacy Policy</a>
                <a href="/legal#refunds" onClick={() => setMenuOpen(false)} className="block py-2.5 text-sm font-medium text-ink-600 hover:text-ink uppercase tracking-wide-sm">Refund Policy</a>
                {unreadCount > 0 && <span className="ml-2 inline-flex items-center justify-center w-5 h-5 bg-accent text-white text-xs font-bold rounded-full">{unreadCount}</span>}
                <button onClick={() => { setMenuOpen(false); handleSignOut(); }} className="block w-full text-left py-2.5 text-sm font-medium text-ink-400 uppercase tracking-wide-sm">Sign Out</button>
              </>
            ) : (
              <>
                <Link to="/artists" onClick={() => setMenuOpen(false)} className="block py-2.5 text-sm font-medium text-ink-600 hover:text-ink uppercase tracking-wide-sm">Browse</Link>
                <a href="/legal#terms" onClick={() => setMenuOpen(false)} className="block py-2.5 text-sm font-medium text-ink-600 hover:text-ink uppercase tracking-wide-sm">Terms & Conditions</a>
                <a href="/legal#privacy" onClick={() => setMenuOpen(false)} className="block py-2.5 text-sm font-medium text-ink-600 hover:text-ink uppercase tracking-wide-sm">Privacy Policy</a>
                <a href="/legal#refunds" onClick={() => setMenuOpen(false)} className="block py-2.5 text-sm font-medium text-ink-600 hover:text-ink uppercase tracking-wide-sm">Refund Policy</a>
                <Link to="/login" onClick={() => setMenuOpen(false)} className="block py-2.5 text-sm font-medium text-ink-600 hover:text-ink uppercase tracking-wide-sm">Sign In</Link>
                <Link to="/signup" onClick={() => setMenuOpen(false)} className="block py-2.5 text-sm font-semibold text-paper bg-ink uppercase tracking-wide-sm text-center">Get Started</Link>
              </>
            )}
          </div>
        </div>
      )}
    </nav>
  );
}

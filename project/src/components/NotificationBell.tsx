import React, { useEffect, useState } from 'react';
import { Bell } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';

interface NotificationItem {
  id: string;
  user_id?: string;
  title: string;
  message: string;
  is_read: boolean;
  created_at?: string;
  type?: string;
  link_url?: string;
  link?: string;
}

export const NotificationBell: React.FC = () => {
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const navigate = useNavigate();

  useEffect(() => {
    let channel: any;

    const setupNotifications = async () => {
      try {
        const { data: { user }, error: userError } = await supabase.auth.getUser();
        if (userError || !user) return;

        // 1. Initial Fetch (Limit to 10 most recent)
        const { data, error } = await supabase
          .from('notifications')
          .select('*')
          .eq('user_id', user.id)
          .limit(10);

        if (error) {
          console.error('Error fetching notifications:', error.message || error);
        } else if (data) {
          // Sort in memory to prevent postgREST 400 parameter errors
          const sorted = [...data].sort((a, b) => 
            new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime()
          );
          setNotifications(sorted as NotificationItem[]);
          setUnreadCount(sorted.filter((n) => !n.is_read).length);
        }

        // 2. Realtime Subscription Listener (Listen to public inserts and filter in memory)
        channel = supabase
          .channel(`user_notifications_${user.id}`)
          .on(
            'postgres_changes',
            {
              event: 'INSERT',
              schema: 'public',
              table: 'notifications',
            },
            (payload) => {
              const newNotif = payload.new as NotificationItem;
              // Ensure notification is targeted to the logged-in user
              if (newNotif && newNotif.user_id === user.id) {
                setNotifications((prev) => [newNotif, ...prev]);
                if (!newNotif.is_read) {
                  setUnreadCount((prev) => prev + 1);
                }
              }
            }
          )
          .subscribe();
      } catch (err) {
        console.error('Notification setup failed:', err);
      }
    };

    setupNotifications();

    return () => {
      if (channel) {
        supabase.removeChannel(channel);
      }
    };
  }, []);

  const handleNotificationClick = async (notif: NotificationItem) => {
    if (!notif.is_read) {
      await supabase
        .from('notifications')
        .update({ is_read: true })
        .eq('id', notif.id);

      setNotifications((prev) =>
        prev.map((n) => (n.id === notif.id ? { ...n, is_read: true } : n))
      );
      setUnreadCount((prev) => Math.max(0, prev - 1));
    }

    setIsOpen(false);
    
    const targetUrl = notif.link_url || notif.link;
    if (targetUrl) {
      navigate(targetUrl);
    }
  };

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 text-gray-700 hover:text-black focus:outline-none flex items-center"
        aria-label="Notifications"
      >
        <Bell className="w-5 h-5" />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-red-600 text-[10px] font-bold text-white animate-pulse">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-80 bg-white border border-gray-200 rounded-lg shadow-xl z-50 overflow-hidden">
          <div className="px-4 py-3 bg-gray-50 border-b border-gray-200 flex justify-between items-center">
            <h4 className="text-sm font-semibold text-gray-800">Notifications</h4>
            {unreadCount > 0 && (
              <span className="text-xs text-green-600 font-medium">{unreadCount} new</span>
            )}
          </div>
          <div className="max-h-80 overflow-y-auto divide-y divide-gray-100">
            {notifications.length === 0 ? (
              <div className="p-4 text-center text-xs text-gray-500">
                No notifications yet.
              </div>
            ) : (
              notifications.map((notif) => (
                <div
                  key={notif.id}
                  onClick={() => handleNotificationClick(notif)}
                  className={`p-3 transition-colors cursor-pointer hover:bg-gray-50 ${
                    !notif.is_read ? 'bg-blue-50/50' : 'bg-white'
                  }`}
                >
                  <p className="text-xs font-semibold text-gray-900">{notif.title}</p>
                  <p className="text-xs text-gray-600 mt-0.5">{notif.message}</p>
                  {notif.created_at && (
                    <span className="text-[10px] text-gray-400 mt-1 block">
                      {new Date(notif.created_at).toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
};

import React, { useEffect, useState } from 'react';
import { Bell } from 'lucide-react';
import { supabase } from '../lib/supabase'; // Adjust import if your supabase client is located elsewhere

interface NotificationItem {
  id: string;
  title: string;
  message: string;
  is_read: boolean;
  created_at: string;
  type: string;
}

export const NotificationBell: React.FC = () => {
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    let channel: any;

    const fetchNotifications = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Initial Fetch
      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(10);

      if (!error && data) {
        setNotifications(data);
        setUnreadCount(data.filter((n) => !n.is_read).length);
      }

      // Supabase Realtime Listener
      channel = supabase
        .channel(`user_notifications:${user.id}`)
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'notifications',
            filter: `user_id=eq.${user.id}`,
          },
          (payload) => {
            const newNotif = payload.new as NotificationItem;
            setNotifications((prev) => [newNotif, ...prev]);
            setUnreadCount((prev) => prev + 1);
          }
        )
        .subscribe();
    };

    fetchNotifications();

    return () => {
      if (channel) supabase.removeChannel(channel);
    };
  }, []);

  const markAllAsRead = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    await supabase
      .from('notifications')
      .update({ is_read: true })
      .eq('user_id', user.id)
      .eq('is_read', false);

    setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
    setUnreadCount(0);
  };

  return (
    <div className="relative">
      <button
        onClick={() => {
          setIsOpen(!isOpen);
          if (unreadCount > 0) markAllAsRead();
        }}
        className="relative p-2 text-gray-700 hover:text-black focus:outline-none flex items-center"
      >
        <Bell className="w-5 h-5" />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-red-600 text-[10px] font-bold text-white">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-80 bg-white border border-gray-200 rounded-lg shadow-xl z-50 overflow-hidden">
          <div className="px-4 py-3 bg-gray-50 border-b border-gray-200 flex justify-between items-center">
            <h4 className="text-sm font-semibold text-gray-800">Notifications</h4>
            {unreadCount > 0 && (
              <span className="text-xs text-green-600 font-medium">New alerts</span>
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
                  className={`p-3 transition-colors ${
                    !notif.is_read ? 'bg-blue-50/50' : 'bg-white'
                  }`}
                >
                  <p className="text-xs font-semibold text-gray-900">{notif.title}</p>
                  <p className="text-xs text-gray-600 mt-0.5">{notif.message}</p>
                  <span className="text-[10px] text-gray-400 mt-1 block">
                    {new Date(notif.created_at).toLocaleTimeString([], {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
};

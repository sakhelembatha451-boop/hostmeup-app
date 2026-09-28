import React, { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabaseClient'; // Adjust path if your client is located elsewhere

interface BookingActivity {
  id: string;
  status: string;
  arrived_at: string | null;
  completed_at: string | null;
  artist_name?: string;
  host_name?: string;
  event_title?: string;
}

export const SafetyPage: React.FC = () => {
  const [loading, setLoading] = useState<boolean>(true);
  const [logs, setLogs] = useState<BookingActivity[]>([]);
  const [activeCheckInsCount, setActiveCheckInsCount] = useState<number>(0);
  const [completedTodayCount, setCompletedTodayCount] = useState<number>(0);
  const [searchQuery, setSearchQuery] = useState<string>('');

  const fetchSafetyData = async () => {
    setLoading(true);
    try {
      // Fetch bookings with check-in or check-out timestamps
      const { data, error } = await supabase
        .from('bookings')
        .select(`
          id,
          status,
          arrived_at,
          completed_at,
          event_title,
          artist:artist_id ( full_name ),
          host:host_id ( full_name )
        `)
        .or('arrived_at.not.is.null,completed_at.not.is.null')
        .order('arrived_at', { ascending: false });

      if (error) throw error;

      if (data) {
        // Format the raw data
        const formattedLogs: BookingActivity[] = data.map((b: any) => ({
          id: b.id,
          status: b.status,
          arrived_at: b.arrived_at,
          completed_at: b.completed_at,
          event_title: b.event_title || 'Event Booking',
          artist_name: b.artist?.full_name || 'Talent Provider',
          host_name: b.host?.full_name || 'Event Host',
        }));

        setLogs(formattedLogs);

        // Calculate today's stats
        const today = new Date().toISOString().split('T')[0];

        const activeToday = formattedLogs.filter(
          (item) => item.arrived_at && item.arrived_at.startsWith(today) && !item.completed_at
        ).length;

        const completedToday = formattedLogs.filter(
          (item) => item.completed_at && item.completed_at.startsWith(today)
        ).length;

        setActiveCheckInsCount(activeToday);
        setCompletedTodayCount(completedToday);
      }
    } catch (err) {
      console.error('Error fetching safety logs:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSafetyData();
  }, []);

  // Filter logs based on search query
  const filteredLogs = logs.filter((log) => {
    const q = searchQuery.toLowerCase();
    return (
      log.artist_name?.toLowerCase().includes(q) ||
      log.host_name?.toLowerCase().includes(q) ||
      log.event_title?.toLowerCase().includes(q) ||
      log.id.toLowerCase().includes(q)
    );
  });

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <span className="text-xs font-bold uppercase tracking-wider text-amber-600">
            PLATFORM PROTECTION HUB
          </span>
          <h1 className="text-3xl font-serif font-bold text-gray-900">Safety Command Center</h1>
        </div>
        <div className="flex gap-3">
          <button
            onClick={fetchSafetyData}
            disabled={loading}
            className="px-4 py-2 border border-gray-300 rounded hover:bg-gray-50 text-sm font-medium transition"
          >
            {loading ? 'REFRESHING...' : 'REFRESH'}
          </button>
          <button className="px-4 py-2 bg-amber-600 text-white rounded hover:bg-amber-700 text-sm font-medium transition">
            BROADCAST ADVISORY
          </button>
        </div>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="p-5 border rounded-lg bg-white shadow-sm flex justify-between items-start">
          <div>
            <p className="text-xs font-bold uppercase text-gray-500">ACTIVE EMERGENCIES</p>
            <p className="text-3xl font-bold text-gray-900 mt-2">0</p>
            <p className="text-xs text-gray-400 mt-1">Requires immediate dispatch response</p>
          </div>
        </div>

        <div className="p-5 border rounded-lg bg-white shadow-sm flex justify-between items-start">
          <div>
            <p className="text-xs font-bold uppercase text-gray-500">LIVE CHECK-INS TODAY</p>
            <p className="text-3xl font-bold text-emerald-600 mt-2">{activeCheckInsCount}</p>
            <p className="text-xs text-gray-400 mt-1">Active status updates logged</p>
          </div>
        </div>

        <div className="p-5 border rounded-lg bg-white shadow-sm flex justify-between items-start">
          <div>
            <p className="text-xs font-bold uppercase text-gray-500">CLEARED / CHECKED OUT TODAY</p>
            <p className="text-3xl font-bold text-blue-600 mt-2">{completedTodayCount}</p>
            <p className="text-xs text-gray-400 mt-1">Cleared safety logs</p>
          </div>
        </div>
      </div>

      {/* Search Bar */}
      <div className="flex justify-between items-center gap-4">
        <input
          type="text"
          placeholder="Search user, email, or subject..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full max-w-sm px-3 py-2 border rounded-md text-sm focus:outline-none focus:ring-1 focus:ring-amber-500"
        />
      </div>

      {/* Live Security Log Table */}
      <div className="border rounded-lg bg-white shadow-sm overflow-hidden">
        <div className="p-4 border-b bg-gray-50 flex justify-between items-center">
          <h2 className="text-sm font-bold text-gray-700 tracking-wider uppercase">
            LIVE SECURITY LOG
          </h2>
          <span className="text-xs text-gray-500 font-semibold">
            {filteredLogs.length} EVENTS
          </span>
        </div>

        {loading ? (
          <div className="p-8 text-center text-gray-500 text-sm">Loading security logs...</div>
        ) : filteredLogs.length === 0 ? (
          <div className="p-12 text-center text-gray-400 text-sm">
            No safety incidents or check-in activity matching criteria.
          </div>
        ) : (
          <table className="w-full text-left border-collapse text-sm">
            <thead>
              <tr className="border-b bg-gray-100 text-xs font-semibold text-gray-600 uppercase">
                <th className="p-3">Talent / Host</th>
                <th className="p-3">Event</th>
                <th className="p-3">Check-In Time</th>
                <th className="p-3">Check-Out Time</th>
                <th className="p-3">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {filteredLogs.map((log) => (
                <tr key={log.id} className="hover:bg-gray-50">
                  <td className="p-3">
                    <p className="font-semibold text-gray-900">{log.artist_name}</p>
                    <p className="text-xs text-gray-500">Host: {log.host_name}</p>
                  </td>
                  <td className="p-3 text-gray-700">{log.event_title}</td>
                  <td className="p-3 text-gray-600">
                    {log.arrived_at
                      ? new Date(log.arrived_at).toLocaleString([], {
                          dateStyle: 'short',
                          timeStyle: 'short',
                        })
                      : '—'}
                  </td>
                  <td className="p-3 text-gray-600">
                    {log.completed_at
                      ? new Date(log.completed_at).toLocaleString([], {
                          dateStyle: 'short',
                          timeStyle: 'short',
                        })
                      : '—'}
                  </td>
                  <td className="p-3">
                    {log.completed_at ? (
                      <span className="px-2 py-1 bg-blue-100 text-blue-800 text-xs font-semibold rounded-full">
                        CHECKED OUT
                      </span>
                    ) : log.arrived_at ? (
                      <span className="px-2 py-1 bg-emerald-100 text-emerald-800 text-xs font-semibold rounded-full">
                        ARRIVED AT EVENT
                      </span>
                    ) : (
                      <span className="px-2 py-1 bg-gray-100 text-gray-600 text-xs font-semibold rounded-full">
                        PENDING
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
};

export default SafetyPage;

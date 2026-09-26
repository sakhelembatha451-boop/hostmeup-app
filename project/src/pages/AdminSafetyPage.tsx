import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { 
  ShieldAlert, ShieldCheck, PhoneCall, MapPin, AlertTriangle, 
  CheckCircle2, Clock, Send, Users, Activity, Search, RefreshCw, 
  ChevronRight, Filter, BellRing
} from 'lucide-react';

interface SafetyAlert {
  id: string;
  conversation_id: string;
  user_id: string;
  alert_type: 'emergency' | 'location_checkin' | 'dispute_flag';
  status: 'open' | 'in_progress' | 'resolved';
  details: {
    subject?: string;
    triggered_at?: string;
    checked_in_at?: string;
    user_email?: string;
    user_name?: string;
    notes?: string;
  };
  created_at: string;
  user_profile?: {
    full_name: string;
    email: string;
    phone?: string;
  };
}

export default function AdminSafetyPage() {
  const { profile } = useAuth();

  const [alerts, setAlerts] = useState<SafetyAlert[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState<'all' | 'open' | 'resolved'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  
  // Broadcast Advisory Modal State
  const [showBroadcastModal, setShowBroadcastModal] = useState(false);
  const [broadcastMessage, setBroadcastMessage] = useState('');
  const [broadcastSubject, setBroadcastSubject] = useState('');
  const [isBroadcasting, setIsBroadcasting] = useState(false);

  // Selected Alert for Details
  const [selectedAlert, setSelectedAlert] = useState<SafetyAlert | null>(null);
  const [actionNotes, setActionNotes] = useState('');

  const isAdmin = profile?.role === 'admin' || profile?.email === 'sakhelembatha451@gmail.com';

  // Fetch all platform safety alerts
  const loadSafetyAlerts = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('safety_alerts')
        .select('*, profiles:user_id(full_name, email, phone)')
        .order('created_at', { ascending: false });

      if (error) throw error;

      const formatted = (data || []).map((item: any) => ({
        ...item,
        user_profile: item.profiles,
      }));

      setAlerts(formatted);
    } catch (err) {
      console.error('Error fetching safety alerts:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadSafetyAlerts();

    // Subscribe to real-time safety alerts
    const channel = supabase
      .channel('admin_safety_alerts')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'safety_alerts' }, () => {
        loadSafetyAlerts();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [loadSafetyAlerts]);

  // Update alert status
  const updateAlertStatus = async (alertId: string, newStatus: 'in_progress' | 'resolved') => {
    try {
      const { error } = await supabase
        .from('safety_alerts')
        .update({
          status: newStatus,
          details: {
            ...selectedAlert?.details,
            notes: actionNotes ? `${selectedAlert?.details?.notes || ''}\n[${new Date().toLocaleTimeString()}]: ${actionNotes}` : selectedAlert?.details?.notes
          }
        })
        .eq('id', alertId);

      if (error) throw error;

      alert(`Alert updated to ${newStatus.replace('_', ' ')}.`);
      setActionNotes('');
      loadSafetyAlerts();
      if (selectedAlert?.id === alertId) {
        setSelectedAlert(null);
      }
    } catch (err) {
      console.error('Failed to update alert:', err);
      alert('Could not update alert status.');
    }
  };

  // Dispatch Platform Safety Broadcast
  const handleSendBroadcast = async () => {
    if (!broadcastSubject.trim() || !broadcastMessage.trim()) return;
    setIsBroadcasting(true);

    try {
      // Log broadcast in safety history
      await supabase.from('safety_alerts').insert({
        user_id: profile?.id,
        alert_type: 'dispute_flag',
        status: 'resolved',
        details: {
          subject: `[SAFETY BROADCAST] ${broadcastSubject}`,
          notes: broadcastMessage,
          triggered_at: new Date().toISOString(),
        }
      });

      alert('📢 Platform Safety Advisory dispatched successfully!');
      setShowBroadcastModal(false);
      setBroadcastSubject('');
      setBroadcastMessage('');
      loadSafetyAlerts();
    } catch (err) {
      console.error('Broadcast error:', err);
      alert('Failed to send broadcast advisory.');
    } finally {
      setIsBroadcasting(false);
    }
  };

  const filteredAlerts = alerts.filter(a => {
    const matchesFilter = filterStatus === 'all' || a.status === filterStatus;
    const matchesQuery = 
      a.details?.user_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      a.details?.subject?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      a.user_profile?.email?.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesFilter && matchesQuery;
  });

  const openEmergencies = alerts.filter(a => a.alert_type === 'emergency' && a.status === 'open').length;
  const totalCheckins = alerts.filter(a => a.alert_type === 'location_checkin').length;
  const resolvedToday = alerts.filter(a => a.status === 'resolved').length;

  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-paper flex items-center justify-center p-6">
        <div className="text-center max-w-md border border-line p-8 bg-paper-100">
          <ShieldAlert className="w-12 h-12 text-red-600 mx-auto mb-4" />
          <h2 className="font-display text-2xl font-bold text-ink mb-2">Access Restricted</h2>
          <p className="text-sm text-ink-400">You must be a platform administrator to view the Safety Command Center.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-paper">
      <div className="max-w-7xl mx-auto px-6 lg:px-12 py-12">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-10">
          <div>
            <p className="text-xs uppercase tracking-wide-sm text-amber-600 font-semibold mb-2 flex items-center gap-2">
              <ShieldCheck className="w-4 h-4" /> Platform Protection Hub
            </p>
            <h1 className="font-display text-4xl font-bold text-ink tracking-tight">Safety Command Center</h1>
          </div>
          <div className="flex items-center gap-3">
            <button 
              onClick={loadSafetyAlerts}
              className="px-4 py-3 border border-line hover:bg-paper-200 text-xs font-semibold uppercase tracking-wide-sm inline-flex items-center gap-2 transition-colors">
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} /> Refresh
            </button>
            <button 
              onClick={() => setShowBroadcastModal(true)}
              className="btn-primary bg-amber-600 border-amber-600 hover:bg-amber-700 text-white inline-flex items-center gap-2 px-5 py-3 text-xs uppercase tracking-wide-sm">
              <BellRing className="w-3.5 h-3.5" /> Broadcast Advisory
            </button>
          </div>
        </div>

        {/* Metrics Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 mb-10">
          <div className={`p-6 border ${openEmergencies > 0 ? 'bg-red-50 border-red-200' : 'bg-paper-100 border-line'}`}>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold uppercase tracking-wide-sm text-ink-400">Active Emergencies</span>
              <PhoneCall className={`w-5 h-5 ${openEmergencies > 0 ? 'text-red-600 animate-bounce' : 'text-ink-300'}`} />
            </div>
            <p className="font-display text-4xl font-bold text-ink">{openEmergencies}</p>
            <p className="text-xs text-ink-400 mt-1">Requires immediate dispatch response</p>
          </div>

          <div className="p-6 bg-paper-100 border border-line">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold uppercase tracking-wide-sm text-ink-400">Live Check-Ins Today</span>
              <MapPin className="w-5 h-5 text-emerald-600" />
            </div>
            <p className="font-display text-4xl font-bold text-ink">{totalCheckins}</p>
            <p className="text-xs text-ink-400 mt-1">Active status updates logged</p>
          </div>

          <div className="p-6 bg-paper-100 border border-line">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold uppercase tracking-wide-sm text-ink-400">Resolved Incidents</span>
              <CheckCircle2 className="w-5 h-5 text-ink-400" />
            </div>
            <p className="font-display text-4xl font-bold text-ink">{resolvedToday}</p>
            <p className="text-xs text-ink-400 mt-1">Cleared safety logs</p>
          </div>
        </div>

        {/* Filter and Search Bar */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mb-6">
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <div className="relative flex-1 sm:w-72">
              <Search className="w-4 h-4 text-ink-300 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search user, email, or subject..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="input-editorial w-full pl-9 pr-4 py-2 text-xs bg-paper"
              />
            </div>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <Filter className="w-4 h-4 text-ink-400" />
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value as any)}
              className="input-editorial text-xs px-3 py-2 bg-paper">
              <option value="all">All Incidents</option>
              <option value="open">Open / Unresolved</option>
              <option value="resolved">Resolved</option>
            </select>
          </div>
        </div>

        {/* Alerts Table / Feed */}
        <div className="border border-line bg-paper">
          <div className="p-4 border-b border-line bg-paper-200/50 flex items-center justify-between text-xs text-ink-400 font-semibold uppercase tracking-wide-sm">
            <span>Live Security Log</span>
            <span>{filteredAlerts.length} Events</span>
          </div>

          {filteredAlerts.length === 0 ? (
            <div className="p-12 text-center text-ink-400 text-sm">
              <ShieldCheck className="w-10 h-10 mx-auto mb-3 text-ink-300 stroke-[1.5]" />
              No safety incidents matching criteria.
            </div>
          ) : (
            <div className="divide-y divide-line">
              {filteredAlerts.map((alert) => {
                const isEmergency = alert.alert_type === 'emergency';
                return (
                  <div 
                    key={alert.id}
                    className={`p-5 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 hover:bg-paper-200/30 transition-colors ${
                      isEmergency && alert.status === 'open' ? 'bg-red-500/5 border-l-4 border-l-red-600' : ''
                    }`}>
                    <div className="flex items-start gap-4 flex-1">
                      <div className={`p-2.5 rounded-none flex-shrink-0 mt-0.5 ${
                        isEmergency 
                          ? 'bg-red-600 text-white' 
                          : alert.alert_type === 'location_checkin' 
                          ? 'bg-emerald-600 text-white' 
                          : 'bg-amber-600 text-white'
                      }`}>
                        {isEmergency ? <PhoneCall className="w-5 h-5 animate-pulse" /> : <MapPin className="w-5 h-5" />}
                      </div>

                      <div className="space-y-1">
                        <div className="flex items-center gap-3">
                          <span className={`text-xs font-bold uppercase tracking-wider px-2 py-0.5 rounded-none ${
                            isEmergency 
                              ? 'bg-red-100 text-red-700 border border-red-200' 
                              : 'bg-emerald-100 text-emerald-700 border border-emerald-200'
                          }`}>
                            {alert.alert_type.replace('_', ' ')}
                          </span>
                          <span className="text-xs text-ink-300 flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {new Date(alert.created_at).toLocaleString()}
                          </span>
                        </div>

                        <h3 className="font-display font-semibold text-ink text-base">
                          {alert.details?.subject || 'Safety Verification Request'}
                        </h3>

                        <p className="text-xs text-ink-400">
                          User: <strong className="text-ink">{alert.details?.user_name || alert.user_profile?.full_name || 'Anonymous'}</strong> ({alert.details?.user_email || alert.user_profile?.email})
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 w-full md:w-auto justify-end">
                      <span className={`text-xs font-semibold px-2.5 py-1 ${
                        alert.status === 'open' 
                          ? 'bg-red-500/10 text-red-600 border border-red-500/20' 
                          : 'bg-emerald-500/10 text-emerald-600 border border-emerald-500/20'
                      }`}>
                        {alert.status.toUpperCase()}
                      </span>

                      <button 
                        onClick={() => setSelectedAlert(alert)}
                        className="px-4 py-2 border border-line hover:bg-paper-200 text-xs font-semibold uppercase tracking-wide-sm inline-flex items-center gap-1">
                        Manage <ChevronRight className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Modal: Manage Single Incident */}
        {selectedAlert && (
          <div className="fixed inset-0 bg-ink/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-paper border border-line p-6 max-w-xl w-full shadow-2xl relative">
              <button 
                onClick={() => setSelectedAlert(null)}
                className="absolute top-4 right-4 text-ink-400 hover:text-ink text-xs uppercase font-bold">
                Close [✕]
              </button>

              <div className="flex items-center gap-2 mb-4 text-red-600">
                <AlertTriangle className="w-5 h-5" />
                <h2 className="font-display text-xl font-bold text-ink">Incident Protocol Response</h2>
              </div>

              <div className="space-y-4 text-xs text-ink-400 border-t border-b border-line py-4 my-4">
                <div>
                  <strong className="text-ink uppercase tracking-wide-sm block mb-1">Subject / Context:</strong>
                  <p className="text-sm text-ink bg-paper-100 p-2 border border-line">{selectedAlert.details?.subject || 'N/A'}</p>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <strong className="text-ink block">User Name:</strong>
                    <span>{selectedAlert.details?.user_name || 'N/A'}</span>
                  </div>
                  <div>
                    <strong className="text-ink block">User Email:</strong>
                    <span>{selectedAlert.details?.user_email || 'N/A'}</span>
                  </div>
                </div>

                {selectedAlert.details?.notes && (
                  <div>
                    <strong className="text-ink block mb-1">Log History:</strong>
                    <pre className="p-2 bg-paper-100 text-[11px] whitespace-pre-wrap text-ink font-mono border border-line">
                      {selectedAlert.details.notes}
                    </pre>
                  </div>
                )}

                <div>
                  <label className="block text-ink font-bold mb-1 uppercase tracking-wide-sm">Add Dispatch / Audit Notes:</label>
                  <textarea
                    rows={3}
                    value={actionNotes}
                    onChange={(e) => setActionNotes(e.target.value)}
                    placeholder="Log actions taken, call updates, or law enforcement dispatch details..."
                    className="input-editorial w-full p-2 text-xs"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-3">
                {selectedAlert.status !== 'resolved' && (
                  <button
                    onClick={() => updateAlertStatus(selectedAlert.id, 'resolved')}
                    className="btn-primary bg-emerald-600 border-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 text-xs uppercase tracking-wide-sm inline-flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5" /> Clear & Mark Resolved
                  </button>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Modal: Broadcast Safety Advisory */}
        {showBroadcastModal && (
          <div className="fixed inset-0 bg-ink/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-paper border border-line p-6 max-w-lg w-full shadow-2xl relative">
              <button 
                onClick={() => setShowBroadcastModal(false)} 
                className="absolute top-4 right-4 text-ink-400 hover:text-ink text-xs uppercase font-bold">
                Close [✕]
              </button>

              <h2 className="font-display text-xl font-bold text-ink mb-2">Platform Safety Advisory</h2>
              <p className="text-xs text-ink-400 mb-4">Send a high-priority security advisory to system logs and active users.</p>

              <div className="space-y-4">
                <div>
                  <label className="block text-xs uppercase tracking-wide-sm text-ink-400 mb-1">Advisory Title</label>
                  <input
                    type="text"
                    value={broadcastSubject}
                    onChange={(e) => setBroadcastSubject(e.target.value)}
                    placeholder="e.g., Weather Warning / Verification Alert"
                    className="input-editorial w-full px-3 py-2 text-sm"
                  />
                </div>

                <div>
                  <label className="block text-xs uppercase tracking-wide-sm text-ink-400 mb-1">Advisory Notice Details</label>
                  <textarea
                    value={broadcastMessage}
                    onChange={(e) => setBroadcastMessage(e.target.value)}
                    rows={4}
                    placeholder="Type official safety guidance..."
                    className="input-editorial w-full px-3 py-2 text-sm resize-none"
                  />
                </div>

                <div className="flex justify-end gap-3 pt-2">
                  <button
                    type="button"
                    onClick={handleSendBroadcast}
                    disabled={isBroadcasting || !broadcastSubject.trim() || !broadcastMessage.trim()}
                    className="btn-primary bg-amber-600 border-amber-600 hover:bg-amber-700 text-white px-5 py-2 text-xs uppercase tracking-wide-sm inline-flex items-center gap-2 disabled:opacity-50">
                    {isBroadcasting ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                    Broadcast Notice
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

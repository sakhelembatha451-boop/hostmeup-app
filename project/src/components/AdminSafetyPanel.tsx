import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { 
  ShieldAlert, ShieldCheck, PhoneCall, MapPin, Loader2, AlertTriangle, 
  Volume2, VolumeX, CheckCircle, Clock, ExternalLink, RefreshCw, Radio
} from 'lucide-react';
import type { Profile } from '@/types';

export interface SafetyAlert {
  id: string;
  conversation_id: string;
  user_id: string;
  alert_type: 'emergency' | 'location_checkin' | 'dispute';
  status: 'open' | 'investigating' | 'resolved';
  details: {
    subject?: string;
    user_name?: string;
    user_email?: string;
    triggered_at?: string;
    checked_in_at?: string;
    [key: string]: unknown;
  };
  created_at: string;
  user?: Profile;
}

export default function AdminSafetyPanel() {
  const [alerts, setAlerts] = useState<SafetyAlert[]>([]);
  const [loading, setLoading] = useState(true);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [bannerAlert, setBannerAlert] = useState<SafetyAlert | null>(null);
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  const audioCtxRef = useRef<AudioContext | null>(null);

  const playAlertSound = useCallback(() => {
    if (!soundEnabled) return;
    try {
      if (!audioCtxRef.current) {
        audioCtxRef.current = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
      }
      const ctx = audioCtxRef.current;
      if (ctx.state === 'suspended') {
        ctx.resume();
      }

      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(880, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(440, ctx.currentTime + 0.4);

      gain.gain.setValueAtTime(0.3, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.4);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start();
      osc.stop(ctx.currentTime + 0.4);
    } catch (err) {
      console.warn('Audio playback restricted or failed:', err);
    }
  }, [soundEnabled]);

  const loadAlerts = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('safety_alerts')
        .select('*, user:profiles(id, full_name, email, avatar_url)')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setAlerts((data as SafetyAlert[]) || []);
    } catch (err) {
      console.error('Error fetching safety alerts:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAlerts();

    const channel = supabase
      .channel('realtime:safety_alerts')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'safety_alerts' },
        async (payload) => {
          const newRecord = payload.new as SafetyAlert;

          const { data: userData } = await supabase
            .from('profiles')
            .select('id, full_name, email, avatar_url')
            .eq('id', newRecord.user_id)
            .maybeSingle();

          const fullAlert: SafetyAlert = {
            ...newRecord,
            user: userData || undefined,
          };

          setAlerts((prev) => [fullAlert, ...prev]);
          setBannerAlert(fullAlert);
          playAlertSound();

          setTimeout(() => setBannerAlert(null), 10000);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [loadAlerts, playAlertSound]);

  const handleUpdateStatus = async (alertId: string, status: 'open' | 'investigating' | 'resolved') => {
    setUpdatingId(alertId);
    try {
      const { error } = await supabase
        .from('safety_alerts')
        .update({ status })
        .eq('id', alertId);

      if (error) throw error;

      setAlerts((prev) =>
        prev.map((a) => (a.id === alertId ? { ...a, status } : a))
      );
    } catch (err) {
      console.error('Failed to update status:', err);
      alert('Could not update alert status.');
    } finally {
      setUpdatingId(null);
    }
  };

  const triggerTestAlert = async () => {
    try {
      const { data: currentUser } = await supabase.auth.getUser();
      if (!currentUser.user) return;

      await supabase.from('safety_alerts').insert({
        user_id: currentUser.user.id,
        alert_type: 'emergency',
        status: 'open',
        details: {
          subject: 'TEST EMERGENCY ALERT',
          triggered_at: new Date().toISOString(),
          user_email: currentUser.user.email,
          user_name: 'System Admin Tester',
        },
      });
    } catch (err) {
      console.error('Test alert error:', err);
    }
  };

  const activeEmergencies = alerts.filter((a) => a.alert_type === 'emergency' && a.status !== 'resolved');

  return (
    <div className="space-y-6">
      {bannerAlert && (
        <div className="bg-red-600 text-white p-4 rounded-lg shadow-xl animate-bounce flex items-center justify-between border-2 border-white">
          <div className="flex items-center gap-3">
            <ShieldAlert className="w-6 h-6 animate-pulse text-yellow-300" />
            <div>
              <p className="font-bold text-sm tracking-wide uppercase">
                🚨 NEW {bannerAlert.alert_type.toUpperCase()} INCIDENT LOGGED
              </p>
              <p className="text-xs text-red-100">
                User: {bannerAlert.user?.full_name || bannerAlert.details.user_name || 'Unknown'} — Subject: {bannerAlert.details.subject || 'N/A'}
              </p>
            </div>
          </div>
          <button
            onClick={() => setBannerAlert(null)}
            className="text-xs bg-black/30 hover:bg-black/50 px-3 py-1 rounded transition-colors"
          >
            Dismiss Visual
          </button>
        </div>
      )}

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-paper-200/50 p-6 border border-line rounded-xl">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <ShieldCheck className="w-5 h-5 text-accent" />
            <h2 className="font-display text-2xl font-bold text-ink">Platform Safety Command Center</h2>
          </div>
          <p className="text-xs text-ink-400">
            Real-time incident monitoring, emergency dispatch logs, and live gig status checks.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => setSoundEnabled(!soundEnabled)}
            className={`inline-flex items-center gap-2 px-3 py-2 text-xs font-semibold rounded border transition-colors ${
              soundEnabled
                ? 'bg-paper border-line text-ink hover:bg-paper-200'
                : 'bg-red-500/10 border-red-500/30 text-red-600'
            }`}
          >
            {soundEnabled ? <Volume2 className="w-4 h-4 text-accent" /> : <VolumeX className="w-4 h-4" />}
            {soundEnabled ? 'Audio Alerts: ON' : 'Audio Muted'}
          </button>

          <button
            onClick={loadAlerts}
            className="p-2 border border-line rounded hover:bg-paper-200 transition-colors text-ink-400 hover:text-ink"
            title="Refresh list"
          >
            <RefreshCw className="w-4 h-4" />
          </button>

          <button
            onClick={triggerTestAlert}
            className="inline-flex items-center gap-1.5 px-3 py-2 bg-red-600 hover:bg-red-700 text-white text-xs font-semibold rounded transition-colors"
          >
            <Radio className="w-3.5 h-3.5 animate-pulse" />
            Simulate Alert
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="p-5 bg-paper border border-line rounded-lg flex items-center justify-between">
          <div>
            <p className="text-xs uppercase tracking-wide text-ink-400">Active Emergencies</p>
            <p className="text-3xl font-display font-bold text-red-600 mt-1">{activeEmergencies.length}</p>
          </div>
          <div className="p-3 bg-red-500/10 rounded-full text-red-600">
            <PhoneCall className="w-6 h-6" />
          </div>
        </div>

        <div className="p-5 bg-paper border border-line rounded-lg flex items-center justify-between">
          <div>
            <p className="text-xs uppercase tracking-wide text-ink-400">Total Incidents Logged</p>
            <p className="text-3xl font-display font-bold text-ink mt-1">{alerts.length}</p>
          </div>
          <div className="p-3 bg-paper-200 rounded-full text-ink-400">
            <ShieldAlert className="w-6 h-6" />
          </div>
        </div>

        <div className="p-5 bg-paper border border-line rounded-lg flex items-center justify-between">
          <div>
            <p className="text-xs uppercase tracking-wide text-ink-400">Resolved Cases</p>
            <p className="text-3xl font-display font-bold text-green-600 mt-1">
              {alerts.filter((a) => a.status === 'resolved').length}
            </p>
          </div>
          <div className="p-3 bg-green-500/10 rounded-full text-green-600">
            <CheckCircle className="w-6 h-6" />
          </div>
        </div>
      </div>

      <div className="border border-line rounded-xl bg-paper overflow-hidden">
        <div className="p-4 border-b border-line bg-paper-200/40 flex items-center justify-between">
          <h3 className="font-display font-semibold text-sm text-ink">Incident Response Stream</h3>
          <span className="text-xs text-ink-400">{alerts.length} Total Records</span>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="w-6 h-6 text-ink animate-spin" />
          </div>
        ) : alerts.length === 0 ? (
          <div className="py-16 text-center text-ink-400 text-sm">
            No safety incidents or emergency logs recorded.
          </div>
        ) : (
          <div className="divide-y divide-line">
            {alerts.map((alertItem) => {
              const isEmergency = alertItem.alert_type === 'emergency';
              const isResolved = alertItem.status === 'resolved';

              return (
                <div
                  key={alertItem.id}
                  className={`p-5 transition-colors flex flex-col md:flex-row md:items-center justify-between gap-4 ${
                    isEmergency && !isResolved ? 'bg-red-500/5' : 'hover:bg-paper-200/30'
                  }`}
                >
                  <div className="flex items-start gap-4">
                    <div
                      className={`p-3 rounded-full flex-shrink-0 mt-1 ${
                        isEmergency
                          ? 'bg-red-600 text-white'
                          : alertItem.alert_type === 'location_checkin'
                          ? 'bg-amber-500 text-white'
                          : 'bg-blue-600 text-white'
                      }`}
                    >
                      {isEmergency ? (
                        <PhoneCall className="w-5 h-5 animate-pulse" />
                      ) : alertItem.alert_type === 'location_checkin' ? (
                        <MapPin className="w-5 h-5" />
                      ) : (
                        <AlertTriangle className="w-5 h-5" />
                      )}
                    </div>

                    <div className="space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span
                          className={`px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider rounded ${
                            isEmergency
                              ? 'bg-red-600 text-white'
                              : alertItem.alert_type === 'location_checkin'
                              ? 'bg-amber-500/20 text-amber-900 border border-amber-500/30'
                              : 'bg-blue-500/20 text-blue-900'
                          }`}
                        >
                          {alertItem.alert_type.replace('_', ' ')}
                        </span>

                        <span
                          className={`px-2 py-0.5 text-[10px] font-semibold uppercase rounded ${
                            alertItem.status === 'open'
                              ? 'bg-red-100 text-red-800'
                              : alertItem.status === 'investigating'
                              ? 'bg-amber-100 text-amber-800'
                              : 'bg-green-100 text-green-800'
                          }`}
                        >
                          {alertItem.status}
                        </span>

                        <span className="text-xs text-ink-300 flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {new Date(alertItem.created_at).toLocaleString('en-US', {
                            month: 'short',
                            day: 'numeric',
                            hour: 'numeric',
                            minute: '2-digit',
                          })}
                        </span>
                      </div>

                      <h4 className="font-semibold text-sm text-ink">
                        {alertItem.details?.subject || 'Safety Incident Notification'}
                      </h4>

                      <p className="text-xs text-ink-400">
                        Triggered by:{' '}
                        <span className="font-medium text-ink">
                          {alertItem.user?.full_name || alertItem.details?.user_name || 'Platform User'}
                        </span>{' '}
                        ({alertItem.user?.email || alertItem.details?.user_email || 'No email'})
                      </p>

                      {alertItem.conversation_id && (
                        <a
                          href={`/inbox?conv=${alertItem.conversation_id}`}
                          className="inline-flex items-center gap-1 text-xs text-accent hover:underline mt-1 font-medium"
                        >
                          View Related Conversation <ExternalLink className="w-3 h-3" />
                        </a>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 self-end md:self-center">
                    {alertItem.status !== 'investigating' && alertItem.status !== 'resolved' && (
                      <button
                        onClick={() => handleUpdateStatus(alertItem.id, 'investigating')}
                        disabled={updatingId === alertItem.id}
                        className="px-3 py-1.5 text-xs font-semibold bg-amber-500/10 hover:bg-amber-500/20 text-amber-900 border border-amber-500/30 rounded transition-colors disabled:opacity-50"
                      >
                        Mark Investigating
                      </button>
                    )}

                    {alertItem.status !== 'resolved' && (
                      <button
                        onClick={() => handleUpdateStatus(alertItem.id, 'resolved')}
                        disabled={updatingId === alertItem.id}
                        className="px-3 py-1.5 text-xs font-semibold bg-green-600 hover:bg-green-700 text-white rounded transition-colors disabled:opacity-50"
                      >
                        Resolve Incident
                      </button>
                    )}

                    {alertItem.status === 'resolved' && (
                      <span className="inline-flex items-center gap-1 text-xs text-green-600 font-semibold px-3 py-1.5 bg-green-500/10 rounded">
                        <CheckCircle className="w-3.5 h-3.5" /> Case Closed
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { Loader2, CheckCircle, XCircle, ShieldAlert, FileText, ExternalLink } from 'lucide-react';

interface PendingHost {
  id: string;
  user_id?: string;
  full_legal_name: string | null;
  id_document_url: string | null;
  id_type: string | null;
  is_identity_verified: boolean;
  verification_status: 'pending' | 'approved' | 'rejected' | null;
  profiles?: {
    full_name: string;
    email: string;
  } | null;
}

export default function AdminVerification() {
  const [hosts, setHosts] = useState<PendingHost[]>([]);
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState<string | null>(null);

  const fetchSubmissions = useCallback(async () => {
    setLoading(true);
    try {
      // 1. Fetch host profiles that are pending review or not explicitly approved
      let { data, error } = await supabase
        .from('host_profiles')
        .select(`
          *,
          profiles:user_id(full_name, email)
        `)
        .or('verification_status.eq.pending,verification_status.is.null')
        .neq('verification_status', 'approved')
        .order('updated_at', { ascending: false });

      // Fallback if foreign key alias fails or returns no relational data
      if (error) {
        const retry = await supabase
          .from('host_profiles')
          .select('*')
          .or('verification_status.eq.pending,verification_status.is.null')
          .neq('verification_status', 'approved');

        if (!retry.error && retry.data) {
          data = retry.data;
          error = null;
        }
      }

      let rawHosts: PendingHost[] = (data as unknown as PendingHost[]) || [];

      // 2. Hydrate missing profile details manually if needed
      if (rawHosts.length > 0) {
        const userIds = Array.from(
          new Set(rawHosts.map((h) => h.user_id || h.id).filter(Boolean))
        );

        if (userIds.length > 0) {
          const { data: userProfiles } = await supabase
            .from('profiles')
            .select('id, full_name, email')
            .in('id', userIds);

          const profileMap = new Map((userProfiles || []).map((p) => [p.id, p]));

          rawHosts = rawHosts.map((h) => ({
            ...h,
            profiles: h.profiles || profileMap.get(h.user_id || h.id) || null,
          }));
        }
      }

      // Filter to show records with submitted document URLs OR pending status
      const validSubmissions = rawHosts.filter(
        (host) =>
          host.id_document_url ||
          host.verification_status === 'pending' ||
          host.full_legal_name
      );

      setHosts(validSubmissions);
    } catch (err) {
      console.error('Error fetching verification submissions:', err);
      setHosts([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSubmissions();
  }, [fetchSubmissions]);

  const handleReview = async (hostId: string, approve: boolean) => {
    setProcessingId(hostId);

    const updates = {
      is_identity_verified: approve,
      verification_status: approve ? 'approved' : 'rejected',
      updated_at: new Date().toISOString(),
    };

    const { error } = await supabase
      .from('host_profiles')
      .update(updates)
      .eq('id', hostId);

    if (!error) {
      fetchSubmissions();
    } else {
      console.error('Error updating verification status:', error);
    }
    setProcessingId(null);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-paper flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-ink" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-paper py-12 px-6 lg:px-12">
      <div className="max-w-5xl mx-auto space-y-8">
        <div>
          <p className="text-xs uppercase tracking-wide-sm text-ink-400 mb-2">— Admin Control</p>
          <h1 className="font-display text-3xl font-bold text-ink">Host Verification Requests</h1>
          <p className="text-xs text-ink-500 mt-1">Review identity documents and verify host accounts.</p>
        </div>

        {hosts.length === 0 ? (
          <div className="border border-line p-12 text-center bg-paper">
            <ShieldAlert className="w-8 h-8 text-ink-400 mx-auto mb-3" />
            <h3 className="font-display font-semibold text-ink">No Submissions Found</h3>
            <p className="text-xs text-ink-500 mt-1">There are currently no host identity verification requests to review.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {hosts.map((host) => (
              <div key={host.id} className="border border-line p-6 bg-paper flex flex-col md:flex-row md:items-center justify-between gap-6">

                {/* Host Info */}
                <div className="space-y-2">
                  <div className="flex items-center gap-3">
                    <h3 className="font-display text-lg font-bold text-ink">
                      {host.full_legal_name || host.profiles?.full_name || 'Unnamed Host'}
                    </h3>

                    {/* Verification Status Pill */}
                    <span className={`text-[10px] font-semibold uppercase px-2 py-0.5 tracking-wider border ${
                      host.verification_status === 'approved'
                        ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                        : host.verification_status === 'rejected'
                        ? 'bg-red-50 text-red-800 border-red-200'
                        : 'bg-amber-50 text-amber-800 border-amber-200'
                    }`}>
                      {host.verification_status || 'Pending'}
                    </span>
                  </div>

                  <p className="text-xs text-ink-500">Email: {host.profiles?.email || 'N/A'}</p>
                  {host.id_type && <p className="text-xs text-ink-400">ID Type: <span className="capitalize">{host.id_type}</span></p>}
                </div>

                {/* Actions & Document Link */}
                <div className="flex flex-wrap items-center gap-3 border-t md:border-t-0 pt-4 md:pt-0 border-line">
                  {host.id_document_url ? (
                    <a
                      href={host.id_document_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="btn-outline inline-flex items-center gap-1.5 px-4 py-2 text-xs uppercase tracking-wide-sm"
                    >
                      <FileText className="w-3.5 h-3.5" /> View ID Document <ExternalLink className="w-3 h-3 ml-1" />
                    </a>
                  ) : (
                    <span className="text-xs text-ink-400 italic">No document attached</span>
                  )}

                  {/* Action Buttons */}
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleReview(host.id, true)}
                      disabled={processingId === host.id || host.verification_status === 'approved'}
                      className="btn-primary inline-flex items-center gap-1 px-4 py-2 text-xs uppercase tracking-wide-sm bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50"
                    >
                      {processingId === host.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle className="w-3.5 h-3.5" />} Approve
                    </button>

                    <button
                      onClick={() => handleReview(host.id, false)}
                      disabled={processingId === host.id || host.verification_status === 'rejected'}
                      className="btn-outline inline-flex items-center gap-1 px-4 py-2 text-xs uppercase tracking-wide-sm text-red-600 border-red-200 hover:bg-red-50 disabled:opacity-50"
                    >
                      {processingId === host.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <XCircle className="w-3.5 h-3.5" />} Reject
                    </button>
                  </div>
                </div>

              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

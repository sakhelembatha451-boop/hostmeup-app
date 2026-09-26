import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { Loader2, CheckCircle, XCircle, ShieldAlert, FileText, ExternalLink, User, Building2, MapPin, Mail, Phone, X } from 'lucide-react';

interface PendingHost {
  id: string;
  user_id?: string;
  full_legal_name: string | null;
  company_name?: string | null;
  phone_number?: string | null;
  id_document_url: string | null;
  id_type: string | null;
  is_identity_verified: boolean;
  verification_status: 'pending' | 'approved' | 'rejected' | null;
  created_at?: string;
  profiles?: {
    id?: string;
    full_name: string;
    email: string;
    avatar_url?: string | null;
    location?: string | null;
  } | null;
}

export default function AdminVerification() {
  const [hosts, setHosts] = useState<PendingHost[]>([]);
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [selectedHost, setSelectedHost] = useState<PendingHost | null>(null);

  const fetchSubmissions = useCallback(async () => {
    setLoading(true);
    try {
      let { data, error } = await supabase
        .from('host_profiles')
        .select(`
          *,
          profiles:user_id(id, full_name, email, avatar_url, location)
        `)
        .or('verification_status.eq.pending,verification_status.is.null')
        .neq('verification_status', 'approved')
        .order('updated_at', { ascending: false });

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

      if (rawHosts.length > 0) {
        const userIds = Array.from(
          new Set(rawHosts.map((h) => h.user_id || h.id).filter(Boolean))
        );

        if (userIds.length > 0) {
          const { data: userProfiles } = await supabase
            .from('profiles')
            .select('id, full_name, email, avatar_url, location')
            .in('id', userIds);

          const profileMap = new Map((userProfiles || []).map((p) => [p.id, p]));

          rawHosts = rawHosts.map((h) => ({
            ...h,
            profiles: h.profiles || profileMap.get(h.user_id || h.id) || null,
          }));
        }
      }

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
      if (selectedHost?.id === hostId) {
        setSelectedHost(null);
      }
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
              <div key={host.id} className="border border-line p-6 bg-paper flex flex-col md:flex-row md:items-center justify-between gap-6 hover:border-ink/20 transition-all">

                {/* Host Brief Details */}
                <div className="space-y-2">
                  <div className="flex items-center gap-3">
                    <h3 className="font-display text-lg font-bold text-ink">
                      {host.full_legal_name || host.profiles?.full_name || 'Unnamed Host'}
                    </h3>

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
                </div>

                {/* Actions & Inspection Buttons */}
                <div className="flex flex-wrap items-center gap-3 border-t md:border-t-0 pt-4 md:pt-0 border-line">
                  
                  {/* View Full Host Profile Button */}
                  <button
                    onClick={() => setSelectedHost(host)}
                    className="btn-outline inline-flex items-center gap-1.5 px-4 py-2 text-xs uppercase tracking-wide-sm"
                  >
                    <User className="w-3.5 h-3.5" /> View Full Profile
                  </button>

                  {/* View ID Document Link */}
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

                  {/* Decision Buttons */}
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

      {/* FULL HOST PROFILE MODAL */}
      {selectedHost && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fade-in">
          <div className="bg-paper border border-line max-w-lg w-full p-6 space-y-6 shadow-xl relative max-h-[90vh] overflow-y-auto">
            
            <div className="flex items-center justify-between border-b border-line pb-4">
              <h2 className="font-display text-xl font-bold text-ink">Host Details</h2>
              <button 
                onClick={() => setSelectedHost(null)}
                className="p-1 hover:bg-paper-200 rounded text-ink-400 hover:text-ink"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4 text-xs">
              
              {/* Profile Avatar & Primary Name */}
              <div className="flex items-center gap-4 border-b border-line pb-4">
                {selectedHost.profiles?.avatar_url ? (
                  <img 
                    src={selectedHost.profiles.avatar_url} 
                    alt="Host Avatar" 
                    className="w-16 h-16 rounded-full object-cover border border-line" 
                  />
                ) : (
                  <div className="w-16 h-16 rounded-full bg-ink-200 flex items-center justify-center text-ink-500 font-display font-bold text-xl">
                    {(selectedHost.profiles?.full_name || selectedHost.full_legal_name || 'H')[0]?.toUpperCase()}
                  </div>
                )}
                <div>
                  <p className="font-display text-lg font-bold text-ink">
                    {selectedHost.profiles?.full_name || 'N/A'}
                  </p>
                  <p className="text-ink-400">
                    Legal Name: {selectedHost.full_legal_name || 'Not provided'}
                  </p>
                </div>
              </div>

              {/* Information Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <p className="text-ink-400 uppercase tracking-wide-sm text-[10px] font-semibold">Email Address</p>
                  <p className="text-ink font-medium flex items-center gap-1.5">
                    <Mail className="w-3.5 h-3.5 text-ink-300" />
                    {selectedHost.profiles?.email || 'N/A'}
                  </p>
                </div>

                <div className="space-y-1">
                  <p className="text-ink-400 uppercase tracking-wide-sm text-[10px] font-semibold">Company / Organization</p>
                  <p className="text-ink font-medium flex items-center gap-1.5">
                    <Building2 className="w-3.5 h-3.5 text-ink-300" />
                    {selectedHost.company_name || 'Individual Host'}
                  </p>
                </div>

                <div className="space-y-1">
                  <p className="text-ink-400 uppercase tracking-wide-sm text-[10px] font-semibold">Location</p>
                  <p className="text-ink font-medium flex items-center gap-1.5">
                    <MapPin className="w-3.5 h-3.5 text-ink-300" />
                    {selectedHost.profiles?.location || 'Not provided'}
                  </p>
                </div>

                <div className="space-y-1">
                  <p className="text-ink-400 uppercase tracking-wide-sm text-[10px] font-semibold">Phone Number</p>
                  <p className="text-ink font-medium flex items-center gap-1.5">
                    <Phone className="w-3.5 h-3.5 text-ink-300" />
                    {selectedHost.phone_number || 'N/A'}
                  </p>
                </div>

                <div className="space-y-1">
                  <p className="text-ink-400 uppercase tracking-wide-sm text-[10px] font-semibold">Submitted Document Type</p>
                  <p className="text-ink font-medium capitalize">
                    {selectedHost.id_type || 'ID Card / Passport'}
                  </p>
                </div>

                <div className="space-y-1">
                  <p className="text-ink-400 uppercase tracking-wide-sm text-[10px] font-semibold">Verification Status</p>
                  <span className="capitalize font-semibold text-accent">
                    {selectedHost.verification_status || 'Pending Review'}
                  </span>
                </div>
              </div>

              {/* ID Document Link inside Modal */}
              <div className="pt-4 border-t border-line">
                <p className="text-ink-400 uppercase tracking-wide-sm text-[10px] font-semibold mb-2">Attached Verification File</p>
                {selectedHost.id_document_url ? (
                  <a
                    href={selectedHost.id_document_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn-outline w-full flex items-center justify-center gap-2 py-2.5 text-xs uppercase tracking-wide-sm"
                  >
                    <FileText className="w-4 h-4" /> Open Document in New Tab <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                ) : (
                  <p className="text-ink-400 italic">No document file uploaded.</p>
                )}
              </div>

            </div>

            {/* Decision Controls inside Modal */}
            <div className="flex items-center justify-end gap-3 pt-4 border-t border-line">
              <button
                onClick={() => handleReview(selectedHost.id, false)}
                disabled={processingId === selectedHost.id}
                className="btn-outline px-4 py-2 text-xs uppercase text-red-600 border-red-200 hover:bg-red-50"
              >
                Reject Host
              </button>
              <button
                onClick={() => handleReview(selectedHost.id, true)}
                disabled={processingId === selectedHost.id}
                className="btn-primary px-4 py-2 text-xs uppercase bg-emerald-600 hover:bg-emerald-700"
              >
                Approve Host
              </button>
            </div>

          </div>
        </div>
      )}
    </div>
  );
}

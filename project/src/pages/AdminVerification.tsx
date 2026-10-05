import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { Loader2, CheckCircle, XCircle, ShieldAlert, FileText, ExternalLink, User, Mail, X } from 'lucide-react';

interface VerificationSubmission {
  id: string;
  user_id: string;
  full_name: string | null;
  email: string | null;
  avatar_url?: string | null;
  id_type: string | null;
  id_number?: string | null;
  document_url: string | null;
  selfie_url?: string | null;
  verification_status: 'pending' | 'approved' | 'rejected' | null;
  updated_at?: string;
  source: 'profiles' | 'host_profiles';
}

export default function AdminVerification() {
  const [submissions, setSubmissions] = useState<VerificationSubmission[]>([]);
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [selectedSub, setSelectedSub] = useState<VerificationSubmission | null>(null);

  // Helper function to reliably fetch storage links for files
  const openStorageFile = async (path: string | null) => {
    if (!path) return;
    if (path.startsWith('http://') || path.startsWith('https://')) {
      window.open(path, '_blank');
      return;
    }

    // Strip bucket prefix if accidentally prepended
    const cleanPath = path.replace(/^verification-docs\//, '');

    // 1. Try public URL first
    const { data: publicData } = supabase.storage.from('verification-docs').getPublicUrl(cleanPath);
    
    // 2. Fallback to signed URL if access is restricted by policy
    const { data: signedData } = await supabase.storage.from('verification-docs').createSignedUrl(cleanPath, 3600);

    const targetUrl = signedData?.signedUrl || publicData?.publicUrl;
    if (targetUrl) {
      window.open(targetUrl, '_blank');
    } else {
      alert('Could not generate document download link.');
    }
  };

  const fetchSubmissions = useCallback(async () => {
    setLoading(true);
    try {
      // Fetch from profiles table
      const { data: profileData, error: profileErr } = await supabase
        .from('profiles')
        .select('*')
        .or('verification_status.eq.pending,verification_status.eq.rejected')
        .order('updated_at', { ascending: false });

      if (profileErr) console.error('Profiles fetch error:', profileErr);

      // Fetch from host_profiles table
      const { data: hostData, error: hostErr } = await supabase
        .from('host_profiles')
        .select('*, profiles:user_id(id, full_name, email, avatar_url)')
        .or('verification_status.eq.pending,verification_status.is.null')
        .neq('verification_status', 'approved');

      if (hostErr) console.error('Host profiles fetch error:', hostErr);

      const list: VerificationSubmission[] = [];

      (profileData || []).forEach((p: any) => {
        list.push({
          id: p.id,
          user_id: p.id,
          full_name: p.full_name || p.username || 'User',
          email: p.email || 'N/A',
          avatar_url: p.avatar_url,
          id_type: p.id_type,
          id_number: p.id_number,
          document_url: p.document_url,
          selfie_url: p.selfie_url,
          verification_status: p.verification_status || 'pending',
          updated_at: p.updated_at,
          source: 'profiles',
        });
      });

      (hostData || []).forEach((h: any) => {
        if (!list.some((existing) => existing.user_id === (h.user_id || h.id))) {
          list.push({
            id: h.id,
            user_id: h.user_id || h.id,
            full_name: h.full_legal_name || h.profiles?.full_name || 'Host',
            email: h.profiles?.email || 'N/A',
            avatar_url: h.profiles?.avatar_url,
            id_type: h.id_type,
            document_url: h.id_document_url,
            verification_status: h.verification_status || 'pending',
            updated_at: h.updated_at,
            source: 'host_profiles',
          });
        }
      });

      setSubmissions(list);
    } catch (err) {
      console.error('Error fetching verification submissions:', err);
      setSubmissions([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSubmissions();
  }, [fetchSubmissions]);

  const handleReview = async (submission: VerificationSubmission, approve: boolean) => {
    setProcessingId(submission.id);
    const newStatus = approve ? 'approved' : 'rejected';

    try {
      if (submission.source === 'profiles') {
        const { error } = await supabase
          .from('profiles')
          .update({
            verification_status: newStatus,
            is_verified: approve,
            updated_at: new Date().toISOString(),
          })
          .eq('id', submission.id);

        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('host_profiles')
          .update({
            verification_status: newStatus,
            is_identity_verified: approve,
            updated_at: new Date().toISOString(),
          })
          .eq('id', submission.id);

        if (error) throw error;
      }

      if (selectedSub?.id === submission.id) {
        setSelectedSub(null);
      }
      fetchSubmissions();
    } catch (error) {
      console.error('Error updating status:', error);
    } finally {
      setProcessingId(null);
    }
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
          <h1 className="font-display text-3xl font-bold text-ink">Identity Verification Requests</h1>
          <p className="text-xs text-ink-500 mt-1">Review identity documents and verify user & host accounts.</p>
        </div>

        {submissions.length === 0 ? (
          <div className="border border-line p-12 text-center bg-paper">
            <ShieldAlert className="w-8 h-8 text-ink-400 mx-auto mb-3" />
            <h3 className="font-display font-semibold text-ink">No Submissions Found</h3>
            <p className="text-xs text-ink-500 mt-1">There are currently no pending identity verification requests to review.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {submissions.map((sub) => (
              <div key={sub.id} className="border border-line p-6 bg-paper flex flex-col md:flex-row md:items-center justify-between gap-6 hover:border-ink/20 transition-all">
                <div className="space-y-2">
                  <div className="flex items-center gap-3">
                    <h3 className="font-display text-lg font-bold text-ink">{sub.full_name}</h3>
                    <span className={`text-[10px] font-semibold uppercase px-2 py-0.5 tracking-wider border ${
                      sub.verification_status === 'approved'
                        ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                        : sub.verification_status === 'rejected'
                        ? 'bg-red-50 text-red-800 border-red-200'
                        : 'bg-amber-50 text-amber-800 border-amber-200'
                    }`}>
                      {sub.verification_status || 'Pending'}
                    </span>
                  </div>
                  <p className="text-xs text-ink-500">Email: {sub.email}</p>
                  {sub.id_number && (
                    <p className="text-xs text-ink-400">
                      ID/Passport No: <span className="font-mono text-ink">{sub.id_number}</span>
                    </p>
                  )}
                </div>

                <div className="flex flex-wrap items-center gap-3 border-t md:border-t-0 pt-4 md:pt-0 border-line">
                  <button
                    onClick={() => setSelectedSub(sub)}
                    className="btn-outline inline-flex items-center gap-1.5 px-4 py-2 text-xs uppercase tracking-wide-sm"
                  >
                    <User className="w-3.5 h-3.5" /> View Details
                  </button>

                  {sub.document_url ? (
                    <button
                      onClick={() => openStorageFile(sub.document_url)}
                      className="btn-outline inline-flex items-center gap-1.5 px-4 py-2 text-xs uppercase tracking-wide-sm"
                    >
                      <FileText className="w-3.5 h-3.5" /> ID Doc <ExternalLink className="w-3 h-3 ml-1" />
                    </button>
                  ) : (
                    <span className="text-xs text-ink-400 italic">No ID Doc</span>
                  )}

                  {sub.selfie_url && (
                    <button
                      onClick={() => openStorageFile(sub.selfie_url)}
                      className="btn-outline inline-flex items-center gap-1.5 px-4 py-2 text-xs uppercase tracking-wide-sm"
                    >
                      <FileText className="w-3.5 h-3.5" /> Selfie <ExternalLink className="w-3 h-3 ml-1" />
                    </button>
                  )}

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleReview(sub, true)}
                      disabled={processingId === sub.id || sub.verification_status === 'approved'}
                      className="btn-primary inline-flex items-center gap-1 px-4 py-2 text-xs uppercase tracking-wide-sm bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50"
                    >
                      {processingId === sub.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle className="w-3.5 h-3.5" />} Approve
                    </button>

                    <button
                      onClick={() => handleReview(sub, false)}
                      disabled={processingId === sub.id || sub.verification_status === 'rejected'}
                      className="btn-outline inline-flex items-center gap-1 px-4 py-2 text-xs uppercase tracking-wide-sm text-red-600 border-red-200 hover:bg-red-50 disabled:opacity-50"
                    >
                      {processingId === sub.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <XCircle className="w-3.5 h-3.5" />} Reject
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {selectedSub && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fade-in">
          <div className="bg-paper border border-line max-w-lg w-full p-6 space-y-6 shadow-xl relative max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-line pb-4">
              <h2 className="font-display text-xl font-bold text-ink">Verification Details</h2>
              <button 
                onClick={() => setSelectedSub(null)}
                className="p-1 hover:bg-paper-200 rounded text-ink-400 hover:text-ink"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4 text-xs">
              <div className="flex items-center gap-4 border-b border-line pb-4">
                {selectedSub.avatar_url ? (
                  <img 
                    src={selectedSub.avatar_url} 
                    alt="User Avatar" 
                    className="w-16 h-16 rounded-full object-cover border border-line" 
                  />
                ) : (
                  <div className="w-16 h-16 rounded-full bg-ink-200 flex items-center justify-center text-ink-500 font-display font-bold text-xl">
                    {(selectedSub.full_name || 'U')[0]?.toUpperCase()}
                  </div>
                )}
                <div>
                  <p className="font-display text-lg font-bold text-ink">{selectedSub.full_name}</p>
                  <p className="text-ink-400">{selectedSub.email}</p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <p className="text-ink-400 uppercase tracking-wide-sm text-[10px] font-semibold">Email Address</p>
                  <p className="text-ink font-medium flex items-center gap-1.5">
                    <Mail className="w-3.5 h-3.5 text-ink-300" /> {selectedSub.email}
                  </p>
                </div>

                <div className="space-y-1">
                  <p className="text-ink-400 uppercase tracking-wide-sm text-[10px] font-semibold">Document Type</p>
                  <p className="text-ink font-medium uppercase">{selectedSub.id_type || 'N/A'}</p>
                </div>

                {selectedSub.id_number && (
                  <div className="space-y-1">
                    <p className="text-ink-400 uppercase tracking-wide-sm text-[10px] font-semibold">ID / Passport Number</p>
                    <p className="text-ink font-mono font-medium">{selectedSub.id_number}</p>
                  </div>
                )}

                <div className="space-y-1">
                  <p className="text-ink-400 uppercase tracking-wide-sm text-[10px] font-semibold">Current Status</p>
                  <p className="capitalize font-semibold text-amber-600">{selectedSub.verification_status || 'Pending'}</p>
                </div>
              </div>

              <div className="pt-4 border-t border-line space-y-2">
                <p className="text-ink-400 uppercase tracking-wide-sm text-[10px] font-semibold">Submitted Files</p>
                
                {selectedSub.document_url && (
                  <button
                    onClick={() => openStorageFile(selectedSub.document_url)}
                    className="btn-outline w-full flex items-center justify-center gap-2 py-2 text-xs uppercase tracking-wide-sm"
                  >
                    <FileText className="w-4 h-4" /> Open ID Document <ExternalLink className="w-3.5 h-3.5" />
                  </button>
                )}

                {selectedSub.selfie_url && (
                  <button
                    onClick={() => openStorageFile(selectedSub.selfie_url)}
                    className="btn-outline w-full flex items-center justify-center gap-2 py-2 text-xs uppercase tracking-wide-sm"
                  >
                    <FileText className="w-4 h-4" /> Open Holding Selfie <ExternalLink className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-4 border-t border-line">
              <button
                onClick={() => handleReview(selectedSub, false)}
                disabled={processingId === selectedSub.id}
                className="btn-outline px-4 py-2 text-xs uppercase text-red-600 border-red-200 hover:bg-red-50"
              >
                Reject Submission
              </button>
              <button
                onClick={() => handleReview(selectedSub, true)}
                disabled={processingId === selectedSub.id}
                className="btn-primary px-4 py-2 text-xs uppercase bg-emerald-600 hover:bg-emerald-700"
              >
                Approve Submission
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

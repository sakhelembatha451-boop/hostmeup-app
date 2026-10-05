import React, { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { ShieldCheck, Upload, Loader2, FileText, CheckCircle2, AlertCircle } from 'lucide-react';

export const VerificationForm: React.FC = () => {
  const { profile, refreshProfile } = useAuth();
  const [idType, setIdType] = useState<'national_id' | 'passport' | 'visa'>('national_id');
  const [idNumber, setIdNumber] = useState('');
  const [docFile, setDocFile] = useState<File | null>(null);
  const [selfieFile, setSelfieFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  if (profile?.verification_status === 'approved') {
    return (
      <div className="p-6 border border-emerald-300 bg-emerald-50 text-emerald-900 flex items-center gap-3">
        <CheckCircle2 className="w-6 h-6 text-emerald-600 flex-shrink-0" />
        <div>
          <h4 className="font-semibold text-sm uppercase tracking-wide">Account Verified</h4>
          <p className="text-xs">Your identity document has been verified by the HostMeUp team.</p>
        </div>
      </div>
    );
  }

  if (profile?.verification_status === 'pending') {
    return (
      <div className="p-6 border border-amber-300 bg-amber-50 text-amber-900 flex items-center gap-3">
        <Loader2 className="w-6 h-6 text-amber-600 animate-spin flex-shrink-0" />
        <div>
          <h4 className="font-semibold text-sm uppercase tracking-wide">Verification Under Review</h4>
          <p className="text-xs">Your documents are currently being reviewed by our admin team.</p>
        </div>
      </div>
    );
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile || !docFile || !selfieFile || !idNumber.trim()) {
      setErrorMsg('Please enter your ID/Passport number and attach both files.');
      return;
    }

    setSubmitting(true);
    setErrorMsg('');

    try {
      // Structure file paths inside verification-docs/[user_id]/
      const docPath = `${profile.id}/id_doc_${Date.now()}_${docFile.name}`;
      const { error: docErr } = await supabase.storage
        .from('verification-docs')
        .upload(docPath, docFile, { upsert: true });

      if (docErr) throw docErr;

      const selfiePath = `${profile.id}/selfie_${Date.now()}_${selfieFile.name}`;
      const { error: selfieErr } = await supabase.storage
        .from('verification-docs')
        .upload(selfiePath, selfieFile, { upsert: true });

      if (selfieErr) throw selfieErr;

      // Update user details in the profiles table
      const { error: updateErr } = await supabase
        .from('profiles')
        .update({
          id_type: idType,
          id_number: idNumber.trim(),
          document_url: docPath,
          selfie_url: selfiePath,
          verification_status: 'pending',
        })
        .eq('id', profile.id);

      if (updateErr) throw updateErr;

      setSuccessMsg('Your identity documents have been submitted for review.');
      if (refreshProfile) refreshProfile();
    } catch (err: any) {
      console.error('Failed to submit verification:', err);
      setErrorMsg(err.message || 'Error uploading documents. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="border border-line bg-paper p-6 max-w-2xl">
      <div className="flex items-center gap-3 mb-6 border-b border-line pb-4">
        <ShieldCheck className="w-6 h-6 text-ink" />
        <div>
          <h3 className="font-display text-lg font-bold text-ink">Identity Verification</h3>
          <p className="text-xs text-ink-400">Provide your official identity details and documents for verification.</p>
        </div>
      </div>

      {errorMsg && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 text-xs flex items-center gap-2">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {successMsg && (
        <div className="mb-4 p-3 bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs">
          {successMsg}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-xs uppercase tracking-wide-sm font-semibold text-ink-600 mb-2">
            Document Type
          </label>
          <select
            value={idType}
            onChange={(e: any) => setIdType(e.target.value)}
            className="w-full bg-paper border border-line px-4 py-2.5 text-sm text-ink focus:outline-none focus:border-ink"
          >
            <option value="national_id">National ID Card / Book</option>
            <option value="passport">Passport</option>
            <option value="visa">Passport with Visa / Work Permit</option>
          </select>
        </div>

        <div>
          <label className="block text-xs uppercase tracking-wide-sm font-semibold text-ink-600 mb-2">
            ID / Passport / Visa Number
          </label>
          <input
            type="text"
            required
            placeholder="Enter ID / Passport Number"
            value={idNumber}
            onChange={(e) => setIdNumber(e.target.value)}
            className="w-full bg-paper border border-line px-4 py-2.5 text-sm text-ink focus:outline-none focus:border-ink"
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
          <div>
            <label className="block text-xs uppercase tracking-wide-sm font-semibold text-ink-600 mb-2">
              Identity Document (PDF / Image)
            </label>
            <div className="border border-dashed border-line p-4 text-center cursor-pointer hover:bg-paper-100 transition-colors">
              <input
                type="file"
                accept="image/*,application/pdf"
                required
                onChange={(e) => setDocFile(e.target.files?.[0] || null)}
                className="hidden"
                id="doc-upload"
              />
              <label htmlFor="doc-upload" className="cursor-pointer block">
                <FileText className="w-6 h-6 mx-auto mb-1 text-ink-400" />
                <span className="text-xs text-ink font-medium">
                  {docFile ? docFile.name : 'Choose File'}
                </span>
              </label>
            </div>
          </div>

          <div>
            <label className="block text-xs uppercase tracking-wide-sm font-semibold text-ink-600 mb-2">
              Holding Document Selfie / Photo
            </label>
            <div className="border border-dashed border-line p-4 text-center cursor-pointer hover:bg-paper-100 transition-colors">
              <input
                type="file"
                accept="image/*"
                required
                onChange={(e) => setSelfieFile(e.target.files?.[0] || null)}
                className="hidden"
                id="selfie-upload"
              />
              <label htmlFor="selfie-upload" className="cursor-pointer block">
                <Upload className="w-6 h-6 mx-auto mb-1 text-ink-400" />
                <span className="text-xs text-ink font-medium">
                  {selfieFile ? selfieFile.name : 'Choose Photo'}
                </span>
              </label>
            </div>
          </div>
        </div>

        <div className="pt-4 flex justify-end">
          <button
            type="submit"
            disabled={submitting}
            className="px-6 py-3 text-xs font-semibold uppercase tracking-wide-sm bg-ink text-paper hover:bg-ink/90 disabled:opacity-50 flex items-center gap-2"
          >
            {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
            Submit Document
          </button>
        </div>
      </form>
    </div>
  );
};

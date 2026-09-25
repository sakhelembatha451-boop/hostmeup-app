import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { Shield, Upload, CheckCircle, Loader2, Building2, Clock, AlertCircle } from 'lucide-react';

export default function HostVerificationForm({ hostId }: { hostId: string }) {
  // Required Personal Identity Fields
  const [legalName, setLegalName] = useState('');
  const [idNumber, setIdNumber] = useState('');
  const [idFile, setIdFile] = useState<File | null>(null);
  const [addressFile, setAddressFile] = useState<File | null>(null);

  // Optional Business / Legal Compliance Fields
  const [isBusiness, setIsBusiness] = useState(false);
  const [companyRegNo, setCompanyRegNo] = useState('');
  const [vatNo, setVatNo] = useState('');
  const [liquorLicenseFile, setLiquorLicenseFile] = useState<File | null>(null);

  // Loading & Verification Status States
  const [loadingInitial, setLoadingInitial] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [verificationStatus, setVerificationStatus] = useState<'pending' | 'approved' | 'rejected' | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Check if host has already submitted documents on component mount
  useEffect(() => {
    const fetchVerificationStatus = async () => {
      if (!hostId) {
        setLoadingInitial(false);
        return;
      }

      try {
        const { data, error } = await supabase
          .from('host_profiles')
          .select('full_legal_name, id_number, verification_status, is_identity_verified')
          .eq('id', hostId)
          .maybeSingle();

        if (error) {
          console.error('Error fetching verification status:', error.message);
        } else if (data) {
          if (data.is_identity_verified) {
            setVerificationStatus('approved');
          } else if (data.verification_status) {
            setVerificationStatus(data.verification_status as 'pending' | 'approved' | 'rejected');
          }

          if (data.full_legal_name) setLegalName(data.full_legal_name);
          if (data.id_number) setIdNumber(data.id_number);
        }
      } catch (err: any) {
        console.error('Unexpected error fetching status:', err.message);
      } finally {
        setLoadingInitial(false);
      }
    };

    fetchVerificationStatus();
  }, [hostId]);

  const uploadDocument = async (file: File, folder: string) => {
    const fileExt = file.name.split('.').pop();
    const filePath = `${folder}/${hostId}_${Date.now()}.${fileExt}`;
    const { error } = await supabase.storage.from('verification-docs').upload(filePath, file);
    if (error) throw error;

    const { data } = supabase.storage.from('verification-docs').getPublicUrl(filePath);
    return data.publicUrl;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!idFile) {
      setErrorMessage('Please attach your personal ID document.');
      return;
    }

    try {
      setUploading(true);

      // Upload mandatory personal ID
      const idUrl = await uploadDocument(idFile, 'id_cards');

      // Upload optional proof of address
      let addressUrl = null;
      if (addressFile) {
        addressUrl = await uploadDocument(addressFile, 'proof_address');
      }

      // Upload optional liquor/event license
      let liquorLicenseUrl = null;
      if (liquorLicenseFile) {
        liquorLicenseUrl = await uploadDocument(liquorLicenseFile, 'licenses');
      }

      const { error } = await supabase
        .from('host_profiles')
        .upsert({
          id: hostId,
          full_legal_name: legalName,
          id_number: idNumber,
          id_document_url: idUrl,
          proof_of_address_url: addressUrl,
          company_registration_number: isBusiness && companyRegNo ? companyRegNo : null,
          vat_number: isBusiness && vatNo ? vatNo : null,
          liquor_license_url: liquorLicenseUrl,
          verification_status: 'pending'
        });

      if (error) throw error;
      setVerificationStatus('pending');
    } catch (err: any) {
      console.error('Upload failed:', err.message);
      setErrorMessage(err.message || 'Failed to submit verification details.');
    } finally {
      setUploading(false);
    }
  };

  if (loadingInitial) {
    return (
      <div className="p-8 border border-line bg-paper flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-ink-400" />
      </div>
    );
  }

  if (verificationStatus === 'approved') {
    return (
      <div className="p-6 bg-paper-100 border border-line text-center space-y-3">
        <CheckCircle className="w-10 h-10 text-green-600 mx-auto" />
        <h3 className="font-bold text-ink text-sm">Identity Verified</h3>
        <p className="text-xs text-ink-500">Your host profile is fully verified for talent booking safety.</p>
      </div>
    );
  }

  if (verificationStatus === 'pending') {
    return (
      <div className="p-6 bg-paper-100 border border-line text-center space-y-3">
        <Clock className="w-10 h-10 text-amber-600 mx-auto" />
        <h3 className="font-bold text-ink text-sm">Verification Pending Review</h3>
        <p className="text-xs text-ink-500">
          Your documents have been submitted successfully. Our team is currently reviewing them.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="p-6 border border-line bg-paper space-y-6">
      {/* Required Personal Verification Header */}
      <div className="space-y-4">
        <div className="flex items-center gap-2 border-b border-line pb-3">
          <Shield className="w-5 h-5 text-ink" />
          <h3 className="font-bold text-ink text-sm uppercase tracking-wide">
            Host Safety & Verification <span className="text-red-500">*</span>
          </h3>
        </div>

        {errorMessage && (
          <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 text-red-700 text-xs">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}

        <div>
          <label className="block text-[10px] uppercase font-bold text-ink-500 mb-1">
            Full Legal Name <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            required
            value={legalName}
            onChange={(e) => setLegalName(e.target.value)}
            placeholder="As shown on official ID"
            className="w-full bg-paper-100 border border-line px-3 py-2 text-xs text-ink focus:outline-none focus:border-ink"
          />
        </div>

        <div>
          <label className="block text-[10px] uppercase font-bold text-ink-500 mb-1">
            ID / Passport Number <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            required
            value={idNumber}
            onChange={(e) => setIdNumber(e.target.value)}
            placeholder="e.g. 980101XXXXXXXXX"
            className="w-full bg-paper-100 border border-line px-3 py-2 text-xs text-ink focus:outline-none focus:border-ink"
          />
        </div>

        <div>
          <label className="block text-[10px] uppercase font-bold text-ink-500 mb-1">
            Upload ID Picture (Smart Card / Passport) <span className="text-red-500">*</span>
          </label>
          <input
            type="file"
            accept="image/*,application/pdf"
            required
            onChange={(e) => setIdFile(e.target.files?.[0] || null)}
            className="text-xs text-ink file:mr-4 file:py-2 file:px-4 file:border-0 file:text-xs file:bg-ink file:text-paper hover:file:bg-ink-800 cursor-pointer"
          />
        </div>

        <div>
          <label className="block text-[10px] uppercase font-bold text-ink-500 mb-1">
            Proof of Address (Optional)
          </label>
          <input
            type="file"
            accept="image/*,application/pdf"
            onChange={(e) => setAddressFile(e.target.files?.[0] || null)}
            className="text-xs text-ink file:mr-4 file:py-2 file:px-4 file:border-0 file:text-xs file:bg-paper-200 file:border file:border-line file:text-ink hover:file:bg-paper-300 cursor-pointer"
          />
        </div>
      </div>

      {/* Optional Business / Legal Compliance Section */}
      <div className="border-t border-line pt-4 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Building2 className="w-4 h-4 text-ink-500" />
            <span className="text-xs font-bold text-ink uppercase tracking-wide">Business / Registered Entity Details</span>
          </div>
          <span className="text-[10px] uppercase bg-paper-200 text-ink-500 px-2 py-0.5 border border-line font-semibold">
            Optional
          </span>
        </div>

        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            id="isBusiness"
            checked={isBusiness}
            onChange={(e) => setIsBusiness(e.target.checked)}
            className="accent-ink cursor-pointer"
          />
          <label htmlFor="isBusiness" className="text-xs text-ink-600 cursor-pointer select-none">
            Registering as a venue business or legal entity
          </label>
        </div>

        {isBusiness && (
          <div className="space-y-3 pt-2 bg-paper-100 p-4 border border-line">
            <div>
              <label className="block text-[10px] uppercase font-bold text-ink-500 mb-1">
                Company Registration Number (CIPC)
              </label>
              <input
                type="text"
                value={companyRegNo}
                onChange={(e) => setCompanyRegNo(e.target.value)}
                placeholder="e.g. 2021/123456/07"
                className="w-full bg-paper border border-line px-3 py-2 text-xs text-ink focus:outline-none focus:border-ink"
              />
            </div>

            <div>
              <label className="block text-[10px] uppercase font-bold text-ink-500 mb-1">
                VAT Number
              </label>
              <input
                type="text"
                value={vatNo}
                onChange={(e) => setVatNo(e.target.value)}
                placeholder="e.g. 4010203040"
                className="w-full bg-paper border border-line px-3 py-2 text-xs text-ink focus:outline-none focus:border-ink"
              />
            </div>

            <div>
              <label className="block text-[10px] uppercase font-bold text-ink-500 mb-1">
                Liquor / Event Permit Document
              </label>
              <input
                type="file"
                accept="image/*,application/pdf"
                onChange={(e) => setLiquorLicenseFile(e.target.files?.[0] || null)}
                className="text-xs text-ink file:mr-4 file:py-2 file:px-4 file:border-0 file:text-xs file:bg-paper file:border file:border-line file:text-ink cursor-pointer"
              />
            </div>
          </div>
        )}
      </div>

      <button
        type="submit"
        disabled={uploading}
        className="w-full flex items-center justify-center gap-2 py-3 bg-ink text-paper text-xs uppercase font-semibold tracking-wide hover:bg-ink-800 disabled:opacity-50 transition-colors cursor-pointer"
      >
        {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
        {uploading ? 'Submitting Documents...' : 'Submit Verification'}
      </button>
    </form>
  );
}

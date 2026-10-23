import React, { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { 
  X, Loader2, Send, Upload, Trash2, FileAudio, FileVideo, Image as ImageIcon, Sparkles 
} from 'lucide-react';

interface PitchGigModalProps {
  isOpen: boolean;
  onClose: () => void;
  gigId: string;
  gigTitle: string;
  hostName?: string;
  suggestedBudget?: number;
  onSuccess?: () => void;
}

interface UploadedFile {
  name: string;
  url: string;
  path: string;
  type: string;
}

export default function PitchGigModal({
  isOpen,
  onClose,
  gigId,
  gigTitle,
  hostName,
  suggestedBudget,
  onSuccess,
}: PitchGigModalProps) {
  const [proposedRate, setProposedRate] = useState(suggestedBudget ? String(suggestedBudget) : '');
  const [availableTimeSlot, setAvailableTimeSlot] = useState('');
  const [equipmentOffered, setEquipmentOffered] = useState('');
  const [pitchMessage, setPitchMessage] = useState('');
  
  // File Upload State
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    if (uploadedFiles.length + files.length > 3) {
      alert('You can upload a maximum of 3 media files per pitch.');
      return;
    }

    setIsUploading(true);
    setError(null);

    try {
      const newUploadedFiles: UploadedFile[] = [];

      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const fileExt = file.name.split('.').pop();
        const fileName = `${Date.now()}_${Math.random().toString(36).substring(2, 9)}.${fileExt}`;
        const filePath = `pitches/${gigId}/${fileName}`;

        const { error: uploadError } = await supabase.storage
          .from('pitch-media')
          .upload(filePath, file, { cacheControl: '3600', upsert: true });

        if (uploadError) throw uploadError;

        const { data: publicUrlData } = supabase.storage
          .from('pitch-media')
          .getPublicUrl(filePath);

        newUploadedFiles.push({
          name: file.name,
          url: publicUrlData.publicUrl,
          path: filePath,
          type: file.type,
        });
      }

      setUploadedFiles((prev) => [...prev, ...newUploadedFiles]);
    } catch (err: any) {
      console.error('Error uploading file:', err);
      setError(err.message || 'Failed to upload media file.');
    } finally {
      setIsUploading(false);
      e.target.value = ''; // Reset file input
    }
  };

  const handleRemoveFile = async (index: number) => {
    const fileToRemove = uploadedFiles[index];
    if (!fileToRemove) return;

    try {
      // Remove from state immediately
      setUploadedFiles((prev) => prev.filter((_, i) => i !== index));

      // Delete from Supabase Storage
      await supabase.storage.from('pitch-media').remove([fileToRemove.path]);
    } catch (err) {
      console.error('Error removing file from storage:', err);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const { data: { user }, error: authErr } = await supabase.auth.getUser();
      if (authErr || !user) throw new Error('You must be logged in as an artist to submit a pitch.');

      const mediaUrls = uploadedFiles.map((f) => f.url);

      const pitchPayload = {
        gig_id: gigId,
        artist_id: user.id,
        proposed_rate: parseFloat(proposedRate) || 0,
        available_time_slot: availableTimeSlot.trim(),
        equipment_offered: equipmentOffered.trim() || null,
        pitch_message: pitchMessage.trim(),
        media_urls: mediaUrls,
        status: 'pending',
      };

      const { error: insertErr } = await supabase.from('gig_pitches').upsert(
        pitchPayload,
        { onConflict: 'gig_id,artist_id' }
      );

      if (insertErr) throw insertErr;

      alert('Pitch submitted successfully! The host will review your proposal.');
      if (onSuccess) onSuccess();
      onClose();
    } catch (err: any) {
      console.error('Error submitting pitch:', err);
      setError(err.message || 'Failed to submit pitch. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const renderFileIcon = (fileType: string) => {
    if (fileType.startsWith('audio/')) return <FileAudio className="w-4 h-4 text-purple-700 shrink-0" />;
    if (fileType.startsWith('video/')) return <FileVideo className="w-4 h-4 text-blue-700 shrink-0" />;
    return <ImageIcon className="w-4 h-4 text-emerald-700 shrink-0" />;
  };

  return (
    <div className="fixed inset-0 z-50 bg-ink/70 backdrop-blur-xs flex items-center justify-center p-4 animate-fade-in">
      <div className="bg-paper border border-line p-6 max-w-xl w-full relative shadow-2xl space-y-5 max-h-[90vh] overflow-y-auto">
        <button
          onClick={onClose}
          type="button"
          className="absolute top-4 right-4 text-ink-400 hover:text-ink transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        <div>
          <div className="flex items-center gap-2 text-purple-900 bg-purple-100 border border-purple-200 px-2.5 py-1 w-fit text-[10px] font-bold uppercase tracking-wider mb-2">
            <Sparkles className="w-3 h-3 text-purple-700" /> Professional Pitch Sheet
          </div>
          <h2 className="font-display text-2xl font-bold text-ink">{gigTitle}</h2>
          <p className="text-xs text-ink-500 mt-0.5">
            Submit your tailored set proposal, availability, equipment list, and media samples directly to {hostName || 'the host'}.
          </p>
        </div>

        {error && (
          <div className="p-3 bg-red-50 border border-red-200 text-red-800 text-xs">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[10px] uppercase font-bold tracking-wide-sm text-ink mb-1">
                Your Rate Quote (ZAR)
              </label>
              <input
                type="number"
                required
                min="0"
                placeholder="e.g. 2500"
                value={proposedRate}
                onChange={(e) => setProposedRate(e.target.value)}
                className="w-full bg-paper-100 border border-line p-2.5 text-xs text-ink focus:outline-none focus:border-ink font-bold text-emerald-800"
              />
            </div>

            <div>
              <label className="block text-[10px] uppercase font-bold tracking-wide-sm text-ink mb-1">
                Call-Time / Availability Slot
              </label>
              <input
                type="text"
                required
                placeholder="e.g. Available 18:00 - 22:00"
                value={availableTimeSlot}
                onChange={(e) => setAvailableTimeSlot(e.target.value)}
                className="w-full bg-paper-100 border border-line p-2.5 text-xs text-ink focus:outline-none focus:border-ink"
              />
            </div>
          </div>

          <div>
            <label className="block text-[10px] uppercase font-bold tracking-wide-sm text-ink mb-1">
              Gear & Sound Equipment You Provide
            </label>
            <input
              type="text"
              placeholder="e.g. Pioneer RX3 Controller, Wireless Mic & PA Speakers"
              value={equipmentOffered}
              onChange={(e) => setEquipmentOffered(e.target.value)}
              className="w-full bg-paper-100 border border-line p-2.5 text-xs text-ink focus:outline-none focus:border-ink"
            />
          </div>

          <div>
            <label className="block text-[10px] uppercase font-bold tracking-wide-sm text-ink mb-1">
              Set Hook & Pitch Message
            </label>
            <textarea
              rows={3}
              required
              placeholder="Pitch your style, genres, experience, and why you are the ideal fit for this event..."
              value={pitchMessage}
              onChange={(e) => setPitchMessage(e.target.value)}
              className="w-full bg-paper-100 border border-line p-2.5 text-xs text-ink focus:outline-none focus:border-ink"
            />
          </div>

          {/* Media File Upload Section */}
          <div className="space-y-2 border-t border-line pt-3">
            <label className="block text-[10px] uppercase font-bold tracking-wide-sm text-ink">
              Upload Audio / Video / Image Showcase (Max 3)
            </label>
            <p className="text-[11px] text-ink-400">
              Upload MP3 mixes, MP4 performance clips, or photos so hosts can listen/view directly.
            </p>

            <div className="relative">
              <input
                type="file"
                id="pitch-media-upload"
                accept="audio/*,video/*,image/*"
                multiple
                onChange={handleFileUpload}
                disabled={isUploading || uploadedFiles.length >= 3}
                className="hidden"
              />
              <label
                htmlFor="pitch-media-upload"
                className={`w-full py-3 px-4 border-2 border-dashed border-line bg-paper-100 flex items-center justify-center gap-2 text-xs font-semibold uppercase tracking-wide-sm cursor-pointer hover:border-ink transition-colors ${
                  isUploading || uploadedFiles.length >= 3 ? 'opacity-50 cursor-not-allowed' : ''
                }`}
              >
                {isUploading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin text-purple-700" />
                    <span>Uploading Media...</span>
                  </>
                ) : (
                  <>
                    <Upload className="w-4 h-4 text-purple-700" />
                    <span>Choose Media File(s) to Upload</span>
                  </>
                )}
              </label>
            </div>

            {/* List of Uploaded Media */}
            {uploadedFiles.length > 0 && (
              <div className="space-y-2 pt-2">
                {uploadedFiles.map((file, index) => (
                  <div key={index} className="flex items-center justify-between p-2.5 bg-paper-100 border border-line text-xs">
                    <div className="flex items-center gap-2 truncate pr-2">
                      {renderFileIcon(file.type)}
                      <span className="truncate font-medium text-ink">{file.name}</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleRemoveFile(index)}
                      className="p-1 text-red-600 hover:text-red-800 hover:bg-red-50 rounded transition-colors"
                      title="Delete media file"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-line">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 text-xs uppercase font-semibold text-ink-500 hover:text-ink"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || isUploading}
              className="px-6 py-2.5 bg-ink text-paper text-xs uppercase tracking-wide-sm font-semibold hover:bg-ink-800 disabled:opacity-50 flex items-center gap-2"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" /> Submitting...
                </>
              ) : (
                <>
                  <Send className="w-3.5 h-3.5" /> Submit Pitch Sheet
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

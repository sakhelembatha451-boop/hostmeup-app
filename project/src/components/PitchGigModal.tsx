import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { 
  X, Loader2, Send, Upload, Trash2, FileAudio, FileVideo, Image as ImageIcon, Sparkles, Calendar, Clock, MapPin, ExternalLink 
} from 'lucide-react';

interface GigDetails {
  event_date?: string;
  start_time?: string;
  duration_hours?: number;
  location?: string;
  description?: string;
}

interface PitchGigModalProps {
  isOpen: boolean;
  onClose: () => void;
  gigId: string;
  gigTitle: string;
  hostId?: string;
  hostName?: string;
  hostAvatar?: string | null;
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
  hostId,
  hostName,
  hostAvatar,
  suggestedBudget,
  onSuccess,
}: PitchGigModalProps) {
  const [gigDetails, setGigDetails] = useState<GigDetails | null>(null);
  const [proposedRate, setProposedRate] = useState(suggestedBudget ? String(suggestedBudget) : '');
  const [availableTimeSlot, setAvailableTimeSlot] = useState('');
  const [equipmentOffered, setEquipmentOffered] = useState('');
  const [pitchMessage, setPitchMessage] = useState('');
  
  // File Upload State
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [fetchingExisting, setFetchingExisting] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch Gig Schedule Details & Existing Pitch Data when Modal Opens
  useEffect(() => {
    if (!isOpen || !gigId) return;

    const loadModalData = async () => {
      setFetchingExisting(true);
      try {
        const { data: { user } } = await supabase.auth.getUser();

        // 1. Fetch gig schedule info
        const { data: gigData } = await supabase
          .from('gigs')
          .select('event_date, start_time, duration_hours, location, description')
          .eq('id', gigId)
          .maybeSingle();

        if (gigData) {
          setGigDetails(gigData);
        }

        // 2. Fetch existing pitch if any
        if (user) {
          const { data: pitch, error: pitchErr } = await supabase
            .from('gig_pitches')
            .select('*')
            .eq('gig_id', gigId)
            .eq('artist_id', user.id)
            .maybeSingle();

          if (!pitchErr && pitch) {
            if (pitch.proposed_rate) setProposedRate(String(pitch.proposed_rate));
            if (pitch.available_time_slot) setAvailableTimeSlot(pitch.available_time_slot);
            if (pitch.equipment_offered) setEquipmentOffered(pitch.equipment_offered);
            if (pitch.pitch_message) setPitchMessage(pitch.pitch_message);

            if (pitch.media_urls && Array.isArray(pitch.media_urls)) {
              const formattedExistingFiles: UploadedFile[] = pitch.media_urls.map((url: string, index: number) => {
                const urlParts = url.split('/');
                const rawFileName = urlParts[urlParts.length - 1] || `Media File ${index + 1}`;
                const decodedName = decodeURIComponent(rawFileName);

                let fileType = 'image/jpeg';
                const lower = decodedName.toLowerCase();
                if (lower.endsWith('.mp3') || lower.endsWith('.wav') || lower.endsWith('.m4a')) {
                  fileType = 'audio/mpeg';
                } else if (lower.endsWith('.mp4') || lower.endsWith('.mov') || lower.endsWith('.webm')) {
                  fileType = 'video/mp4';
                }

                return {
                  name: decodedName,
                  url: url,
                  path: url.includes('pitch-media/') ? url.split('pitch-media/')[1] : '',
                  type: fileType,
                };
              });

              setUploadedFiles(formattedExistingFiles);
            }
          }
        }
      } catch (err) {
        console.error('Failed to load modal data:', err);
      } finally {
        setFetchingExisting(false);
      }
    };

    loadModalData();
  }, [isOpen, gigId]);

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
      e.target.value = '';
    }
  };

  const handleRemoveFile = async (index: number) => {
    const fileToRemove = uploadedFiles[index];
    if (!fileToRemove) return;

    try {
      setUploadedFiles((prev) => prev.filter((_, i) => i !== index));

      if (fileToRemove.path) {
        await supabase.storage.from('pitch-media').remove([fileToRemove.path]);
      }
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
          
          {/* Host Profile Bar */}
          {hostId && (
            <div className="flex items-center justify-between mt-2 pt-2 pb-2 border-y border-line text-xs">
              <div className="flex items-center gap-2">
                {hostAvatar ? (
                  <img src={hostAvatar} alt="" className="w-7 h-7 rounded-full object-cover border border-line" />
                ) : (
                  <div className="w-7 h-7 rounded-full bg-ink text-paper flex items-center justify-center font-bold text-[10px]">
                    {hostName?.[0]?.toUpperCase() || 'H'}
                  </div>
                )}
                <span className="text-ink-600 font-medium">Posted by <strong className="text-ink">{hostName || 'Event Host'}</strong></span>
              </div>
              <Link
                to={`/hosts/${hostId}`}
                onClick={onClose}
                className="text-purple-900 font-semibold hover:underline inline-flex items-center gap-1"
              >
                <ExternalLink className="w-3.5 h-3.5" /> View Host Profile
              </Link>
            </div>
          )}
        </div>

        {fetchingExisting ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-6 h-6 text-purple-800 animate-spin" />
            <span className="text-xs text-ink-500 ml-2">Loading gig schedule & your pitch details...</span>
          </div>
        ) : (
          <>
            {/* Event Time & Schedule Info Box */}
            {gigDetails && (
              <div className="bg-purple-50/60 border border-purple-200 p-3.5 rounded-sm space-y-2 text-xs">
                <span className="font-bold uppercase tracking-wide-sm text-purple-900 block">Event Schedule & Time Slot</span>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-ink-600">
                  <div className="flex items-center gap-1.5">
                    <Calendar className="w-4 h-4 text-purple-700 shrink-0" />
                    <span>{gigDetails.event_date ? new Date(gigDetails.event_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—'}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Clock className="w-4 h-4 text-purple-700 shrink-0" />
                    <span>Start: {gigDetails.start_time || 'Flexible'}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Sparkles className="w-4 h-4 text-purple-700 shrink-0" />
                    <span>Duration: {gigDetails.duration_hours ? `${gigDetails.duration_hours} Hours` : '—'}</span>
                  </div>
                </div>
                {gigDetails.location && (
                  <div className="flex items-center gap-1.5 text-ink-500 pt-1 border-t border-purple-200/50">
                    <MapPin className="w-3.5 h-3.5 text-purple-700 shrink-0" />
                    <span className="truncate">Location: {gigDetails.location}</span>
                  </div>
                )}
              </div>
            )}

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
                      <Loader2 className="w-4 h-4 animate-spin" /> Updating...
                    </>
                  ) : (
                    <>
                      <Send className="w-3.5 h-3.5" /> Save & Update Pitch Sheet
                    </>
                  )}
                </button>
              </div>
            </form>
          </>
        )}
      </div>
    </div>
  );
}

import React, { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { X, Loader2, Send, Link as LinkIcon, Music2, Sparkles, Clock, ShieldCheck } from 'lucide-react';

interface PitchGigModalProps {
  isOpen: boolean;
  onClose: () => void;
  gigId: string;
  gigTitle: string;
  hostName?: string;
  suggestedBudget?: number;
  onSuccess?: () => void;
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
  const [mediaUrlInput, setMediaUrlInput] = useState('');
  const [mediaUrls, setMediaUrls] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleAddMediaUrl = () => {
    if (!mediaUrlInput.trim()) return;
    if (mediaUrls.length >= 3) {
      alert('You can attach up to 3 showcase media links.');
      return;
    }
    setMediaUrls([...mediaUrls, mediaUrlInput.trim()]);
    setMediaUrlInput('');
  };

  const handleRemoveMediaUrl = (index: number) => {
    setMediaUrls(mediaUrls.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const { data: { user }, error: authErr } = await supabase.auth.getUser();
      if (authErr || !user) throw new Error('You must be logged in as an artist to submit a pitch.');

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
            Submit your tailored set proposal, call-time availability, and media showcase directly to {hostName || 'the event host'}.
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

          {/* Media Links Attachment */}
          <div className="space-y-2 border-t border-line pt-3">
            <label className="block text-[10px] uppercase font-bold tracking-wide-sm text-ink">
              Attach Audio / Video Showcase Links (Max 3)
            </label>
            <p className="text-[11px] text-ink-400">
              Paste SoundCloud set links, YouTube performances, Instagram reels, or Drive mix links so hosts can listen instantly.
            </p>

            <div className="flex gap-2">
              <input
                type="url"
                placeholder="https://soundcloud.com/your-mix or YouTube link"
                value={mediaUrlInput}
                onChange={(e) => setMediaUrlInput(e.target.value)}
                className="flex-1 bg-paper-100 border border-line p-2 text-xs text-ink focus:outline-none focus:border-ink"
              />
              <button
                type="button"
                onClick={handleAddMediaUrl}
                className="px-3 py-2 bg-ink text-paper text-xs uppercase font-semibold hover:bg-ink-800"
              >
                Add Link
              </button>
            </div>

            {mediaUrls.length > 0 && (
              <div className="space-y-1.5 pt-1">
                {mediaUrls.map((url, index) => (
                  <div key={index} className="flex items-center justify-between p-2 bg-paper-100 border border-line text-xs">
                    <span className="truncate max-w-[320px] font-mono text-purple-900 flex items-center gap-1.5">
                      <Music2 className="w-3.5 h-3.5 text-purple-700 shrink-0" />
                      {url}
                    </span>
                    <button
                      type="button"
                      onClick={() => handleRemoveMediaUrl(index)}
                      className="text-red-600 hover:text-red-800 text-[11px] font-bold"
                    >
                      Remove
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
              disabled={loading}
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

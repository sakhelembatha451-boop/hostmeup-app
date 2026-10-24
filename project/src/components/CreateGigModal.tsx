import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { X, Loader2, Sparkles, Calendar, MapPin, Clock, DollarSign, Tag, FileText } from 'lucide-react';

interface CreateGigModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export default function CreateGigModal({
  isOpen,
  onClose,
  onSuccess,
}: CreateGigModalProps) {
  const { profile } = useAuth();
  const [loading, setLoading] = useState(false);

  const [title, setTitle] = useState('');
  const [category, setCategory] = useState('Live Band');
  const [location, setLocation] = useState('');
  const [eventDate, setEventDate] = useState('');
  const [startTime, setStartTime] = useState('18:00');
  const [durationHours, setDurationHours] = useState<number>(2);
  const [budget, setBudget] = useState<number | ''>('');
  const [description, setDescription] = useState('');

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile?.id) {
      alert('You must be logged in as a host to post a gig.');
      return;
    }

    if (!title || !location || !eventDate || !budget) {
      alert('Please fill in all required fields.');
      return;
    }

    setLoading(true);

    try {
      // 1. Create the new Gig
      const { data: newGig, error: gigErr } = await supabase
        .from('gigs')
        .insert({
          host_id: profile.id,
          title,
          category,
          location,
          event_date: eventDate,
          start_time: startTime,
          duration_hours: Number(durationHours),
          budget: Number(budget),
          description,
          status: 'open',
        })
        .select()
        .single();

      if (gigErr) throw gigErr;

      // 2. Broadcast Notification to relevant Talent Providers
      // Fetch all artist profiles matching the category (or all artists if category is general)
      const { data: targetArtists } = await supabase
        .from('artist_profiles')
        .select('user_id, category');

      if (targetArtists && targetArtists.length > 0) {
        // Filter artists by matching category, or notify all if none match specifically
        const matchingArtists = targetArtists.filter(
          (a) => !a.category || a.category.toLowerCase() === category.toLowerCase()
        );

        const artistUserIds = (matchingArtists.length > 0 ? matchingArtists : targetArtists).map(
          (a) => a.user_id
        );

        // Remove duplicate user IDs and exclude host
        const uniqueArtistIds = Array.from(new Set(artistUserIds)).filter(
          (id) => id !== profile.id
        );

        if (uniqueArtistIds.length > 0) {
          const notificationsToInsert = uniqueArtistIds.map((artistId) => ({
            user_id: artistId,
            title: `New Gig Posted: ${title} 🎵`,
            message: `A new ${category} gig opportunity ("${title}") was posted for R${Number(budget).toLocaleString()} in ${location}. Check the Gig Board to pitch!`,
            type: 'gig_alert',
          }));

          await supabase.from('notifications').insert(notificationsToInsert);
        }
      }

      alert('Gig posted successfully! Talent providers have been notified.');

      // Reset form
      setTitle('');
      setLocation('');
      setEventDate('');
      setBudget('');
      setDescription('');

      if (onSuccess) onSuccess();
      onClose();
    } catch (err: any) {
      console.error('Error creating gig:', err);
      alert(`Could not post gig: ${err.message || 'Check database permissions.'}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-ink/70 backdrop-blur-xs flex items-center justify-center p-4 animate-fade-in">
      <div className="bg-paper border border-line p-6 max-w-lg w-full relative shadow-2xl space-y-5 max-h-[90vh] overflow-y-auto">
        <button
          onClick={onClose}
          type="button"
          className="absolute top-4 right-4 text-ink-400 hover:text-ink transition-colors cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>

        <div>
          <div className="flex items-center gap-2 text-purple-900 bg-purple-100 border border-purple-200 px-2.5 py-1 w-fit text-[10px] font-bold uppercase tracking-wider mb-2">
            <Sparkles className="w-3 h-3 text-purple-700" /> Host Portal — Publish Opportunity
          </div>
          <h2 className="font-display text-2xl font-bold text-ink">Post a New Gig Opening</h2>
          <p className="text-xs text-ink-500 mt-0.5">
            Publish your event details to notify registered talent providers and receive pitch sheets.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          <div>
            <label className="block text-ink font-semibold uppercase tracking-wide-sm mb-1">
              Event / Gig Title <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <FileText className="w-4 h-4 text-ink-400 absolute left-3 top-2.5" />
              <input
                type="text"
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Birthday Party Performance, Club DJ Set"
                className="w-full bg-paper-100 border border-line pl-9 pr-3 py-2 text-ink font-medium focus:border-ink outline-none"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-ink font-semibold uppercase tracking-wide-sm mb-1">
                Talent Category <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <Tag className="w-4 h-4 text-ink-400 absolute left-3 top-2.5" />
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="w-full bg-paper-100 border border-line pl-9 pr-3 py-2 text-ink font-medium focus:border-ink outline-none cursor-pointer"
                >
                  <option value="Live Band">Live Band</option>
                  <option value="DJ">DJ</option>
                  <option value="MC">MC</option>
                  <option value="Singer">Singer / Vocalist</option>
                  <option value="Photographer">Photographer</option>
                  <option value="Videographer">Videographer</option>
                  <option value="Dancer">Dancer</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-ink font-semibold uppercase tracking-wide-sm mb-1">
                Budget (ZAR) <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <DollarSign className="w-4 h-4 text-ink-400 absolute left-3 top-2.5" />
                <input
                  type="number"
                  required
                  min="100"
                  value={budget}
                  onChange={(e) => setBudget(e.target.value ? Number(e.target.value) : '')}
                  placeholder="e.g. 1500"
                  className="w-full bg-paper-100 border border-line pl-9 pr-3 py-2 text-ink font-medium focus:border-ink outline-none"
                />
              </div>
            </div>
          </div>

          <div>
            <label className="block text-ink font-semibold uppercase tracking-wide-sm mb-1">
              Event Location / Venue <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <MapPin className="w-4 h-4 text-ink-400 absolute left-3 top-2.5" />
              <input
                type="text"
                required
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="e.g. Cape Town CBD, Sandton, Soweto"
                className="w-full bg-paper-100 border border-line pl-9 pr-3 py-2 text-ink font-medium focus:border-ink outline-none"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-ink font-semibold uppercase tracking-wide-sm mb-1">
                Event Date <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <Calendar className="w-4 h-4 text-ink-400 absolute left-3 top-2.5" />
                <input
                  type="date"
                  required
                  value={eventDate}
                  onChange={(e) => setEventDate(e.target.value)}
                  className="w-full bg-paper-100 border border-line pl-9 pr-2 py-2 text-ink font-medium focus:border-ink outline-none"
                />
              </div>
            </div>

            <div>
              <label className="block text-ink font-semibold uppercase tracking-wide-sm mb-1">
                Start Time
              </label>
              <div className="relative">
                <Clock className="w-4 h-4 text-ink-400 absolute left-3 top-2.5" />
                <input
                  type="time"
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                  className="w-full bg-paper-100 border border-line pl-9 pr-2 py-2 text-ink font-medium focus:border-ink outline-none"
                />
              </div>
            </div>

            <div>
              <label className="block text-ink font-semibold uppercase tracking-wide-sm mb-1">
                Duration (Hours)
              </label>
              <input
                type="number"
                min="1"
                max="24"
                value={durationHours}
                onChange={(e) => setDurationHours(Number(e.target.value))}
                className="w-full bg-paper-100 border border-line px-3 py-2 text-ink font-medium focus:border-ink outline-none"
              />
            </div>
          </div>

          <div>
            <label className="block text-ink font-semibold uppercase tracking-wide-sm mb-1">
              Gig Description & Requirements
            </label>
            <textarea
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe theme, equipment expectations, or specific sound requirements..."
              className="w-full bg-paper-100 border border-line p-3 text-ink font-medium focus:border-ink outline-none resize-none"
            />
          </div>

          <div className="pt-3 border-t border-line flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-paper-100 border border-line text-ink font-semibold uppercase tracking-wide-sm hover:border-ink cursor-pointer"
            >
              Cancel
            </button>

            <button
              type="submit"
              disabled={loading}
              className="px-5 py-2 bg-ink text-paper font-semibold uppercase tracking-wide-sm hover:bg-ink-800 transition-colors inline-flex items-center gap-2 cursor-pointer shadow-xs"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" /> Publishing...
                </>
              ) : (
                'Post Gig & Notify Talent'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

import React, { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { X, Loader2 } from 'lucide-react';

interface CreateGigModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export default function CreateGigModal({ isOpen, onClose, onSuccess }: CreateGigModalProps) {
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState('DJ');
  const [location, setLocation] = useState('');
  const [eventDate, setEventDate] = useState('');
  const [startTime, setStartTime] = useState('');
  const [durationHours, setDurationHours] = useState(2);
  const [budget, setBudget] = useState('');
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      // Get the currently authenticated user directly from Supabase session
      const { data: { user }, error: authErr } = await supabase.auth.getUser();
      
      if (authErr || !user) {
        throw new Error('You must be logged in to post a gig. Please sign in again.');
      }

      const { error: insertErr } = await supabase.from('gigs').insert([
        {
          host_id: user.id,
          title: title.trim(),
          category,
          location: location.trim(),
          event_date: eventDate,
          start_time: startTime || null,
          duration_hours: Number(durationHours) || 2,
          budget: parseFloat(budget) || 0,
          description: description.trim() || null,
          status: 'open',
        },
      ]);

      if (insertErr) throw insertErr;

      alert('Gig posted successfully!');
      onSuccess();
      onClose();
    } catch (err: any) {
      console.error('Error creating gig:', err);
      setError(err.message || 'Failed to post gig.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-ink/70 backdrop-blur-xs flex items-center justify-center p-4 animate-fade-in">
      <div className="bg-paper border border-line p-6 max-w-lg w-full relative shadow-2xl space-y-5">
        <button
          onClick={onClose}
          type="button"
          className="absolute top-4 right-4 text-ink-400 hover:text-ink transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        <div>
          <span className="text-[10px] uppercase font-bold tracking-wider text-purple-700 bg-purple-50 border border-purple-200 px-2 py-0.5 rounded-sm">
            Host Action
          </span>
          <h2 className="font-display text-2xl font-bold text-ink mt-2">Post a New Gig / Event</h2>
          <p className="text-xs text-ink-500 mt-0.5">Reach local creative talent and receive pitches directly.</p>
        </div>

        {error && (
          <div className="p-3 bg-red-50 border border-red-200 text-red-800 text-xs">{error}</div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-[10px] uppercase font-bold tracking-wide-sm text-ink mb-1">Gig Title</label>
            <input
              type="text"
              required
              placeholder="e.g. DJ Needed for Rooftop Birthday Party"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full bg-paper-100 border border-line p-2 text-xs text-ink focus:outline-none focus:border-ink"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[10px] uppercase font-bold tracking-wide-sm text-ink mb-1">Category</label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full bg-paper-100 border border-line p-2 text-xs text-ink focus:outline-none focus:border-ink"
              >
                <option value="DJ">DJ</option>
                <option value="Live Band">Live Band</option>
                <option value="MC">MC / Host</option>
                <option value="Photographer">Photographer</option>
                <option value="Videographer">Videographer</option>
                <option value="Dancer">Dancer</option>
              </select>
            </div>

            <div>
              <label className="block text-[10px] uppercase font-bold tracking-wide-sm text-ink mb-1">Budget (ZAR)</label>
              <input
                type="number"
                required
                min="0"
                placeholder="e.g. 2500"
                value={budget}
                onChange={(e) => setBudget(e.target.value)}
                className="w-full bg-paper-100 border border-line p-2 text-xs text-ink focus:outline-none focus:border-ink"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[10px] uppercase font-bold tracking-wide-sm text-ink mb-1">Event Date</label>
              <input
                type="date"
                required
                value={eventDate}
                onChange={(e) => setEventDate(e.target.value)}
                className="w-full bg-paper-100 border border-line p-2 text-xs text-ink focus:outline-none focus:border-ink"
              />
            </div>

            <div>
              <label className="block text-[10px] uppercase font-bold tracking-wide-sm text-ink mb-1">Start Time</label>
              <input
                type="time"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                className="w-full bg-paper-100 border border-line p-2 text-xs text-ink focus:outline-none focus:border-ink"
              />
            </div>
          </div>

          <div>
            <label className="block text-[10px] uppercase font-bold tracking-wide-sm text-ink mb-1">Location / City</label>
            <input
              type="text"
              required
              placeholder="e.g. Camps Bay, Cape Town"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              className="w-full bg-paper-100 border border-line p-2 text-xs text-ink focus:outline-none focus:border-ink"
            />
          </div>

          <div>
            <label className="block text-[10px] uppercase font-bold tracking-wide-sm text-ink mb-1">Event Description & Requirements</label>
            <textarea
              rows={3}
              placeholder="Describe the vibe, genre preferences, and sound equipment provided..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full bg-paper-100 border border-line p-2 text-xs text-ink focus:outline-none focus:border-ink"
            />
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs uppercase font-semibold text-ink-500 hover:text-ink"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-5 py-2.5 bg-ink text-paper text-xs uppercase tracking-wide-sm font-semibold hover:bg-ink-800 disabled:opacity-50"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : 'Publish Gig'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
